#!/usr/bin/env node
/**
 * [INPUT]: verify_ci_action_pins.js 与临时复制的 workflow/policy/requirements/toolchain inputs
 * [OUTPUT]: 证明 baseline 通过，同时拒绝 unknown/wrong-SHA action、floating Rust setup 与 toolchain manifest/file 漂移
 * [POS]: GitHub Actions exact name+SHA allowlist 的离线回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const verifier = path.join(root, 'tools/verify_ci_action_pins.js');
const inputs = [
  '.github/workflows/build.yml',
  'tools/ci_action_pins.json',
  'tools/dependency_vulnerability_gate.json',
  'tools/verify_runner_image.js',
  'requirements-ci.in',
  'requirements-ci.txt',
  'requirements-audit.in',
  'requirements-audit.txt',
  'rust-toolchain.toml',
];

function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-action-pins-'));
  for (const relative of inputs) {
    const destination = path.join(temp, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
  }
  return temp;
}
function run(cwd) { return spawnSync(process.execPath, [verifier], { cwd, encoding: 'utf8' }); }

test('action gate is an exact action-name and SHA allowlist, not a generic 40-char check', () => {
  const temp = fixture();
  try {
    const baseline = run(temp);
    assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
    const workflowPath = path.join(temp, '.github/workflows/build.yml');
    const baselineWorkflow = fs.readFileSync(workflowPath, 'utf8');
    fs.writeFileSync(
      workflowPath,
      baselineWorkflow.replace(
        /(      - name: Set up pinned Python for build-closure audit)/,
        '      - uses: attacker/owned-action@0000000000000000000000000000000000000000\n$1'
      )
    );
    const unknown = run(temp);
    assert.notEqual(unknown.status, 0);
    assert.match(unknown.stderr, /not present in the exact allowlist/);

    fs.writeFileSync(workflowPath, baselineWorkflow.replace(
      /actions\/checkout@[0-9a-f]{40}/,
      'actions/checkout@0000000000000000000000000000000000000000'
    ));
    const wrongSha = run(temp);
    assert.notEqual(wrongSha.status, 0);
    assert.match(wrongSha.stderr, /expected allowlisted SHA/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('every Rust setup and rust-toolchain.toml must match the exact manifest channel', () => {
  const temp = fixture();
  try {
    const workflowPath = path.join(temp, '.github/workflows/build.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    fs.writeFileSync(workflowPath, workflow.replaceAll("toolchain: '1.97.1'", 'toolchain: stable'));
    const floating = run(temp);
    assert.notEqual(floating.status, 0);
    assert.match(floating.stderr, /must declare exactly toolchain: '1\.97\.1'/);

    fs.writeFileSync(workflowPath, workflow);
    fs.writeFileSync(
      path.join(temp, 'rust-toolchain.toml'),
      fs.readFileSync(path.join(temp, 'rust-toolchain.toml'), 'utf8').replace('1.97.1', 'stable')
    );
    const fileDrift = run(temp);
    assert.notEqual(fileDrift.status, 0);
    assert.match(fileDrift.stderr, /must declare exactly channel = "1\.97\.1"/);

    fs.copyFileSync(path.join(root, 'rust-toolchain.toml'), path.join(temp, 'rust-toolchain.toml'));
    const pinsPath = path.join(temp, 'tools/ci_action_pins.json');
    const pins = JSON.parse(fs.readFileSync(pinsPath, 'utf8'));
    pins.rust.channel = 'stable';
    fs.writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
    const manifestDrift = run(temp);
    assert.notEqual(manifestDrift.status, 0);
    assert.match(manifestDrift.stderr, /must exactly pin Rust 1\.97\.1/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('Node and Python pins belong to their own setup steps, not global decoy counts', () => {
  for (const fixtureCase of [
    {
      mutate(workflow) {
        return workflow
          .replace("python-version: '3.12.6'", "python-version: '3.13.0'")
          .replace('node-version: 22.23.1', "node-version: 22.23.1\n          python-version: '3.12.6'");
      },
      expected: /actions\/setup-python step .*python-version: '3\.12\.6'/,
    },
    {
      mutate(workflow) {
        return workflow
          .replace('node-version: 22.23.1', 'node-version: 23.0.0')
          .replace("python-version: '3.12.6'", "python-version: '3.12.6'\n          node-version: 22.23.1");
      },
      expected: /actions\/setup-node step .*node-version: '22\.23\.1'/,
    },
  ]) {
    const temp = fixture();
    try {
      const workflowPath = path.join(temp, '.github/workflows/build.yml');
      fs.writeFileSync(
        workflowPath,
        fixtureCase.mutate(fs.readFileSync(workflowPath, 'utf8'))
      );
      const result = run(temp);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, fixtureCase.expected);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
});

test('an unnamed setup action is still a distinct step and cannot use default runtime inputs', () => {
  const temp = fixture();
  try {
    const workflowPath = path.join(temp, '.github/workflows/build.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const pins = JSON.parse(fs.readFileSync(path.join(temp, 'tools/ci_action_pins.json'), 'utf8'));
    const unnamed = `      - uses: actions/setup-python@${pins.actions['actions/setup-python'].sha}\n`;
    fs.writeFileSync(
      workflowPath,
      workflow.replace(/(      - name: Set up pinned Python for build-closure audit)/, `${unnamed}$1`)
    );
    const result = run(temp);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /actions\/setup-python step .*python-version: '3\.12\.6'.*none/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('a setup step whose first key is if is still isolated from the preceding pinned step', () => {
  const temp = fixture();
  try {
    const workflowPath = path.join(temp, '.github/workflows/build.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const pins = JSON.parse(fs.readFileSync(path.join(temp, 'tools/ci_action_pins.json'), 'utf8'));
    const conditional = [
      '      - if: ${{ always() }}',
      `        uses: actions/setup-python@${pins.actions['actions/setup-python'].sha}`,
      '',
    ].join('\n');
    fs.writeFileSync(
      workflowPath,
      workflow.replace(/(      - name: Set up pinned Python for build-closure audit)/, `${conditional}$1`)
    );
    const result = run(temp);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /actions\/setup-python step .*python-version: '3\.12\.6'.*none/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('flow-mapping and quoted uses keys are parsed by the exact action allowlist', () => {
  for (const injected of [
    "      - { uses: attacker/owned-action@0000000000000000000000000000000000000000 }\n",
    "      - 'uses': attacker/owned-action@0000000000000000000000000000000000000000\n",
  ]) {
    const temp = fixture();
    try {
      const workflowPath = path.join(temp, '.github/workflows/build.yml');
      const workflow = fs.readFileSync(workflowPath, 'utf8');
      fs.writeFileSync(
        workflowPath,
        workflow.replace(/(      - name: Set up pinned Python for build-closure audit)/, `${injected}$1`)
      );
      const result = run(temp);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not present in the exact allowlist/);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
});
