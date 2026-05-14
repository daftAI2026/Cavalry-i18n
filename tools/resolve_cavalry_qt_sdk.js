#!/usr/bin/env node
/**
 * [INPUT]: 依赖 tools/cavalry_qt_target.json、可选 Cavalry.app 与 python3/aqtinstall
 * [OUTPUT]: 对外提供 Qt SDK 探测、严格版本校验、按目标版本下载 SDK 与 shell env 输出
 * [POS]: tools 的 injector SDK 解析器，被 package.json 的 prepare/build 脚本消费，消除散落 Qt 版本常量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const targetPath = path.join(__dirname, 'cavalry_qt_target.json');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    app: process.env.CAVALRY_APP_PATH || '/Applications/Cavalry.app',
    ensure: false,
    printEnv: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--app') {
      options.app = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--ensure') {
      options.ensure = true;
      continue;
    }
    if (arg === '--print-env') {
      options.printEnv = true;
    }
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPlistValue(plistPath, key) {
  if (!fs.existsSync(plistPath)) {
    return '';
  }
  const buddy = run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath]);
  if (buddy.ok && buddy.stdout.trim()) {
    return buddy.stdout.trim();
  }

  const text = fs.readFileSync(plistPath, 'utf8');
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`<key>${escaped}</key>\\s*<(?:string|integer)>([\\s\\S]*?)</(?:string|integer)>`));
  return match ? match[1].trim() : '';
}

function probeCavalry(appPath) {
  if (!appPath || !fs.existsSync(appPath)) {
    return null;
  }
  const contents = path.join(appPath, 'Contents');
  return {
    appPath,
    cavalryVersion: readPlistValue(path.join(contents, 'Info.plist'), 'CFBundleShortVersionString'),
    qtVersion: readPlistValue(
      path.join(contents, 'Frameworks', 'QtCore.framework', 'Resources', 'Info.plist'),
      'CFBundleVersion'
    ),
  };
}

function sdkPrefix(target) {
  return path.resolve(repoRoot, target.sdkPath);
}

function sdkQtVersion(prefix) {
  return readPlistValue(
    path.join(prefix, 'lib', 'QtCore.framework', 'Resources', 'Info.plist'),
    'CFBundleVersion'
  );
}

function validateTarget(target) {
  for (const key of ['cavalryVersion', 'qtVersion', 'sdkPath', 'aqt']) {
    if (!target[key]) {
      fail(`Missing ${key} in ${path.relative(repoRoot, targetPath)}.`);
    }
  }
  for (const key of ['host', 'target', 'arch', 'outputDir']) {
    if (!target.aqt[key]) {
      fail(`Missing aqt.${key} in ${path.relative(repoRoot, targetPath)}.`);
    }
  }
}

function validateCavalryProbe(target, probe) {
  if (!probe) {
    return;
  }
  if (!probe.cavalryVersion) {
    fail(`Could not read Cavalry version from ${probe.appPath}.`);
  }
  if (probe.cavalryVersion !== target.cavalryVersion) {
    fail(
      `Unsupported Cavalry version ${probe.cavalryVersion} at ${probe.appPath}. ` +
        `This release targets Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}.`
    );
  }
  if (!probe.qtVersion) {
    fail(`Could not read QtCore version from ${probe.appPath}.`);
  }
  if (probe.qtVersion !== target.qtVersion) {
    fail(
      `Unsupported Cavalry Qt ${probe.qtVersion} at ${probe.appPath}. ` +
        `This release targets Cavalry ${target.cavalryVersion} / Qt ${target.qtVersion}.`
    );
  }
}

function ensureAqt() {
  const check = run('python3', ['-m', 'aqt', '--version']);
  if (check.ok) {
    return;
  }

  const install = run('python3', ['-m', 'pip', 'install', '--user', 'aqtinstall'], {
    stdio: 'inherit',
  });
  if (!install.ok) {
    fail('aqtinstall is required to download Qt. Install it with: python3 -m pip install --user aqtinstall');
  }
}

function ensureSdk(target, prefix) {
  if (fs.existsSync(prefix)) {
    return;
  }

  ensureAqt();
  const args = [
    '-m',
    'aqt',
    'install-qt',
    target.aqt.host,
    target.aqt.target,
    target.qtVersion,
    target.aqt.arch,
    '--outputdir',
    target.aqt.outputDir,
  ];
  if (Array.isArray(target.aqt.archives) && target.aqt.archives.length > 0) {
    args.push('--archives', ...target.aqt.archives);
  }

  const result = run('python3', args, { stdio: 'inherit' });
  if (!result.ok) {
    fail(`Failed to download Qt ${target.qtVersion} SDK with aqt.`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function resolve(options) {
  const target = readJson(targetPath);
  validateTarget(target);
  validateCavalryProbe(target, probeCavalry(options.app));

  const prefix = sdkPrefix(target);
  if (options.ensure) {
    ensureSdk(target, prefix);
  }

  if (!fs.existsSync(prefix)) {
    fail(
      `Qt ${target.qtVersion} SDK missing at ${path.relative(repoRoot, prefix)}. ` +
        'Run: npm run prepare:qt-sdk'
    );
  }

  const buildQtVersion = sdkQtVersion(prefix);
  if (buildQtVersion !== target.qtVersion) {
    fail(`SDK at ${path.relative(repoRoot, prefix)} is Qt ${buildQtVersion || 'unknown'}, expected ${target.qtVersion}.`);
  }

  return { target, prefix };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { target, prefix } = resolve(options);

  if (options.printEnv) {
    process.stdout.write(`export CAVALRY_QT_PREFIX=${shellQuote(prefix)}\n`);
    process.stdout.write(`export CAVALRY_QT_VERSION=${shellQuote(target.qtVersion)}\n`);
    return;
  }

  process.stdout.write(
    JSON.stringify(
      {
        cavalryVersion: target.cavalryVersion,
        qtVersion: target.qtVersion,
        qtPrefix: prefix,
      },
      null,
      2
    )
  );
  process.stdout.write('\n');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  probeCavalry,
  resolve,
  shellQuote,
};
