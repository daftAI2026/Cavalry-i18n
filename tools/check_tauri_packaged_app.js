#!/usr/bin/env node
/**
 * [INPUT]: 依赖 npm run tauri:build 产出的 macOS .app、renderer 资产、runtime resource 候选路径、languages 与 injector dylib
 * [OUTPUT]: 对外提供 packaged Tauri .app 资源测试与 size report，证明发布包包含 UI 入口和运行时可解析资源
 * [POS]: tools 的 Phase 6 packaged 资源守门，只在打包后执行，失败即说明不能宣称 packaged 可用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const appPath = process.env.PACKAGED_APP_PATH
  ? path.resolve(repoRoot, process.env.PACKAGED_APP_PATH)
  : path.join(repoRoot, 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Cavalry Language Switcher.app');
const bundleRoot = process.env.PACKAGED_BUNDLE_ROOT
  ? path.resolve(repoRoot, process.env.PACKAGED_BUNDLE_ROOT)
  : path.resolve(appPath, '..', '..');
const expectedArch = process.env.PACKAGED_EXPECTED_ARCH || '';
const reportPath = path.join(bundleRoot, 'cavalry-i18n-tauri-size-report.json');
const rendererRoot = path.join(repoRoot, 'renderer');
const expectedRendererHashes = {
  'index.html': sha256(path.join(rendererRoot, 'index.html')),
  'styles.css': sha256(path.join(rendererRoot, 'styles.css')),
  'app.js': sha256(path.join(rendererRoot, 'app.js')),
};

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function* walk(root) {
  if (!fs.existsSync(root)) {
    return;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function findFile(root, name) {
  return Array.from(walk(root)).find((filePath) => path.basename(filePath) === name);
}

function packagedBinary() {
  return path.join(appPath, 'Contents', 'MacOS', 'cavalry-i18n-tauri');
}

function packagedResourceDir() {
  return path.join(appPath, 'Contents', 'Resources');
}

function runtimeLanguageResourceCandidates() {
  const resources = packagedResourceDir();
  return [
    path.join(resources, 'languages'),
    path.join(resources, '_up_', 'languages'),
    path.join(resources, '..', 'languages'),
  ];
}

function findDirectory(root, name) {
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    if (!fs.existsSync(current)) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === name) {
        return fullPath;
      }
      queue.push(fullPath);
    }
  }
  return '';
}

function requirePackagedApp() {
  assert.ok(
    fs.existsSync(appPath),
    `Packaged app missing at ${appPath}. Run npm run tauri:build before this test.`
  );
}

test('tauri build contains renderer assets or embeds their Tauri routes', () => {
  requirePackagedApp();
  const missingFiles = [];
  for (const [fileName, expectedHash] of Object.entries(expectedRendererHashes)) {
    const packagedFile = findFile(appPath, fileName);
    if (!packagedFile) {
      missingFiles.push(fileName);
      continue;
    }
    assert.equal(sha256(packagedFile), expectedHash, `${fileName} hash changed in packaged app`);
  }

  if (missingFiles.length === 0) {
    return;
  }

  const binary = packagedBinary();
  assert.ok(fs.existsSync(binary), 'Tauri executable missing from packaged app');
  const binaryText = fs.readFileSync(binary, 'latin1');
  for (const token of ['index.html', '/styles.css', '/app.js']) {
    assert.ok(binaryText.includes(token), `Tauri executable should embed route token ${token}`);
  }
});

test('tauri build contains languages resource tree', () => {
  requirePackagedApp();
  const languagesDir = runtimeLanguageResourceCandidates().find((candidate) =>
    ['zh-Hans', 'zh-Hant', 'ja_JP'].every((lang) => fs.existsSync(path.join(candidate, lang)))
  );
  assert.ok(
    languagesDir,
    `languages directory missing from runtime resource candidates: ${runtimeLanguageResourceCandidates().join(', ')}`
  );
  for (const lang of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
    assert.ok(fs.existsSync(path.join(languagesDir, lang)), `${lang} missing from packaged app`);
  }
});

test('tauri build contains injector dylib resource', () => {
  requirePackagedApp();
  const injector = findFile(appPath, 'libCavalryTranslatorInjector.dylib');
  assert.ok(injector, 'libCavalryTranslatorInjector.dylib missing from packaged app');
  assert.ok(fs.statSync(injector).size > 0, 'injector dylib is empty');
});

test('tauri packaged executable matches the requested macOS architecture', { skip: process.platform !== 'darwin' || !expectedArch }, () => {
  requirePackagedApp();
  const result = spawnSync('lipo', ['-archs', packagedBinary()], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const archs = result.stdout.trim().split(/\s+/).filter(Boolean);
  assert.ok(
    archs.includes(expectedArch),
    `packaged executable should include ${expectedArch}; found ${archs.join(', ') || 'none'}`
  );
});

test('tauri build has a valid app bundle signature for quarantined downloads', { skip: process.platform !== 'darwin' }, () => {
  requirePackagedApp();
  const codeResources = path.join(appPath, 'Contents', '_CodeSignature', 'CodeResources');
  assert.ok(fs.existsSync(codeResources), 'packaged app is missing CodeResources bundle seal');

  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('tauri bundle app size report is generated from the real package', () => {
  requirePackagedApp();
  const files = Array.from(walk(appPath));
  const totalBytes = files.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  const report = {
    appPath,
    fileCount: files.length,
    totalBytes,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  assert.ok(files.length > 0, 'packaged app contains no files');
  assert.ok(totalBytes > 0, 'packaged app size is zero');
});
