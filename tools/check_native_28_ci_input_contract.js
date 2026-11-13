/**
 * [INPUT]: 依赖build.yml、Mac双架构与Windows官方输入准备器、native构建包装器及BuildMode合同。
 * [OUTPUT]: 验证2.8输入、固定280 runtime源、生产配置、Rust隔离、CI分派与三平台发布闭包。
 * [POS]: 原生生产CI离线合同；mock下载边界，不运行产品或GitHub Actions。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const workflow = read('.github/workflows/build.yml');
const workflowMap = read('.github/workflows/CLAUDE.md');
const workflowL2 = read('.github/workflows/CLAUDE.md');
const toolsMap = read('tools/CLAUDE.md');
const packageJson = JSON.parse(read('package.json'));
const inputPreparer = read('tools/prepare_cavalry_28_ci_inputs.sh');
const windowsInputPreparer = read('tools/prepare_cavalry_28_windows_ci_inputs.ps1');
const qtPreparer = read('tools/prepare_native_qt_headers.py');
const resourceProducer = read('tools/native_resource_bundle.js');
const windowsNativeBuildSource = read('tools/windows_native_build.js');
const windowsNativeBuild = require('./windows_native_build.js');
const buildScript = read('src-tauri/build.rs');
const x86Builder = read('injector/native/build_x86_64_candidate.sh');
const x86TimelineContract = read('injector/native/check_timeline_owner_observer_x86_64.py');
const x86SourceManifest = read('injector/native/native_source_manifest_x86_64.py');
const x86SourceManifestFixture = read('injector/native/native_source_manifest_x86_64_contract_test.py');

const pins = Object.freeze({
  dmgUrl: 'https://cavalry.studio/downloads/latest/Cavalry.dmg',
  dmgBytes: '256757556',
  dmgSha256: 'f7b732f57a411c577c9dc72180bd06609076d6e1b07a0c195851c12f0a57efe9',
  qtUrl: 'https://download.qt.io/online/qtsdkrepository/mac_x64/desktop/qt6_692/qt6_692/qt.qt6.692.clang_64/6.9.2-0-202508181146qtbase-MacOS-MacOS_15-Clang-MacOS-MacOS_15-X86_64-ARM64.7z',
  qtBytes: '34027496',
  qtSha256: 'd2a2a80de2e049dab5521318cc359ce2a02d1f3bc5235804de158b7342201e11',
});
const profile = 'release-2.8.config.json';
const resourceProfile = 'production-2.8';
const targets = Object.freeze({
  arm64: 'aarch64-apple-darwin',
  x86_64: 'x86_64-apple-darwin',
});

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing block start: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing block end: ${endMarker}`);
  return source.slice(start, end);
}

function stepBlock(source, name) {
  const startMarker = `      - name: ${name}`;
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing workflow step: ${name}`);
  const end = source.indexOf('\n      - name:', start + startMarker.length);
  return source.slice(start, end < 0 ? source.length : end);
}

const preflight = blockBetween(workflow, '  release_tag_preflight:', '\n  dependency_vulnerability_gate:');
const packageJob = blockBetween(workflow, '  package_macos:', '\n  release:');
const dispatch = blockBetween(workflow, '  workflow_dispatch:', '\n  push:');
const windowsJob = blockBetween(workflow, '  windows_check:', '\n  macos_injector_check:');
const releaseJobStart = workflow.indexOf('\n  release:');
assert.ok(releaseJobStart >= 0, 'release job must exist');
const releaseJob = workflow.slice(releaseJobStart);
const tagBuild = stepBlock(packageJob, 'Build packaged macOS app (tag = ad-hoc + signed updater)');
const manualBuild = stepBlock(packageJob, 'Build packaged macOS app (workflow_dispatch = ad-hoc verification only)');
const packagedGate = stepBlock(packageJob, 'Validate packaged app with LOCAL_BUILD_SOP gates');

// 手动预验先具备源码和Node；普通检查不扩大为打包或发布。
const profileInputCondition = "startsWith(github.ref, 'refs/tags/cavalry-') || (github.event_name == 'workflow_dispatch' && inputs.package_scope == 'macos-2.8-preflight')";
for (const name of ['Checkout release tag history', 'Set up pinned Node.js for release profile validation']) {
  const step = stepBlock(preflight, name);
  const condition = step.match(/^\s+if:\s*(.+)$/m)?.[1];
  assert.equal(condition, profileInputCondition, `${name} must run before manual profile validation`);
  const evaluate = new Function('ref', 'event', 'scope', `return ${condition
    .replace("startsWith(github.ref, 'refs/tags/cavalry-')", "ref.startsWith('refs/tags/cavalry-')")
    .replaceAll('github.event_name', 'event').replaceAll('inputs.package_scope', 'scope')};`);
  for (const [ref, event, scope, expected] of [
    ['refs/tags/cavalry-2.8.0-p1', 'push', '', true],
    ['refs/heads/feat/cavalry-2.8.0', 'workflow_dispatch', 'macos-2.8-preflight', true],
    ['refs/heads/feat/cavalry-2.8.0', 'workflow_dispatch', 'none', false],
    ['refs/heads/main', 'push', '', false],
    ['refs/pull/1/merge', 'pull_request', '', false],
  ]) assert.equal(evaluate(ref, event, scope), expected, `${name}: ${event}/${scope}`);
}

// -- 发布边界：2.7仅历史，2.8复用三平台生产闭包 -------------------
assert.match(preflight, /cavalry-2\.7\.2-p\[0-9\].*historical only; repackaging is forbidden/);
assert.match(preflight, /cavalry-2\.8\.0-p\[0-9\].*release-2\.8\.config\.json/);
assert.doesNotMatch(preflight, /implementation-not-ready/, 'approved 2.8 tags must reach the real production jobs');
assert.match(preflight, /git merge-base --is-ancestor/, 'tag ancestry remains required');
const packageCondition = require('yaml').parse(workflow).jobs.package_macos.if;
assert.match(packageCondition, /startsWith\(github\.ref, 'refs\/tags\/cavalry-'\) \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.package_scope == 'macos-2\.8-preflight'\)/);
assert.match(packageCondition, /needs\.build\.result == 'success'/);
assert.match(windowsJob, /github\.event_name != 'workflow_dispatch'/, 'manual 2.8 preflight must skip Windows');
assert.match(releaseJob, /if: startsWith\(github\.ref, 'refs\/tags\/cavalry-'\)/, 'manual preflight must not create a Release');
assert.match(dispatch, /default: 'none'/);
assert.match(dispatch, /- macos-2\.8-preflight/);
assert.match(workflow, /if: env\.RELEASE_PROFILE_CONFIG == 'release-2\.8\.config\.json'/);
assert.doesNotMatch(packageJob, /npm run prepare:qt-sdk(?:\s|$)/, '2.8 package matrix must not build the legacy Qt 6.6.3 injector');

// Windows CI stages official inputs, native runtime tests, then production NSIS packaging.
const windowsInputStep = stepBlock(windowsJob, 'Prepare Cavalry 2.8 Windows production inputs');
const windowsRuntimeStep = stepBlock(windowsJob, 'Build Windows 2.8 native runtime and language packs');
const windowsRustStep = stepBlock(windowsJob, 'Check and test the Windows Rust target');
const windowsPrBuildStep = stepBlock(windowsJob, 'Build the Windows NSIS installer (PR/main)');
const windowsTagBuildStep = stepBlock(windowsJob, 'Build the Windows NSIS installer and updater signature (tag)');
assert.match(windowsInputStep, /prepare_cavalry_28_windows_ci_inputs\.ps1/);
assert.match(windowsInputPreparer, /CAVALRY_NATIVE_ASSETS_ROOT/);
assert.match(windowsInputPreparer, /CAVALRY_QT_PREFIX/);
assert.match(windowsInputPreparer, /GITHUB_ENV/);
assert.doesNotMatch(windowsInputPreparer, /6\.6\.3|cavalry_qt_target\.json|prepare:qt-sdk:windows/,
  'Windows 2.8 inputs must not reuse the frozen 2.7 Qt target');
assert.match(windowsRuntimeStep, /npm run prepare:tauri:windows-bundle/);
assert.equal(packageJson.scripts['prepare:tauri:windows-bundle'],
  'node tools/windows_native_build.js --prepare-only');
assert.equal(packageJson.scripts['build:tauri:windows'], 'node tools/windows_native_build.js');
assert.deepEqual(windowsNativeBuild.WINDOWS_PRODUCTION_CONFIGS, [
  'src-tauri/tauri.windows.conf.json',
  'src-tauri/tauri.native-production-2.8.conf.json',
  'src-tauri/tauri.native-windows-2.8.conf.json',
  'src-tauri/tauri.release-2.8.conf.json',
]);
assert.match(windowsNativeBuildSource, /CAVALRY_I18N_NATIVE_BUILD_PROFILE/);
assert.match(windowsNativeBuildSource, /production: true/);
assert.doesNotMatch(windowsJob, /CAVALRY_I18N_NATIVE_BUILD_PROFILE\s*:/,
  'native production mode must not leak into debug Rust checks');
assert.doesNotMatch(windowsJob, /prepare:qt-sdk:windows|build:injector:windows/,
  'Windows 2.8 CI must not build the legacy Qt 6.6.3 injector');
assert.match(windowsRustStep, /npm run check:tauri[\s\S]*npm run test:tauri/);
assert.ok(windowsJob.indexOf(windowsRuntimeStep) < windowsJob.indexOf(windowsRustStep),
  'native resource DLLs must exist before Windows Rust check/test');
assert.match(windowsPrBuildStep, /npm run build:tauri:windows -- --package-only/);
assert.match(windowsTagBuildStep, /npm run build:tauri:windows -- --package-only --updater/);
assert.match(windowsTagBuildStep, /TAURI_SIGNING_PRIVATE_KEY/);
assert.doesNotMatch(windowsTagBuildStep, /prepare:qt-sdk:windows|tauri\.updater-artifacts\.conf\.json|tauri build/,
  'the wrapper owns native config order and appends updater artifacts');

// 失败候选只供诊断；不把官方库或失败字节混入产品制品。
const failureArtifact = stepBlock(packageJob, 'Preserve failed native candidate for diagnosis');
assert.match(failureArtifact, /if: failure\(\) && github\.event_name == 'workflow_dispatch' && inputs\.package_scope == 'macos-2\.8-preflight'/);
assert.match(failureArtifact, /name: failed-native-candidate-\$\{\{ matrix\.label \}\}/);
assert.match(failureArtifact, /path: \$\{\{ runner\.temp \}\}\/cavalry-2\.8-\$\{\{ matrix\.expected_arch \}\}-inputs\/\*\*\/libCavalryNativeFontCandidate\*\.dylib/);
assert.match(failureArtifact, /retention-days: 1/);
assert.match(inputPreparer, /TMPDIR="\$run_dir"\s*(?:\\\s*)?bash "\$candidate_builder"/);

// One target owner per build invocation: aliases bind local architectures; the matrix binds CI once.
const genericTauriBuild = packageJson.scripts['tauri:build'];
assert.ok(genericTauriBuild, 'generic Tauri build entry must exist');
assert.match(genericTauriBuild, /CAVALRY_I18N_NATIVE_BUILD_PROFILE=production-2\.8/);
assert.match(genericTauriBuild, /tauri\.macos\.conf\.json/);
assert.match(genericTauriBuild, /tauri\.native-production-2\.8\.conf\.json/);
assert.match(genericTauriBuild, /tauri\.release-2\.8\.conf\.json/);
assert.doesNotMatch(genericTauriBuild, /--target/, 'generic Tauri command must not hard-code ARM');
for (const [arch, target] of Object.entries(targets)) {
  const alias = arch === 'arm64'
    ? packageJson.scripts['build:tauri:native:production']
    : packageJson.scripts['build:tauri:native:production:x86_64'];
  assert.match(alias, new RegExp(`--target ${target.replaceAll('-', '\\-')}`));
  assert.equal((alias.match(/--target/g) || []).length, 1, `${arch} local alias owns one target`);
}
assert.match(packageJson.scripts['build:tauri'], /build:tauri:native:production/);
assert.equal(packageJson.scripts.build, 'npm run build:tauri', 'generic local build alias must keep the ARM default package route');
assert.match(packageJson.scripts['build:tauri'], /PACKAGED_NATIVE_PROFILE=production-2\.8/);
assert.match(packageJson.scripts['build:tauri'], /PACKAGED_EXPECTED_ARCH=arm64/);
assert.match(packageJson.scripts['build:tauri:x86_64'], /test:tauri:packaged:x86_64/);
assert.match(packageJson.scripts['test:tauri:packaged:x86_64'], /PACKAGED_EXPECTED_ARCH=x86_64/);
assert.equal((tagBuild.match(/--target\s+\$\{\{\s*matrix\.rust_target\s*\}\}/g) || []).length, 1);
assert.equal((manualBuild.match(/--target\s+\$\{\{\s*matrix\.rust_target\s*\}\}/g) || []).length, 1);
assert.match(tagBuild, /tauri\.updater-artifacts\.conf\.json/);
assert.doesNotMatch(manualBuild, /TAURI_SIGNING_PRIVATE_KEY|tauri\.updater-artifacts\.conf\.json/);
assert.match(packagedGate, /PACKAGED_NATIVE_PROFILE=production-2\.8/);
assert.match(packagedGate, /PACKAGED_EXPECTED_ARCH="\$\{\{ matrix\.expected_arch \}\}"/);
const testTauriConfig = packagedGate.match(/TAURI_CONFIG='([^']+)'/);
assert.ok(testTauriConfig, 'macOS Rust tests must use a test-only Tauri config overlay');
assert.deepEqual(JSON.parse(testTauriConfig[1]), { bundle: { resources: [] } },
  'the Rust test overlay must remove bundle resources without changing product configs');
const rustTestCommand = 'npm run test:tauri -- --target ${{ matrix.rust_target }} --no-fail-fast';
const packagedGateLines = packagedGate.split(/\r?\n/);
const testConfigLine = packagedGateLines.findIndex((line) =>
  line.trim() === `TAURI_CONFIG='${testTauriConfig[1]}' \\`);
assert.ok(testConfigLine >= 0, 'the test-only overlay must be a single shell command prefix');
assert.equal(packagedGateLines[testConfigLine + 1].trim(), rustTestCommand,
  'the empty-resource overlay must scope only to the target-specific Rust test command');
assert.equal((packagedGate.match(/TAURI_CONFIG=/g) || []).length, 1,
  'the test-only Tauri config must not leak into packaged-app or DMG gates');
assert.doesNotMatch(manualBuild, /TAURI_CONFIG=/,
  'the product build must retain the explicit production configuration overlays');
assert.match(packageJob, /label: aarch64[\s\S]*rust_target: aarch64-apple-darwin[\s\S]*expected_arch: arm64[\s\S]*runner_label: macos-26/);
assert.match(packageJob, /label: x64[\s\S]*rust_target: x86_64-apple-darwin[\s\S]*expected_arch: x86_64[\s\S]*runner_label: macos-26-intel/);
assert.match(workflowMap, /macOS.*arm64.*x86_64/);

// x86 native source is a real builder, not the ARM binary under a new asset name.
assert.match(inputPreparer, /aarch64-apple-darwin[\s\S]*build_candidate\.sh/);
assert.match(inputPreparer, /x86_64-apple-darwin[\s\S]*build_x86_64_candidate\.sh/);
assert.match(x86Builder, /check_timeline_owner_observer_x86_64\.py/);
assert.match(x86Builder, /native_source_manifest_x86_64\.py/);
assert.match(x86Builder, /"\$SOURCE_MANIFEST"/);
assert.ok(x86Builder.indexOf('native_source_manifest_x86_64.py') <
  x86Builder.indexOf('check_timeline_owner_observer_x86_64.py'),
  'builder must snapshot the current source closure before the Timeline consumer');
assert.doesNotMatch(x86Builder, /source-manifest-0[38]\.json|\.\.\/evidence/);
assert.match(x86TimelineContract, /manifest_path: pathlib\.Path,/);
assert.match(x86TimelineContract, /if len\(sys\.argv\) != 4/);
assert.match(x86TimelineContract, /builder生成的当前source manifest/);
assert.doesNotMatch(x86TimelineContract, /root\.parent\s*\/\s*"evidence"/);
assert.match(x86SourceManifest, /"injector"/);
assert.match(x86SourceManifest, /"languages\/native"/);
assert.match(x86SourceManifest, /"tools\/build_native_help_description_table\.js"/);
assert.match(x86SourceManifestFixture, /test_producer_manifest_is_consumed_without_vendor_inputs/);
assert.match(x86SourceManifestFixture, /"added"/);
assert.match(x86SourceManifestFixture, /"missing"/);
assert.match(x86SourceManifestFixture, /"mode"/);
assert.match(x86TimelineContract, /hashlib\.sha256\(data\)\.hexdigest\(\) == expected\["sha256"\]/);
assert.match(x86TimelineContract, /stat\.S_IMODE\(source\.stat\(\)\.st_mode\) == expected_mode/);
assert.match(x86TimelineContract, /added = sorted\(set\(current_files\) - set\(expected_files\)\)/);
assert.match(x86TimelineContract, /missing = sorted\(set\(expected_files\) - set\(current_files\)\)/);

for (const [value, label] of [
  [pins.dmgUrl, 'official DMG URL'], [pins.dmgBytes, 'official DMG size'],
  [pins.dmgSha256, 'official DMG digest'], [pins.qtUrl, 'Qt 6.9.2 URL'],
  [pins.qtBytes, 'Qt 6.9.2 size'], [pins.qtSha256, 'Qt 6.9.2 digest'],
]) assert.ok(inputPreparer.includes(value), `input preparer must pin ${label}`);
assert.match(inputPreparer, /release-2\.8\.config\.json/);
assert.match(inputPreparer, /CAVALRY_NATIVE_CI_TARGET/);
assert.match(inputPreparer, /uname -m/);
assert.match(inputPreparer, /hdiutil attach .*?-readonly/);
assert.match(inputPreparer, /CAVALRY_PLIST_BUDDY/);
assert.match(inputPreparer, /CFBundleShortVersionString/);
assert.match(inputPreparer, /CFBundleVersion/);
assert.match(inputPreparer, /build:native-resources -- --assets-root .*--profile production-2\.8/);
assert.match(inputPreparer, /CAVALRY_I18N_NATIVE_INJECTOR_FILE=/);
assert.match(inputPreparer, /lipo "\$candidate" -verify_arch "\$candidate_arch"/);
assert.doesNotMatch(inputPreparer, /TAURI_SIGNING_PRIVATE_KEY|npm run prepare:qt-sdk|build:injector/);
assert.match(qtPreparer, /EXPECTED_BYTES = 34_027_496/);
assert.match(qtPreparer, /d2a2a80de2e049dab5521318cc359ce2a02d1f3bc5235804de158b7342201e11/);
assert.match(qtPreparer, /MODULES = \("QtCore", "QtGui", "QtWidgets"\)/);
assert.match(qtPreparer, /runtimeLibrariesCopied": False/);
assert.match(resourceProducer, /--assets-root <official Contents\/assets>/);
assert.match(resourceProducer, /production-2\.8/);
assert.match(buildScript, /CAVALRY_I18N_NATIVE_INJECTOR_FILE/);
assert.match(buildScript, /production-2\.8/);
assert.match(toolsMap, /prepare_cavalry_28_ci_inputs\.sh/);
assert.match(toolsMap, /check_native_28_ci_input_contract\.js/);

function writeExecutable(file, content) {
  fs.writeFileSync(file, `#!/bin/sh\nset -eu\n${content}\n`, { mode: 0o755 });
}

function scenario(options = {}) {
  const arch = options.candidateArch || 'arm64';
  const target = options.target || targets[arch];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-28-ci-contract-'));
  const bin = path.join(temp, 'bin');
  const logs = path.join(temp, 'logs');
  const runnerTemp = path.join(temp, 'runner-temp');
  fs.mkdirSync(bin);
  fs.mkdirSync(logs);
  fs.mkdirSync(runnerTemp);
  const envFile = path.join(temp, 'github-env');
  const summaryFile = path.join(temp, 'github-summary');
  fs.writeFileSync(envFile, '');
  fs.writeFileSync(summaryFile, '');

  writeExecutable(path.join(bin, 'curl'), `
  out=''; url=''; previous=''
  for arg in "$@"; do
    if [ "$previous" = '--output' ]; then out="$arg"; fi
    url="$arg"; previous="$arg"
  done
  [ -n "$out" ] && [ -n "$url" ]
  printf '%s\\n' "$url" >> "$MOCK_LOG_ROOT/curl.urls"
  printf 'mock boundary\\n' > "$out"
  `);
  writeExecutable(path.join(bin, 'stat'), `
  file=''; for arg in "$@"; do file="$arg"; done
  case "$file" in
    *.dmg) if [ "$MOCK_BAD_DMG_SIZE" = 1 ]; then printf '1\\n'; else printf '%s\\n' '${pins.dmgBytes}'; fi ;;
    *.7z) if [ "$MOCK_BAD_QT_SIZE" = 1 ]; then printf '1\\n'; else printf '%s\\n' '${pins.qtBytes}'; fi ;;
    *) printf '4096\\n' ;;
  esac
  `);
  writeExecutable(path.join(bin, 'shasum'), `
  file=''; for arg in "$@"; do file="$arg"; done
  printf '%s\\n' "$file" >> "$MOCK_LOG_ROOT/shasum.files"
  case "$file" in
    *.dmg) hash="${options.badDmgSha ? '0000000000000000000000000000000000000000000000000000000000000000' : pins.dmgSha256}" ;;
    *.7z) hash="${options.badQtSha ? '0000000000000000000000000000000000000000000000000000000000000000' : pins.qtSha256}" ;;
    *) hash='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' ;;
  esac
  printf '%s  %s\\n' "$hash" "$file"
  `);
  writeExecutable(path.join(bin, 'uname'), `printf '%s\\n' '${options.hostArch || arch}'`);
  writeExecutable(path.join(bin, 'hdiutil'), `
  action="$1"; shift
  printf '%s\\n' "$action $*" >> "$MOCK_LOG_ROOT/hdiutil.log"
  if [ "$action" = attach ]; then
    mountpoint=''; previous=''
    for arg in "$@"; do
      if [ "$previous" = '-mountpoint' ]; then mountpoint="$arg"; fi
      previous="$arg"
    done
    [ -n "$mountpoint" ]
    mkdir -p "$mountpoint/Cavalry.app/Contents/assets" "$mountpoint/Cavalry.app/Contents/Frameworks"
    : > "$mountpoint/Cavalry.app/Contents/Info.plist"
    printf '%s\\n' "$mountpoint" > "$MOCK_MOUNT_STATE"
  elif [ "$action" = detach ]; then
    rm -f "$MOCK_MOUNT_STATE"
  else
    exit 9
  fi
  `);
  writeExecutable(path.join(bin, 'mount'), `
  if [ -f "$MOCK_MOUNT_STATE" ]; then
    mountpoint="$(cat "$MOCK_MOUNT_STATE")"
    printf 'mock-device on %s (hfs, local, read-only)\\n' "$mountpoint"
  fi
  `);
  writeExecutable(path.join(bin, 'PlistBuddy'), `printf '%s\\n' '${options.appVersion || '2.8.0'}'`);
  writeExecutable(path.join(bin, 'npm'), `printf '%s\\n' "$*" >> "$MOCK_LOG_ROOT/npm.args"`);
  writeExecutable(path.join(bin, 'git'), `
  printf '%s\\n' "$*" >> "$MOCK_LOG_ROOT/git.args"
  case "$1" in
    cat-file) exit ${options.missingRuntimeRevision ? '1' : '0'} ;;
    fetch) exit ${options.runtimeFetchFails ? '37' : '0'} ;;
    archive) /usr/bin/tar -cf - -T /dev/null ;;
    *) exit 29 ;;
  esac
  `);
  writeExecutable(path.join(temp, 'python'), `
  [ "$1" = 'tools/prepare_native_qt_headers.py' ] || exit 21
  shift
  archive=''; output=''; key=''
  for arg in "$@"; do
    if [ "$key" = '--archive' ]; then archive="$arg"; fi
    if [ "$key" = '--output' ]; then output="$arg"; fi
    key="$arg"
  done
  [ -f "$archive" ] && [ -n "$output" ]
  printf '%s\\n' "$archive $output" >> "$MOCK_LOG_ROOT/qt-preparer.args"
  mkdir -p "$output/include/QtCore" "$output/include/QtGui" "$output/include/QtWidgets"
  printf '#define QT_VERSION_MAJOR 6\\n#define QT_VERSION_MINOR 9\\n#define QT_VERSION_PATCH 2\\n' > "$output/include/QtCore/qconfig.h"
  `);
  writeExecutable(path.join(bin, 'bash'), `
  case "\${1:-}" in
    injector/native/build_candidate.sh)
      [ -d "\${2:-}" ] || exit 22
      [ -d "\${CAVALRY_QT_PREFIX:-}" ] || exit 23
      printf '%s\\n' "$2" >> "$MOCK_LOG_ROOT/candidate-frameworks.txt"
      candidate="$RUNNER_TEMP/mock-native-arm64.dylib"
      printf 'mock arm64 candidate\\n' > "$candidate"
      printf 'ARTIFACT: %s\\n' "$candidate"
      exit 0
      ;;
    injector/native/build_x86_64_candidate.sh)
      [ -d "\${2:-}" ] || exit 24
      [ -n "\${3:-}" ] || exit 25
      [ -d "\${CAVALRY_QT_PREFIX:-}" ] || exit 26
      mkdir -p "$3"
      printf '%s\\n' "$2" >> "$MOCK_LOG_ROOT/candidate-frameworks.txt"
      printf '%s\\n' "$3" >> "$MOCK_LOG_ROOT/candidate-output.txt"
      candidate="$3/libCavalryNativeFontCandidate.x86_64.dylib"
      printf 'mock x86_64 candidate\\n' > "$candidate"
      printf 'ARTIFACT: %s\\n' "$candidate"
      exit 0
      ;;
    *) exec /bin/bash "$@" ;;
  esac
  `);
  writeExecutable(path.join(bin, 'lipo'), `
  if [ ! -f "$1" ] || [ "$2" != '-verify_arch' ] || [ "$3" != '${arch}' ]; then
    echo "unexpected lipo invocation: $*" >&2
    exit 1
  fi
  printf '%s\\n' "$*" >> "$MOCK_LOG_ROOT/lipo.args"
  `);

  const env = {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    RUNNER_TEMP: runnerTemp,
    GITHUB_ENV: envFile,
    GITHUB_STEP_SUMMARY: summaryFile,
    RELEASE_PROFILE_CONFIG: options.profile || profile,
    CAVALRY_NATIVE_CI_TARGET: target,
    MOCK_BAD_DMG_SIZE: options.badDmgSize ? '1' : '0',
    MOCK_BAD_QT_SIZE: options.badQtSize ? '1' : '0',
    CAVALRY_PLIST_BUDDY: path.join(bin, 'PlistBuddy'),
    PYTHON: path.join(temp, 'python'),
    MOCK_LOG_ROOT: logs,
    MOCK_MOUNT_STATE: path.join(temp, 'mounted-path'),
  };
  const result = spawnSync('/bin/bash', ['tools/prepare_cavalry_28_ci_inputs.sh'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  const exists = (name) => fs.existsSync(path.join(logs, name));
  const content = (name) => exists(name) ? fs.readFileSync(path.join(logs, name), 'utf8') : '';
  return {
    result,
    runnerTemp,
    exists,
    content,
    envOutput: fs.readFileSync(envFile, 'utf8'),
    summary: fs.readFileSync(summaryFile, 'utf8'),
    cleanup: () => fs.rmSync(temp, { recursive: true, force: true }),
  };
}

function expectRejectedBeforeNetwork(options, label) {
  const run = scenario(options);
  assert.notEqual(run.result.status, 0, `${label} must fail closed`);
  assert.equal(run.exists('curl.urls'), false, `${label} must fail before download`);
  assert.equal(run.envOutput, '', `${label} must not export a native candidate`);
  run.cleanup();
}

expectRejectedBeforeNetwork({ profile: 'release.config.json' }, '2.7 profile');
expectRejectedBeforeNetwork({ target: 'x86_64-apple-darwin', hostArch: 'arm64' }, 'wrong Intel runner');
expectRejectedBeforeNetwork({ candidateArch: 'x86_64', hostArch: 'arm64' }, 'Intel target on ARM host');
expectRejectedBeforeNetwork({ candidateArch: 'arm64', hostArch: 'x86_64' }, 'ARM target on Intel host');
expectRejectedBeforeNetwork({ target: 'x86_64-linux-gnu' }, 'non-macOS target');

const badDmgSize = scenario({ badDmgSize: true });
assert.notEqual(badDmgSize.result.status, 0, 'DMG byte-count drift must fail');
assert.equal(badDmgSize.exists('shasum.files'), false, 'DMG size mismatch must fail before hashing');
assert.equal(badDmgSize.exists('hdiutil.log'), false, 'DMG size mismatch must fail before mount');
assert.equal(badDmgSize.envOutput, '', 'DMG size mismatch must not export a candidate');
badDmgSize.cleanup();

const badDmg = scenario({ badDmgSha: true });
assert.notEqual(badDmg.result.status, 0, 'DMG digest drift must fail');
assert.match(badDmg.content('curl.urls'), /downloads\/latest\/Cavalry\.dmg/);
assert.equal(badDmg.exists('hdiutil.log'), false, 'DMG mismatch must fail before mount');
assert.equal(badDmg.exists('npm.args'), false, 'DMG mismatch must fail before resource generation');
assert.equal(badDmg.envOutput, '', 'DMG mismatch must not export a candidate');
badDmg.cleanup();

const wrongVersion = scenario({ appVersion: '2.7.2' });
assert.notEqual(wrongVersion.result.status, 0, 'wrong mounted app version must fail');
assert.match(wrongVersion.content('hdiutil.log'), /^attach .*?-readonly/m);
assert.match(wrongVersion.content('hdiutil.log'), /detach/);
assert.equal(wrongVersion.exists('npm.args'), false, 'wrong version must fail before resource generation');
assert.equal(wrongVersion.envOutput, '', 'wrong version must not export a candidate');
wrongVersion.cleanup();

const badQtSize = scenario({ badQtSize: true });
assert.notEqual(badQtSize.result.status, 0, 'Qt archive byte-count drift must fail');
assert.match(badQtSize.content('npm.args'), /build:native-resources .*--profile production-2\.8/);
assert.equal(badQtSize.exists('candidate-frameworks.txt'), false, 'Qt size mismatch must fail before native build');
assert.equal(badQtSize.envOutput, '', 'Qt size mismatch must not export a candidate');
badQtSize.cleanup();

const badQt = scenario({ badQtSha: true });
assert.notEqual(badQt.result.status, 0, 'Qt digest drift must fail');
assert.match(badQt.content('npm.args'), /build:native-resources .*--profile production-2\.8/);
assert.equal(badQt.exists('candidate-frameworks.txt'), false, 'Qt mismatch must fail before native build');
assert.equal(badQt.envOutput, '', 'Qt mismatch must not export a candidate');
badQt.cleanup();

for (const arch of ['arm64', 'x86_64']) {
  const run = scenario({ candidateArch: arch });
  assert.equal(run.result.status, 0, `${arch} mocked producer path must complete: ${run.result.stderr}`);
  assert.deepEqual(run.content('curl.urls').trim().split('\n'), [pins.dmgUrl, pins.qtUrl]);
  assert.match(run.content('hdiutil.log'), /^attach .*?-readonly/m, 'mount verified DMG read-only');
  assert.match(run.content('hdiutil.log'), /detach/, 'detach verified DMG on exit');
  assert.match(run.content('npm.args'), /build:native-resources .*--assets-root .*Cavalry\.app\/Contents\/assets .*--profile production-2\.8/);
  assert.match(run.content('qt-preparer.args'), /qtbase-6\.9\.2\.7z .*qt-6\.9\.2-headers/);
  assert.match(run.content('candidate-frameworks.txt'), /Cavalry\.app\/Contents\/Frameworks/);
  assert.match(run.content('git.args'), /archive --format=tar ad7d501b04133650ac9d26953fa60ee3f57eedec CLAUDE\.md injector languages tools/);
  assert.doesNotMatch(run.content('git.args'), /^fetch /m);
  const candidatePath = path.join(
    run.runnerTemp,
    arch === 'arm64'
      ? 'mock-native-arm64.dylib'
      : 'cavalry-2.8-x86_64-inputs/native-candidate-output/libCavalryNativeFontCandidate.x86_64.dylib'
  );
  assert.equal(
    run.content('lipo.args').trim(),
    `${candidatePath} -verify_arch ${arch}`,
    'lipo must receive the candidate input before its architecture verification command'
  );
  assert.match(run.envOutput, new RegExp(`^CAVALRY_I18N_NATIVE_INJECTOR_FILE=.*${arch === 'arm64' ? 'mock-native-arm64\\.dylib' : 'libCavalryNativeFontCandidate\\.x86_64\\.dylib'}$`, 'm'));
  assert.match(run.summary, /official latest alias/);
  assert.match(run.summary, /Frozen 2\.8\.0 runtime source commit: ad7d501b04133650ac9d26953fa60ee3f57eedec/);
  assert.match(run.summary, /all-platform production build and signed updater closure/);
  assert.ok(!run.summary.includes('mock-native-'), 'summary must not expose transient candidate path');
  if (arch === 'x86_64') assert.match(run.content('candidate-output.txt'), /native-candidate-output/);
  run.cleanup();
}

const missingRevision = scenario({ missingRuntimeRevision: true });
assert.equal(missingRevision.result.status, 0, missingRevision.result.stderr);
assert.match(missingRevision.content('git.args'), /^fetch --no-tags --depth=1 origin ad7d501b04133650ac9d26953fa60ee3f57eedec$/m);
missingRevision.cleanup();
const failedRuntimeFetch = scenario({ missingRuntimeRevision: true, runtimeFetchFails: true });
assert.notEqual(failedRuntimeFetch.result.status, 0);
assert.equal(failedRuntimeFetch.exists('candidate-frameworks.txt'), false);
assert.equal(failedRuntimeFetch.envOutput, '');
failedRuntimeFetch.cleanup();

console.log('PASS: unsupported profile, target, or host architecture rejects before network access.');
console.log('PASS: DMG and Qt size/SHA drift and version drift fail before unsafe producer stages.');
console.log('PASS: ARM and Intel mock paths call their matching native builder and export the exact dylib.');
console.log('PASS: workflow binds one matrix target, explicit macOS-only manual preflight, and tag-only updater overlay.');
console.log('LIMIT: external downloads, real mount, SDK extraction, dylib compilation, Tauri packaging, GitHub Actions, GUI, and publication were not run.');
