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
    path.join(appPath, 'Contents', 'Frameworks', 'libExtensionLayer.dylib'),
  ].filter((targetPath) => fs.existsSync(targetPath));

  if (targets.length === 0) {
    fail(`Could not find compiled UI targets inside ${appPath}.`);
  }

  return targets;
}

function normalizeCandidate(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isReviewableCharacterSet(value) {
  return /^[\p{L}\p{N}\s&/.,:;()'"%+\-?![\]]+$/u.test(value);
}

function isSingleUiWord(value) {
  return /^[A-Z][a-z]+(?:['-][A-Za-z]+)?$/.test(value);
}

function hasMeaningfulAlphaToken(value) {
  return /[A-Za-z]{3,}/.test(value);
}

function isKnownNonUiString(value) {
  return /^(?:Accept|Accepted|Already Reported|Bad Gateway|Bad Request|Content-Type|Content-Range|Forbidden|Gateway Timeout|Internal Server Error|Keep-Alive|Auth callback missing code or state|Auth has no pending auth flow|Concurrent task failed with unknown exception|cannot create object from initializer list|I'm a teapot)$/.test(
    value
  );
}

function tokensLookUiLike(value) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.replace(/^[()[\].,!?:;"']+|[()[\].,!?:;"']+$/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => {
    if (/^\d+(?:%|[A-Z])?$/.test(token)) {
      return true;
    }

    if (/^[A-Z]{2,5}$/.test(token)) {
      return true;
    }

    if (/[a-z][A-Z]/.test(token)) {
      return false;
    }

    if (token.includes('-')) {
      const segments = token.split('-');
      if (segments.some((segment) => segment.length <= 1)) {
        return false;
      }
    }

    return /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(token);
  });
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

  if (!/^[A-Za-z0-9]/.test(value) || !/[A-Za-z0-9.)!?]$/.test(value)) {
    return false;
  }

  if (!isReviewableCharacterSet(value)) {
    return false;
  }

  if (!hasMeaningfulAlphaToken(value)) {
    return false;
  }

  if (isKnownNonUiString(value)) {
    return false;
  }

  if (!tokensLookUiLike(value)) {
    return false;
  }

  if (/[@/\\]/.test(value)) {
    return false;
  }

  if (/[{}_=<>#]/.test(value)) {
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

  if (
    /(?:::|%[svd]|(?:nonce|cnonce|qop|realm|algorithm|filename|multipart|boundary|spdlog|nlohmann|allocator|shared_ptr|mutex|border-radius|QPushButton|Accept-Encoding|Accept-Ranges|Content-Encoding|Content-Length|Transfer-Encoding|Authorization|bytes))/i.test(
      value
    )
  ) {
    return false;
  }

  if (/\b[A-Z][a-z]+[A-Z][A-Za-z]+\b/.test(value) && !/\s/.test(value)) {
    return false;
  }

  if (!/\s/.test(value) && !isSingleUiWord(value)) {
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

function expandUiAliases(text) {
  const variants = [text];
  const stripped = text.replace(/(?:\.{3}|\.)$/, '').trim();
  if (stripped && stripped !== text && stripped.split(/\s+/).length >= 3 && isLikelyUiString(stripped)) {
    variants.push(stripped);
  }
  return variants;
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

function extractEntriesFromLines(sourcePath, rawLines) {
  const seen = new Set();
  const entries = [];

  for (const rawLine of rawLines) {
    const text = normalizeCandidate(rawLine);
    if (!isLikelyUiString(text)) {
      continue;
    }

    for (const candidate of expandUiAliases(text)) {
      const dedupeKey = `${sourcePath}\u0000${candidate}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      entries.push({
        source: sourcePath,
        text: candidate,
        normalizedText: candidate,
        surfaceHint: getSurfaceHint(candidate),
      });
    }
  }

  return entries;
}

function extractInventory(appPath) {
  const targets = getCompiledUiTargets(appPath);
  const entries = [];

  for (const targetPath of targets) {
    entries.push(...extractEntriesFromLines(targetPath, runStrings(targetPath)));
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

if (require.main === module) {
  main();
}

module.exports = {
  buildSourceMap,
  extractEntriesFromLines,
  extractInventory,
  getCompiledUiTargets,
  expandUiAliases,
  getSurfaceHint,
  isLikelyUiString,
  normalizeCandidate,
  parseArgs,
  runStrings,
};
