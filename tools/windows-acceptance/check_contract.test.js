/**
 * [INPUT]: windows acceptance contract、TEMP disposable clone、合成的最终 NSIS/DLL 与三语矩阵 fixture
 * [OUTPUT]: 证明 Windows release producer 能复验完整现场，并拒绝安装器、DLL、inventory、session 与人工复核篡改
 * [POS]: tools/windows-acceptance 的纯合同回归；不启动 Cavalry、不访问真实 Program Files、不制造可发布现场
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CLONE_SENTINEL,
  EXPECTED_POINTS,
  GENERIC_RELATIVE_PATH,
  QPA_RELATIVE_PATH,
  SESSION_SENTINEL,
  SESSION_SENTINEL_MAGIC,
  toWindowsAcceptanceRecord,
  validateWindowsAcceptanceRecord,
  verifyWindowsAcceptanceSession,
} = require('./acceptance_contract');

const SOURCE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function identity(file) {
  const stat = fs.statSync(file);
  return { path: file, bytes: stat.size, sha256: sha256(file) };
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return identity(file);
}

function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function png() {
  // 2x2 RGBA PNG: enough structure for the contract's non-empty PNG check.
  return Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000200000002080600000072b60d240000000b49444154789c6360f8cfc0f01f00050702027a0c5a3b0000000049454e44ae426082',
    'hex'
  );
}

function fingerprint(entries) {
  return crypto.createHash('sha256')
    .update(entries.slice().sort((left, right) => left.path.localeCompare(right.path, 'en'))
      .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`).join(''), 'utf8')
    .digest('hex');
}

function makeSession() {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-windows-release-')));
  const session = path.join(temp, 'SESSION_001');
  const clone = path.join(temp, 'cavalry-clone');
  fs.mkdirSync(session);
  fs.mkdirSync(clone);
  const sentinel = writeFile(path.join(session, SESSION_SENTINEL), `${SESSION_SENTINEL_MAGIC}\nfixture\n`);
  const cloneSentinel = writeFile(path.join(clone, CLONE_SENTINEL), 'cavalry-i18n-disposable-smoke\nfixture\n');
  const executable = writeFile(path.join(clone, 'Cavalry.exe'), 'MZ Cavalry 2.7.2 fixture\n');
  const installerName = 'Cavalry Language Switcher_0.7.0_x64-setup.exe';
  const installerPath = path.join(temp, installerName);
  const installer = writeFile(installerPath, 'MZ final NSIS installer fixture\n');
  const genericPath = path.join(temp, 'installed', GENERIC_RELATIVE_PATH);
  const qpaPath = path.join(temp, 'installed', QPA_RELATIVE_PATH);
  const generic = writeFile(genericPath, 'MZ generic shipped DLL fixture\n');
  const qpa = writeFile(qpaPath, 'MZ qpa shipped DLL fixture\n');
  const fingerprintFiles = [
    { path: GENERIC_RELATIVE_PATH, bytes: generic.bytes, sha256: generic.sha256 },
    { path: QPA_RELATIVE_PATH, bytes: qpa.bytes, sha256: qpa.sha256 },
    { path: 'languages/en/appStrings.json', bytes: 4, sha256: crypto.createHash('sha256').update('en\n').digest('hex') },
  ];
  const provenanceValue = {
    schemaVersion: 1,
    target: 'x86_64-pc-windows-msvc',
    productName: 'Cavalry Language Switcher',
    version: '0.7.0',
    installer: { fileName: installerName, bytes: installer.bytes, sha256: installer.sha256 },
    inputFingerprint: { algorithm: 'sha256', value: fingerprint(fingerprintFiles), files: fingerprintFiles },
  };
  const provenancePath = `${installerPath}.provenance.json`;
  const provenance = writeJson(provenancePath, provenanceValue);
  const points = EXPECTED_POINTS.map((expected, index) => {
    const pid = 4000 + index;
    const screenshotPath = path.join(session, 'captures', `${index + 1}-${expected.language}-${expected.scenario}-${expected.ordinal}.png`);
    const inventoryPath = path.join(session, 'inventory', `${index + 1}.json`);
    const screenshot = writeFile(screenshotPath, png());
    const inventory = writeJson(inventoryPath, {
      schema: 'cavalry-i18n.windows-live-inventory/v1',
      language: expected.language,
      scenario: expected.scenario,
      ordinal: expected.ordinal,
      pid,
      windowHandle: String(8000 + index),
      executableSha256: executable.sha256,
      genericPluginSha256: generic.sha256,
      qpaProxySha256: qpa.sha256,
      translationSource: 'packaged-nsis',
    });
    return {
      ...expected,
      screenshot,
      inventory,
      pid,
      startToken: `fixture-start-${pid}`,
      executableSha256: executable.sha256,
      genericPluginSha256: generic.sha256,
      qpaProxySha256: qpa.sha256,
      interactionEvidence: 'runtime exact-pid / exact-hwnd producer capture',
    };
  });
  const machine = {
    schema: 'cavalry-i18n.windows-release.machine/v1',
    status: 'MACHINE-COMPLETE-MANUAL-PENDING',
    createdAtUtc: '2026-08-27T00:00:00.000Z',
    sessionId: path.basename(session),
    releaseTag: 'cavalry-2.7.2-p999',
    repository: { head: SOURCE_COMMIT, worktreeStatus: [] },
    target: {
      cavalryVersion: '2.7.2',
      qtVersion: '6.6.3',
      architecture: 'x86_64',
      clonePath: clone,
      cloneSentinel,
      executable,
      restoredEnglish: true,
      zeroOwnedProcesses: true,
    },
    installer: { fileName: installerName, artifact: installer },
    provenance: { artifact: provenance },
    shippedDlls: {
      generic: { relativePath: GENERIC_RELATIVE_PATH, artifact: generic },
      qpa: { relativePath: QPA_RELATIVE_PATH, artifact: qpa },
    },
    runner: {
      os: 'win32',
      arch: 'x64',
      runnerOs: 'Windows Server 2022',
      runnerArch: 'X64',
      imageOs: 'win22',
      imageVersion: '20260801.1',
      node: 'v22.14.0',
      npm: '10.9.2',
      rustc: 'rustc 1.97.1 (fixture)',
      cargo: 'cargo 1.97.1 (fixture)',
      cmake: '4.2.0',
      powershell: '5.1.19041.6456',
    },
    matrix: {
      profile: 'windows-onboarding-adjacent-v1',
      languages: ['zh-Hans', 'zh-Hant', 'ja_JP'],
      scenarios: ['onboarding', 'adjacent'],
      points,
    },
  };
  const machinePath = path.join(session, 'windows-machine-record.json');
  const machineIdentity = writeJson(machinePath, machine);
  const reviewPath = path.join(session, 'windows-manual-review.json');
  const reviewIdentity = writeJson(reviewPath, {
    schema: 'cavalry-i18n.windows-release.manual-review/v1',
    status: 'APPROVED',
    reviewedAtUtc: '2026-08-27T01:00:00.000Z',
    reviewer: 'fixture reviewer',
    points: points.map((point) => ({ key: point.key, status: 'APPROVED', screenshot: point.screenshot, inventory: point.inventory })),
  });
  const finalPath = path.join(session, 'windows-final-record.json');
  const finalIdentity = writeJson(finalPath, {
    schema: 'cavalry-i18n.windows-release.final/v1',
    status: 'PASS-24-OF-24',
    sealedAtUtc: '2026-08-27T01:01:00.000Z',
    machine: machineIdentity,
    review: reviewIdentity,
    points: points.map((point) => point.key),
  });
  return {
    temp,
    session,
    paths: { installerPath, genericPath, qpaPath, machinePath, reviewPath, finalPath },
    identities: { installer, generic, qpa, machineIdentity, reviewIdentity, finalIdentity, sentinel },
  };
}

test('Windows release producer verifies final NSIS, shipped DLLs, clone and 24-point matrix', () => {
  const fixture = makeSession();
  try {
    const summary = verifyWindowsAcceptanceSession(fixture.session);
    const record = toWindowsAcceptanceRecord(summary);
    assert.equal(summary.result, 'PASS-24-OF-24');
    assert.equal(summary.matrix, '24-screenshot/24-point');
    assert.equal(record.installer.sha256, fixture.identities.installer.sha256);
    assert.equal(record.tag, 'cavalry-2.7.2-p999');
    assert.equal(record.shippedDlls.generic.sha256, fixture.identities.generic.sha256);
    assert.equal(record.shippedDlls.qpa.sha256, fixture.identities.qpa.sha256);
    assert.doesNotThrow(() => validateWindowsAcceptanceRecord(record));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('Windows release producer rejects installer, DLL, inventory, session and review mutations', () => {
  const cases = [
    ['installer bytes', (fixture) => fs.appendFileSync(fixture.paths.installerPath, 'tamper\n'), /installer\.artifact\.bytes drifted|installer\.artifact\.sha256 drifted/],
    ['generic DLL bytes', (fixture) => fs.appendFileSync(fixture.paths.genericPath, 'tamper\n'), /shippedDlls\.generic\.artifact\.bytes drifted|shippedDlls\.generic\.artifact\.sha256 drifted/],
    ['QPA DLL bytes', (fixture) => fs.appendFileSync(fixture.paths.qpaPath, 'tamper\n'), /shippedDlls\.qpa\.artifact\.bytes drifted|shippedDlls\.qpa\.artifact\.sha256 drifted/],
    ['inventory bytes', (fixture) => fs.appendFileSync(path.join(fixture.session, 'inventory', '1.json'), 'tamper\n'), /matrix\.zh-Hans\/onboarding\/1\.inventory\.bytes drifted|matrix\.zh-Hans\/onboarding\/1\.inventory\.sha256 drifted/],
    ['session sentinel', (fixture) => fs.writeFileSync(path.join(fixture.session, SESSION_SENTINEL), 'wrong\n'), /session sentinel has the wrong magic/],
    ['manual review', (fixture) => {
      const review = JSON.parse(fs.readFileSync(fixture.paths.reviewPath, 'utf8'));
      review.points[0].status = 'REJECTED';
      fs.writeFileSync(fixture.paths.reviewPath, `${JSON.stringify(review, null, 2)}\n`);
    }, /manual review point zh-Hans\/onboarding\/1 is not bound\/approved/],
  ];
  for (const [label, mutate, expected] of cases) {
    const fixture = makeSession();
    try {
      mutate(fixture);
      assert.throws(() => verifyWindowsAcceptanceSession(fixture.session), expected, label);
    } finally {
      fs.rmSync(fixture.temp, { recursive: true, force: true });
    }
  }
});

test('portable Windows acceptance schema keeps the public digest contract exact', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'windows_release_acceptance.schema.json'), 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.match(schema.properties.result.pattern, /PASS/);
  assert.deepEqual(schema.required.slice(0, 4), ['schemaVersion', 'kind', 'tag', 'result']);
  assert.equal(schema.properties.installer.properties.sha256.pattern, '^[a-f0-9]{64}$');
  assert.equal(schema.properties.shippedDlls.required.join(','), 'generic,qpa');
});
