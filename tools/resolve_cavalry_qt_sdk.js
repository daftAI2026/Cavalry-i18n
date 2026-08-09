#!/usr/bin/env node
/**
 * [INPUT]: 依赖 tools/cavalry_qt_target.json 的 macOS/Windows 平台投影及安装身份哈希、requirements-ci.txt 的 aqtinstall 完整 hash-lock、python_command.js 与可选 Cavalry.app
 * [OUTPUT]: 对外提供宿主感知或显式平台的 Qt SDK 探测、版本及关键安装文件 SHA-256 身份校验、项目内 hash-locked aqt bootstrap、按目标版本下载 SDK；stdout 只承载机器可解析的 shell env/JSON，bootstrap 诊断统一写 stderr
 * [POS]: tools 的跨平台 injector SDK 解析器，被 package.json 的 prepare/build 脚本与 CI 共同消费，以单一 Cavalry/Qt 版本真相派生 clang_64 与 msvc2019_64 SDK
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolvePythonCommand } = require('./python_command.js');

const repoRoot = path.resolve(__dirname, '..');
const targetPath = path.join(__dirname, 'cavalry_qt_target.json');
const requirementsPath = path.join(repoRoot, 'requirements-ci.txt');
const qtBootstrapRoot = path.join(repoRoot, 'qt_sdk', '.aqt-bootstrap');
const SUPPORTED_PLATFORMS = Object.freeze(['macos', 'windows']);
let pythonCommand = null;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    app: process.env.CAVALRY_APP_PATH || '/Applications/Cavalry.app',
    ensure: false,
    platform: process.platform === 'win32' ? 'windows' : 'macos',
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
    if (arg === '--platform') {
      options.platform = argv[index + 1] || '';
      index += 1;
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

function runDiagnostic(command, args, options = {}) {
  return run(command, args, {
    ...options,
    stdio: ['inherit', 2, 2],
  });
}

function resolvedPythonCommand() {
  if (!pythonCommand) {
    pythonCommand = resolvePythonCommand();
  }
  return pythonCommand;
}

function runPython(args, options = {}) {
  const python = resolvedPythonCommand();
  return run(python.command, [...python.args, ...args], options);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return require('node:crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Tree(rootPath) {
  const root = path.resolve(rootPath);
  const records = [];
  function visit(relativePath) {
    const current = path.join(root, relativePath);
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      const childRelative = path.posix.join(relativePath.split(path.sep).join('/'), entry.name);
      const childPath = path.join(root, childRelative);
      if (entry.isDirectory()) {
        records.push(`D\0${childRelative}\n`);
        visit(childRelative);
      } else if (entry.isFile()) {
        records.push(`F\0${childRelative}\0${sha256File(childPath)}\n`);
      } else if (entry.isSymbolicLink()) {
        records.push(`L\0${childRelative}\0${fs.readlinkSync(childPath)}\n`);
      } else {
        fail(`Unsupported special file in Qt SDK identity tree: ${path.relative(repoRoot, childPath)}.`);
      }
    }
  }
  visit('');
  return require('node:crypto').createHash('sha256').update(records.join('')).digest('hex');
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

function sdkQtVersion(prefix, platform) {
  if (platform === 'windows') {
    const qconfig = path.join(prefix, 'mkspecs', 'qconfig.pri');
    if (!fs.existsSync(qconfig)) {
      return '';
    }
    const match = fs.readFileSync(qconfig, 'utf8').match(/^QT_VERSION\s*=\s*(\S+)\s*$/m);
    return match ? match[1] : '';
  }
  return readPlistValue(
    path.join(prefix, 'lib', 'QtCore.framework', 'Resources', 'Info.plist'),
    'CFBundleVersion'
  );
}

function validateTarget(target) {
  for (const key of ['cavalryVersion', 'qtVersion', 'platforms']) {
    if (!target[key]) {
      fail(`Missing ${key} in ${path.relative(repoRoot, targetPath)}.`);
    }
  }
  for (const platform of SUPPORTED_PLATFORMS) {
    const projection = target.platforms[platform];
    if (!projection || !projection.sdkPath || !projection.aqt) {
      fail(`Missing platforms.${platform} SDK mapping in ${path.relative(repoRoot, targetPath)}.`);
    }
    for (const key of ['host', 'target', 'arch', 'outputDir']) {
      if (!projection.aqt[key]) {
        fail(`Missing platforms.${platform}.aqt.${key} in ${path.relative(repoRoot, targetPath)}.`);
      }
    }
    // macOS injector packaging is a release path: version-only checks do not prove
    // the downloaded Qt payload. Pin a small, high-value identity set from qtbase.
    if (platform === 'macos') {
      const treeSha256 = projection.aqt.identity && projection.aqt.identity.treeSha256;
      if (!/^[a-f0-9]{64}$/i.test(treeSha256 || '')) {
        fail(`Missing platforms.macos.identity.treeSha256 full-SDK hash in ${path.relative(repoRoot, targetPath)}.`);
      }
    }
  }
}

function selectPlatformTarget(target, platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    fail(
      `Unsupported Qt SDK platform "${platform}". Expected one of: ${SUPPORTED_PLATFORMS.join(', ')}.`
    );
  }
  const projection = target.platforms[platform];
  return {
    cavalryVersion: target.cavalryVersion,
    qtVersion: target.qtVersion,
    platform,
    sdkPath: projection.sdkPath,
    aqt: projection.aqt,
  };
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

function bootstrapPythonBinary() {
  return process.platform === 'win32'
    ? path.join(qtBootstrapRoot, 'Scripts', 'python.exe')
    : path.join(qtBootstrapRoot, 'bin', 'python');
}

function ensureAqt() {
  // Never trust a globally installed aqt: a clean local build must consume the same
  // complete hash-locked closure as CI. qt_sdk/ is ignored, so this bootstrap cannot
  // become a release input by accident.
  const bootstrapPython = bootstrapPythonBinary();
  if (!fs.existsSync(bootstrapPython)) {
    fs.mkdirSync(path.dirname(qtBootstrapRoot), { recursive: true });
    const basePython = resolvedPythonCommand();
    const venv = runDiagnostic(basePython.command, [...basePython.args, '-m', 'venv', qtBootstrapRoot]);
    if (!venv.ok || !fs.existsSync(bootstrapPython)) {
      fail(`Could not create the project-local Qt installer virtualenv at ${path.relative(repoRoot, qtBootstrapRoot)}.`);
    }
  }

  // --force-reinstall is deliberate: merely importing an already-present top-level
  // aqtinstall would not revalidate a drifted transitive package. Every download
  // attempt synchronizes the complete lock closure through pip's hash verifier.
  const install = runDiagnostic(
    bootstrapPython,
    [
      '-m', 'pip', 'install', '--disable-pip-version-check', '--force-reinstall',
      '--require-hashes', '--only-binary=:all:', '-r', requirementsPath,
    ]
  );
  if (!install.ok) {
    fail(`Failed to reinstall and hash-verify the aqtinstall closure from ${path.relative(repoRoot, requirementsPath)}.`);
  }
  const pipCheck = run(bootstrapPython, ['-m', 'pip', 'check']);
  if (!pipCheck.ok) fail('Project-local Qt installer dependency closure is inconsistent.');
  const verified = run(bootstrapPython, ['-c', 'import aqt; from importlib.metadata import version; assert version("aqtinstall") == "3.3.0"']);
  if (!verified.ok) {
    fail('Project-local Qt installer bootstrap did not provide aqtinstall==3.3.0.');
  }
  return { command: bootstrapPython, args: [] };
}

function validateSdkIdentity(target, prefix) {
  const expectedDigest = target.aqt && target.aqt.identity && target.aqt.identity.treeSha256;
  if (!expectedDigest) return;
  const actualDigest = sha256Tree(prefix);
  if (actualDigest !== expectedDigest) {
    fail(
      `Qt SDK full-tree identity mismatch for ${path.relative(repoRoot, prefix)}. ` +
      `Expected ${expectedDigest}, received ${actualDigest}.`
    );
  }
}

function ensureSdk(target, prefix) {
  if (fs.existsSync(prefix)) {
    return;
  }

  const aqtPython = ensureAqt();
  const args = [
    '-m', 'aqt', 'install-qt', target.aqt.host, target.aqt.target, target.qtVersion,
    target.aqt.arch, '--outputdir', target.aqt.outputDir,
  ];
  if (Array.isArray(target.aqt.archives) && target.aqt.archives.length > 0) {
    args.push('--archives', ...target.aqt.archives);
  }

  const result = runDiagnostic(aqtPython.command, [...aqtPython.args, ...args]);
  if (!result.ok) {
    fail(`Failed to download Qt ${target.qtVersion} SDK with the project-local hash-locked aqt.`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function resolve(options) {
  const config = readJson(targetPath);
  validateTarget(config);
  const target = selectPlatformTarget(config, options.platform);
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

  const buildQtVersion = sdkQtVersion(prefix, target.platform);
  if (buildQtVersion !== target.qtVersion) {
    fail(`SDK at ${path.relative(repoRoot, prefix)} is Qt ${buildQtVersion || 'unknown'}, expected ${target.qtVersion}.`);
  }
  validateSdkIdentity(target, prefix);

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
  runDiagnostic,
  sdkQtVersion,
  sha256Tree,
  validateSdkIdentity,
  selectPlatformTarget,
  shellQuote,
};
