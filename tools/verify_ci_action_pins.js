#!/usr/bin/env node
/**
 * [INPUT]: 依赖 tools/ci_action_pins.json、dependency_vulnerability_gate.json、两套 hash-locked Python requirements 与 .github/workflows/build.yml
 * [OUTPUT]: 以 strict unique-key YAML AST 要求每个 Actions `uses:` 的 action name/SHA 精确命中 allowlist、运行时精确版本、无 floating runner label、aqt/pip-audit 完整闭包 hash-lock、cargo-audit 显式消费精确 pinned Rust channel，且 npm/Python/Cargo 漏洞输入及 tag runner image allowlist 皆 fail-closed
 * [POS]: tools 的 GitHub Actions 供应链 pin 守门器（P2.5 / P2.6 / P2.8）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const rootDir = process.cwd();

function fail(message) {
  throw new Error(message);
}

function verifyHashedRequirements(contents, fileName, requiredPin) {
  const logicalLines = contents.split(/\r?\n/);
  const requirementBlocks = [];
  let current = null;

  for (const [index, rawLine] of logicalLines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^--hash=sha256:[a-f0-9]{64}(?:\s*\\)?$/i.test(line)) {
      if (!current) {
        fail(`${fileName} has an orphan hash at line ${index + 1}.`);
      }
      current.hashCount += 1;
      continue;
    }
    if (!/^[a-z0-9][a-z0-9_.-]*==[^\s;\\]+(?:\s*;\s*[^\\]+)?\s*\\$/i.test(line)) {
      fail(`${fileName} has an unpinned or unsupported line at ${index + 1}: ${line}`);
    }
    current = { line: index + 1, text: line, hashCount: 0 };
    requirementBlocks.push(current);
  }

  if (requirementBlocks.length < 2) {
    fail(`${fileName} must lock the complete transitive dependency closure.`);
  }
  const unhashed = requirementBlocks.filter((entry) => entry.hashCount === 0);
  if (unhashed.length > 0) {
    fail(
      `${fileName}: every requirement must have at least one SHA-256 hash. Missing at lines: ${unhashed
        .map((entry) => entry.line)
        .join(', ')}`
    );
  }
  const escapedPin = requiredPin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!requirementBlocks.some((entry) => new RegExp(`^${escapedPin}\\s+\\\\$`, 'i').test(entry.text))) {
    fail(`${fileName} must contain the exact ${requiredPin} lock entry.`);
  }
}

function main() {
  const pins = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'tools/ci_action_pins.json'), 'utf8')
  );
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/build.yml'), 'utf8');
  const requirementsInput = fs.readFileSync(path.join(rootDir, 'requirements-ci.in'), 'utf8');
  const requirements = fs.readFileSync(path.join(rootDir, 'requirements-ci.txt'), 'utf8');
  const auditRequirementsInput = fs.readFileSync(path.join(rootDir, 'requirements-audit.in'), 'utf8');
  const auditRequirements = fs.readFileSync(path.join(rootDir, 'requirements-audit.txt'), 'utf8');
  const vulnerabilityPolicy = JSON.parse(fs.readFileSync(path.join(rootDir, 'tools', 'dependency_vulnerability_gate.json'), 'utf8'));
  const runnerGate = fs.readFileSync(path.join(rootDir, 'tools', 'verify_runner_image.js'), 'utf8');
  const workflowDocument = YAML.parseDocument(workflow, { strict: true, uniqueKeys: true });
  if (workflowDocument.errors.length > 0) {
    fail(`build.yml is not strict unique-key YAML: ${workflowDocument.errors[0].message}`);
  }
  function rejectYamlIndirection(node) {
    if (!node || typeof node !== 'object') return;
    if (YAML.isAlias(node) || node.anchor) {
      fail('build.yml must not use YAML aliases or anchors in the release workflow.');
    }
    if (node.tag && !String(node.tag).startsWith('tag:yaml.org,2002:')) {
      fail(`build.yml uses a custom YAML tag: ${node.tag}.`);
    }
    if (Array.isArray(node.items)) {
      for (const item of node.items) {
        rejectYamlIndirection(item?.key);
        rejectYamlIndirection(item?.value ?? item);
      }
    }
  }
  rejectYamlIndirection(workflowDocument.contents);
  const workflowValue = workflowDocument.toJS({ maxAliasCount: 0 });
  if (!workflowValue || typeof workflowValue.jobs !== 'object' || Array.isArray(workflowValue.jobs)) {
    fail('build.yml must contain a jobs mapping.');
  }
  const workflowSteps = [];
  const uses = [];
  for (const [jobName, job] of Object.entries(workflowValue.jobs)) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) fail(`Workflow job is invalid: ${jobName}.`);
    if (Object.hasOwn(job, 'uses')) {
      if (typeof job.uses !== 'string') fail(`Workflow job uses must be a string: ${jobName}.`);
      uses.push(job.uses);
    }
    if (Object.hasOwn(job, 'steps')) {
      if (!Array.isArray(job.steps)) fail(`Workflow job steps must be an array: ${jobName}.`);
      for (const [index, step] of job.steps.entries()) {
        if (!step || typeof step !== 'object' || Array.isArray(step)) {
          fail(`Workflow step must be a mapping: ${jobName}[${index}].`);
        }
        workflowSteps.push(step);
        if (Object.hasOwn(step, 'uses')) {
          if (typeof step.uses !== 'string') fail(`Workflow step uses must be a string: ${jobName}[${index}].`);
          uses.push(step.uses);
        }
      }
    }
  }
  function verifyExactActionInput(actionName, inputName, expectedValue, minimum) {
    const steps = workflowSteps.filter((step) =>
      typeof step.uses === 'string' &&
      step.uses.toLowerCase().startsWith(`${actionName.toLowerCase()}@`)
    );
    if (steps.length < minimum) {
      fail(`Expected at least ${minimum} ${actionName} steps, found ${steps.length}.`);
    }
    for (const [index, step] of steps.entries()) {
      const withInputs = step.with;
      const declared = withInputs && typeof withInputs === 'object' && !Array.isArray(withInputs)
        ? withInputs[inputName]
        : undefined;
      if (declared !== expectedValue) {
        fail(
          `${actionName} step ${index + 1} must declare exactly ${inputName}: '${expectedValue}' ` +
          `(found ${declared ?? 'none'}).`
        );
      }
    }
  }
  if (uses.length < 5) {
    fail(`Expected multiple pinned actions in build.yml, found ${uses.length}.`);
  }

  const floating = uses.filter((entry) => !/@[0-9a-f]{40}$/i.test(entry));
  if (floating.length > 0) {
    fail(
      `GitHub Actions must be pinned to full 40-char commit SHAs. Floating refs found:\n- ${floating.join('\n- ')}`
    );
  }

  const allowedActions = new Map(
    Object.entries(pins.actions).map(([name, meta]) => [name.toLowerCase(), String(meta.sha).toLowerCase()])
  );
  for (const entry of uses) {
    const match = entry.match(/^([^@]+)@([0-9a-f]{40})$/i);
    if (!match) fail(`Unsupported GitHub Action reference: ${entry}.`);
    const actionName = match[1].toLowerCase();
    const actualSha = match[2].toLowerCase();
    const expectedSha = allowedActions.get(actionName);
    if (!expectedSha) fail(`Workflow uses an action not present in the exact allowlist: ${match[1]}.`);
    if (actualSha !== expectedSha) {
      fail(`Workflow action ${match[1]} uses ${actualSha}, expected allowlisted SHA ${expectedSha}.`);
    }
  }

  for (const [name, meta] of Object.entries(pins.actions)) {
    const expected = `${name}@${meta.sha}`;
    if (!uses.includes(expected)) {
      fail(`Workflow missing pinned action ${expected} (from tools/ci_action_pins.json).`);
    }
  }

  // Toolchain pins referenced by workflow body.
  const directRequirements = requirementsInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (directRequirements.length !== 1 || directRequirements[0] !== 'aqtinstall==3.3.0') {
    fail('requirements-ci.in must contain only the direct aqtinstall==3.3.0 pin.');
  }
  verifyHashedRequirements(requirements, 'requirements-ci.txt', 'aqtinstall==3.3.0');
  const auditDirectRequirements = auditRequirementsInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (auditDirectRequirements.length !== 1 || auditDirectRequirements[0] !== 'pip-audit==2.10.1') {
    fail('requirements-audit.in must contain only the direct pip-audit==2.10.1 pin.');
  }
  verifyHashedRequirements(auditRequirements, 'requirements-audit.txt', 'pip-audit==2.10.1');
  if (
    pins.rust?.toolchainFile !== 'rust-toolchain.toml' ||
    pins.rust?.channel !== '1.97.1'
  ) {
    fail('tools/ci_action_pins.json must exactly pin Rust 1.97.1 via rust-toolchain.toml.');
  }
  const rustToolchainPath = path.join(rootDir, pins.rust.toolchainFile);
  if (!fs.existsSync(rustToolchainPath)) {
    fail('rust-toolchain.toml must exist for the pinned Rust channel.');
  }
  const rustToolchain = fs.readFileSync(rustToolchainPath, 'utf8');
  const rustChannels = [...rustToolchain.matchAll(/^\s*channel\s*=\s*['"]([^'"]+)['"]\s*$/gm)]
    .map((match) => match[1]);
  if (rustChannels.length !== 1 || rustChannels[0] !== pins.rust.channel) {
    fail(
      `rust-toolchain.toml must declare exactly channel = "${pins.rust.channel}" ` +
      `(found ${rustChannels.join(', ') || 'none'}).`
    );
  }
  const rustSetupSteps = workflowSteps.filter((step) =>
    typeof step.uses === 'string' && step.uses.toLowerCase().startsWith('dtolnay/rust-toolchain@')
  );
  if (rustSetupSteps.length < 3) {
    fail(`Expected at least three pinned Rust setup steps, found ${rustSetupSteps.length}.`);
  }
  for (const [index, step] of rustSetupSteps.entries()) {
    const declared = step.with && typeof step.with === 'object' && !Array.isArray(step.with)
      ? step.with.toolchain
      : undefined;
    if (declared !== pins.rust.channel) {
      fail(
        `Rust setup step ${index + 1} must declare exactly toolchain: '${pins.rust.channel}' ` +
        `(found ${declared ?? 'none'}).`
      );
    }
  }
  if (pins.node?.version !== '24.20.0' || pins.node?.npmVersion !== '11.19.0') {
    fail('tools/ci_action_pins.json must exactly pin Node 24.20.0 and npm 11.19.0 for the vulnerability gate.');
  }
  verifyExactActionInput('actions/setup-node', 'node-version', pins.node.version, 5);
  if (pins.python.version !== '3.12.6') {
    fail('tools/ci_action_pins.json must pin Python 3.12.6 exactly.');
  }
  verifyExactActionInput('actions/setup-python', 'python-version', pins.python.version, 4);
  if (/pip install\s+--upgrade\s+pip/.test(workflow)) {
    fail('CI must not mutate pip with an unpinned upgrade step.');
  }
  const requirementInstalls = workflow.match(/^.*pip install[^\n]*requirements-ci\.txt.*$/gm) || [];
  if (requirementInstalls.length !== 3) {
    fail(`Expected exactly three aqt lock installs (Windows and two macOS jobs), found ${requirementInstalls.length}.`);
  }
  for (const line of requirementInstalls) {
    if (!line.includes('--require-hashes') || !line.includes('--only-binary=:all:')) {
      fail(`Every aqt install must be hash-locked and wheel-only: ${line.trim()}`);
    }
  }
  if (
    pins.aqtinstall.inputFile !== 'requirements-ci.in' ||
    pins.aqtinstall.requirementFile !== 'requirements-ci.txt' ||
    pins.aqtinstall.directPin !== 'aqtinstall==3.3.0'
  ) {
    fail('tools/ci_action_pins.json aqtinstall metadata must bind the input and compiled lock files.');
  }


  if (vulnerabilityPolicy.schemaVersion !== 1 || vulnerabilityPolicy.kind !== 'DependencyVulnerabilityGatePolicy' ||
      vulnerabilityPolicy.npm?.nodeVersion !== pins.node.version ||
      vulnerabilityPolicy.npm?.npmVersion !== pins.node.npmVersion ||
      !/^[a-f0-9]{40}$/.test(vulnerabilityPolicy.cargoAudit?.rustsecAdvisoryDb?.commit || '')) {
    fail('Dependency vulnerability policy must pin Node/npm and an immutable RustSec advisory DB commit.');
  }
  const pinnedRustAssignment = 'rust_toolchain="$(node -p "require(\'./tools/ci_action_pins.json\').rust.channel")"';
  const pinnedCargoAuditInstall = 'cargo +"$rust_toolchain" install cargo-audit --version';
  if (!workflow.includes(pinnedRustAssignment) || !workflow.includes(pinnedCargoAuditInstall)) {
    fail('cargo-audit must be installed with the exact pinned Rust toolchain from tools/ci_action_pins.json.');
  }
  if (/^\s*cargo\s+install\s+cargo-audit\b/m.test(workflow)) {
    fail('cargo-audit must not use bare cargo install because rust-toolchain.toml component reconciliation is not part of the audit bootstrap.');
  }
  for (const required of [
    'dependency_vulnerability_gate:',
    'npm audit --package-lock-only --json',
    pinnedCargoAuditInstall,
    'requirements-audit.txt',
    'pip-audit"',
    '--python-report "$RUNNER_TEMP/python-audit.json"',
    '--rustsec-commit-timestamp "$advisory_timestamp"',
    'git -C "$advisory_db" fetch --depth=1 origin "$advisory_commit"',
    'RELEASE_RUNNER_IMAGE_FINGERPRINTS',
    'verify_runner_image.js --mode enforce',
  ]) {
    if (!workflow.includes(required)) fail(`build.yml missing fail-closed dependency/runner gate: ${required}`);
  }
  if (/runs-on:\s*[^#\n]*-latest\b/i.test(workflow)) {
    fail('GitHub runner labels must be explicit fixed OS labels, never *-latest.');
  }
  for (const label of ['ubuntu-24.04', 'windows-2022', 'macos-14']) {
    if (!workflow.includes(`runs-on: ${label}`)) fail(`build.yml missing fixed runner label ${label}.`);
  }
  if (!runnerGate.includes('ImageOS') || !runnerGate.includes('ImageVersion') || !runnerGate.includes('not in the protected allowlist')) {
    fail('Runner image verifier must bind ImageOS/ImageVersion and fail closed against the protected allowlist.');
  }

  console.log(`[verify-ci-action-pins] OK: ${uses.length} uses entries pinned to full SHAs`);
}

try {
  main();
} catch (error) {
  console.error(`[verify-ci-action-pins] ${error.message}`);
  process.exit(1);
}
