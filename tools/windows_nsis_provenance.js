#!/usr/bin/env node
/**
 * [INPUT]: 依赖 renderer、languages、Windows Tauri/Rust/NSIS 输入、package manifests、共享 translation policy、已编译 generic/QPA 双 DLL 与显式 x64 NSIS 输出
 * [OUTPUT]: 对外提供 prepare/record/verify 三阶段 provenance；拒绝 bundle 父链重解析点，将 Windows native 源码、共享编译头与双 injector 纳入哈希，并以 canonical file identity 校验安装包路径
 * [POS]: tools 的 Windows 打包自证器；构建前只在真实工作区 bundle 根清本版本输出，构建后以源码+产物双证据拒绝额外或陈旧 EXE
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TARGET_TRIPLE = 'x86_64-pc-windows-msvc';
const SCHEMA_VERSION = 1;
const INTENT_FILE_NAME = 'cavalry-i18n-windows-nsis-build-intent.json';

function fail(message) {
  throw new Error(`Windows NSIS provenance: ${message}`);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    let position = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, position);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function assertRegularFile(filePath, role) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(`${role} does not exist: ${filePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${role} must be a regular non-symlink file: ${filePath}`);
  }
  return stat;
}

function assertDirectory(directoryPath, role) {
  let stat;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch {
    fail(`${role} does not exist: ${directoryPath}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${role} must be a directory, not a symlink: ${directoryPath}`);
  }
}

function normalizedRelative(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function readJson(filePath, role) {
  assertRegularFile(filePath, role);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${role} is not valid JSON: ${error.message}`);
  }
}

function isSafeFileName(name) {
  return name === path.basename(name) && !/[\\/\0]/.test(name);
}

function assertNoReparsePathChain(candidatePath, role) {
  let current = path.resolve(candidatePath);
  for (;;) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        fail(`${role} crosses a symbolic link or junction: ${current}`);
      }
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        throw error;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
}

function readBuildContext(repoRoot) {
  const packageJson = readJson(path.join(repoRoot, 'package.json'), 'package.json');
  const tauriConfig = readJson(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'src-tauri/tauri.conf.json');
  const version = String(packageJson.version || '');
  const productName = String(tauriConfig.productName || '');
  if (!version || !productName) {
    fail('package.json version and src-tauri/tauri.conf.json productName are required.');
  }
  const installerName = `${productName}_${version}_x64-setup.exe`;
  if (!isSafeFileName(installerName)) {
    fail(`derived installer filename is unsafe: ${installerName}`);
  }
  return { productName, version, installerName };
}

function resolveBundle(repoRoot) {
  const bundleRoot = path.resolve(
    repoRoot,
    'src-tauri',
    'target',
    TARGET_TRIPLE,
    'release',
    'bundle',
    'nsis'
  );
  const allowedPrefix = `${path.resolve(repoRoot)}${path.sep}`;
  if (!bundleRoot.startsWith(allowedPrefix)) {
    fail(`derived bundle root escaped repository: ${bundleRoot}`);
  }
  assertNoReparsePathChain(bundleRoot, 'Windows NSIS bundle root');
  return bundleRoot;
}

function sidecarPath(installerPath) {
  return `${installerPath}.provenance.json`;
}

function intentPath(bundleRoot) {
  return path.join(bundleRoot, INTENT_FILE_NAME);
}

function listBundleEntriesWithSuffix(bundleRoot, suffix, role) {
  assertDirectory(bundleRoot, 'Windows NSIS bundle directory');
  return fs.readdirSync(bundleRoot, { withFileTypes: true })
    .filter((entry) => entry.name.toLowerCase().endsWith(suffix))
    .map((entry) => {
      assertRegularFile(path.join(bundleRoot, entry.name), `${role} ${entry.name}`);
      return entry.name;
    })
    .sort();
}

function listInstallerEntries(bundleRoot) {
  return listBundleEntriesWithSuffix(bundleRoot, '.exe', 'Windows NSIS installer output');
}

function listProvenanceEntries(bundleRoot) {
  return listBundleEntriesWithSuffix(bundleRoot, '.exe.provenance.json', 'Windows NSIS provenance sidecar');
}

function collectRegularFiles(root, relativeRoot, predicate, results) {
  const absoluteRoot = path.join(root, relativeRoot);
  assertDirectory(absoluteRoot, `${relativeRoot} input directory`);
  const visit = (directory, relativeDirectory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        fail(`packaging input must not be a symlink: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        if (predicate(relativePath)) {
          const stat = assertRegularFile(absolutePath, `packaging input ${relativePath}`);
          results.push({
            path: relativePath,
            bytes: stat.size,
            sha256: sha256File(absolutePath),
          });
        }
      }
    }
  };
  visit(absoluteRoot, normalizedRelative(relativeRoot));
}

function collectExactInput(repoRoot, relativePath, results) {
  const absolutePath = path.join(repoRoot, relativePath);
  const stat = assertRegularFile(absolutePath, `packaging input ${relativePath}`);
  results.push({
    path: normalizedRelative(relativePath),
    bytes: stat.size,
    sha256: sha256File(absolutePath),
  });
}

function relativePathInsideRepo(repoRoot, absolutePath, role) {
  const relativePath = path.relative(repoRoot, absolutePath);
  if (!relativePath || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    fail(`${role} escapes repository root: ${absolutePath}`);
  }
  return normalizedRelative(relativePath);
}

function collectConfiguredPath(repoRoot, sourcePath, role, results) {
  if (typeof sourcePath !== 'string' || !sourcePath) {
    fail(`${role} is missing a source path.`);
  }
  const absolutePath = path.resolve(repoRoot, 'src-tauri', sourcePath);
  const relativePath = relativePathInsideRepo(repoRoot, absolutePath, role);
  const stat = fs.lstatSync(absolutePath, { throwIfNoEntry: false });
  if (!stat) {
    fail(`${role} source does not exist: ${absolutePath}`);
  }
  if (stat.isDirectory()) {
    collectRegularFiles(repoRoot, relativePath, () => true, results);
    return;
  }
  collectExactInput(repoRoot, relativePath, results);
}

function collectConfiguredBundleResources(repoRoot, results) {
  const tauriConfig = readJson(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'src-tauri/tauri.conf.json');
  const windowsConfig = readJson(
    path.join(repoRoot, 'src-tauri', 'tauri.windows.conf.json'),
    'src-tauri/tauri.windows.conf.json'
  );
  const frontendDist = tauriConfig.build && tauriConfig.build.frontendDist;
  collectConfiguredPath(repoRoot, frontendDist, 'Tauri frontendDist', results);
  const resources = windowsConfig.bundle && windowsConfig.bundle.resources;
  if (!resources || Array.isArray(resources) || typeof resources !== 'object') {
    fail('Windows Tauri bundle.resources must be a non-empty source-to-destination object.');
  }
  const requiredResources = {
    '../languages': 'languages',
    '../injector/windows/generic/cavalryi18n.dll': 'injector/windows/generic/cavalryi18n.dll',
    '../injector/windows/qpa/qwindows.dll': 'injector/windows/qpa/qwindows.dll',
  };
  for (const [sourcePath, destination] of Object.entries(requiredResources)) {
    if (resources[sourcePath] !== destination) {
      fail(`Windows Tauri bundle.resources is missing the required ${sourcePath} -> ${destination} mapping.`);
    }
  }
  for (const sourcePath of Object.keys(resources).sort()) {
    collectConfiguredPath(repoRoot, sourcePath, `Windows Tauri bundle resource ${sourcePath}`, results);
  }
  const installerHooks = windowsConfig.bundle
    && windowsConfig.bundle.windows
    && windowsConfig.bundle.windows.nsis
    && windowsConfig.bundle.windows.nsis.installerHooks;
  collectConfiguredPath(repoRoot, installerHooks, 'Windows NSIS installerHooks', results);
}

function collectInputFingerprint(repoRoot) {
  const files = [];
  collectConfiguredBundleResources(repoRoot, files);
  collectRegularFiles(
    repoRoot,
    path.join('injector', 'windows'),
    (relativePath) => {
      const name = path.posix.basename(relativePath);
      return name === 'CMakeLists.txt'
        || /\.(?:cpp|h|json|ps1)$/i.test(name);
    },
    files
  );
  collectExactInput(repoRoot, path.join('injector', 'cavalry_i18n_translation_policy.h'), files);
  collectExactInput(repoRoot, path.join('injector', 'generated_translations.inc'), files);
  collectRegularFiles(repoRoot, path.join('src-tauri', 'src'), () => true, files);
  collectRegularFiles(repoRoot, path.join('src-tauri', 'capabilities'), () => true, files);
  collectRegularFiles(repoRoot, path.join('src-tauri', 'icons'), () => true, files);
  for (const relativePath of [
    'package.json',
    'package-lock.json',
    path.join('src-tauri', 'Cargo.toml'),
    path.join('src-tauri', 'Cargo.lock'),
    path.join('src-tauri', 'build.rs'),
    path.join('src-tauri', 'tauri.conf.json'),
    path.join('src-tauri', 'tauri.windows.conf.json'),
  ]) {
    collectExactInput(repoRoot, relativePath, files);
  }
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const duplicate = files.find((entry, index) => index > 0 && entry.path === files[index - 1].path);
  if (duplicate) {
    fail(`input fingerprint contains duplicate path: ${duplicate.path}`);
  }
  const serialized = files.map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`).join('');
  return {
    algorithm: 'sha256',
    value: crypto.createHash('sha256').update(serialized, 'utf8').digest('hex'),
    files,
  };
}

function atomicWriteJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.unlinkSync(temporaryPath);
    throw error;
  }
}

function readIntent(bundleRoot, context) {
  const filePath = intentPath(bundleRoot);
  const intent = readJson(filePath, 'Windows NSIS build intent');
  if (
    intent.schemaVersion !== SCHEMA_VERSION ||
    intent.target !== TARGET_TRIPLE ||
    intent.productName !== context.productName ||
    intent.version !== context.version ||
    intent.installerName !== context.installerName ||
    !intent.inputFingerprint ||
    intent.inputFingerprint.algorithm !== 'sha256' ||
    typeof intent.inputFingerprint.value !== 'string'
  ) {
    fail(`Windows NSIS build intent is malformed or does not match current package metadata: ${filePath}`);
  }
  return { filePath, intent };
}

function assertExactlyExpectedInstaller(bundleRoot, context) {
  const installers = listInstallerEntries(bundleRoot);
  if (installers.length !== 1 || installers[0] !== context.installerName) {
    fail(
      `expected exactly one current Windows x64 installer (${context.installerName}) in ${bundleRoot}; found: ${installers.join(', ') || '(none)'}`
    );
  }
  const installerPath = path.join(bundleRoot, context.installerName);
  const stat = assertRegularFile(installerPath, 'Windows NSIS installer');
  return { installerPath, stat };
}

function prepare(repoRoot) {
  const context = readBuildContext(repoRoot);
  const bundleRoot = resolveBundle(repoRoot);
  fs.mkdirSync(bundleRoot, { recursive: true });
  assertNoReparsePathChain(bundleRoot, 'Windows NSIS bundle root after creation');
  assertDirectory(bundleRoot, 'Windows NSIS bundle directory');

  const expectedInstaller = path.join(bundleRoot, context.installerName);
  for (const filePath of [expectedInstaller, sidecarPath(expectedInstaller), intentPath(bundleRoot)]) {
    if (fs.existsSync(filePath)) {
      assertRegularFile(filePath, `stale controlled build output ${path.basename(filePath)}`);
      fs.unlinkSync(filePath);
    }
  }
  const remainingInstallers = listInstallerEntries(bundleRoot);
  const remainingProvenance = listProvenanceEntries(bundleRoot);
  if (remainingInstallers.length !== 0 || remainingProvenance.length !== 0) {
    fail(
      `refusing to erase non-current Windows installer output in ${bundleRoot}: ${[...remainingInstallers, ...remainingProvenance].join(', ')}. Remove it explicitly before building.`
    );
  }
  const fingerprint = collectInputFingerprint(repoRoot);
  const intent = {
    schemaVersion: SCHEMA_VERSION,
    target: TARGET_TRIPLE,
    productName: context.productName,
    version: context.version,
    installerName: context.installerName,
    inputFingerprint: fingerprint,
  };
  atomicWriteJson(intentPath(bundleRoot), intent);
  process.stdout.write(`Prepared Windows NSIS provenance for ${context.installerName}.\n`);
}

function record(repoRoot) {
  const context = readBuildContext(repoRoot);
  const bundleRoot = resolveBundle(repoRoot);
  const { filePath: currentIntentPath, intent } = readIntent(bundleRoot, context);
  const existingProvenance = listProvenanceEntries(bundleRoot);
  if (existingProvenance.length !== 0) {
    fail(`record requires an empty provenance sidecar set after prepare; found: ${existingProvenance.join(', ')}`);
  }
  const fingerprint = collectInputFingerprint(repoRoot);
  if (fingerprint.value !== intent.inputFingerprint.value) {
    fail('packaging inputs changed after provenance preparation; rebuild from a new prepare phase.');
  }
  const { installerPath, stat } = assertExactlyExpectedInstaller(bundleRoot, context);
  const provenance = {
    schemaVersion: SCHEMA_VERSION,
    target: TARGET_TRIPLE,
    productName: context.productName,
    version: context.version,
    installer: {
      fileName: context.installerName,
      bytes: stat.size,
      sha256: sha256File(installerPath),
    },
    inputFingerprint: fingerprint,
  };
  const provenancePath = sidecarPath(installerPath);
  atomicWriteJson(provenancePath, provenance);
  fs.unlinkSync(currentIntentPath);
  process.stdout.write(`Recorded Windows NSIS provenance: ${provenancePath}\n`);
}

function verify(repoRoot, requestedInstaller) {
  const context = readBuildContext(repoRoot);
  const bundleRoot = resolveBundle(repoRoot);
  const { installerPath, stat } = assertExactlyExpectedInstaller(bundleRoot, context);
  if (requestedInstaller) {
    const requestedPath = path.resolve(repoRoot, requestedInstaller);
    if (fs.realpathSync.native(requestedPath) !== fs.realpathSync.native(installerPath)) {
      fail(`requested installer is not the current generated Windows bundle output: ${requestedPath}`);
    }
  }
  if (fs.existsSync(intentPath(bundleRoot))) {
    fail('Windows NSIS build intent remains; record phase did not complete.');
  }
  const provenancePath = sidecarPath(installerPath);
  const provenanceEntries = listProvenanceEntries(bundleRoot);
  if (provenanceEntries.length !== 1 || provenanceEntries[0] !== path.basename(provenancePath)) {
    fail(
      `expected exactly one current Windows NSIS provenance sidecar (${path.basename(provenancePath)}); found: ${provenanceEntries.join(', ') || '(none)'}`
    );
  }
  const provenance = readJson(provenancePath, 'Windows NSIS provenance sidecar');
  const expectedSha256 = sha256File(installerPath);
  const fingerprint = collectInputFingerprint(repoRoot);
  if (
    provenance.schemaVersion !== SCHEMA_VERSION ||
    provenance.target !== TARGET_TRIPLE ||
    provenance.productName !== context.productName ||
    provenance.version !== context.version ||
    !provenance.installer ||
    provenance.installer.fileName !== context.installerName ||
    provenance.installer.bytes !== stat.size ||
    provenance.installer.sha256 !== expectedSha256 ||
    !provenance.inputFingerprint ||
    provenance.inputFingerprint.algorithm !== 'sha256' ||
    provenance.inputFingerprint.value !== fingerprint.value ||
    JSON.stringify(provenance.inputFingerprint.files) !== JSON.stringify(fingerprint.files)
  ) {
    fail('sidecar does not match the current installer bytes and packaging input fingerprint.');
  }
  process.stdout.write(`Verified Windows NSIS provenance for ${context.installerName}.\n`);
}

function main(argv) {
  const [command, ...rest] = argv;
  const repoRoot = path.resolve(__dirname, '..');
  if (command === '--prepare' && rest.length === 0) {
    prepare(repoRoot);
    return;
  }
  if (command === '--record' && rest.length === 0) {
    record(repoRoot);
    return;
  }
  if (command === '--verify') {
    if (rest.length > 1) {
      fail('verify accepts at most one installer path.');
    }
    verify(repoRoot, rest[0]);
    return;
  }
  fail('usage: windows_nsis_provenance.js --prepare | --record | --verify [installer-path]');
}

module.exports = {
  TARGET_TRIPLE,
  assertNoReparsePathChain,
  collectInputFingerprint,
  prepare,
  record,
  verify,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
