const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function powershellQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildMacScript(pairs) {
  return [
    '#!/bin/sh',
    'set -eu',
    ...pairs.map(({ src, dst }) => `cp ${shellQuote(src)} ${shellQuote(dst)}`),
    '',
  ].join('\n');
}

function buildWindowsScript(pairs) {
  return [
    '$ErrorActionPreference = "Stop"',
    ...pairs.map(
      ({ src, dst }) =>
        `Copy-Item -LiteralPath ${powershellQuote(src)} -Destination ${powershellQuote(dst)} -Force`
    ),
    '',
  ].join('\r\n');
}

function runMacCopy(pairs) {
  const scriptPath = path.join(os.tmpdir(), `cavalry-i18n-copy-${Date.now()}-${process.pid}.sh`);
  fs.writeFileSync(scriptPath, buildMacScript(pairs), { mode: 0o755 });

  const appleScript = [
    'on run argv',
    '  set scriptPath to item 1 of argv',
    '  do shell script "sh " & quoted form of scriptPath with administrator privileges',
    'end run',
  ].join('\n');

  try {
    const result = spawnSync('osascript', ['-e', appleScript, scriptPath], { encoding: 'utf8' });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || '').trim() || 'Administrator copy failed.';
      throw new Error(detail);
    }
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function runWindowsCopy(pairs) {
  const scriptPath = path.join(os.tmpdir(), `cavalry-i18n-copy-${Date.now()}-${process.pid}.ps1`);
  fs.writeFileSync(scriptPath, buildWindowsScript(pairs));

  const command = [
    '$scriptPath = ' + powershellQuote(scriptPath),
    'Start-Process',
    'powershell',
    '-ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$scriptPath)',
    '-Verb RunAs',
    '-Wait',
  ].join(' ');

  try {
    const result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || '').trim() || 'Administrator copy failed.';
      throw new Error(detail);
    }
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function copyWithSudo(pairs) {
  if (pairs.length === 0) {
    return;
  }

  if (process.platform === 'darwin') {
    runMacCopy(pairs);
    return;
  }

  if (process.platform === 'win32') {
    runWindowsCopy(pairs);
    return;
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

module.exports = {
  copyWithSudo,
};
