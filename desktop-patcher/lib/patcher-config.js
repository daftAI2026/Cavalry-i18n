const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function listLanguageOptions(repoRoot) {
  const languagesDir = path.join(repoRoot, 'LanguageSwitcher_assets', 'languages');
  return fs
    .readdirSync(languagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'en')
    .map((entry) => ({ label: entry.name, value: entry.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getDefaultAppCandidates() {
  return [
    '/Applications/Cavalry.app',
    path.join(os.homedir(), 'Applications', 'Cavalry.app'),
  ];
}

function buildPatchCommand({ repoRoot, appPath, outputAppPath, language, qmTarget, refreshEnglish }) {
  const args = [
    path.join(repoRoot, 'tools', 'patch_cavalry_bundle.py'),
    '--app',
    appPath,
  ];

  if (outputAppPath) {
    args.push('--output-app', outputAppPath);
  }

  args.push('--lang', language);

  if (refreshEnglish) {
    args.push('--refresh-en');
  }

  args.push('--qm-target', qmTarget);

  return {
    program: 'python3',
    args,
  };
}

function getExistingDefaultAppPath() {
  return getDefaultAppCandidates().find((candidate) => fs.existsSync(candidate)) || '';
}

function readBundleVersion(appPath) {
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(infoPlist)) {
    return '';
  }

  try {
    return execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleShortVersionString', infoPlist],
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    return '';
  }
}

function inspectBundle(appPath) {
  const contents = path.join(appPath, 'Contents');
  const assetsRoot = path.join(contents, 'assets');
  const diagnostics = {
    exists: fs.existsSync(appPath),
    appPath,
    version: '',
    macOSTranslationsDir: path.join(contents, 'MacOS', 'translations'),
    resourcesTranslationsDir: path.join(contents, 'Resources', 'translations'),
    hasAssetsRoot: fs.existsSync(assetsRoot),
    hasDefinitions: fs.existsSync(path.join(assetsRoot, 'Definitions')),
    hasLearn: fs.existsSync(path.join(assetsRoot, 'Learn')),
    hasPlugins: fs.existsSync(path.join(assetsRoot, 'Plugins')),
    macOSTranslationsExists: fs.existsSync(path.join(contents, 'MacOS', 'translations')),
    resourcesTranslationsExists: fs.existsSync(path.join(contents, 'Resources', 'translations')),
  };

  if (diagnostics.exists) {
    diagnostics.version = readBundleVersion(appPath);
  }

  return diagnostics;
}

module.exports = {
  buildPatchCommand,
  getDefaultAppCandidates,
  getExistingDefaultAppPath,
  inspectBundle,
  listLanguageOptions,
};
