#!/usr/bin/env node
/**
 * [INPUT]: 依赖发布流程传入的内部 SemVer、CHANGELOG.md 与目标输出路径
 * [OUTPUT]: 对外提供精确版本 CHANGELOG 正文抽取，并在版本缺失、重复、未标日期、正文为空或含非中文条目或列表之外内容时失败关闭；保留 Added/Fixed 等源码分类语义，仅在发布投影为中文标题
 * [POS]: tools 的 Release notes 内容边界，将内部版本真相源投影为 GitHub Release 的版本更新摘要，不负责产品介绍模板
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const fs = require('node:fs');
const path = require('node:path');

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// -----------------------------------------------------------------------------
// CLI contract
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    changelog: 'CHANGELOG.md',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (!['--version', '--changelog', '--output'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }

  return options;
}

function usage() {
  return [
    'Usage:',
    '  node tools/extract_release_changelog.js --version <x.y.z> --output <path> [--changelog CHANGELOG.md]',
  ].join('\n');
}

// -----------------------------------------------------------------------------
// CHANGELOG projection
// -----------------------------------------------------------------------------

function parseVersionHeadings(source) {
  const headings = [];
  const headingPattern = /^## \[([^\]]+)\](?:[ \t]+-[ \t]+([^\r\n]+))?[ \t]*$/gm;
  let match;

  while ((match = headingPattern.exec(source)) !== null) {
    headings.push({
      version: match[1],
      date: match[2] ? match[2].trim() : null,
      start: match.index,
      bodyStart: headingPattern.lastIndex,
    });
  }

  return headings;
}

function extractReleaseSection(source, version) {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Release version must be an exact SemVer (x.y.z), received: ${version}`);
  }

  const headings = parseVersionHeadings(source);
  const matches = headings.filter((heading) => heading.version === version);
  if (matches.length === 0) {
    throw new Error(`Release version ${version} was not found in CHANGELOG.md`);
  }
  if (matches.length > 1) {
    throw new Error(`Release version ${version} appears more than once in CHANGELOG.md`);
  }

  const selected = matches[0];
  if (!selected.date || !RELEASE_DATE_PATTERN.test(selected.date)) {
    throw new Error(`Release version ${version} must have a YYYY-MM-DD release date in CHANGELOG.md`);
  }

  const selectedIndex = headings.indexOf(selected);
  const nextHeading = headings[selectedIndex + 1];
  const bodyEnd = nextHeading ? nextHeading.start : source.length;
  const body = source.slice(selected.bodyStart, bodyEnd).trim();
  if (!body) {
    throw new Error(`Release version ${version} has an empty CHANGELOG.md section`);
  }

  // ---- 分类是源码语义，中文标题是发布显示；版本作者维护实际更新条目 ----
  const labels = {
    Added: '新增', Changed: '变更', Deprecated: '弃用',
    Removed: '移除', Fixed: '修复', Security: '安全',
  };
  const categories = [...body.matchAll(/^### ([^\r\n]+)[ \t]*$/gm)];
  const seen = new Set();
  if (!categories.length || body.slice(0, categories[0].index).trim()) {
    throw new Error('Release notes must start with a supported change category');
  }
  for (const [index, category] of categories.entries()) {
    const key = category[1].trim();
    const content = body.slice(category.index + category[0].length,
      categories[index + 1]?.index ?? body.length);
    if (!Object.hasOwn(labels, key) || seen.has(key)) {
      throw new Error('Release change category is unsupported or duplicated: ' + key);
    }
    seen.add(key);
    const bullets = content.split(/\r?\n/).filter((line) => line.trim());
    if (!bullets.length || !bullets.every((line) => /^- [^\r\n]*\p{Script=Han}[^\r\n]*$/u.test(line))) {
      throw new Error('Each release category must contain only plain Chinese change bullets');
    }
  }
  return body.replace(/^### ([^\r\n]+)[ \t]*$/gm,
    (_, category) => '### ' + labels[category.trim()]) + '\n';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.version || !options.output) {
    throw new Error(`--version and --output are required\n${usage()}`);
  }

  const changelogPath = path.resolve(options.changelog);
  const outputPath = path.resolve(options.output);
  if (changelogPath === outputPath) {
    throw new Error('CHANGELOG input and release-note output must be different files');
  }

  fs.rmSync(outputPath, { force: true });
  const source = fs.readFileSync(changelogPath, 'utf8');
  const section = extractReleaseSection(source, options.version);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, section, 'utf8');
  process.stdout.write(`Extracted CHANGELOG ${options.version} to ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
