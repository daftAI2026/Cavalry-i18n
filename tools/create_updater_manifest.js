#!/usr/bin/env node
/**
 * [INPUT]: 依赖 release.config.json/package.json 的 tag 与 SemVer 真相、三个 updater artifact、对应 Tauri `.sig` 和已审阅更新摘要
 * [OUTPUT]: 对外提供确定性 `latest.json` 生成器，只发布 darwin-aarch64、darwin-x86_64、windows-x86_64 三个平台映射
 * [POS]: tools 的静态 updater manifest 边界；把签名产物投影为公开下载描述，不生成密钥、不签名、不上传 Release
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, metadataForTag } = require('./release_metadata');

const rootDir = process.cwd();
const args = process.argv.slice(2);
const PLATFORM_SPECS = Object.freeze([
  Object.freeze({
    key: 'darwin-aarch64',
    artifactOption: '--darwin-aarch64',
    signatureOption: '--darwin-aarch64-signature',
    metadataName: 'RELEASE_UPDATER_ASSET_NAME_AARCH64',
  }),
  Object.freeze({
    key: 'darwin-x86_64',
    artifactOption: '--darwin-x86_64',
    signatureOption: '--darwin-x86_64-signature',
    metadataName: 'RELEASE_UPDATER_ASSET_NAME_X64',
  }),
  Object.freeze({
    key: 'windows-x86_64',
    artifactOption: '--windows-x86_64',
    signatureOption: '--windows-x86_64-signature',
    metadataName: 'RELEASE_ASSET_NAME_WINDOWS_X64',
  }),
]);

function fail(message) {
  throw new Error(message);
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function requireOption(name) {
  return optionValue(name) || fail(`Missing required option ${name}.`);
}

function regularFile(file, label) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    fail(`${label} is unavailable: ${error.message}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) {
    fail(`${label} must be a non-empty regular file: ${file}.`);
  }
  return stat;
}

function readSignature(file, label) {
  regularFile(file, label);
  const signature = fs.readFileSync(file, 'utf8').trim();
  if (
    signature.length < 16 ||
    signature.length > 8192 ||
    signature.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)
  ) {
    fail(`${label} must contain one bounded base64 Tauri updater signature.`);
  }
  return signature;
}

function readNotes(file) {
  regularFile(file, 'Updater notes');
  const notes = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  if (!notes || notes.length > 16_384 || notes.includes('\0')) {
    fail('Updater notes must contain 1 to 16384 non-NUL characters.');
  }
  return notes;
}

function readVersion() {
  const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    fail('package.json version must be a plain stable SemVer for updater publication.');
  }
  return version;
}

function normalizePubDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) fail('--pub-date must be a valid RFC 3339 timestamp.');
  return date.toISOString();
}

function encodedAssetUrl(baseUrl, assetName) {
  return `${baseUrl}/${encodeURIComponent(assetName)}`;
}

function exactKeys(value, expected, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())
  ) {
    fail(`${label} has missing or unexpected fields.`);
  }
}

function verifyManifestClosure({ manifestPath, metadata, artifacts, signatures, version = readVersion() }) {
  regularFile(manifestPath, 'Updater manifest');
  if (path.basename(manifestPath) !== metadata.RELEASE_UPDATER_MANIFEST_NAME) {
    fail(`Updater manifest must be named ${metadata.RELEASE_UPDATER_MANIFEST_NAME}.`);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Updater manifest is not valid JSON: ${error.message}`);
  }
  exactKeys(manifest, ['version', 'notes', 'pub_date', 'platforms'], 'Updater manifest');
  if (manifest.version !== version) fail(`Updater manifest version ${manifest.version} does not match ${version}.`);
  if (typeof manifest.notes !== 'string' || !manifest.notes || manifest.notes.length > 16_384 || manifest.notes.includes('\0')) {
    fail('Updater manifest notes are invalid.');
  }
  if (typeof manifest.pub_date !== 'string' || normalizePubDate(manifest.pub_date) !== manifest.pub_date) {
    fail('Updater manifest pub_date must be normalized UTC RFC 3339.');
  }
  exactKeys(manifest.platforms, PLATFORM_SPECS.map((spec) => spec.key), 'Updater manifest platforms');
  for (const spec of PLATFORM_SPECS) {
    const artifact = path.resolve(artifacts[spec.key] || '');
    const signatureFile = path.resolve(signatures[spec.key] || '');
    const expectedName = metadata[spec.metadataName];
    if (path.basename(artifact) !== expectedName) fail(`${spec.key} artifact must be named ${expectedName}.`);
    if (path.basename(signatureFile) !== `${expectedName}.sig`) {
      fail(`${spec.key} signature must be named ${expectedName}.sig.`);
    }
    regularFile(artifact, `${spec.key} artifact`);
    const signature = readSignature(signatureFile, `${spec.key} signature`);
    const platform = manifest.platforms[spec.key];
    exactKeys(platform, ['signature', 'url'], `Updater manifest platforms.${spec.key}`);
    if (platform.signature !== signature) fail(`Updater manifest ${spec.key} signature does not match its sidecar.`);
    if (platform.url !== encodedAssetUrl(metadata.RELEASE_UPDATER_DOWNLOAD_BASE_URL, expectedName)) {
      fail(`Updater manifest ${spec.key} URL does not match release metadata.`);
    }
  }
  return manifest;
}

function main() {
  const tag = requireOption('--tag');
  const output = path.resolve(requireOption('--output'));
  const notes = readNotes(path.resolve(requireOption('--notes')));
  const pubDate = normalizePubDate(requireOption('--pub-date'));
  const config = loadConfig();
  const metadata = metadataForTag(config, tag);
  if (path.basename(output) !== metadata.RELEASE_UPDATER_MANIFEST_NAME) {
    fail(`Updater manifest output must be named ${metadata.RELEASE_UPDATER_MANIFEST_NAME}.`);
  }

  const platforms = {};
  const artifacts = {};
  const signatures = {};
  for (const spec of PLATFORM_SPECS) {
    const artifact = path.resolve(requireOption(spec.artifactOption));
    const signatureFile = path.resolve(requireOption(spec.signatureOption));
    const expectedName = metadata[spec.metadataName];
    if (path.basename(artifact) !== expectedName) {
      fail(`${spec.key} artifact must be named ${expectedName}.`);
    }
    if (path.basename(signatureFile) !== `${expectedName}.sig`) {
      fail(`${spec.key} signature must be named ${expectedName}.sig.`);
    }
    regularFile(artifact, `${spec.key} artifact`);
    artifacts[spec.key] = artifact;
    signatures[spec.key] = signatureFile;
    platforms[spec.key] = {
      signature: readSignature(signatureFile, `${spec.key} signature`),
      url: encodedAssetUrl(metadata.RELEASE_UPDATER_DOWNLOAD_BASE_URL, expectedName),
    };
  }

  const parent = path.dirname(output);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    fail(`Updater manifest parent must be a real directory: ${parent}.`);
  }
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
    fail(`Refusing to overwrite symlink updater manifest: ${output}.`);
  }
  const manifest = {
    version: readVersion(),
    notes,
    pub_date: pubDate,
    platforms,
  };
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  verifyManifestClosure({ manifestPath: output, metadata, artifacts, signatures, version: manifest.version });
  console.log(`[updater-manifest] OK: wrote ${output} for ${manifest.version}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[updater-manifest] ${error.message}`);
    process.exit(1);
  }
}

module.exports = { PLATFORM_SPECS, verifyManifestClosure };
