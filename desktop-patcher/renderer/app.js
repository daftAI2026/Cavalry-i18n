const appVersion = document.querySelector('#appVersion');
const appPathText = document.querySelector('#appPath');
const currentLanguage = document.querySelector('#currentLanguage');
const languageSelect = document.querySelector('#languageSelect');
const browseButton = document.querySelector('#browseButton');
const extractButton = document.querySelector('#extractButton');
const applyButton = document.querySelector('#applyButton');
const statusText = document.querySelector('#statusText');

const api = window.cavalryI18n;
const state = {
  appPath: '',
  currentLang: 'en',
  languages: [],
  needsExtract: false,
};

function setStatus(message, tone = 'neutral') {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setBusy(isBusy) {
  browseButton.disabled = isBusy;
  extractButton.disabled = isBusy;
  applyButton.disabled = isBusy;
  languageSelect.disabled = isBusy;
}

function updateLanguageOptions(languages) {
  languageSelect.innerHTML = languages
    .map((language) => `<option value="${language.value}">${language.label}</option>`)
    .join('');
}

function languageLabel(code) {
  const match = state.languages.find((language) => language.value === code);
  return match ? match.label : code;
}

async function bootstrap() {
  const bootstrapState = await api.getStatus();
  state.appPath = bootstrapState.appPath || '';
  state.currentLang = bootstrapState.currentLang || 'en';
  state.languages = bootstrapState.languages || [];
  state.needsExtract = Boolean(bootstrapState.needsExtract);

  updateLanguageOptions(state.languages);
  languageSelect.value = state.currentLang;
  currentLanguage.textContent = languageLabel(state.currentLang);

  if (state.appPath) {
    appVersion.textContent = bootstrapState.version
      ? `Cavalry ${bootstrapState.version}`
      : 'Cavalry found';
    appPathText.textContent = state.appPath;
  } else {
    appVersion.textContent = 'Cavalry not found';
    appPathText.textContent = `Tried:\n${bootstrapState.defaultAppCandidates.join('\n')}`;
  }

  if (!state.appPath) {
    setStatus('Choose a Cavalry.app to continue.', 'warning');
    return;
  }

  if (state.needsExtract) {
    setStatus('English source files need to be refreshed before the next patch.', 'warning');
    return;
  }

  setStatus('Ready.', 'success');
}

browseButton.addEventListener('click', async () => {
  const result = await api.browseApp();
  if (result.canceled) {
    return;
  }

  await bootstrap();
  setStatus(`Selected ${result.appPath}`, 'success');
});

extractButton.addEventListener('click', async () => {
  if (!state.appPath) {
    setStatus('Choose a Cavalry.app first.', 'warning');
    return;
  }

  setBusy(true);
  setStatus('Refreshing the English snapshot…');

  try {
    const result = await api.extractEnglish(state.appPath);
    if (!result.ok) {
      setStatus(result.error || 'Could not refresh the English snapshot.', 'error');
      return;
    }

    await bootstrap();
    setStatus(`English snapshot refreshed (${result.count} files).`, 'success');
  } finally {
    setBusy(false);
  }
});

applyButton.addEventListener('click', async () => {
  if (!state.appPath) {
    setStatus('Choose a Cavalry.app first.', 'warning');
    return;
  }
  if (!languageSelect.value) {
    setStatus('No language pack is available.', 'warning');
    return;
  }

  const nextLanguage = languageSelect.value;
  setBusy(true);
  setStatus(`Applying ${languageLabel(nextLanguage)}…`);

  try {
    const result = await api.applyLanguage(state.appPath, nextLanguage);
    if (!result.ok) {
      setStatus(result.error || 'Patch failed.', 'error');
      return;
    }

    const restart = await api.restartCavalry(state.appPath);
    await bootstrap();

    if (!restart.ok) {
      setStatus(restart.error || 'Language applied, but Cavalry could not be restarted.', 'warning');
      return;
    }

    const warningSuffix = result.warning ? ` ${result.warning}` : '';
    setStatus(`Applied ${languageLabel(nextLanguage)} and restarted Cavalry.${warningSuffix}`, 'success');
  } finally {
    setBusy(false);
  }
});

bootstrap().catch((error) => {
  setStatus(`Bootstrap failed: ${error.stack || error.message}`, 'error');
});
