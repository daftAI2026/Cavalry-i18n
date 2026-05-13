#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ALLOWED_SOURCES = new Set(['live-injector', 'live-accessibility']);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    injector: '',
    accessibility: '',
    output: '',
    auditLog: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--injector') {
      options.injector = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--accessibility') {
      options.accessibility = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--audit-log') {
      options.auditLog = argv[index + 1] || '';
      index += 1;
    }
  }

  for (const key of ['injector', 'accessibility', 'output']) {
    if (!options[key]) {
      fail(`Missing required --${key} <path> argument.`);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function validateInventory(label, inventory, expectedSource) {
  if (!inventory || typeof inventory !== 'object') {
    fail(`Missing ${label} inventory payload.`);
  }
  const source = inventory.capture?.source || inventory.source || '';
  if (source !== expectedSource || !ALLOWED_SOURCES.has(source)) {
    fail(`${label} inventory must have capture.source=${expectedSource}.`);
  }
}

function coalesceSharedCaptureField(injectorInventory, accessibilityInventory, fieldName) {
  const injectorValue = injectorInventory.capture?.[fieldName];
  const accessibilityValue = accessibilityInventory.capture?.[fieldName];
  if (injectorValue && accessibilityValue && injectorValue !== accessibilityValue) {
    fail(`Runtime capture mismatch for ${fieldName}: ${injectorValue} !== ${accessibilityValue}`);
  }
  return injectorValue || accessibilityValue || '';
}

function mergeRuntimeInventories({ language, injectorInventory, accessibilityInventory }) {
  validateInventory('injector', injectorInventory, 'live-injector');
  validateInventory('accessibility', accessibilityInventory, 'live-accessibility');

  const mergedLanguage = language || injectorInventory.language || accessibilityInventory.language || '';
  if (!mergedLanguage) {
    fail('Merged runtime inventory requires a language.');
  }

  return {
    formatVersion: Math.max(injectorInventory.formatVersion || 0, accessibilityInventory.formatVersion || 0, 3),
    language: mergedLanguage,
    source: 'live-merged',
    capture: {
      pid: Number(coalesceSharedCaptureField(injectorInventory, accessibilityInventory, 'pid') || 0),
      bundleHash: coalesceSharedCaptureField(injectorInventory, accessibilityInventory, 'bundleHash'),
      sessionUuid: coalesceSharedCaptureField(injectorInventory, accessibilityInventory, 'sessionUuid'),
      wallclockUtc: new Date().toISOString(),
      source: 'live-merged',
    },
    menuBars: [...(injectorInventory.menuBars || []), ...(accessibilityInventory.menuBars || [])],
    widgetTexts: [...(injectorInventory.widgetTexts || []), ...(accessibilityInventory.widgetTexts || [])],
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const injectorInventory = readJson(options.injector);
  const accessibilityInventory = readJson(options.accessibility);
  const merged = mergeRuntimeInventories({
    language: injectorInventory.language || accessibilityInventory.language || '',
    injectorInventory,
    accessibilityInventory,
  });
  const outputPath = path.resolve(options.output);
  writeJson(outputPath, merged);

  if (options.auditLog) {
    writeJson(path.resolve(options.auditLog), {
      output: outputPath,
      outputHash: sha256(outputPath),
      inputs: {
        injector: {
          path: path.resolve(options.injector),
          hash: sha256(options.injector),
          source: injectorInventory.capture?.source || injectorInventory.source || '',
        },
        accessibility: {
          path: path.resolve(options.accessibility),
          hash: sha256(options.accessibility),
          source: accessibilityInventory.capture?.source || accessibilityInventory.source || '',
        },
      },
      capture: merged.capture,
      summary: {
        menuBars: merged.menuBars.length,
        widgetTexts: merged.widgetTexts.length,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        capture: merged.capture,
        menuBars: merged.menuBars.length,
        widgetTexts: merged.widgetTexts.length,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  mergeRuntimeInventories,
  parseArgs,
  readJson,
  writeJson,
};
