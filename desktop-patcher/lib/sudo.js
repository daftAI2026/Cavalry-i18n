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
  const lines = ['#!/bin/sh', 'set -eu'];
  lines.push(
    ...pairs.flatMap(({ src, dst }) => [
      `cp ${shellQuote(src)} ${shellQuote(dst)}`,
      `chmod "$(stat -f %Lp ${shellQuote(src)})" ${shellQuote(dst)}`,
    ])
  );
  lines.push('');
  return lines.join('\n');
}

function isPermissionError(detail) {
  return /operation not permitted|permission denied|eacces|eperm/i.test(detail);
}

function runDirectCopy(pairs) {
  for (const { src, dst } of pairs) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, fs.statSync(src).mode);
  }
  return 'direct';
}

function shouldRetryWithFinder(detail, pairs) {
  return (
    detail.includes('Operation not permitted') &&
    pairs.some(({ dst }) => dst.startsWith('/Applications/') && dst.includes('.app/'))
  );
}

function runFinderFallback(pairs) {
  const appleScript = [
    'on run argv',
    '  tell application "Finder"',
    '    set argCount to count of argv',
    '    repeat with i from 1 to argCount by 2',
    '      set srcPath to item i of argv',
    '      set dstPath to item (i + 1) of argv',
    '      set dstFolderPath to do shell script "dirname " & quoted form of dstPath',
    '      set dstFileName to do shell script "basename " & quoted form of dstPath',
    '      set destinationFolder to POSIX file dstFolderPath as alias',
    '      if exists file dstFileName of destinationFolder then',
    '        delete file dstFileName of destinationFolder',
    '      end if',
    '      set duplicatedItem to duplicate (POSIX file srcPath as alias) to destinationFolder',
    '      if class of duplicatedItem is list then',
    '        set duplicatedItem to item 1 of duplicatedItem',
    '      end if',
    '      set name of duplicatedItem to dstFileName',
    '    end repeat',
    '  end tell',
    'end run',
  ].join('\n');

  const result = spawnSync(
    'osascript',
    ['-e', appleScript, ...pairs.flatMap(({ src, dst }) => [src, dst])],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    const detail =
      (result.stderr || result.stdout || '').trim() ||
      'Finder fallback failed. Allow the app to control Finder if macOS prompts.';
    throw new Error(detail);
  }

  return 'finder';
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
      if (shouldRetryWithFinder(detail, pairs)) {
        return runFinderFallback(pairs);
      }
      throw new Error(detail);
    }
    return 'shell';
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
    return 'shell';
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function copyWithSudo(pairs) {
  if (pairs.length === 0) {
    return 'noop';
  }

  try {
    return runDirectCopy(pairs);
  } catch (error) {
    const detail = error && error.message ? error.message : String(error);
    if (!isPermissionError(detail)) {
      throw error;
    }
  }

  if (process.platform === 'darwin') {
    return runMacCopy(pairs);
  }

  if (process.platform === 'win32') {
    return runWindowsCopy(pairs);
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

module.exports = {
  copyWithSudo,
};
