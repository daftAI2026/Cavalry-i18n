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

function getTranslatedAppsDir() {
  return path.join(getStateDir(), 'translated-apps');
}

function sanitizePathSegment(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function getTranslatedAppPath(appPath, version, lang) {
  return path.join(
    getTranslatedAppsDir(),
    sanitizePathSegment(version),
    sanitizePathSegment(lang, 'en'),
    path.basename(appPath)
  );
}

function prepareTranslatedApp(appPath, version, lang) {
  const translatedAppPath = getTranslatedAppPath(appPath, version, lang);
  fs.rmSync(translatedAppPath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(translatedAppPath), { recursive: true });
  const result = spawnSync('ditto', [appPath, translatedAppPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim() || 'Could not create translated app copy.';
    throw new Error(detail);
  }
  return translatedAppPath;
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
  const existingState = readState();
  const appPath = findCavalryApp(existingState?.appPath || '');
  const version = appPath ? readBundleVersion(appPath) : '';
  const state = existingState || writeState({
    appPath,
    cavalryVersion: version,
    currentLang: 'en',
    lastPatchedAt: '',
  });

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

function launchTranslatedCavalry(appPath, version, lang) {
  const translatedAppPath = getTranslatedAppPath(appPath, version, lang);
  if (!fs.existsSync(translatedAppPath)) {
    throw new Error('Translated app copy is missing. Apply the language again before restarting.');
  }

  const launcherPath = path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh');
  if (!fs.existsSync(launcherPath)) {
    throw new Error('Translated launcher is missing from tools/launch_cavalry_with_injector.sh.');
  }

  quitCavalryBundle(appPath);

  const result = spawnSync('/bin/bash', [launcherPath, '--app', translatedAppPath, '--lang', lang], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim() || 'Translated launcher failed.';
    throw new Error(detail);
  }
}

function restartCavalryBundle(appPath, version, lang) {
  if (!appPath) {
    throw new Error('Select a Cavalry.app first.');
  }

  if (process.platform === 'darwin') {
    if (lang && lang !== 'en') {
      launchTranslatedCavalry(appPath, version, lang);
      return;
    }

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
  const isSameApp = previousState.appPath === appPath;

  writeState({
    ...previousState,
    appPath,
    cavalryVersion: isSameApp ? previousState.cavalryVersion : '',
    currentLang: isSameApp ? previousState.currentLang : 'en',
    lastPatchedAt: isSameApp ? previousState.lastPatchedAt : '',
  });

  return {
    canceled: false,
    appPath,
    version,
  };
});

ipcMain.handle('i18n:extract-english', async (_event, payload) => {
  try {
    const requestedPath = payload?.appPath || '';
    const currentState = readState() || normalizeState();
    const appPath = requestedPath || findCavalryApp(currentState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    const version = readBundleVersion(appPath);
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

    const currentState = readState() || normalizeState();
    const appPath = payload?.appPath || findCavalryApp(currentState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    if (lang === 'en' && currentState.currentLang === 'en') {
      return { ok: true, currentLang: 'en', warning: '' };
    }

    const version = readBundleVersion(appPath);
    const snapshotResult =
      lang === 'en'
        ? { count: 0, state: currentState }
        : extractEnglishSnapshotOrThrow(currentState, appPath, version);
    const targetAppPath =
      process.platform === 'darwin' && lang !== 'en'
        ? prepareTranslatedApp(appPath, version, lang)
        : appPath;

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

    const pairs = buildCopyPairs(sourceDir, targetAppPath);
    if (pairs.length === 0) {
      return { ok: false, error: `No JSON assets found for ${lang}.` };
    }

    const stagingDir = path.join(os.tmpdir(), `cavalry-i18n-staging-${Date.now()}-${process.pid}`);
    let copyMode = 'shell';
    try {
      const stagedPairs = stageFiles(pairs, stagingDir);
      copyMode = copyWithSudo(stagedPairs);
    } finally {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }

    const signature =
      targetAppPath === appPath ? verifyCodeSignature(appPath) : { ok: true, message: '' };
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
        targetAppPath !== appPath
          ? `Using managed translated app copy: ${targetAppPath}`
          : '',
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
    const currentState = readState() || normalizeState();
    const appPath = payload?.appPath || findCavalryApp(currentState.appPath);
    if (!appPath) {
      return { ok: false, error: 'Select a Cavalry.app first.' };
    }

    const version = readBundleVersion(appPath) || currentState.cavalryVersion;
    restartCavalryBundle(appPath, version, currentState.currentLang);
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
