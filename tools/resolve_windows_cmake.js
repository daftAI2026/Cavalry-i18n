#!/usr/bin/env node
/**
 * [INPUT]: 依赖 tools/ci_action_pins.json 中官方 CMake Windows x64 archive 的固定版本、下载地址与 SHA-256，以及 Node.js 的 HTTPS/压缩包解包能力
 * [OUTPUT]: 对外提供经过摘要验证的 CMake 4.2.0/CTest 绝对路径与 Windows producer identity；拒绝低版本、floating URL、缺摘要或被篡改的 bootstrap
 * [POS]: tools 的 Windows 原生构建工具链解析器；被 injector/windows/build.ps1 与 Windows CI 消费，切断 runner 预装 CMake 与产品构建之间的隐式依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const pinPath = path.join(repoRoot, 'tools', 'ci_action_pins.json');
const cacheRoot = path.join(repoRoot, 'build', '.toolchain', 'cmake');
const MIN_CMAKE_VERSION = '4.2.0';

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readCmakePin() {
  const pins = readJson(pinPath);
  validateCmakePin(pins.cmake);
  return pins.cmake;
}

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left)?.split('.').map(Number);
  const rightParts = normalizeVersion(right)?.split('.').map(Number);
  if (!leftParts || !rightParts) fail(`Invalid CMake version comparison: ${left} / ${right}.`);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function parseCmakeVersion(output) {
  const match = String(output || '').match(/(?:^|\s)cmake\s+version\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
  return match ? normalizeVersion(match[1]) : null;
}

function validateCmakeVersion(output, minimumVersion = MIN_CMAKE_VERSION) {
  const parsed = parseCmakeVersion(output) || normalizeVersion(output);
  if (!parsed) fail('CMake --version output did not contain a semantic version.');
  if (compareVersions(parsed, minimumVersion) < 0) {
    fail(`CMake ${minimumVersion} or newer is required; received ${parsed}.`);
  }
  return parsed;
}

function validateCmakePin(pin) {
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) fail('CMake pin must be an object.');
  if (pin.platform !== 'windows-x86_64') fail('CMake pin must target windows-x86_64.');
  if (pin.version !== '4.2.0' || pin.minimumVersion !== MIN_CMAKE_VERSION) {
    fail(`CMake pin must require the exact minimum version ${MIN_CMAKE_VERSION}.`);
  }
  if (pin.archive !== `cmake-${pin.version}-windows-x86_64.zip`) {
    fail('CMake pin archive must be the official Windows x64 zip.');
  }
  const expectedUrl = `https://github.com/Kitware/CMake/releases/download/v${pin.version}/${pin.archive}`;
  if (pin.url !== expectedUrl) {
    fail(`CMake pin must use the official CMake v${pin.version} archive URL.`);
  }
  if (pin.releaseUrl !== `https://github.com/Kitware/CMake/releases/tag/v${pin.version}`) {
    fail(`CMake pin must use the official CMake v${pin.version} release page.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(pin.sha256 || '')) {
    fail('CMake pin must include a 64-character SHA-256 archive digest.');
  }
  if (pin.rootDirectory !== `cmake-${pin.version}-windows-x86_64` ||
      pin.executable !== `${pin.rootDirectory}/bin/cmake.exe` ||
      pin.ctest !== `${pin.rootDirectory}/bin/ctest.exe`) {
    fail('CMake pin must describe the official Windows x64 archive layout.');
  }
  return pin;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assertUnder(rootPath, childPath, label) {
  const root = path.resolve(rootPath);
  const child = path.resolve(childPath);
  const relative = path.relative(root, child);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`Refusing ${label} outside the controlled CMake cache.`);
  }
}

function assertNoReparsePathChain(targetPath, label) {
  let current = path.resolve(targetPath);
  while (current) {
    if (fs.existsSync(current)) {
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        fail(`Could not inspect ${label} path component ${current}: ${error.message}`);
      }
      if (stat.isSymbolicLink()) {
        fail(`Refusing ${label} through a symbolic link or junction: ${current}.`);
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function downloadToFile(url, destination, redirects = 0) {
  if (redirects > 4) return Promise.reject(new Error('CMake archive download followed too many redirects.'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'cavalry-i18n-windows-cmake-bootstrap' },
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        let next;
        try {
          next = new URL(response.headers.location, url).toString();
        } catch (error) {
          reject(new Error(`CMake archive redirect URL was invalid: ${error.message}`));
          return;
        }
        downloadToFile(next, destination, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`CMake archive download returned HTTP ${status}.`));
        return;
      }
      let output;
      try {
        output = fs.createWriteStream(destination, { flags: 'wx' });
      } catch (error) {
        response.resume();
        reject(error);
        return;
      }
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        output.destroy();
        reject(error);
      };
      response.on('error', rejectOnce);
      output.on('error', rejectOnce);
      output.on('close', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      output.on('finish', () => {
        if (settled) return;
        output.close();
      });
      response.pipe(output);
    });
    request.on('error', reject);
    request.setTimeout(120000, () => {
      request.destroy(new Error('Timed out downloading the pinned CMake archive.'));
    });
  });
}

async function ensureArchive(pin, archivePath) {
  assertUnder(cacheRoot, archivePath, 'CMake archive');
  assertNoReparsePathChain(cacheRoot, 'CMake cache');
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  if (fs.existsSync(archivePath)) {
    const existingDigest = sha256File(archivePath);
    if (existingDigest !== pin.sha256) {
      fail(`Pinned CMake archive digest mismatch. Expected ${pin.sha256}, received ${existingDigest}.`);
    }
    return;
  }

  const temporary = path.join(
    path.dirname(archivePath),
    `.${pin.archive}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.part`
  );
  try {
    await downloadToFile(pin.url, temporary);
    const downloadedDigest = sha256File(temporary);
    if (downloadedDigest !== pin.sha256) {
      fail(`Downloaded CMake archive digest mismatch. Expected ${pin.sha256}, received ${downloadedDigest}.`);
    }
    fs.renameSync(temporary, archivePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function extractArchive(archivePath, destination) {
  const tar = run(process.platform === 'win32' ? 'tar.exe' : 'tar', [
    '-xf', archivePath, '-C', destination,
  ]);
  if (tar.status === 0) return;

  if (process.platform === 'win32') {
    const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const script = `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath ${quote(archivePath)} -DestinationPath ${quote(destination)} -Force`;
    const powershell = run('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
    ]);
    if (powershell.status === 0) return;
    const detail = (powershell.stderr || tar.stderr || '').trim();
    fail(`Could not extract the pinned CMake archive: ${detail || 'archive extractor failed'}.`);
  }

  fail(`Could not extract the pinned CMake archive: ${(tar.stderr || '').trim() || 'archive extractor failed'}.`);
}

function captureVersion(executable) {
  const result = run(executable, ['--version']);
  if (result.error || result.status !== 0) {
    fail(`Could not execute pinned CMake at ${executable}.`);
  }
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  const version = validateCmakeVersion(output);
  return { output, version };
}

function verifyExecutableLayout(pin, extractionRoot) {
  const executable = path.resolve(extractionRoot, pin.executable);
  const ctest = path.resolve(extractionRoot, pin.ctest);
  assertUnder(extractionRoot, executable, 'CMake executable');
  assertUnder(extractionRoot, ctest, 'CTest executable');
  if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) {
    fail(`Pinned CMake executable is missing at ${executable}.`);
  }
  if (!fs.existsSync(ctest) || !fs.statSync(ctest).isFile()) {
    fail(`Pinned CTest executable is missing at ${ctest}.`);
  }
  return { executable, ctest };
}

function extractAndVerify(pin, archivePath, extractionRoot) {
  assertUnder(cacheRoot, extractionRoot, 'CMake extraction');
  assertNoReparsePathChain(cacheRoot, 'CMake cache');
  assertNoReparsePathChain(extractionRoot, 'CMake extraction');
  const temporaryRoot = fs.mkdtempSync(path.join(cacheRoot, `.cmake-${pin.version}-`));
  assertNoReparsePathChain(temporaryRoot, 'temporary CMake extraction');
  try {
    extractArchive(archivePath, temporaryRoot);
    const temporaryPaths = verifyExecutableLayout(pin, temporaryRoot);
    const version = captureVersion(temporaryPaths.executable);
    if (version.version !== pin.version) {
      fail(`Pinned CMake archive reported ${version.version}; expected ${pin.version}.`);
    }
    if (fs.existsSync(extractionRoot)) fs.rmSync(extractionRoot, { recursive: true, force: true });
    fs.renameSync(temporaryRoot, extractionRoot);
    return {
      executable: path.resolve(extractionRoot, pin.executable),
      ctest: path.resolve(extractionRoot, pin.ctest),
      version,
    };
  } finally {
    if (fs.existsSync(temporaryRoot)) fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { ensure: false, printJson: false, platform: 'windows' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ensure') options.ensure = true;
    else if (arg === '--print-json') options.printJson = true;
    else if (arg === '--platform') options.platform = argv[++index] || '';
    else fail(`Unknown resolve_windows_cmake.js option: ${arg}`);
  }
  if (options.platform !== 'windows') fail('Windows CMake resolver only supports --platform windows.');
  return options;
}

async function resolve(options = {}) {
  const pin = readCmakePin();
  if (process.platform !== 'win32') {
    fail('Windows CMake resolver must run on a Windows host.');
  }
  const archivePath = path.resolve(cacheRoot, 'archives', pin.archive);
  const extractionRoot = path.resolve(cacheRoot, pin.version);
  if (options.ensure) await ensureArchive(pin, archivePath);
  if (!fs.existsSync(archivePath)) {
    fail(`Pinned CMake archive is missing at ${archivePath}. Run the resolver with --ensure.`);
  }
  const archiveDigest = sha256File(archivePath);
  if (archiveDigest !== pin.sha256) {
    fail(`Pinned CMake archive digest mismatch. Expected ${pin.sha256}, received ${archiveDigest}.`);
  }

  let verified;
  if (options.ensure) {
    verified = extractAndVerify(pin, archivePath, extractionRoot);
  } else {
    const paths = verifyExecutableLayout(pin, extractionRoot);
    const version = captureVersion(paths.executable);
    if (version.version !== pin.version) {
      fail(`Installed CMake reported ${version.version}; expected pinned ${pin.version}.`);
    }
    verified = { ...paths, version };
  }

  return {
    schemaVersion: 1,
    kind: 'WindowsCMakeToolchainIdentity',
    platform: pin.platform,
    architecture: 'x86_64',
    version: verified.version.version,
    minimumVersion: pin.minimumVersion,
    executable: verified.executable,
    ctest: verified.ctest,
    archivePath,
    archiveSha256: archiveDigest,
    source: {
      repository: 'Kitware/CMake',
      releaseTag: `v${pin.version}`,
      releaseUrl: pin.releaseUrl,
      archive: pin.archive,
      url: pin.url,
      sha256: pin.sha256,
    },
    versionOutput: verified.version.output,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const identity = await resolve(options);
  if (options.printJson) process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
  else process.stdout.write(`${identity.executable}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  MIN_CMAKE_VERSION,
  compareVersions,
  normalizeVersion,
  parseCmakeVersion,
  readCmakePin,
  resolve,
  validateCmakePin,
  validateCmakeVersion,
};
