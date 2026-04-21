const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const {
  findCavalryApp,
  getDefaultAppCandidates,
  inspectBundle,
  listLanguageOptions,
  readBundleVersion,
} = require('./lib/detect');
const { buildCopyPairs, extractEnglish, stageFiles, verifyCodeSignature } = require('./lib/patch');
const { copyWithSudo } = require('./lib/sudo');

const repoRoot = path.resolve(__dirname, '..');
const languagesDir = path.join(repoRoot, 'languages');
const LANGUAGE_LABELS = {
  en: 'English',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁体中文',
  ja_JP: '日本語',
};
const INJECTOR_DYLIB_NAME = 'libCavalryTranslatorInjector.dylib';
const WRAPPER_EXECUTABLE_NAME = 'CavalryLauncher';
const LANG_MARKER_NAME = 'cavalry-i18n-lang.txt';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function isPermissionError(detail) {
  return /operation not permitted|permission denied|eacces|eperm/i.test(detail);
}

function runCommandWithAdmin(command, args) {
  const resolvedCommand = command.includes('/') ? command : path.join('/usr/bin', command);
  const shellCommand = [resolvedCommand, ...args].map(shellQuote).join(' ');
  const appleScript = [
    'on run argv',
    '  do shell script (item 1 of argv) with administrator privileges',
    'end run',
  ].join('\n');
  return spawnSync('osascript', ['-e', appleScript, shellCommand], { encoding: 'utf8' });
}

function runCommandMaybeWithAdmin(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status === 0 || process.platform !== 'darwin') {
    return result;
  }

  const detail = (result.stderr || result.stdout || '').trim();
  if (!isPermissionError(detail)) {
    return result;
  }

  return runCommandWithAdmin(command, args);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 720,
    height: 760,
    minWidth: 640,
    minHeight: 680,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function getStateDir() {
  return app.getPath('userData');
}

function getStatePath() {
  return path.join(getStateDir(), 'state.json');
}

function getEnglishSnapshotDir() {
  return path.join(getStateDir(), 'en');
}

function getInjectorBuildCachePath() {
  return path.join(getStateDir(), INJECTOR_DYLIB_NAME);
}

function getWrapperExecutablePath(appPath) {
  return path.join(appPath, 'Contents', 'MacOS', WRAPPER_EXECUTABLE_NAME);
}

function getInfoPlistPath(appPath) {
  return path.join(appPath, 'Contents', 'Info.plist');
}

function getLangMarkerPath(appPath) {
  return path.join(appPath, 'Contents', 'Resources', LANG_MARKER_NAME);
}

function getInstalledInjectorPath(appPath) {
  return path.join(appPath, 'Contents', 'Frameworks', INJECTOR_DYLIB_NAME);
}

function readInstalledLanguage(appPath, fallback = 'en') {
  if (!appPath || process.platform !== 'darwin') {
    return fallback;
  }

  const markerPath = getLangMarkerPath(appPath);
  if (!fs.existsSync(markerPath)) {
    return fallback;
  }

  const lang = fs.readFileSync(getLangMarkerPath(appPath), 'utf8').trim();
  if (!lang) {
    return 'en';
  }

  return LANGUAGE_LABELS[lang] ? lang : fallback;
}

function buildLaunchWrapper() {
  return `#!/bin/sh
set -eu
SELF_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SELF_DIR/.." && pwd)"
LANG_FILE="$APP_ROOT/Resources/${LANG_MARKER_NAME}"
INJECTOR_PATH="$APP_ROOT/Frameworks/${INJECTOR_DYLIB_NAME}"
LANG_CODE=""
if [ -f "$LANG_FILE" ]; then
  LANG_CODE="$(tr -d '\\n' < "$LANG_FILE")"
fi
if [ -n "$LANG_CODE" ] && [ -f "$INJECTOR_PATH" ]; then
  export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH"
  export CAVALRY_I18N_LANG="$LANG_CODE"
else
  unset DYLD_INSERT_LIBRARIES
  unset CAVALRY_I18N_LANG
fi
exec "$SELF_DIR/Cavalry" "$@"
`;
}

function buildWrappedInfoPlist(appPath) {
  const infoPlist = fs.readFileSync(getInfoPlistPath(appPath), 'utf8');
  if (infoPlist.includes(`<string>${WRAPPER_EXECUTABLE_NAME}</string>`)) {
    return infoPlist;
  }

  const next = infoPlist.replace(
    /(<key>CFBundleExecutable<\/key>\s*<string>)Cavalry(<\/string>)/,
    `$1${WRAPPER_EXECUTABLE_NAME}$2`
  );
  if (next === infoPlist) {
    throw new Error('Could not update CFBundleExecutable in Info.plist.');
  }
  return next;
}

function getBundledInjectorSourcePath(appPath) {
  const prebuiltPath = path.join(repoRoot, 'desktop-patcher', 'injector', INJECTOR_DYLIB_NAME);
  if (fs.existsSync(prebuiltPath)) {
    return prebuiltPath;
  }

  const buildScriptPath = path.join(repoRoot, 'tools', 'build_translator_injector.sh');
  if (!fs.existsSync(buildScriptPath)) {
    throw new Error(`Injector build script missing: ${buildScriptPath}`);
  }

  const outputPath = getInjectorBuildCachePath();
  const result = spawnSync(
    '/bin/bash',
    [buildScriptPath, outputPath, path.join(appPath, 'Contents', 'Frameworks')],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    const detail =
      (result.stderr || result.stdout || '').trim() ||
      'Could not build the translator injector from source.';
    throw new Error(detail);
  }
  return outputPath;
}

function buildMacRuntimePairs(appPath, lang, stagingDir) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  const wrapperSourcePath = path.join(stagingDir, WRAPPER_EXECUTABLE_NAME);
  const infoPlistSourcePath = path.join(stagingDir, 'Info.plist');
  const langMarkerSourcePath = path.join(stagingDir, LANG_MARKER_NAME);
  const injectorSourcePath = getBundledInjectorSourcePath(appPath);

  fs.writeFileSync(wrapperSourcePath, buildLaunchWrapper(), { mode: 0o755 });
  fs.writeFileSync(infoPlistSourcePath, buildWrappedInfoPlist(appPath), 'utf8');
  fs.writeFileSync(langMarkerSourcePath, lang === 'en' ? '' : `${lang}\n`, 'utf8');

  return [
    { src: infoPlistSourcePath, dst: getInfoPlistPath(appPath) },
    { src: wrapperSourcePath, dst: getWrapperExecutablePath(appPath) },
    { src: injectorSourcePath, dst: getInstalledInjectorPath(appPath) },
    { src: langMarkerSourcePath, dst: getLangMarkerPath(appPath) },
  ];
}

function removeSignatureIfPresent(targetPath) {
  const result = runCommandMaybeWithAdmin('codesign', ['--remove-signature', targetPath]);
  if (result.status === 0) {
    return;
  }

  const detail = (result.stderr || result.stdout || '').trim();
  if (/not signed at all|code object is not signed/i.test(detail)) {
    return;
  }

  throw new Error(detail || `Could not remove existing signature from ${targetPath}.`);
}

function resignPatchedBundle(appPath) {
  if (process.platform !== 'darwin') {
    return;
  }

  const crashpadPath = path.join(appPath, 'Contents', 'MacOS', 'crashpad_handler');
  if (fs.existsSync(crashpadPath)) {
    removeSignatureIfPresent(crashpadPath);

    const crashpadSign = runCommandMaybeWithAdmin('codesign', [
      '--force',
      '--sign',
      '-',
      crashpadPath,
    ]);
    if (crashpadSign.status !== 0) {
      const detail = (crashpadSign.stderr || crashpadSign.stdout || '').trim();
      throw new Error(detail || 'Could not re-sign crashpad_handler.');
    }
  }

  const result = runCommandMaybeWithAdmin('codesign', ['--force', '--deep', '--sign', '-', appPath]);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || 'Could not re-sign the patched app bundle.');
  }
}

function quitCavalryBundle(appPath) {
  const appName = path.basename(appPath, '.app');
  spawnSync('osascript', ['-e', `tell application "${appName.replace(/"/g, '\\"')}" to quit`], {
    stdio: 'ignore',
  });
}

function normalizeState(value = {}) {
  return {
    appPath: typeof value.appPath === 'string' ? value.appPath : '',
    cavalryVersion: typeof value.cavalryVersion === 'string' ? value.cavalryVersion : '',
    currentLang:
      typeof value.currentLang === 'string' && LANGUAGE_LABELS[value.currentLang]
        ? value.currentLang
        : 'en',
    lastPatchedAt: typeof value.lastPatchedAt === 'string' ? value.lastPatchedAt : '',
  };
}

function readState() {
  const statePath = getStatePath();
  if (!fs.existsSync(statePath)) {
    return null;
  }

  return normalizeState(JSON.parse(fs.readFileSync(statePath, 'utf8')));
}

function writeState(value) {
  const state = normalizeState(value);
  fs.mkdirSync(getStateDir(), { recursive: true });
  fs.writeFileSync(getStatePath(), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function syncStateWithBundle(state, appPath, version) {
  const defaultLang =
    state.appPath === appPath && state.cavalryVersion === version ? state.currentLang : 'en';
  const nextState = normalizeState({
    ...state,
    appPath,
    cavalryVersion: version,
    currentLang: readInstalledLanguage(appPath, defaultLang),
  });

  if (
    state.appPath === nextState.appPath &&
    state.cavalryVersion === nextState.cavalryVersion &&
    state.currentLang === nextState.currentLang &&
    state.lastPatchedAt === nextState.lastPatchedAt
  ) {
    return state;
  }

  return writeState(nextState);
}

function getLanguageChoices() {
  return [
    { value: 'en', label: LANGUAGE_LABELS.en },
    ...listLanguageOptions(languagesDir).map((code) => ({
      value: code,
      label: LANGUAGE_LABELS[code] || code,
    })),
  ];
}

function hasEnglishSnapshot() {
  const englishDir = getEnglishSnapshotDir();
  return ['nodeStrings.json', 'appStrings.json', 'tips.json', 'onboarding.json'].every((fileName) =>
    fs.existsSync(path.join(englishDir, fileName))
  );
}

function needsEnglishExtract(state, appPath, version) {
  if (!appPath) {
    return false;
  }

  return !hasEnglishSnapshot() || state.appPath !== appPath || state.cavalryVersion !== version;
}

function getResolvedState() {
  const existingState = readState() || normalizeState();
  const appPath = findCavalryApp(existingState?.appPath || '');
  const version = appPath ? readBundleVersion(appPath) : '';
  const state = syncStateWithBundle(existingState, appPath, version);

  return {
    appPath,
    state,
    version,
  };
}

function extractEnglishSnapshotOrThrow(state, appPath, version) {
  if (!needsEnglishExtract(state, appPath, version)) {
    return { count: 0, state };
  }

  const canSafelyRefreshFromBundle =
    state.currentLang === 'en' || state.appPath !== appPath || state.cavalryVersion !== version;

  if (!canSafelyRefreshFromBundle) {
    throw new Error(
      'The English snapshot is missing for a translated install. Point the app picker to a clean Cavalry.app and refresh English first.'
    );
  }

  const count = extractEnglish(appPath, getEnglishSnapshotDir());
  return {
    count,
    state: writeState({
      ...state,
      appPath,
      cavalryVersion: version,
    }),
  };
}

function restartCavalryBundle(appPath) {
  if (!appPath) {
    throw new Error('Select a Cavalry.app first.');
  }

  if (process.platform === 'darwin') {
    quitCavalryBundle(appPath);

    const child = spawn('open', ['-n', appPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  if (process.platform === 'win32') {
    const child = spawn('cmd', ['/c', 'start', '', appPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

ipcMain.handle('i18n:get-status', async () => {
  const { appPath, state, version } = getResolvedState();

  return {
    appPath,
    currentLang: state.currentLang,
    defaultAppCandidates: getDefaultAppCandidates(),
    diagnostics: appPath ? inspectBundle(appPath) : null,
    languages: getLanguageChoices(),
    needsExtract: needsEnglishExtract(state, appPath, version),
    repoRoot,
    version,
  };
});

ipcMain.handle('i18n:browse-app', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Cavalry.app',
    defaultPath: '/Applications',
    properties: ['openFile'],
    filters: [{ name: 'Applications', extensions: ['app'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const appPath = result.filePaths[0];
  const version = readBundleVersion(appPath);
  const previousState = readState() || normalizeState();
  syncStateWithBundle(
    {
      ...previousState,
      appPath,
      cavalryVersion: version,
    },
    appPath,
    version
  );

  return {
    canceled: false,
    appPath,
    version,
  };
});

ipcMain.handle('i18n:extract-english', async (_event, payload) => {
  try {
    const requestedPath = payload?.appPath || '';
    const storedState = readState() || normalizeState();
    const appPath = requestedPath || findCavalryApp(storedState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    const version = readBundleVersion(appPath);
    const currentState = syncStateWithBundle(storedState, appPath, version);
    const count = extractEnglish(appPath, getEnglishSnapshotDir());
    writeState({
      ...currentState,
      appPath,
      cavalryVersion: version,
      currentLang: currentState.appPath === appPath ? currentState.currentLang : 'en',
    });

    return { ok: true, count };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('i18n:apply-language', async (_event, payload) => {
  try {
    const lang = payload?.lang || '';
    if (!LANGUAGE_LABELS[lang]) {
      return { ok: false, error: `Unsupported language: ${lang}` };
    }

    const storedState = readState() || normalizeState();
    const appPath = payload?.appPath || findCavalryApp(storedState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    const version = readBundleVersion(appPath);
    const currentState = syncStateWithBundle(storedState, appPath, version);

    if (lang === 'en' && currentState.currentLang === 'en') {
      return { ok: true, currentLang: 'en', warning: '' };
    }

    const snapshotResult =
      lang === 'en'
        ? { count: 0, state: currentState }
        : extractEnglishSnapshotOrThrow(currentState, appPath, version);
    const sourceDir = lang === 'en' ? getEnglishSnapshotDir() : path.join(languagesDir, lang);
    if (!fs.existsSync(sourceDir)) {
      if (lang === 'en') {
        return {
          ok: false,
          error:
            'English snapshot not found. Point the app picker to a clean Cavalry.app and refresh English first.',
        };
      }
      return { ok: false, error: `Language files not found for ${lang}.` };
    }

    const pairs = buildCopyPairs(sourceDir, appPath);
    if (pairs.length === 0) {
      return { ok: false, error: `No JSON assets found for ${lang}.` };
    }

    const stagingRoot = path.join(os.tmpdir(), `cavalry-i18n-staging-${Date.now()}-${process.pid}`);
    let copyMode = 'shell';
    try {
      const runtimeSourceDir = path.join(stagingRoot, 'runtime');
      const stagedFilesDir = path.join(stagingRoot, 'staged');
      const runtimePairs =
        process.platform === 'darwin' ? buildMacRuntimePairs(appPath, lang, runtimeSourceDir) : [];
      const stagedPairs = stageFiles([...pairs, ...runtimePairs], stagedFilesDir);
      copyMode = copyWithSudo(stagedPairs);
      if (process.platform === 'darwin') {
        resignPatchedBundle(appPath);
      }
    } finally {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }

    const signature = verifyCodeSignature(appPath);
    const nextState = writeState({
      ...snapshotResult.state,
      appPath,
      cavalryVersion: version,
      currentLang: lang,
      lastPatchedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      currentLang: nextState.currentLang,
      warning: [
        copyMode === 'finder'
          ? 'macOS blocked direct shell copy, so Finder-style replacement was used.'
          : '',
        signature.ok ? '' : signature.message,
      ]
        .filter(Boolean)
        .join(' '),
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('i18n:restart-cavalry', async (_event, payload) => {
  try {
    const storedState = readState() || normalizeState();
    const appPath = payload?.appPath || findCavalryApp(storedState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    const version = readBundleVersion(appPath);
    syncStateWithBundle(storedState, appPath, version);
    restartCavalryBundle(appPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
