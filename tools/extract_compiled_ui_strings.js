#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    app: '',
    output: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--app') {
      options.app = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || '';
      index += 1;
      continue;
    }
  }

  if (!options.app) {
    fail('Missing required --app <Cavalry.app> argument.');
  }
  if (!options.output) {
    fail('Missing required --output <path> argument.');
  }

  return options;
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readPlistValue(plistText, key) {
  const match = plistText.match(
    new RegExp(`<key>${key}</key>\\s*<(?:string|integer)>([\\s\\S]*?)</(?:string|integer)>`)
  );
  return match ? match[1].trim() : '';
}

function getBundleMetadata(appPath) {
  const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    fail(`Missing Info.plist: ${infoPlistPath}`);
  }

  const plistText = readTextFile(infoPlistPath);
  return {
    bundleId: readPlistValue(plistText, 'CFBundleIdentifier'),
    bundleVersion: readPlistValue(plistText, 'CFBundleShortVersionString') || readPlistValue(plistText, 'CFBundleVersion'),
  };
}

function getCompiledUiTargets(appPath) {
  const targets = [
    path.join(appPath, 'Contents', 'MacOS', 'Cavalry'),
    path.join(appPath, 'Contents', 'Frameworks', 'libCavalryUI.dylib'),
    path.join(appPath, 'Contents', 'Frameworks', 'libCavalryFramework.dylib'),
  ].filter((targetPath) => fs.existsSync(targetPath));

  if (targets.length === 0) {
    fail(`Could not find compiled UI targets inside ${appPath}.`);
  }

  return targets;
}

function normalizeCandidate(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isLikelyUiString(value) {
  if (!value) {
    return false;
  }

  if (value.length < 3 || value.length > 120) {
    return false;
  }

  if (!/[A-Za-z]/.test(value)) {
    return false;
  }

  if (/[@/\\]/.test(value)) {
    return false;
  }

  if (/\.(?:dylib|framework|json|png|jpg|jpeg|svg|qml|qss|ttf|otf)$/i.test(value)) {
    return false;
  }

  if (/^[A-Z0-9_]+$/.test(value)) {
    return false;
  }

  if (/^(?:https?:|com\.|org\.|Qt\d|objc_|std::|Q[A-Z][A-Za-z]+)/.test(value)) {
    return false;
  }

  return true;
}

function getSurfaceHint(text) {
  if (/^[A-Z][A-Za-z0-9&'/. -]{1,48}$/.test(text) && text.split(/\s+/).length <= 5) {
    return 'menu-or-action-like';
  }
  if (/[.!?]$/.test(text) || text.split(/\s+/).length > 5) {
    return 'sentence-like';
  }
  return 'label-like';
}

function runStrings(binaryPath) {
  const result = spawnSync('/usr/bin/strings', ['-a', '-n', '4', binaryPath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    fail(
      (result.stderr || result.stdout || '').trim() ||
        `Could not extract strings from ${binaryPath}.`
    );
  }

  return result.stdout.split(/\r?\n/);
}

function extractInventory(appPath) {
  const targets = getCompiledUiTargets(appPath);
  const seen = new Set();
  const entries = [];

  for (const targetPath of targets) {
    for (const rawLine of runStrings(targetPath)) {
      const text = normalizeCandidate(rawLine);
      if (!isLikelyUiString(text)) {
        continue;
      }

      const dedupeKey = `${targetPath}\u0000${text}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      entries.push({
        source: targetPath,
        text,
        normalizedText: text,
        surfaceHint: getSurfaceHint(text),
      });
    }
  }

  return entries.sort((left, right) => {
    if (left.normalizedText !== right.normalizedText) {
      return left.normalizedText.localeCompare(right.normalizedText);
    }
    return left.source.localeCompare(right.source);
  });
}

function buildSourceMap(appPath) {
  const { bundleId, bundleVersion } = getBundleMetadata(appPath);
  const compiledUiTargets = getCompiledUiTargets(appPath);
  const jsonAssetRoots = [
    'languages/<locale>/appStrings.json',
    'languages/<locale>/nodeStrings.json',
    'languages/<locale>/tips.json',
    'languages/<locale>/onboarding.json',
    'languages/<locale>/plugins/*.json',
    `${appPath}/Contents/assets/Definitions/appStrings.json`,
    `${appPath}/Contents/assets/Definitions/nodeStrings.json`,
    `${appPath}/Contents/assets/Learn/tips.json`,
    `${appPath}/Contents/assets/Learn/onboarding.json`,
    `${appPath}/Contents/assets/Plugins/*/strings.json`,
  ];

  return {
    bundleId,
    bundleVersion,
    generatedBy: 'tools/extract_compiled_ui_strings.js',
    kind: 'ownership-map',
    authoritativeRuntimeInventory: '~/Library/Caches/Cavalry-i18n/menu-inventory.json',
    jsonAssetRoots,
    compiledUiTargets,
    surfaces: [
      {
        id: 'json-assets',
        owner: 'JSON asset pipeline',
        carries: ['node labels', 'plugin strings', 'tips', 'onboarding', 'limited app strings'],
        paths: jsonAssetRoots,
      },
      {
        id: 'compiled-ui',
        owner: 'Compiled Qt/UI code',
        carries: ['menus', 'actions', 'panel titles', 'compiled UI labels'],
        paths: compiledUiTargets,
      },
      {
        id: 'qt-builtins',
        owner: 'Qt built-in translators',
        carries: ['file dialogs', 'message boxes', 'common widget chrome'],
        paths: [
          `${appPath}/Contents/Frameworks/QtCore.framework`,
          `${appPath}/Contents/Frameworks/QtGui.framework`,
          `${appPath}/Contents/Frameworks/QtWidgets.framework`,
        ],
      },
    ],
    notes: [
      'JSON assets cover node/plugin/onboarding/tips surfaces, not the full compiled Qt UI.',
      'Compiled menu, action, and panel labels are inventoried from bundled binaries/frameworks with macOS strings.',
      'This inventory is a source map for workflow coverage and still needs human translation curation downstream.',
    ],
    entries: extractInventory(appPath),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceMap = buildSourceMap(path.resolve(options.app));
  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sourceMap, null, 2)}\n`);
}

main();
