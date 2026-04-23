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
    setStatus(
      `Applied ${languageLabel(nextLanguage)} and restarted Cavalry.${warningSuffix}`,
      result.warning ? 'warning' : 'success'
    );
  } finally {
    setBusy(false);
  }
});

bootstrap().catch((error) => {
  setStatus(`Bootstrap failed: ${error.stack || error.message}`, 'error');
});

/* ── Custom Select: sync with native <select> ── */
(function initCustomSelect() {
  const trigger = document.querySelector('#selectTrigger');
  const popup = document.querySelector('#selectPopup');
  const triggerText = trigger.querySelector('.select-trigger-text');
  let focusedIndex = -1;

  function syncPopup() {
    const options = Array.from(languageSelect.options);
    popup.innerHTML = options
      .map(
        (opt, i) =>
          `<li class="select-option" role="option" data-value="${opt.value}" aria-selected="${opt.value === languageSelect.value}" data-index="${i}">${opt.textContent}</li>`
      )
      .join('');
    triggerText.textContent =
      options.find((o) => o.value === languageSelect.value)?.textContent || '';
    focusedIndex = -1;
  }

  function open() {
    if (trigger.disabled) return;
    syncPopup();
    popup.setAttribute('data-open', '');
    trigger.setAttribute('aria-expanded', 'true');
    focusedIndex = Array.from(languageSelect.options).findIndex(
      (o) => o.value === languageSelect.value
    );
    updateFocus();
  }

  function close() {
    popup.removeAttribute('data-open');
    trigger.setAttribute('aria-expanded', 'false');
    focusedIndex = -1;
  }

  function isOpen() {
    return popup.hasAttribute('data-open');
  }

  function pick(value) {
    languageSelect.value = value;
    syncPopup();
    close();
  }

  function updateFocus() {
    popup.querySelectorAll('.select-option').forEach((el, i) => {
      if (i === focusedIndex) el.setAttribute('data-focused', '');
      else el.removeAttribute('data-focused');
    });
    const focused = popup.querySelector('[data-focused]');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen() ? close() : open();
  });

  popup.addEventListener('click', (e) => {
    const option = e.target.closest('.select-option');
    if (option) pick(option.dataset.value);
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && !trigger.contains(e.target) && !popup.contains(e.target)) close();
  });

  trigger.addEventListener('keydown', (e) => {
    const items = popup.querySelectorAll('.select-option');
    if (!isOpen()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); focusedIndex = Math.min(focusedIndex + 1, items.length - 1); updateFocus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); focusedIndex = Math.max(focusedIndex - 1, 0); updateFocus(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && items[focusedIndex]) pick(items[focusedIndex].dataset.value);
    }
  });

  new MutationObserver(syncPopup).observe(languageSelect, { childList: true, attributes: true });
  languageSelect.addEventListener('change', syncPopup);

  const origDisabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');
  Object.defineProperty(languageSelect, 'disabled', {
    get() { return origDisabledDesc.get.call(this); },
    set(v) {
      origDisabledDesc.set.call(this, v);
      trigger.disabled = v;
    },
  });

  syncPopup();
})();
