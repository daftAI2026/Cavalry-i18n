const appPathInput = document.querySelector('#appPath');
const outputAppPathInput = document.querySelector('#outputAppPath');
const languageSelect = document.querySelector('#language');
const qmTargetSelect = document.querySelector('#qmTarget');
const refreshEnglishInput = document.querySelector('#refreshEnglish');
const outputLog = document.querySelector('#outputLog');
const diagnosticsGrid = document.querySelector('#diagnosticsGrid');
const browseButton = document.querySelector('#browseButton');
const inspectButton = document.querySelector('#inspectButton');
const applyButton = document.querySelector('#applyButton');

function renderDiagnostics(diagnostics) {
  if (!diagnostics) {
    diagnosticsGrid.innerHTML = '<div class="diagnostic-empty">No bundle selected yet.</div>';
    return;
  }

  const items = [
    ['Bundle exists', diagnostics.exists ? 'Yes' : 'No'],
    ['Version', diagnostics.version || 'Unknown'],
    ['Assets root', diagnostics.hasAssetsRoot ? 'Present' : 'Missing'],
    ['Definitions', diagnostics.hasDefinitions ? 'Present' : 'Missing'],
    ['Learn', diagnostics.hasLearn ? 'Present' : 'Missing'],
    ['Plugins', diagnostics.hasPlugins ? 'Present' : 'Missing'],
    ['MacOS translations dir', diagnostics.macOSTranslationsExists ? 'Present' : 'Missing'],
    ['Resources translations dir', diagnostics.resourcesTranslationsExists ? 'Present' : 'Missing'],
    ['MacOS translations path', diagnostics.macOSTranslationsDir],
    ['Resources translations path', diagnostics.resourcesTranslationsDir],
  ];

  diagnosticsGrid.innerHTML = items
    .map(
      ([label, value]) =>
        `<div class="diagnostic-item"><dt>${label}</dt><dd>${String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')}</dd></div>`
    )
    .join('');
}

function setOutput(text) {
  outputLog.textContent = text;
}

async function refreshDiagnostics() {
  const appPath = appPathInput.value.trim();
  if (!appPath) {
    renderDiagnostics(null);
    setOutput('Select a Cavalry.app first.');
    return;
  }

  const diagnostics = await window.desktopPatcher.inspectApp(appPath);
  renderDiagnostics(diagnostics);
  setOutput(`Inspected: ${appPath}`);
}

async function bootstrap() {
  const bootstrapState = await window.desktopPatcher.getBootstrap();
  appPathInput.value = bootstrapState.appPath || bootstrapState.defaultAppCandidates[0] || '';

  languageSelect.innerHTML = bootstrapState.languages
    .map((language) => `<option value="${language.value}">${language.label}</option>`)
    .join('');
  languageSelect.value = bootstrapState.languages.some((language) => language.value === 'zh-Hans')
    ? 'zh-Hans'
    : bootstrapState.languages[0]?.value || '';

  renderDiagnostics(bootstrapState.diagnostics);
  if (bootstrapState.appPath) {
    setOutput(`Discovered installed app: ${bootstrapState.appPath}`);
  } else {
    setOutput(
      `No default Cavalry.app found. Tried:\n${bootstrapState.defaultAppCandidates.join('\n')}`
    );
  }
}

browseButton.addEventListener('click', async () => {
  const result = await window.desktopPatcher.chooseApp();
  if (result.canceled) {
    return;
  }

  appPathInput.value = result.appPath;
  renderDiagnostics(result.diagnostics);
  setOutput(`Selected app bundle:\n${result.appPath}`);
});

inspectButton.addEventListener('click', async () => {
  await refreshDiagnostics();
});

applyButton.addEventListener('click', async () => {
  const appPath = appPathInput.value.trim();
  if (!appPath) {
    setOutput('Select a Cavalry.app before patching.');
    return;
  }
  if (!languageSelect.value) {
    setOutput('No language pack is available.');
    return;
  }

  setOutput('Running external patcher…');
  const result = await window.desktopPatcher.runPatch({
    appPath,
    outputAppPath: outputAppPathInput.value.trim(),
    language: languageSelect.value,
    qmTarget: qmTargetSelect.value,
    refreshEnglish: refreshEnglishInput.checked,
  });

  await refreshDiagnostics();
  setOutput(
    [
      `$ ${result.command}`,
      '',
      result.stdout || '(no stdout)',
      result.stderr ? `\n[stderr]\n${result.stderr}` : '',
      `\nExit code: ${result.code}`,
      result.ok ? '\nPatch finished.' : '\nPatch failed.',
    ].join('\n')
  );
});

bootstrap().catch((error) => {
  setOutput(`Bootstrap failed:\n${error.stack || error.message}`);
});
