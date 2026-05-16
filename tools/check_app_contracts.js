#!/usr/bin/env node
/**
 * [INPUT]: 依赖 node:test 与仓库源码文件，读取 Tauri app、语言资源、工具脚本和 package 脚本契约
 * [OUTPUT]: 对外提供 npm run test:contracts 的 Node 测试集合，冻结 Tauri app、full-ui 与翻译质量契约
 * [POS]: tools 的 Tauri-only 应用合同测试，承接从旧壳层 baseline 迁出的非壳层断言
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const rendererRoot = path.join(repoRoot, 'renderer');
const injectorRoot = path.join(repoRoot, 'injector');


function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-i18n-test-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listJsonRelativeFiles(rootDir) {
  const results = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(path.relative(rootDir, entryPath).split(path.sep).join('/'));
      }
    }
  };
  visit(rootDir);
  return results.sort();
}

function sha256(filePath) {
  return require('node:crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256JsonWithoutHash(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.hash;
  return require('node:crypto').createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function copyTool(tempRoot, toolName) {
  const sourcePath = path.join(repoRoot, 'tools', toolName);
  const targetPath = path.join(tempRoot, 'tools', toolName);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function writeLanguageFixture(rootDir, languageCode, values) {
  const languageRoot = path.join(rootDir, 'languages', languageCode);
  writeJson(path.join(languageRoot, 'appStrings.json'), [{ value: { label: values.appLabel } }]);
  writeJson(path.join(languageRoot, 'nodeStrings.json'), [{ value: { label: values.nodeLabel } }]);
  writeJson(path.join(languageRoot, 'onboarding.json'), [{ value: { label: values.onboardingLabel } }]);
  writeJson(path.join(languageRoot, 'tips.json'), [{ value: { label: values.tipLabel } }]);
  writeJson(path.join(languageRoot, 'Style', 'theme.json'), {
    FontStyleWindows: 'Regular',
    FontStyleMac: 'Regular',
    colors: { Green: '#2FCD71' },
  });
}

function writeFrozenExtractionInventory(rootDir, extractionPath) {
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen App Label', valueType: 'string' }],
      },
      'languages/en/nodeStrings.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Node Label', valueType: 'string' }],
      },
      'languages/en/onboarding.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Onboarding Label', valueType: 'string' }],
      },
      'languages/en/tips.json': {
        englishLeaves: [{ path: '$[0].value.label', value: 'Frozen Tip Label', valueType: 'string' }],
      },
    },
  });
}

function makeValidatorFixtureRepo() {
  const tempRoot = makeTempDir();
  copyTool(tempRoot, 'validate_translations.py');
  copyTool(tempRoot, 'forbidden_translation_patterns.py');
  copyTool(tempRoot, 'forbidden_translation_patterns.json');

  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    appStrings: { translate: ['label'], no_translate: [], locale_sync: [] },
    nodeStrings: { translate: ['label'], no_translate: [], locale_sync: [] },
    onboarding: { translate: ['label'], no_translate: [], locale_sync: [] },
    tips: { translate: ['label'], no_translate: [], locale_sync: [] },
    plugins: { translate: ['label'], no_translate: [], locale_sync: [] },
    theme: { translate: [], no_translate: ['FontStyleWindows', 'FontStyleMac', 'colors'], locale_sync: [] },
  });

  writeJson(path.join(tempRoot, 'languages', 'en', 'appStrings.json'), [
    { value: { label: 'Current App Label', extra: 'Current Extra Leaf' } },
  ]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'nodeStrings.json'), [{ value: { label: 'Current Node Label' } }]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'onboarding.json'), [
    { value: { label: 'Current Onboarding Label' } },
  ]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'tips.json'), [{ value: { label: 'Current Tip Label' } }]);
  writeJson(path.join(tempRoot, 'languages', 'en', 'Style', 'theme.json'), {
    FontStyleWindows: 'Regular',
    FontStyleMac: 'Regular',
    colors: { Green: '#2FCD71' },
  });

  writeLanguageFixture(tempRoot, 'zh-Hans', {
    appLabel: 'Current App Label',
    nodeLabel: '节点标签',
    onboardingLabel: '欢迎',
    tipLabel: '提示',
  });
  writeLanguageFixture(tempRoot, 'zh-Hant', {
    appLabel: '目前的應用標籤',
    nodeLabel: '節點標籤',
    onboardingLabel: '歡迎',
    tipLabel: '提示',
  });
  writeLanguageFixture(tempRoot, 'ja_JP', {
    appLabel: '現在のアプリラベル',
    nodeLabel: 'ノードラベル',
    onboardingLabel: 'ようこそ',
    tipLabel: 'ヒント',
  });

  const extractionPath = path.join(tempRoot, 'session', 'extraction-inventory.json');
  writeFrozenExtractionInventory(tempRoot, extractionPath);
  return { tempRoot, extractionPath };
}

function makeFakeBundle(rootDir) {
  const appPath = path.join(rootDir, 'Cavalry.app');
  const assetsRoot = path.join(appPath, 'Contents', 'assets');

  writeJson(path.join(assetsRoot, 'Definitions', 'nodeStrings.json'), { value: 'EN node' });
  writeJson(path.join(assetsRoot, 'Definitions', 'appStrings.json'), { value: 'EN app' });
  writeJson(path.join(assetsRoot, 'Learn', 'tips.json'), { title: 'EN tip', text: 'EN text' });
  writeJson(path.join(assetsRoot, 'Learn', 'onboarding.json'), { title: 'EN onboarding' });
  writeJson(path.join(assetsRoot, 'Plugins', 'Gaussian Blur Filter', 'strings.json'), {
    niceName: 'Gaussian Blur Filter',
    language: 'en',
  });
  writeJson(path.join(assetsRoot, 'Plugins', 'Bulge Filter', 'strings.json'), {
    niceName: 'Bulge Filter',
    language: 'en',
  });

  return appPath;
}





test('renderer only switches status to warning when the patch flow reports a real warning', () => {
  const rendererSource = fs.readFileSync(path.join(rendererRoot, 'app.js'), 'utf8');

  assert.match(
    rendererSource,
    /result\.warning/,
    'renderer should branch on applyLanguage warnings instead of showing a permanent warning note'
  );
  assert.match(
    rendererSource,
    /result\.warning\s*\?\s*'warning'\s*:\s*'success'/,
    'renderer should downgrade the status tone only when applyLanguage returns a warning'
  );
});






test('embedded injector does not depend on runtime qm files', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translate\s*\(/,
    'injector should provide in-memory translation logic for compiled UI strings'
  );
  assert.doesNotMatch(
    injectorSource,
    /qtbase_|cavalry_.*\.qm|CAVALRY_I18N_QM_DIR/,
    'release translation path should not require runtime qm files or user-installed Qt tools'
  );
});

test('embedded injector refreshes the native macOS menu bar after installing translations', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /\[NSApp mainMenu\]|\[NSApplication sharedApplication\]/,
    'injector should touch the native AppKit menu bar because late-installed Qt translators do not automatically retranslate existing macOS menus'
  );
  assert.match(
    injectorSource,
    /NSMenuItem|submenu/,
    'injector should walk native menu items recursively to refresh existing menu labels after launch'
  );
});

test('embedded injector translates Qt-owned menus before AppKit sync can overwrite them', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /qapplication\.h|QApplication/,
    'injector should use QApplication so it can modify the Qt-owned menu state instead of relying only on NSMenuItem titles'
  );
  assert.match(
    injectorSource,
    /qmenubar\.h|QMenuBar/,
    'injector should look for QMenuBar instances because Qt owns the menu bar model'
  );
  assert.match(
    injectorSource,
    /qmenu\.h|QMenu/,
    'injector should traverse QMenu objects so submenu titles stay translated'
  );
  assert.match(
    injectorSource,
    /qaction\.h|QAction/,
    'injector should update QAction text because Qt syncs native menu labels from action text'
  );
  assert.match(
    injectorSource,
    /menu->setTitle|action->setText/,
    'injector should write translated menu text back through Qt APIs before refreshing the native menu'
  );
});

test('embedded injector hooks menus before they are shown so lazy submenus are translated', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /aboutToShow/,
    'injector should connect QMenu::aboutToShow because Cavalry creates many submenu actions lazily when menus open'
  );
  assert.match(
    injectorSource,
    /hookQtMenu|installMenuHooks|ensureMenuHooked/,
    'injector should have a named menu hook pass so newly discovered menus are hooked exactly once'
  );
  assert.match(
    injectorSource,
    /QSet<QMenu \*>|hookedMenus/,
    'menu hooks should be de-duplicated to avoid repeated signal connections on every refresh'
  );
  assert.match(
    injectorSource,
    /refreshNativeMenuBar\(lang\)/,
    'menu show-time translation should refresh the native AppKit menu after Qt action text is updated'
  );
});

test('embedded injector keeps retrying until a Qt menu surface exists', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translateQtMenuBar/,
    'injector should separate Qt menu translation from translator installation so menu readiness can be retried'
  );
  assert.match(
    injectorSource,
    /if\s*\(\s*gTranslator\s*==\s*nullptr\s*\)|if\s*\(\s*!gTranslator\s*\)/,
    'injector should install the translator only once while continuing to retry menu translation'
  );
  assert.match(
    injectorSource,
    /if\s*\(\s*!translateQtMenuBar\(lang\)\s*\)\s*\{\s*return false;\s*\}/,
    'injector should keep retrying until a Qt menu bar exists instead of stopping as soon as QCoreApplication appears'
  );
  assert.match(
    injectorSource,
    /actions\(\)|isEmpty\(\)/,
    'injector should treat an empty QMenuBar as not-ready so retries continue until menu actions exist'
  );
});

test('embedded injector translates visible Qt widget text beyond menus', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translateQtWidgetTexts/,
    'injector should have a dedicated pass for non-menu QWidget text so compiled UI labels can use the embedded translations'
  );
  assert.match(
    injectorSource,
    /QLabel|QAbstractButton|QGroupBox|QLineEdit|QTabBar/,
    'widget translation should cover common Qt label, button, group, input placeholder, and tab surfaces'
  );
  assert.match(
    injectorSource,
    /setWindowTitle|setToolTip|setStatusTip|setWhatsThis|setText|setTitle|setPlaceholderText|setTabText/,
    'widget translation should write translated strings back through Qt widget APIs rather than only exporting inventory'
  );
  assert.match(
    injectorSource,
    /scheduleRefreshAttempt|refreshQtUiTranslations/,
    'injector should keep refreshing UI translations after startup because Cavalry creates many widgets after the menu bar exists'
  );
});

test('embedded injector translates compound multiline widget strings line by line', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translatedCompoundWidgetText/,
    'compound tooltip text should have a dedicated fallback after exact string lookup fails'
  );
  assert.match(
    injectorSource,
    /split\(QChar\('\\n'\)\)|split\(QStringLiteral\("\\n"\)\)/,
    'compound tooltip fallback should split multiline tooltips into independently translatable lines'
  );
  assert.match(
    injectorSource,
    /translatedLineCount/,
    'compound translation should only rewrite a string when at least one component line was translated'
  );
});

test('embedded injector translates exact QLineEdit values as well as placeholders', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /lineEdit->text\(\)/,
    'line edit current values such as Default Keyframe Layer should be considered for exact embedded translation'
  );
  assert.match(
    injectorSource,
    /lineEdit->setText\(translated\)/,
    'line edit current values should be rewritten when they exactly match an embedded UI source'
  );
});

test('embedded injector translates widget-owned actions and container item labels', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translateQtWidgetActions/,
    'injector should translate QAction objects owned by ordinary widgets because toolbars and custom panels often draw action text outside the menu bar'
  );
  assert.match(
    injectorSource,
    /actions\(\)/,
    'widget action translation should cover direct QWidget::actions used by toolbars and custom panels'
  );
  assert.doesNotMatch(
    injectorSource,
    /widget->findChildren<QAction \*>/,
    'injector should not recursively scan child actions for every widget because that can make Cavalry hang during startup'
  );
  assert.match(
    injectorSource,
    /QSet<QAction \*>|seenActions/,
    'widget action translation should de-duplicate actions across the widget tree'
  );
  assert.match(
    injectorSource,
    /QComboBox|QTabWidget|QStatusBar/,
    'widget translation should cover combo box item labels, tab widget pages, and status bar messages'
  );
  assert.match(
    injectorSource,
    /setItemText|setTabText|showMessage/,
    'container translation should write translated item, tab, and status text back through Qt APIs'
  );
});

test('embedded injector handles runtime Qt events with dirty-object local translation only', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /eventFilter/,
    'injector should still observe runtime Qt object creation for panels and widgets created after startup'
  );
  assert.match(
    injectorSource,
    /enqueueRuntimeObject|scheduleDirtyObjectDrain|drainDirtyObjects|gDirtyObjects/,
    'runtime events should enqueue dirty objects for local translation instead of scheduling a full UI refresh'
  );
  assert.match(
    injectorSource,
    /QChildEvent|child\(\)/,
    'ChildAdded handling should enqueue the new child object instead of blindly refreshing the whole application'
  );
  assert.match(
    injectorSource,
    /translateRuntimeObject/,
    'dirty object draining should use a dedicated local translation entry point'
  );
  assert.doesNotMatch(
    injectorSource,
    /scheduleCoalescedRefresh[\s\S]*refreshQtUiTranslations/,
    'coalesced runtime event handling must not call refreshQtUiTranslations because that runs QApplication::allWidgets()'
  );
  assert.doesNotMatch(
    injectorSource,
    /eventFilter[\s\S]{0,1600}refreshQtUiTranslations/,
    'eventFilter must not directly or nearby indirectly trigger the full UI refresh path'
  );
});

test('embedded injector caches source-text translation lookup for runtime widget writes', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /QHash<\s*QString\s*,\s*QString\s*>|QHash<QString, QString>/,
    'widget translation lookup should use a QHash cache instead of linearly normalizing every embedded entry for every widget string'
  );
  assert.match(
    injectorSource,
    /rebuildTranslationCache|gTranslationBySource/,
    'injector should build the per-language source text translation cache when the translator is installed'
  );
  assert.match(
    injectorSource,
    /lookupEmbeddedTranslation[\s\S]*gTranslationBySource/,
    'lookupEmbeddedTranslation should consult the cache before falling back to embedded table scanning'
  );
});

test('embedded injector covers item widgets, headers, docks, toolbars, and standard dialog surfaces', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /QListWidget|QTreeWidget|QTableWidget/,
    'injector should translate item-based list, tree, and table widgets without mutating arbitrary business models'
  );
  assert.match(
    injectorSource,
    /headerItem\(\)|horizontalHeaderItem\(|verticalHeaderItem\(/,
    'injector should translate table/tree header labels because Cavalry panels use column headers'
  );
  assert.match(
    injectorSource,
    /QDockWidget|QToolBar|QToolButton|QDialogButtonBox/,
    'injector should cover common dock, toolbar, tool button, and standard button box surfaces'
  );
  assert.match(
    injectorSource,
    /QSpinBox|QDoubleSpinBox|QProgressBar/,
    'injector should cover prefix, suffix, and progress format strings used by numeric widgets'
  );
});

test('embedded injector patches ExtensionLayer literal hints outside Qt widget properties', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /_dyld_register_func_for_add_image|_dyld_image_count/,
    'injector should observe loaded Mach-O images because ExtensionLayer hint text is stored as raw binary literals'
  );
  assert.match(
    injectorSource,
    /libExtensionLayer\.dylib/,
    'literal patching should be scoped to Cavalry ExtensionLayer instead of mutating arbitrary Qt or injector strings'
  );
  assert.match(
    injectorSource,
    /__cstring/,
    'literal patching should scan the Mach-O __cstring section that owns self-painted panel and viewport hint strings'
  );
  assert.match(
    injectorSource,
    /vm_protect[\s\S]*VM_PROT_COPY[\s\S]*mprotect/,
    'literal patching should use macOS copy-on-write page protection before falling back to mprotect for read-only binary literals'
  );

  for (const english of [
    'Double click here to import Assets.',
    'Drag layers here to see their settings.',
    'Use the Create menu to add a layer to your Composition.',
    'Insert Keyframe',
    'Direct Layer Selection',
    'Play/ Stop',
    'Space + click + drag',
    'Enable Snapping',
    'Pan',
  ]) {
    assert.match(
      injectorSource,
      new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `literal patch table should cover screenshot residue: ${english}`
    );
  }

  const compactRows = [
    ['Drag layers here to see their settings.', '拖入图层查看设置。'],
    ['Play/ Stop', '播/停'],
    ['Space + click + drag', '空格+点按+拖动'],
    ['Pan', '移'],
  ];
  for (const [source, translation] of compactRows) {
    assert.ok(
      Buffer.byteLength(translation) <= Buffer.byteLength(source),
      `${translation} must fit inside the original ${source} literal for safe in-place patching`
    );
  }
});

test('embedded injector inventory records dynamic refresh and expanded widget evidence', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /refreshCount|menuHookCount|dirtyEnqueueCount|dirtyDrainCount|dirtyObjectTranslateCount/,
    'runtime inventory should expose full-refresh, menu-hook, and dirty-object counters so weak injection and runtime event behavior can be diagnosed from artifacts'
  );
  assert.match(
    injectorSource,
    /actionTexts/,
    'runtime inventory should include actionTexts evidence from widget-owned actions'
  );
  // NOTE: listItems/treeItems/tableItems/headerTexts serialization is deferred per plan (line 994);
  // these fields are consumed by check_runtime_ui_coverage.js but not yet emitted by the injector.
  // Add them when live capture cannot locate remaining English residues with actionTexts alone.
});

test('manual debug launcher follows the embedded-injector flow', () => {
  const launcherSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'),
    'utf8'
  );

  assert.doesNotMatch(
    launcherSource,
    /lrelease|CAVALRY_I18N_QM_DIR|qtbase_.*\.qm|cavalry_.*\.qm/,
    'manual launcher should match the embedded-injector runtime and not rebuild qm files'
  );
  assert.match(
    launcherSource,
    /CAVALRY_I18N_LANG/,
    'manual launcher should pass the selected language directly to the embedded injector'
  );
});



test('Qt SDK resolver rejects installed Cavalry version drift', () => {
  const resolverPath = path.join(repoRoot, 'tools', 'resolve_cavalry_qt_sdk.js');
  const resolver = fs.readFileSync(resolverPath, 'utf8');

  assert.match(
    resolver,
    /probe\.cavalryVersion[\s\S]*!==[\s\S]*target\.cavalryVersion/,
    'resolver should reject an installed Cavalry.app whose version does not match tools/cavalry_qt_target.json'
  );
  assert.match(
    resolver,
    /Unsupported Cavalry version/,
    'resolver failure should name Cavalry version drift explicitly'
  );
});

test('injector build script can fall back to Qt frameworks when Cavalry app frameworks are unavailable', () => {
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
  const buildScript = fs.readFileSync(path.join(repoRoot, 'tools', 'build_translator_injector.sh'), 'utf8');
  const resolverPath = path.join(repoRoot, 'tools', 'resolve_cavalry_qt_sdk.js');
  const workflowSource = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');
  const targetPath = path.join(repoRoot, 'tools', 'cavalry_qt_target.json');
  const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const resolver = fs.readFileSync(resolverPath, 'utf8');

  assert.match(
    packageJson,
    /"prepare:qt-sdk": "node tools\/resolve_cavalry_qt_sdk\.js --ensure"/,
    'package.json should expose an explicit SDK preparation command for CI and clean machines'
  );
  assert.match(
    JSON.parse(packageJson).scripts['build:injector'] || '',
    /resolve_cavalry_qt_sdk\.js --print-env --ensure.*build_translator_injector\.sh/,
    'default injector builds should resolve the target SDK from the project contract instead of scattering 6.6.3 inline'
  );
  assert.equal(target.qtVersion, '6.6.3');
  assert.equal(target.cavalryVersion, '2.7.2');
  assert.equal(target.sdkPath, 'qt_sdk/6.6.3/macos');
  assert.match(
    resolver,
    /install-qt[\s\S]*target\.aqt\.host[\s\S]*target\.aqt\.target[\s\S]*target\.qtVersion[\s\S]*target\.aqt\.arch/,
    'resolver should be able to download exactly the target Qt SDK for CI'
  );
  assert.match(
    resolver,
    /process\.env\.PYTHON[\s\S]*python3[\s\S]*import aqt[\s\S]*VIRTUAL_ENV/,
    'resolver should allow CI to provide an isolated Python interpreter instead of mutating the managed system Python'
  );
  assert.match(
    workflowSource,
    /python3 -m venv "\$RUNNER_TEMP\/aqt-venv"[\s\S]*pip install aqtinstall[\s\S]*PYTHON=\$RUNNER_TEMP\/aqt-venv\/bin\/python/,
    'macOS packaging should install aqtinstall inside a local venv and pass that Python to the resolver'
  );
  assert.match(
    workflowSource,
    /CSC_IDENTITY_AUTO_DISCOVERY:\s*false[\s\S]*APPLE_SIGNING_IDENTITY:\s*"-"[\s\S]*unset CI[\s\S]*npm run tauri:build[\s\S]*bash tools\/stamp_dmg_icon\.sh src-tauri\/target\/release\/bundle\/dmg/,
    'macOS packaging should mirror LOCAL_BUILD_SOP by disabling automatic signing discovery, forcing Tauri ad-hoc signing, unsetting CI for Finder DMG layout, running tauri:build, and stamping the DMG'
  );
  assert.doesNotMatch(
    workflowSource,
    /\.dmg\.zip/,
    'macOS packaging should expose the direct DMG release shape instead of wrapping the installer in a zip'
  );
  assert.match(
    workflowSource,
    /Write GitHub Release notes[\s\S]*Cavalry Language Switcher 是一个面向 Cavalry \$\{TARGET_CAVALRY_VERSION\}[\s\S]*Apple M[\s\S]*支持语言[\s\S]*日本語[\s\S]*English/,
    'tag releases should render a concise product body instead of relying on a bare generated changelog link'
  );
  assert.match(
    workflowSource,
    /gh release create "\$GITHUB_REF_NAME" "\$\{assets\[@\]\}" --title "\$RELEASE_TITLE" --notes-file release-notes\.md/,
    'tag releases should use release.config.json metadata as the Release title while keeping the git tag machine-readable'
  );
  assert.doesNotMatch(
    workflowSource,
    /rm -rf src-tauri\/target\/release\/bundle/,
    'GitHub packaging starts from a clean checkout and should not need local stale-bundle cleanup'
  );
  assert.match(
    resolver,
    /QtCore\.framework[\s\S]*Resources[\s\S]*Info\.plist/,
    'resolver should probe an installed Cavalry.app when present before selecting the SDK'
  );
  assert.match(
    buildScript,
    /QT_FRAMEWORKS\/QtCore\.framework\/Versions\/A\/QtCore/,
    'injector build should support linking against a standalone Qt install for CI prebuilds'
  );
  assert.match(
    buildScript,
    /QtGui QtWidgets/,
    'injector build should keep the same QtGui/QtWidgets link surface as the historical working injector where available'
  );
  assert.match(
    buildScript,
    /CAVALRY_QT_VERSION|CFBundleVersion/,
    'injector build should verify that the build-time Qt version matches the target Cavalry Qt runtime branch'
  );
  assert.doesNotMatch(
    buildScript,
    /Version check bypassed|Proceeding with building injecting/,
    'injector build should not silently bypass the Qt branch compatibility check'
  );
  assert.match(
    buildScript,
    /major_minor_version "\$BUILD_QT_VERSION".*major_minor_version "\$TARGET_QT_VERSION"[\s\S]*exit 1/,
    'injector build should fail fast when the build-time Qt branch does not match the target Cavalry Qt branch'
  );
});

test('embedded injector source is generated from ts translation files', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /generated_translations\.inc/,
    'injector source should include generated translation tables rather than hand-maintained copies'
  );
  assert.match(
    injectorSource,
    /qVersion|QT_VERSION_STR/,
    'injector should verify the runtime Qt version before installing translations'
  );
});

test('embedded injector normalizes real runtime menu text before lookup', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );
  const generated = fs.readFileSync(
    path.join(injectorRoot, 'generated_translations.inc'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /normalizeMenuText/,
    'injector should normalize live menu text before matching embedded translations'
  );
  assert.match(
    injectorSource,
    /QChar::Other_Format|category\(\)\s*==\s*QChar::Other_Format/,
    'normalization should strip zero-width or format characters that appear in the real runtime menu inventory'
  );
  assert.match(
    injectorSource,
    /replace\(QChar\('&'\)/,
    'normalization should ignore Qt mnemonic markers so runtime menu text can match ts source strings'
  );
  assert.match(
    generated,
    /"MenuBarManager", "Set Project", ".*"/,
    'embedded translations should include the real Set Project menu label captured from the runtime inventory'
  );
});

test('active full-ui scripts reject the legacy 99% threshold', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const runtimeChecker = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js'),
    'utf8'
  );
  const fullUiChecker = fs.readFileSync(path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'), 'utf8');
  const matrixChecker = fs.readFileSync(path.join(repoRoot, 'tools', 'check_full_ui_matrix.js'), 'utf8');

  assert.match(
    scripts['check:ui-coverage'] || '',
    /tools\/check_runtime_ui_coverage\.js/,
    'package.json should expose a dedicated runtime UI coverage checker instead of relying on ad hoc screenshot inspection'
  );
  assert.match(
    scripts['check:ui-coverage'] || '',
    /--threshold 100/,
    'runtime UI localization should use a hard 100% completion gate, with any retained English terms handled through an explicit allowlist'
  );

  for (const language of ['ja_JP', 'zh-Hans', 'zh-Hant']) {
    assert.match(
      scripts[`check:full-ui:${language}`] || '',
      /--threshold 100/,
      `package.json should gate ${language} against a hard 100% full-ui threshold`
    );
  }

  assert.doesNotMatch(runtimeChecker, /threshold:\s*99/);
  assert.doesNotMatch(fullUiChecker, /threshold:\s*99/);
  assert.doesNotMatch(matrixChecker, /threshold:\s*99/);
});

test('package.json exposes a compiled UI extraction workflow for non-JSON text', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.match(
    scripts['extract:compiled-ui'] || '',
    /tools\/extract_compiled_ui_strings\.js/,
    'package.json should expose a compiled UI extractor script instead of relying only on handwritten menu entries'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /Library\/Caches\/Cavalry-i18n\/compiled-ui-source-map\.json/,
    'compiled UI extraction should write to a generated cache source map JSON file'
  );
});

test('package.json exposes per-language full UI blocker scripts', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  for (const language of ['ja_JP', 'zh-Hans', 'zh-Hant']) {
    assert.match(
      scripts[`check:full-ui:${language}`] || '',
      /tools\/check_full_ui_coverage\.js/,
      `package.json should expose a full-UI coverage blocker for ${language}`
    );
  }
});

test('package.json exposes a matrix full UI blocker script with a runlog path', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.match(
    scripts['check:full-ui'] || '',
    /tools\/check_full_ui_matrix\.js/,
    'package.json should expose one matrix full-UI blocker script instead of requiring manual per-language command assembly'
  );
  assert.match(
    scripts['check:full-ui'] || '',
    /verify_gate_inputs\.js/,
    'matrix full-UI blocker should run a gate-input preflight before the matrix so known bypass inputs fail fast'
  );
  assert.match(
    scripts['check:full-ui'] || '',
    /full-ui-run-record\.json/,
    'matrix full-UI blocker should write the run record under SESSION_DIR so progress is tied to the live capture session'
  );
});

test('verify gate inputs fails on known bypass artifacts before matrix execution', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');

  writeJson(path.join(tempRoot, 'package.json'), {
    scripts: {
      'prepare:full-ui-gate': 'node tools/prepare_full_ui_gate_inputs.js',
    },
  });
  fs.mkdirSync(path.join(tempRoot, 'tools', 'full_ui_inventory_fixtures'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'doc'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'doc', 'libExtensionLayer-curated-ui.txt'), 'curated\n');

  const result = spawnSync(process.execPath, [preflightPath, '--repo-root', tempRoot], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, 'preflight should fail when known bypass artifacts are present');
  assert.match(`${result.stdout}\n${result.stderr}`, /prepare:full-ui-gate/);
  assert.match(`${result.stdout}\n${result.stderr}`, /full_ui_inventory_fixtures/);
  assert.match(`${result.stdout}\n${result.stderr}`, /libExtensionLayer-curated-ui\.txt/);
});

test('verify gate inputs rejects curated source maps and non-whitelisted live capture sources', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');
  const cacheRoot = path.join(tempRoot, 'cache');
  const sessionDir = path.join(cacheRoot, 'sessions', 'ABC123');
  const runtimeDir = path.join(sessionDir, 'runtime');
  const sourceMapPath = path.join(cacheRoot, 'compiled-ui-source-map.json');

  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  fs.mkdirSync(runtimeDir, { recursive: true });
  writeJson(path.join(runtimeDir, 'zh-Hans-merged-inventory.json'), {
    capture: {
      pid: 123,
      bundleHash: 'abc',
      sessionUuid: 'ABC123',
      wallclockUtc: '2026-04-29T12:00:00.000Z',
      source: 'live-dump',
    },
  });
  writeJson(sourceMapPath, {
    kind: 'curated',
    entries: [],
  });

  const result = spawnSync(
    process.execPath,
    [
      preflightPath,
      '--repo-root',
      tempRoot,
      '--cache-root',
      cacheRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
    ],
    {
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1, 'preflight should fail when source-map/runtime provenance is not live');
  assert.match(`${result.stdout}\n${result.stderr}`, /compiled source map kind/i);
  assert.match(`${result.stdout}\n${result.stderr}`, /live-dump/);
});

test('verify gate inputs rejects runtime inventories outside SESSION_DIR/runtime', () => {
  const tempRoot = makeTempDir();
  const preflightPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');
  const cacheRoot = path.join(tempRoot, 'cache');
  const sessionDir = path.join(cacheRoot, 'sessions', 'ABC123');

  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(cacheRoot, 'compiled-ui-source-map.json'), {
    kind: 'generated',
    entries: [],
  });
  writeJson(path.join(sessionDir, 'zh-Hans-merged-inventory.json'), {
    capture: {
      pid: 123,
      bundleHash: 'abc',
      sessionUuid: 'ABC123',
      wallclockUtc: '2026-04-29T12:00:00.000Z',
      source: 'live-merged',
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      preflightPath,
      '--repo-root',
      tempRoot,
      '--cache-root',
      cacheRoot,
      '--session-dir',
      sessionDir,
    ],
    {
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1, 'preflight should fail when runtime inventory escapes SESSION_DIR/runtime');
  assert.match(`${result.stdout}\n${result.stderr}`, /SESSION_DIR\/runtime|runtime artifact outside/i);
});

test('compiled UI source map is generated in the local cache, not tracked under doc', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.equal(
    fs.existsSync(path.join(repoRoot, 'doc', 'compiled-ui-source-map.json')),
    false,
    'compiled UI source map should be regenerated from the local Cavalry.app instead of tracked under doc/'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /--app \/Applications\/Cavalry\.app/,
    'compiled UI extraction should bind to the local Cavalry.app owner binary'
  );
  assert.match(
    scripts['extract:compiled-ui'] || '',
    /\$HOME\/Library\/Caches\/Cavalry-i18n\/compiled-ui-source-map\.json/,
    'compiled UI extraction should write the generated source map to the local cache'
  );
});

test('compiled UI extractor inventories strings from Cavalry binaries and frameworks', () => {
  const extractorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js'),
    'utf8'
  );

  assert.match(
    extractorSource,
    /spawnSync/,
    'compiled UI extractor should invoke platform tools to inventory bundled binary strings'
  );
  assert.match(
    extractorSource,
    /\/usr\/bin\/strings|strings'/,
    'compiled UI extractor should use the macOS strings tool to inspect compiled UI binaries'
  );
  assert.match(
    extractorSource,
    /Contents', 'MacOS', 'Cavalry'|Contents\/MacOS\/Cavalry/,
    'compiled UI extractor should inspect the main Cavalry executable'
  );
  assert.match(
    extractorSource,
    /libCavalryUI\.dylib/,
    'compiled UI extractor should inspect the Cavalry UI framework where menu/action text likely lives'
  );
  assert.match(
    extractorSource,
    /libExtensionLayer\.dylib/,
    'compiled UI extractor should include libExtensionLayer.dylib so Extension Layer UI strings enter the owner map'
  );
  assert.match(
    extractorSource,
    /Could not find compiled UI targets/,
    'compiled UI extractor should fail loudly instead of emitting an empty source map when the target binaries are missing'
  );
  assert.match(
    extractorSource,
    /JSON\.stringify|writeFileSync/,
    'compiled UI extractor should emit a deterministic JSON inventory that can become the repo source of truth'
  );
});

test('full UI coverage checker composes runtime, compiled, and JSON-backed validation', () => {
  const checkerSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_full_ui_coverage.js'),
    'utf8'
  );

  assert.match(
    checkerSource,
    /check_runtime_ui_coverage|buildCoverage/,
    'full UI checker should reuse the runtime UI coverage logic instead of inventing a second incompatible runtime gate'
  );
  assert.match(
    checkerSource,
    /compiled-ui-source-map|compiledSourceMap|buildCompiledCoverage/,
    'full UI checker should include compiled UI inventory coverage instead of only the currently visible runtime surface'
  );
  assert.match(
    checkerSource,
    /validate_translations\.py|python3/,
    'full UI checker should incorporate the existing JSON translation validator so JSON-backed surfaces stay inside the blocker'
  );
  assert.match(
    checkerSource,
    /ja_JP|zh-Hans|zh-Hant/,
    'full UI checker should support all three target languages under the same workflow'
  );
});

test('runtime UI coverage can lock its denominator to frozen extraction candidates', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');
  const { buildCoverage } = require(checkerPath);

  // Create a Map of English to Japanese translations
  const translations = new Map([
    ['Edit', '編集'],  // Edit in Japanese
  ]);

  const report = buildCoverage(
    {
      language: 'ja_JP',
      menuBars: [
        {
          items: [
            { text: '編集', separator: false },
            { text: 'Scene Window', separator: false },
          ],
        },
      ],
      widgetTexts: [],
    },
    { exact: [], contains: [] },
    translations,  // Pass translations as third parameter
    {
      englishLeaves: [{ value: 'File' }, { value: 'Edit' }, { value: 'Scene Window' }],
    }  // Pass extraction surface as fourth parameter
  );

  assert.equal(
    report.totalCandidates,
    3,
    'runtime coverage should use the frozen extraction candidate count instead of shrinking the denominator to the current translated inventory'
  );
  assert.equal(report.denominatorSource, 'extraction-inventory');
  assert.equal(report.untranslatedCount, 2);  // File and Scene Window are untranslated
  assert.equal(report.coveragePct, 33.33);  // Only Edit is translated (1/3 = 33.33%)
});

test('compiled coverage can lock its denominator to frozen extraction entries', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { buildCompiledCoverage } = require(checkerPath);

  const report = buildCompiledCoverage(
    {
      entries: [{ normalizedText: 'Scene Window', surfaceHint: 'menu-or-action-like' }],
    },
    new Map([['Scene Window', 'シーンウィンドウ']]),
    { exact: [], contains: [] },
    {
      englishLeaves: [
        { value: 'Scene Window', surfaceHint: 'menu-or-action-like' },
        { value: 'Render Queue', surfaceHint: 'menu-or-action-like' },
      ],
    }
  );

  assert.equal(
    report.totalCandidates,
    2,
    'compiled coverage should use the frozen extraction entry set instead of shrinking the denominator to the current source-map subset'
  );
  assert.equal(report.denominatorSource, 'extraction-inventory');
  assert.deepEqual(report.untranslated, ['Render Queue']);
  assert.equal(report.coveragePct, 50);
});

test('compiled coverage reuses punctuation-normalized TS translations for aliased source-map entries', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { buildCompiledCoverage } = require(checkerPath);

  const report = buildCompiledCoverage(
    {
      entries: [
        { normalizedText: 'Action not allowed. Adding composition would create a cycle.', surfaceHint: 'sentence-like' },
      ],
    },
    new Map([['Action not allowed. Adding composition would create a cycle', '不允许此操作。添加该合成会形成循环。']]),
    { exact: [], contains: [] },
    {
      englishLeaves: [
        {
          value: 'Action not allowed. Adding composition would create a cycle.',
          surfaceHint: 'sentence-like',
        },
      ],
    }
  );

  assert.equal(
    report.untranslatedCount,
    0,
    'compiled coverage should honor punctuation-normalized aliases instead of requiring duplicate TS entries for every dotted variant'
  );
  assert.equal(report.coveragePct, 100);
});

test('compiled coverage filter rejects debug labels, copyright strings, glyph names, and shaping-engine internals', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { shouldCountCompiledCandidate } = require(checkerPath);
  const allowlist = { exact: [], contains: [] };

  assert.equal(shouldCountCompiledCandidate('0: Root', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('2026 Scene Group Ltd', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('2026 Scene Group Ltd.', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Aacute', 'menu-or-action-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Acircumflexsmall', 'menu-or-action-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Forms', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Mark Positioning', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('Above-base Substitutions', 'label-like', allowlist), false);
  assert.equal(shouldCountCompiledCandidate('About Cavalry', 'menu-or-action-like', allowlist), true);
  assert.equal(shouldCountCompiledCandidate('Access All Alternates', 'label-like', allowlist), true);
});

test('JSON validator can read frozen extraction leaves and still return structured blocker data on failure', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const zhHansAppPath = path.join(tempRoot, 'languages', 'zh-Hans', 'appStrings.json');
  const zhHansApp = readJson(zhHansAppPath);
  zhHansApp.push({ value: { label: '冻结后新增的目标叶' } });
  writeJson(zhHansAppPath, zhHansApp);

  const report = runJsonValidator(tempRoot, 'zh-Hans', extractionPath);

  assert.equal(
    report.structureIssueCount,
    0,
    'validator should trust the frozen extraction leaf set instead of failing on new English leaves that were added after freeze'
  );
  assert.equal(
    report.coveragePct,
    100,
    'validator should measure translated-leaf coverage against the frozen extraction source values'
  );
  assert.equal(report.englishResidueCount, 1);
  assert.equal(
    report.pass,
    false,
    'validator should still return a structured failing report when the language contains blockers'
  );
});

test('JSON validator falls back to live English plugin files when extraction only freezes core JSON surfaces', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  writeJson(path.join(tempRoot, 'languages', 'en', 'plugins', 'testPlugin.json'), {
    label: 'English Plugin Label',
  });
  writeJson(path.join(tempRoot, 'languages', 'zh-Hans', 'plugins', 'testPlugin.json'), {
    label: '中文插件标签',
  });
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'plugins', 'testPlugin.json'), {
    label: '中文外掛標籤',
  });
  writeJson(path.join(tempRoot, 'languages', 'ja_JP', 'plugins', 'testPlugin.json'), {
    label: 'プラグインラベル',
  });

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(
    report.structureIssueCount,
    0,
    'plugin validation should keep using the live English source files instead of crashing on missing plugin surfaces in extraction'
  );
  assert.equal(report.pass, true);
});

test('JSON validator allows exact-English translate leaves when they are pure allowlisted technical tokens', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = 'CPU';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: 'CPU' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 100);
  assert.equal(
    report.pass,
    true,
    'G1 should not fail when a translate leaf remains exactly equal to the frozen English source if that value is a pure allowlisted technical token'
  );
});

test('JSON validator allows exact translate leaves when they are numeric or empty technical values', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = '3:1';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: '3:1' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 100);
  assert.equal(
    report.pass,
    true,
    'G1 should not fail when a translate leaf remains exactly equal to the frozen English source if that value is purely numeric or symbolic'
  );
});

test('JSON validator hard-fails when frozen translate leaves stay equal to untranslated English copy', () => {
  const checkerPath = path.join(repoRoot, 'tools', 'check_full_ui_coverage.js');
  const { runJsonValidator } = require(checkerPath);
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();

  const extraction = readJson(extractionPath);
  extraction.surfaces['languages/en/appStrings.json'].englishLeaves[0].value = 'English Label';
  writeJson(extractionPath, extraction);
  writeJson(path.join(tempRoot, 'languages', 'zh-Hant', 'appStrings.json'), [{ value: { label: 'English Label' } }]);

  const report = runJsonValidator(tempRoot, 'zh-Hant', extractionPath);

  assert.equal(report.coveragePct, 75);
  assert.equal(
    report.pass,
    false,
    'G1 should still fail when a translate leaf remains exactly equal to natural-language English source text'
  );
});

test('translation validator rejects the legacy 0.90 coverage threshold', () => {
  const validatorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'validate_translations.py'),
    'utf8'
  );

  assert.doesNotMatch(
    validatorSource,
    /0\.90/,
    'translation validator should not retain the legacy 0.90 weak-threshold gate'
  );
  assert.match(
    validatorSource,
    /1\.00/,
    'translation validator should record a strict 1.00 coverage threshold'
  );
});

test('full UI matrix checker runs all languages and writes a structured runlog', () => {
  const checkerSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_full_ui_matrix.js'),
    'utf8'
  );

  assert.match(
    checkerSource,
    /ja_JP[\s\S]*zh-Hans[\s\S]*zh-Hant|zh-Hans[\s\S]*zh-Hant[\s\S]*ja_JP/,
    'matrix full-UI checker should run all three target languages in one pass'
  );
  assert.match(
    checkerSource,
    /full-ui-runlog\.json|runlog/,
    'matrix full-UI checker should persist a runlog so the latest blocker state is not lost between iterations'
  );
  assert.match(
    checkerSource,
    /startedAt|finishedAt/,
    'matrix full-UI checker should timestamp the runlog'
  );
  assert.match(
    checkerSource,
    /runtime[\s\S]*compiled[\s\S]*jsonValidation|jsonValidation[\s\S]*runtime[\s\S]*compiled/,
    'matrix full-UI checker runlog should retain the runtime, compiled, and JSON blocker details for each language'
  );
  assert.match(
    checkerSource,
    /forbiddenPatterns/,
    'matrix full-UI checker run record should preserve per-language forbidden-pattern summaries'
  );
  assert.match(
    checkerSource,
    /provenance/,
    'matrix full-UI checker run record should preserve per-language provenance details'
  );
  assert.match(
    checkerSource,
    /sessionUuid/,
    'matrix full-UI checker run record should bind the current session UUID'
  );
  assert.match(
    checkerSource,
    /runtimeDir/,
    'matrix full-UI checker run record should record the current runtime directory'
  );
  assert.match(
    checkerSource,
    /--session-dir|sessionDir/,
    'matrix full-UI checker should require an explicit session dir instead of discovering runtime inputs from cache root'
  );
  assert.match(
    checkerSource,
    /runtime[\s\S]*-merged-inventory\.json|-merged-inventory\.json[\s\S]*runtime/,
    'matrix full-UI checker should read merged runtime artifacts from SESSION_DIR/runtime'
  );
  assert.match(
    checkerSource,
    /sourceMap[\s\S]*hash|hash[\s\S]*sourceMap/,
    'matrix full-UI checker run record should preserve source-map hash provenance'
  );
  assert.match(
    checkerSource,
    /sourceMap[\s\S]*mtime|mtime[\s\S]*sourceMap/,
    'matrix full-UI checker run record should preserve source-map mtime provenance'
  );
  assert.match(
    checkerSource,
    /extractionInventory/,
    'matrix full-UI checker run record should preserve frozen extraction inventory provenance'
  );
  assert.match(
    checkerSource,
    /frozenBaselines/,
    'matrix full-UI checker run record should preserve the whitelist and allowlist provenance used for the gate run'
  );
  assert.match(
    checkerSource,
    /blockedReason/,
    'matrix full-UI checker should keep a structured blocked reason in the run record when a language run crashes or produces no report'
  );
  assert.doesNotMatch(
    checkerSource,
    /inventoryPath\s*=\s*path\.join\(CACHE_ROOT,/,
    'matrix full-UI checker should not hardcode root-cache runtime inventory discovery'
  );
  assert.match(
    checkerSource,
    /process\.exitCode\s*=\s*1|process\.exit\(1\)/,
    'matrix full-UI checker should fail the run when any language stays below the hard gate'
  );
});

test('compiled UI extractor filters obvious binary noise while keeping UI labels', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  assert.equal(
    typeof extractEntriesFromLines,
    'function',
    'compiled UI extractor should expose a reusable line-filtering helper so tests can lock the noise filter down'
  );

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Group',
    'Window',
    'Open Scene...',
    '_16VisualDesignDark',
    '--cpp-httplib-multipart-data-',
    '", nonce="',
    '; border-radius: 4px;}QPushButton:disabled { border-color:',
    '#NSt3__120__shared_ptr_emplaceIN6spdlog5sinks21ansicolor_stdout_sinkINS1_7details13console_mutexEEENS_9allocatorIS6_EEEE',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Group', 'Window', 'Open Scene...'],
    'compiled UI extractor should keep reviewable UI copy and drop obvious binary junk before the full-UI blocker consumes the inventory'
  );
});

test('compiled UI extractor rejects HTTP and exception strings that are not UI copy', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Accept',
    'Accepted',
    'Bad Gateway',
    'Content-Type',
    'Auth has no pending auth flow',
    'Close Others',
    'Delete Script Tab?',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Close Others', 'Delete Script Tab?'],
    'compiled UI extractor should reject protocol and exception text so the hard gate only blocks real UI strings'
  );
});

test('compiled UI extractor rejects HTTP status labels and debug errors that are not product UI', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', [
    'Already Reported',
    'Forbidden',
    'Gateway Timeout',
    "I'm a teapot",
    'Internal Server Error',
    'Keep-Alive',
    'Concurrent task failed with unknown exception',
    'cannot create object from initializer list',
    'Install Plugin?',
    'Close Others',
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.text),
    ['Install Plugin?', 'Close Others'],
    'compiled UI extractor should drop HTTP status labels and debug-only failure strings before they reach the full-UI blocker'
  );
});

test('compiled UI extractor emits punctuation-normalized label aliases for raw UI strings', () => {
  const extractorPath = path.join(repoRoot, 'tools', 'extract_compiled_ui_strings.js');
  const { extractEntriesFromLines } = require(extractorPath);

  const entries = extractEntriesFromLines('/tmp/Cavalry', ['No Project Set.', 'No Project Set...']);
  const texts = entries.map((entry) => entry.text);

  assert.ok(texts.includes('No Project Set.'), 'extractor should keep the raw compiled string');
  assert.ok(texts.includes('No Project Set...'), 'extractor should keep ellipsis variants from raw extraction');
  assert.ok(
    texts.includes('No Project Set'),
    'extractor should also emit the punctuation-normalized label form for downstream denominator checks'
  );
});

test('embedded injector exports the real runtime menu tree from Cavalry itself', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /NSJSONSerialization|writeToFile/,
    'injector should serialize the real runtime menu tree to JSON instead of relying only on handwritten menu entries'
  );
  assert.match(
    injectorSource,
    /Library\/Caches\/Cavalry-i18n|menu-inventory\.json/,
    'injector should write the runtime menu inventory to a stable cache path that can be inspected after launch'
  );
  assert.match(
    injectorSource,
    /dumpQtMenuInventory|serializeQtMenu|serializeQtAction/,
    'injector should walk the Qt-owned menu model and export its exact runtime structure'
  );
  assert.match(
    injectorSource,
    /failed to serialize runtime menu inventory|failed to write runtime menu inventory|menu inventory export deferred/,
    'injector should log why runtime menu inventory export failed so real-app verification does not stall on silent errors'
  );
  assert.match(
    injectorSource,
    /windowTitle|placeholderText|toolTip|widgetTexts|serializeWidget/,
    'runtime inventory should cover broader visible UI text beyond menus so completion can be measured across the real app surface'
  );
});

test('injector supports English dump-only and session-scoped runtime inventory output', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /CAVALRY_I18N_LANG/,
    'injector should continue to read the target language from the environment'
  );
  assert.match(
    injectorSource,
    /lang\s*==\s*QStringLiteral\("en"\)|dump-only|english/i,
    'injector should special-case English dump-only capture instead of rejecting en as an unsupported language'
  );
  assert.match(
    injectorSource,
    /sessionUuid|bundleHash|wallclockUtc|source/,
    'injector runtime inventory should write full provenance metadata for G-CAPTURE and G-P'
  );
  assert.match(
    injectorSource,
    /runtime\/.*-injector-inventory\.json|-injector-inventory\.json/,
    'injector should write session-scoped injector inventories instead of cache-root menu-inventory.json'
  );
});

test('launcher passes session-scoped capture environment into the injector process', () => {
  const launcherSource = fs.readFileSync(path.join(repoRoot, 'tools', 'launch_cavalry_with_injector.sh'), 'utf8');

  assert.match(
    launcherSource,
    /--session-dir|SESSION_DIR|CAVALRY_I18N_SESSION_DIR/,
    'launcher should accept and forward the session dir for runtime capture artifacts'
  );
  assert.match(
    launcherSource,
    /--session-uuid|SESSION_UUID|CAVALRY_I18N_SESSION_UUID/,
    'launcher should accept and forward the session UUID for provenance'
  );
  assert.match(
    launcherSource,
    /--cache-root|CACHE_ROOT|CAVALRY_I18N_CACHE_ROOT/,
    'launcher should accept and forward the cache root for shared toolchain inputs'
  );
});

test('runtime merge tool preserves live provenance and rejects non-live inputs', () => {
  const mergePath = path.join(repoRoot, 'tools', 'merge_runtime_inventory.js');
  const { mergeRuntimeInventories } = require(mergePath);

  const merged = mergeRuntimeInventories({
    language: 'zh-Hans',
    injectorInventory: {
      language: 'zh-Hans',
      capture: {
        pid: 101,
        bundleHash: 'bundle-hash',
        sessionUuid: 'ABC123',
        wallclockUtc: '2026-04-29T12:00:00.000Z',
        source: 'live-injector',
      },
      menuBars: [{ items: [{ text: 'File' }] }],
      widgetTexts: [],
    },
    accessibilityInventory: {
      language: 'zh-Hans',
      capture: {
        pid: 101,
        bundleHash: 'bundle-hash',
        sessionUuid: 'ABC123',
        wallclockUtc: '2026-04-29T12:00:01.000Z',
        source: 'live-accessibility',
      },
      menuBars: [],
      widgetTexts: [{ className: 'AXWindow', strings: { windowTitle: 'Library' } }],
    },
  });

  assert.equal(merged.capture.source, 'live-merged');
  assert.equal(merged.capture.sessionUuid, 'ABC123');
  assert.equal(merged.capture.bundleHash, 'bundle-hash');
  assert.equal(merged.menuBars.length, 1);
  assert.equal(merged.widgetTexts.length, 1);
  assert.throws(
    () =>
      mergeRuntimeInventories({
        language: 'zh-Hans',
        injectorInventory: {
          language: 'zh-Hans',
          capture: { source: 'repo-fixture' },
          menuBars: [],
          widgetTexts: [],
        },
        accessibilityInventory: {
          language: 'zh-Hans',
          capture: { source: 'live-accessibility' },
          menuBars: [],
          widgetTexts: [],
        },
      }),
    /live-injector|live-accessibility/,
    'merge tool should reject fixture or curated runtime inputs'
  );
});

test('live full UI matrix orchestrator owns session runtime and audit artifacts', () => {
  const orchestratorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'run_live_full_ui_matrix.js'),
    'utf8'
  );

  assert.match(
    orchestratorSource,
    /full-ui-run-record\.json/,
    'live matrix orchestrator should own the session run record'
  );
  assert.match(
    orchestratorSource,
    /runtime\/.*-injector-inventory\.json|runtime\/.*-ax-inventory\.json|runtime\/.*-merged-inventory\.json/,
    'live matrix orchestrator should write injector, accessibility, and merged runtime artifacts under SESSION_DIR/runtime'
  );
  assert.match(
    orchestratorSource,
    /audit\/.*-injector-capture\.json|audit\/.*-ax-capture\.json|audit\/.*-merge\.json/,
    'live matrix orchestrator should write capture audit artifacts under SESSION_DIR/audit'
  );
  assert.match(
    orchestratorSource,
    /launch_cavalry_with_injector|capture_accessibility_inventory|merge_runtime_inventory/,
    'live matrix orchestrator should explicitly chain launcher, AX capture, and merge steps'
  );
});

test('live full UI matrix orchestrator parses launcher PID and rejects missing PID output', () => {
  const { assertRuntimeCaptureStrength, parseLaunchPid } = require(
    path.join(repoRoot, 'tools', 'run_live_full_ui_matrix.js')
  );

  assert.equal(
    parseLaunchPid('Launching /Applications/Cavalry.app with embedded translator for ja_JP\nPID=12345\n'),
    12345
  );
  assert.throws(
    () => parseLaunchPid('Launching /Applications/Cavalry.app with embedded translator for ja_JP\n'),
    /launcher PID/,
    'orchestrator must not continue into AX capture with pid NaN/0'
  );
  assert.throws(
    () => assertRuntimeCaptureStrength({ language: 'en', totalCandidates: 0, menuLeaves: 0 }),
    /WEAK-CAPTURE/,
    'orchestrator must reject live artifacts that miss runtime lower bounds'
  );
});

test('live full UI matrix orchestrator exposes help without starting a capture', () => {
  const { parseArgs } = require(path.join(repoRoot, 'tools', 'run_live_full_ui_matrix.js'));

  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
});

test('measurement integrity workflow advertises BLOCKED-NO-LIVE-CAVALRY and mirrors LOCAL_BUILD_SOP gates', () => {
  const workflowSource = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');
  const stampScript = fs.readFileSync(path.join(repoRoot, 'tools', 'stamp_dmg_icon.sh'), 'utf8');
  const dmgLayoutScript = fs.readFileSync(path.join(repoRoot, 'tools', 'check_dmg_layout.sh'), 'utf8');
  const packageJson = readJson(path.join(repoRoot, 'package.json'));

  assert.match(
    workflowSource,
    /BLOCKED-NO-LIVE-CAVALRY/,
    'CI workflow should emit BLOCKED-NO-LIVE-CAVALRY when no live Cavalry session can run full-ui gates'
  );
  assert.match(
    workflowSource,
    /unset CI[\s\S]*npm run tauri:build[\s\S]*bash tools\/stamp_dmg_icon\.sh src-tauri\/target\/release\/bundle\/dmg[\s\S]*npm run check:app[\s\S]*npm run test:contracts[\s\S]*npm run check:tauri[\s\S]*npm run test:tauri[\s\S]*npm run test:tauri:packaged[\s\S]*npm run test:tauri:dmg-layout/,
    'macOS packaging workflow should mirror LOCAL_BUILD_SOP, omitting only manual-smoke and GUI window regression'
  );
  assert.doesNotMatch(
    workflowSource,
    /npm run test:tauri:manual-smoke|npm run test:tauri:ui/,
    'GitHub packaging must omit only the local manual smoke and GUI window regression gates'
  );
  assert.doesNotMatch(
    workflowSource,
    /run: npm run build$|doc\/compiled-ui-source-map\.json|doc\/translation-whitelist\.json/,
    'workflow should not keep the legacy build command or doc-scoped gate artifacts'
  );
  assert.doesNotMatch(
    stampScript,
    /ditto -c -k --sequesterRsrc --keepParent|\.dmg\.zip/,
    'DMG stamping should keep the release as a direct DMG without creating a zip artifact'
  );
  assert.match(
    stampScript,
    /hdiutil convert "\$dmg" -format UDRW[\s\S]*hdiutil attach "\$rw_dmg"[\s\S]*cp "\$ICNS" "\$mount_point\/\.VolumeIcon\.icns"[\s\S]*SetFile -a C "\$mount_point"[\s\S]*hdiutil convert "\$rw_dmg" -format UDZO/,
    'DMG stamping should embed the project icon inside the mounted DMG volume before uploading the direct DMG'
  );
  assert.match(
    stampScript,
    /Rez -append "\$TMPRSRC" -o "\$dmg"[\s\S]*SetFile -a C "\$dmg"/,
    'DMG stamping should still best-effort stamp the local Finder file icon after the volume icon is embedded'
  );
  assert.equal(
    packageJson.scripts['test:tauri:dmg-layout'],
    'bash tools/check_dmg_layout.sh src-tauri/target/release/bundle/dmg',
    'package scripts should expose the DMG layout gate used by GitHub packaging'
  );
  [
    /\.DS_Store/,
    /\.background\/background\.png/,
    /\.VolumeIcon\.icns/,
    /Applications/,
    /Cavalry Language Switcher\.app/,
    /GetFileInfo "\$current_mount"/,
    /attributes: \.\*C/,
  ].forEach((pattern) => {
    assert.match(
      dmgLayoutScript,
      pattern,
      'DMG layout gate should mount the real image and verify Finder layout resources instead of trusting config alone'
    );
  });
  assert.match(
    workflowSource,
    /find dist -type f -name '\*\.dmg'[\s\S]*gh release create "\$GITHUB_REF_NAME" "\$\{assets\[@\]\}" --title "\$RELEASE_TITLE" --notes-file release-notes\.md/,
    'tag releases should publish the direct DMG asset in the same shape users expect from GitHub app releases'
  );
});

test('check:full-ui binds SESSION_DIR and frozen compiled source map explicitly', () => {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const script = packageJson.scripts['check:full-ui'] || '';

  assert.match(script, /SESSION_DIR|session-dir/, 'check:full-ui should bind the current SESSION_DIR explicitly');
  assert.match(
    script,
    /compiled-ui-source-map\.json/,
    'check:full-ui should bind the authoritative compiled source map explicitly'
  );
  assert.match(
    script,
    /--cache-root/,
    'check:full-ui should make root-cache pollution checks part of the default preflight path'
  );
  assert.doesNotMatch(script, /full-ui-runlog\.json/, 'check:full-ui should stop writing runlogs outside SESSION_DIR');
});

test('package full-ui scripts do not read root-cache runtime inventories', () => {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const scripts = packageJson.scripts || {};
  const runtimeScripts = [
    'check:ui-coverage',
    'check:full-ui:ja_JP',
    'check:full-ui:zh-Hans',
    'check:full-ui:zh-Hant',
    'check:full-ui',
  ];

  for (const name of runtimeScripts) {
    const script = scripts[name] || '';
    assert.doesNotMatch(
      script,
      /Cavalry-i18n\/(?:menu|ja_JP|zh-Hans|zh-Hant)-inventory\.json/,
      `${name} must not read root-cache runtime inventory artifacts`
    );
  }
});

test('accessibility capture uses menu scripting that can see real submenu items', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /menu 1 of menu bar item|tell application \"System Events\"|menu bar item \"/,
    'AX capture should use a submenu traversal strategy that can see real menu items, not only top-level menu bar labels'
  );
});

test('accessibility capture activates and opens menus before enumerating submenu items', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /click menu bar item|perform action \"AXPress\"/,
    'AX capture should explicitly open a menu before reading its submenu contents'
  );
  assert.match(
    captureSource,
    /activate|frontmost/,
    'AX capture should bring the target app to the foreground before walking the menu tree'
  );
});

test('accessibility capture returns submenu paths from recursive AppleScript traversal', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /return nestedLines|set outputLines to outputLines & my collectMenuItems/,
    'AX capture should return submenu path lines from recursive handlers instead of relying on pass-by-value list mutation'
  );
});

test('accessibility capture runs recursive submenu enumeration inside System Events context', () => {
  const captureSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'capture_accessibility_inventory.js'),
    'utf8'
  );

  assert.match(
    captureSource,
    /on collectMenuItems[\s\S]*tell application \"System Events\"/,
    'AX capture should keep recursive menu enumeration inside System Events so submenu references stay live'
  );
});

test('freeze extraction inventory writes frozen denominator surfaces and run-record provenance', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const runtimeDir = path.join(sessionDir, 'runtime');
  const runRecordPath = path.join(sessionDir, 'full-ui-run-record.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const freezePath = path.join(repoRoot, 'tools', 'freeze_extraction_inventory.js');

  writeJson(path.join(tempRoot, 'package.json'), { version: '0.1.2' });
  writeJson(path.join(tempRoot, 'tools', 'translation-whitelist.json'), {
    nodeStrings: { translate: ['title', 'description'], no_translate: [], locale_sync: [] },
    appStrings: { translate: ['title', 'cta'], no_translate: [], locale_sync: [] },
    tips: { translate: ['title'], no_translate: [], locale_sync: [] },
    onboarding: { translate: ['title'], no_translate: [], locale_sync: [] },
  });
  writeJson(path.join(tempRoot, 'tools', 'runtime_ui_allowlist.json'), {
    exact: [],
    contains: [],
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'nodeStrings.json'), {
    title: 'Node Title',
    description: 'Node Description',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'appStrings.json'), {
    title: 'App Title',
    cta: 'Open Scene',
  });
  writeJson(path.join(tempRoot, 'languages', 'en', 'tips.json'), { title: 'Tip Title' });
  writeJson(path.join(tempRoot, 'languages', 'en', 'onboarding.json'), { title: 'Welcome' });
  writeJson(sourceMapPath, {
    entries: [
      { text: 'Scene Window', normalizedText: 'Scene Window', surfaceHint: 'menu-or-action-like' },
      { text: 'Render Queue', normalizedText: 'Render Queue', surfaceHint: 'menu-or-action-like' },
    ],
  });
  writeJson(path.join(runtimeDir, 'en-merged-inventory.json'), {
    formatVersion: 3,
    language: 'en',
    capture: {
      pid: 123,
      bundleHash: 'bundle-hash',
      sessionUuid: path.basename(sessionDir),
      wallclockUtc: '2026-04-29T00:00:00.000Z',
      source: 'live-merged',
    },
    menuBars: [
      {
        items: [
          { text: 'File', submenu: { title: 'File', items: [{ text: 'Open...' }, { text: 'Render Queue' }] } },
        ],
      },
    ],
    widgetTexts: [{ className: 'AXWindow', strings: { windowTitle: 'Scene Window' } }],
  });
  writeJson(runRecordPath, {
    sessionUuid: path.basename(sessionDir),
    sessionDir,
  });

  const result = spawnSync(
    process.execPath,
    [freezePath, '--repo-root', tempRoot, '--session-dir', sessionDir, '--compiled-source-map', sourceMapPath],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const extraction = readJson(extractionPath);
  assert.deepEqual(
    Object.keys(extraction.surfaces).sort(),
    [
      'compiled-source-map',
      'json-total',
      'languages/en/appStrings.json',
      'languages/en/nodeStrings.json',
      'languages/en/onboarding.json',
      'languages/en/tips.json',
      'runtime-candidates',
      'runtime-menuLeaves',
    ].sort()
  );
  assert.equal(extraction.surfaces['languages/en/nodeStrings.json'].count, 2);
  assert.equal(extraction.surfaces['json-total'].count, 6);
  assert.equal(extraction.surfaces['compiled-source-map'].count, 2);
  assert.equal(extraction.surfaces['runtime-candidates'].count, 4);
  assert.equal(extraction.surfaces['runtime-menuLeaves'].count, 4);
  assert.ok(Array.isArray(extraction.englishLeaves['compiled-source-map']));
  assert.equal(extraction.englishLeaves['compiled-source-map'].length, 2);
  assert.equal(extraction.hash, sha256JsonWithoutHash(extraction));

  const runRecord = readJson(runRecordPath);
  assert.equal(runRecord.extractionInventory.path, extractionPath);
  assert.equal(runRecord.extractionInventory.hash, extraction.hash);
  assert.ok(runRecord.extractionInventory.mtime);
});

test('verify gate inputs accepts extraction inventory runtime candidates and menuLeaves bounds', () => {
  const tempRoot = makeTempDir();
  const sessionDir = path.join(tempRoot, 'session');
  const sourceMapPath = path.join(tempRoot, 'compiled-ui-source-map.json');
  const extractionPath = path.join(sessionDir, 'extraction-inventory.json');
  const verifierPath = path.join(repoRoot, 'tools', 'verify_gate_inputs.js');

  fs.mkdirSync(sessionDir, { recursive: true });
  writeJson(path.join(tempRoot, 'package.json'), { scripts: {} });
  writeJson(sourceMapPath, {
    entries: new Array(5195).fill({ normalizedText: 'Scene Window' }),
  });
  writeJson(extractionPath, {
    surfaces: {
      'languages/en/appStrings.json': { count: 10 },
      'languages/en/nodeStrings.json': { count: 6197 },
      'languages/en/onboarding.json': { count: 34 },
      'languages/en/tips.json': { count: 51 },
      'json-total': { count: 6292 },
      'compiled-source-map': { count: 3190 },
      'runtime-candidates': { count: 619 },
      'runtime-menuLeaves': { count: 733 },
    },
  });

  const result = spawnSync(
    process.execPath,
    [
      verifierPath,
      '--repo-root',
      tempRoot,
      '--session-dir',
      sessionDir,
      '--compiled-source-map',
      sourceMapPath,
      '--extraction-inventory',
      extractionPath,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('runtime UI coverage tool enforces thresholded untranslated-string reporting', () => {
  const tempRoot = makeTempDir();
  const inventoryPath = path.join(tempRoot, 'runtime-ui-inventory.json');
  const allowlistPath = path.join(tempRoot, 'allowlist.json');
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');

  writeJson(inventoryPath, {
    formatVersion: 2,
    language: 'ja_JP',
    menuBars: [
      {
        items: [
          { text: '編集', separator: false },
          { text: 'Show Guides', separator: false },
          { text: 'SVG', separator: false },
          { text: 'Google スプレッドシートを読み込み...', separator: false },
          { text: 'Copy as SVG', separator: false },
        ],
      },
    ],
    widgetTexts: [
      { className: 'QLabel', strings: { text: '保存' } },
      { className: 'QLabel', strings: { text: 'Scene Window' } },
    ],
  });
  writeJson(allowlistPath, {
    exact: ['SVG'],
    contains: ['Google', 'SVG'],
  });

  const failing = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '99'],
    { encoding: 'utf8' }
  );
  assert.equal(
    failing.status,
    1,
    'coverage checker should fail when untranslated runtime UI strings exceed the threshold'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /Copy as SVG/,
    'coverage checker should keep blocking strings that still contain untranslated English after stripping allowlisted retained terms'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /Show Guides|Scene Window/,
    'coverage checker should report the real untranslated runtime strings that block completion'
  );
  assert.doesNotMatch(
    `${failing.stdout}\n${failing.stderr}`,
    /Google スプレッドシートを読み込み/,
    'coverage checker should not flag strings that are translated except for explicitly allowlisted retained terms'
  );
  assert.match(
    `${failing.stdout}\n${failing.stderr}`,
    /99/,
    'coverage checker output should include the configured completion threshold'
  );

  const passing = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '40'],
    { encoding: 'utf8' }
  );
  assert.equal(
    passing.status,
    0,
    passing.stderr || passing.stdout || 'coverage checker should pass when the runtime inventory clears the threshold'
  );
});

test('runtime UI coverage tool fails forbidden translation patterns even without ASCII residue', () => {
  const tempRoot = makeTempDir();
  const inventoryPath = path.join(tempRoot, 'runtime-ui-inventory.json');
  const allowlistPath = path.join(tempRoot, 'allowlist.json');
  const checkerPath = path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js');

  writeJson(inventoryPath, {
    formatVersion: 2,
    language: 'ja_JP',
    menuBars: [
      {
        items: [
          { text: '保存（訳）', separator: false },
          { text: 'Ａｌｐｈａ', separator: false },
          { text: 'ページ:1', separator: false },
        ],
      },
    ],
    widgetTexts: [],
  });
  writeJson(allowlistPath, {
    exact: [],
    contains: [],
  });

  const result = spawnSync(
    process.execPath,
    [checkerPath, '--inventory', inventoryPath, '--allowlist', allowlistPath, '--threshold', '100'],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 1, 'coverage checker should fail on forbidden pseudo-translations');
  assert.match(`${result.stdout}\n${result.stderr}`, /保存（訳）/);
  assert.match(`${result.stdout}\n${result.stderr}`, /Ａｌｐｈａ/);
  assert.match(`${result.stdout}\n${result.stderr}`, /ページ:1/);
});

test('runtime allowlist keeps glossary-preserved brands and acronyms out of blocker counts', () => {
  const allowlist = readJson(path.join(repoRoot, 'tools', 'runtime_ui_allowlist.json'));

  assert.ok(
    allowlist.contains.includes('Canva'),
    'compiled/runtime coverage should allow the Canva brand name inside otherwise translated strings'
  );
  assert.ok(
    allowlist.contains.includes('IK'),
    'compiled/runtime coverage should allow the IK rigging acronym inside otherwise translated strings'
  );
});

test('runtime allowlist ignores shortcut, color swatch, app-state, and AX chrome noise', () => {
  const { buildCoverage } = require(path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js'));
  const allowlist = readJson(path.join(repoRoot, 'tools', 'runtime_ui_allowlist.json'));
  const summary = buildCoverage(
    {
      formatVersion: 3,
      language: 'zh-Hans',
      menuBars: [
        {
          items: [
            { text: '项目设置' },
            { text: '3D矩阵' },
            { text: 'Falloff' },
          ],
        },
      ],
      widgetTexts: [
        { className: 'ToolButton', strings: { toolTip: '选择工具 (v)' } },
        {
          className: 'ToolButton',
          strings: { toolTip: '箭头工具 按住 Alt/Option 可直接创建此图元，而不进入该工具。' },
        },
        { className: 'QLabel', strings: { text: 'Name: Tan Hex: #ffbfab99 R: 191 G: 171 B: 153 A: 255' } },
        { className: 'AXWindow', strings: { description: 'standard window' } },
        { className: 'QLabel', strings: { text: 'Composition 1' } },
        { className: 'QLabel', strings: { text: '<i>点击查看下一条消息</i>' } },
      ],
    },
    allowlist
  );

  assert.deepEqual(summary.untranslated, ['Falloff']);
});

test('zh-Hans embedded runtime tail has exact translations for live-only widget strings', () => {
  const zhHansTs = fs.readFileSync(path.join(repoRoot, 'tools', 'zh-Hans.ts'), 'utf8');

  assert.match(
    zhHansTs,
    /<source>Falloff<\/source>\s*<translation>衰减<\/translation>/,
    'live runtime menus can expose the bare Falloff label outside Add Falloff'
  );
  assert.match(
    zhHansTs,
    /<source>ToolBox<\/source>\s*<translation>工具箱<\/translation>/,
    'live runtime window titles can expose ToolBox as a bare widget string'
  );
  assert.match(
    zhHansTs,
    /<source>&lt;i&gt;Click to see next message&lt;\/i&gt;<\/source>\s*<translation>&lt;i&gt;点击查看下一条消息&lt;\/i&gt;<\/translation>/,
    'Tips panel HTML labels should be translated as exact runtime widget strings'
  );
});

test('shared forbidden translation detector covers the current FP set without legacy FP-6', () => {
  const detectorPath = path.join(repoRoot, 'tools', 'forbidden_translation_patterns.js');
  const { detectForbiddenTranslationPatterns } = require(detectorPath);

  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: '上传预设管理器（译）' }).map((hit) => hit.id),
    ['FP-1']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: 'ＲＧＢ' }).map((hit) => hit.id),
    ['FP-2']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'ja_JP', value: 'ページ3' }).map((hit) => hit.id),
    ['FP-3']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hant', value: '图层' }).map((hit) => hit.id),
    ['FP-4']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({ language: 'zh-Hans', value: '圖層' }).map((hit) => hit.id),
    ['FP-5']
  );
  const placeholderHits = detectForbiddenTranslationPatterns({
    language: 'zh-Hans',
    sourceText: 'Upload Preset Manager',
    value: 'Upload Preset Manager（译）',
  }).map((hit) => hit.id);
  assert.ok(placeholderHits.includes('FP-1'));
  assert.ok(placeholderHits.includes('FP-9'));
  assert.equal(placeholderHits.includes('FP-6'), false, 'legacy FP-6 must not be emitted');
});

test('shared forbidden translation detector rejects transliteration and pangram fabrication', () => {
  const detectorPath = path.join(repoRoot, 'tools', 'forbidden_translation_patterns.js');
  const { detectForbiddenTranslationPatterns } = require(detectorPath);

  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'Acce',
      value: '重音符',
    }).map((hit) => hit.id),
    ['FP-10']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'ja_JP',
      sourceText: 'Arial',
      value: 'アリアル',
    }).map((hit) => hit.id),
    ['FP-10']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'ahk ISK bhk DBX khk GNM nhk',
      value: '阿赫克 伊斯克 贝赫克 德贝克斯 卡赫克 吉恩姆 恩赫克',
    }).map((hit) => hit.id),
    ['FP-11']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'Acce',
      value: 'Acce',
    }),
    []
  );
});

test('shortcut-token translations are free of semantic mistranslation', () => {
  const zhHansPath = path.join(repoRoot, 'tools', 'zh-Hans.ts');
  const zhHantPath = path.join(repoRoot, 'tools', 'zh-Hant.ts');
  const jaJpPath = path.join(repoRoot, 'tools', 'ja_JP.ts');

  function parseTs(file) {
    const xml = fs.readFileSync(file, 'utf8');
    const out = new Map();
    for (const message of xml.matchAll(/<message>([\s\S]*?)<\/message>/g)) {
      const block = message[1];
      const source = (block.match(/<source>([\s\S]*?)<\/source>/) || [])[1];
      const translation = (block.match(/<translation>([\s\S]*?)<\/translation>/) || [])[1];
      if (source && translation) out.set(source.trim(), translation.trim());
    }
    return out;
  }

  const zhHans = parseTs(zhHansPath);
  const zhHant = parseTs(zhHantPath);
  const jaJp = parseTs(jaJpPath);

  // Hold S must not contain 保存 (save verb)
  assert.ok(!zhHans.get('Hold S').includes('保存'), 'Hold S zh-Hans should not contain 保存');

  // Standalone Space must not translate as 空间 (outer space)
  assert.ok(!zhHans.get('Space').includes('空间'), 'Space zh-Hans should not be 空间');
  assert.ok(!zhHant.get('Space').includes('空間'), 'Space zh-Hant should not be 空間');

  // Standalone Shift must not translate as 移动/上档 (move verb)
  assert.ok(!zhHans.get('Shift').includes('移动'), 'Shift zh-Hans should not be 移动');
  assert.ok(!zhHans.get('Shift').includes('上档'), 'Shift zh-Hans should not be 上档');
  assert.ok(!zhHant.get('Shift').includes('移動'), 'Shift zh-Hant should not be 移動');
  assert.ok(!zhHant.get('Shift').includes('上檔'), 'Shift zh-Hant should not be 上檔');

  // Command must not translate as 命令 (order verb) in zh-Hans and zh-Hant
  assert.ok(!zhHans.get('Command').includes('命令'), 'Command zh-Hans should not be 命令');
  assert.ok(!zhHant.get('Command').includes('命令'), 'Command zh-Hant should not be 命令');
});

test('shared forbidden translation detector rejects target-language filler and script contamination', () => {
  const detectorPath = path.join(repoRoot, 'tools', 'forbidden_translation_patterns.js');
  const { detectForbiddenTranslationPatterns } = require(detectorPath);

  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'Click to edit or remove the Attribute Expression',
      value: '单击以编辑项目移除项目属性表达式',
    }).map((hit) => hit.id),
    ['FP-13']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'ja_JP',
      sourceText: 'and restricted Assets found',
      value: '并找到受限アセット',
    }).map((hit) => hit.id),
    ['FP-14']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hant',
      sourceText: 'Create Array from Assets in Group',
      value: '建立陣列从素材項目群組',
    }).map((hit) => hit.id),
    ['FP-4', 'FP-13']
  );
  assert.deepEqual(
    detectForbiddenTranslationPatterns({
      language: 'zh-Hans',
      sourceText: 'This feature requires a Project',
      value: '此功能需要项目',
    }),
    []
  );
});

test('translation whitelist registers FP-10 FP-11 FP-12 contracts', () => {
  const whitelist = readJson(path.join(repoRoot, 'tools', 'translation-whitelist.json'));
  const contracts = whitelist._forbidden_patterns;

  assert.equal(contracts.transliteration_ban.id, 'FP-10');
  assert.equal(contracts.pangram_skip.id, 'FP-11');
  assert.equal(contracts.translation_reuse_cap.id, 'FP-12');
});

test('translation validator preserves TS and generated table context for FP-8', () => {
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const validatorPath = path.join(tempRoot, 'tools', 'validate_translations.py');
  const reportPath = path.join(tempRoot, 'p5-report.json');
  const summaryPath = path.join(tempRoot, 'p5-summary.md');
  const tsPath = path.join(tempRoot, 'tools', 'zh-Hans.ts');
  const generatedPath = path.join(tempRoot, 'injector', 'generated_translations.inc');

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1" language="zh-Hans">',
      '<context>',
      '<name>Cavalry-Compiled-UI-Glossary</name>',
      '<message><source>Open</source><translation>打开</translation></message>',
      '</context>',
      '</TS>',
    ].join('\n')
  );
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(
    generatedPath,
    [
      'const TranslationEntry kZhHansEntries[] = {',
      '  {"Foo-Synthetic", "Close", "关闭"},',
      '};',
      'const TranslationEntry kZhHantEntries[] = {',
      '};',
      'const TranslationEntry kJaEntries[] = {',
      '};',
    ].join('\n')
  );

  const result = spawnSync(
    'python3',
    [
      validatorPath,
      '--root',
      tempRoot,
      '--extraction-inventory',
      extractionPath,
      '--json-report',
      reportPath,
      '--markdown-summary',
      summaryPath,
    ],
    { encoding: 'utf8' }
  );
  const report = readJson(reportPath);

  assert.equal(result.status, 1, 'validator should hard-fail fake Qt contexts');
  assert.equal(report.gates.B13.status, 'FAIL');
  assert.equal(report.languages.zh_Hans.forbidden_patterns.by_pattern['FP-8'], 2);
});

test('translation validator rejects generic translation reuse across unrelated sources', () => {
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const validatorPath = path.join(tempRoot, 'tools', 'validate_translations.py');
  const reportPath = path.join(tempRoot, 'p5-report.json');
  const summaryPath = path.join(tempRoot, 'p5-summary.md');
  const tsPath = path.join(tempRoot, 'tools', 'ja_JP.ts');

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1" language="ja_JP">',
      '<context>',
      '<name>MenuBarManager</name>',
      '<message><source>Enable Onion Skin</source><translation>文字列形式が正しくありません</translation></message>',
      '<message><source>Export Movie</source><translation>文字列形式が正しくありません</translation></message>',
      '<message><source>Reset Workspace</source><translation>文字列形式が正しくありません</translation></message>',
      '</context>',
      '</TS>',
    ].join('\n')
  );

  const result = spawnSync(
    'python3',
    [
      validatorPath,
      '--root',
      tempRoot,
      '--extraction-inventory',
      extractionPath,
      '--json-report',
      reportPath,
      '--markdown-summary',
      summaryPath,
    ],
    { encoding: 'utf8' }
  );
  const report = readJson(reportPath);

  assert.equal(result.status, 1, 'validator should hard-fail generic placeholder reuse');
  assert.equal(report.gates.B13.status, 'FAIL');
  assert.equal(report.languages.ja.forbidden_patterns.by_pattern['FP-12'], 1);
});

test('JSON surface translation report uses non-overlapping file counts', () => {
  const reportPath = path.join(repoRoot, 'output', 'json-surfaces', 'translation-gap-report.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  const rowValue = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = report.match(
      new RegExp(`\\| ${escaped} \\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|`)
    );
    assert.ok(match, `missing report row: ${label}`);
    assert.equal(match[1], match[2], `${label} should match across zh-Hans and zh-Hant`);
    assert.equal(match[1], match[3], `${label} should match across zh-Hans and ja_JP`);
    return Number(match[1]);
  };

  const total = rowValue('Total JSON files');
  const retained = rowValue('Previously covered files retained');
  const translated = rowValue('New user-visible files translated');
  const preserved = rowValue('New zero-user-visible files preserved');
  const deferred = rowValue('Files deferred');

  assert.equal(retained + translated + preserved + deferred, total);
  assert.equal(deferred, 0);
});

test('English language package is the 38-file JSON surface source truth', () => {
  const englishFiles = listJsonRelativeFiles(path.join(repoRoot, 'languages', 'en'));
  const zhHansFiles = listJsonRelativeFiles(path.join(repoRoot, 'languages', 'zh-Hans'));
  const zhHantFiles = listJsonRelativeFiles(path.join(repoRoot, 'languages', 'zh-Hant'));
  const jaFiles = listJsonRelativeFiles(path.join(repoRoot, 'languages', 'ja_JP'));

  assert.equal(englishFiles.length, 38);
  assert.deepEqual(englishFiles, zhHansFiles);
  assert.deepEqual(englishFiles, zhHantFiles);
  assert.deepEqual(englishFiles, jaFiles);
});

test('checked-in 38-file JSON language packages pass the translation validator', () => {
  const tempRoot = makeTempDir();
  const reportPath = path.join(tempRoot, 'report.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const result = spawnSync(
    'python3',
    [
      'tools/validate_translations.py',
      '--root',
      repoRoot,
      '--json-report',
      reportPath,
      '--markdown-summary',
      summaryPath,
    ],
    { cwd: repoRoot, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : result.stderr);
});

test('ja_JP TS header is not mixed with Chinese wording', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'tools', 'ja_JP.ts'), 'utf8');
  const header = source.slice(0, source.indexOf('-->'));
  assert.doesNotMatch(header, /对外提供|依赖|菜单文本|编译期|翻译目录/);
});

test('add-layer runtime labels cover short translated tags and unnamed JSON nodes', () => {
  const requiredTsEntries = {
    'zh-Hans': {
      'Background Shape': '背景形状',
      Filter: '滤镜',
      Spiral: '螺旋',
      'Bézier': '贝塞尔',
    },
    'zh-Hant': {
      'Background Shape': '背景形狀',
      Filter: '濾鏡',
      Spiral: '螺旋',
      'Bézier': '貝茲',
    },
    ja_JP: {
      'Background Shape': '背景シェイプ',
      Filter: 'フィルター',
      Spiral: 'スパイラル',
      'Bézier': 'ベジェ',
    },
  };

  for (const [language, entries] of Object.entries(requiredTsEntries)) {
    const source = fs.readFileSync(path.join(repoRoot, 'tools', `${language}.ts`), 'utf8');
    for (const [english, translation] of Object.entries(entries)) {
      const message = `<source>${english}</source>\\s*<translation>${translation}</translation>`;
      assert.match(source, new RegExp(message), `${language} TS should translate ${english}`);
    }
  }

  const expectedLatticeNames = {
    en: 'Lattice',
    'zh-Hans': '晶格',
    'zh-Hant': '晶格',
    ja_JP: 'ラティス',
  };

  for (const [language, expectedName] of Object.entries(expectedLatticeNames)) {
    const nodeStrings = readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json'));
    const lattice = nodeStrings[38].values.find((node) => node.nodeType === 'lattice');
    assert.equal(lattice.niceName, expectedName, `${language} lattice needs a non-empty add-layer name`);
  }
});

test('text selection preset labels are localized in JSON node strings', () => {
  const nodeTypes = [
    'applyFontSize',
    'applyTypeface',
    'applyTextFill',
    'applyTextMaterial',
    'applyOpenType',
    'applyFontStyle',
  ];
  const expectedPresets = {
    'zh-Hans': {
      numbers: '数字',
      inParenthesis: '括号内文本',
      vowels: '元音',
      twoLetterWords: '所有双字母词',
      capitalWords: '首字母大写词',
      specificWords: '匹配指定单词',
      filenames: '文件名',
      ordinalIndicators: '序数标记',
    },
    'zh-Hant': {
      numbers: '數字',
      inParenthesis: '括號內文字',
      vowels: '母音',
      twoLetterWords: '所有雙字母詞',
      capitalWords: '首字母大寫詞',
      specificWords: '匹配指定單詞',
      filenames: '檔案名稱',
      ordinalIndicators: '序數標記',
    },
    ja_JP: {
      numbers: '数字',
      inParenthesis: '括弧内のテキスト',
      vowels: '母音',
      twoLetterWords: 'すべての2文字単語',
      capitalWords: '大文字始まりの単語',
      specificWords: '指定単語に一致',
      filenames: 'ファイル名',
      ordinalIndicators: '序数標識',
    },
  };

  for (const [language, expected] of Object.entries(expectedPresets)) {
    const nodeStrings = readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json'));
    for (const nodeType of nodeTypes) {
      const node = nodeStrings[40].values.find((candidate) => candidate.nodeType === nodeType);
      assert.deepEqual(node.presets, expected, `${language} ${nodeType} presets should be localized`);
    }
  }
});

test('zh-Hant node strings reject known simplified Chinese residues', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'languages', 'zh-Hant', 'nodeStrings.json'),
    'utf8'
  );
  assert.doesNotMatch(source, /参考|伽马|卷曲/);
});

test('runtime and JSON validators import the shared forbidden translation detector', () => {
  const runtimeSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'check_runtime_ui_coverage.js'),
    'utf8'
  );
  const validatorSource = fs.readFileSync(path.join(repoRoot, 'tools', 'validate_translations.py'), 'utf8');

  assert.match(
    runtimeSource,
    /forbidden_translation_patterns/,
    'runtime detector should call the shared forbidden-translation module instead of keeping a private regex copy'
  );
  assert.match(
    validatorSource,
    /forbidden_translation_patterns/,
    'JSON validator should call the shared forbidden-translation module instead of keeping purity rules private'
  );
});

test('checked-in generated translation table matches the ts sources', () => {
  const tempRoot = makeTempDir();
  const generatedPath = path.join(tempRoot, 'generated_translations.inc');
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const checkedInPath = path.join(injectorRoot, 'generated_translations.inc');

  const result = spawnSync(process.execPath, [generatorPath, generatedPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'generator should exit cleanly');

  const generated = fs.readFileSync(generatedPath, 'utf8');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8');
  assert.equal(
    generated,
    checkedIn,
    'generated_translations.inc should be regenerated from tools/*.ts whenever translation sources change'
  );
});

test('release workflow prebuilds the injector and publishes Tauri macOS artifacts', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  assert.match(
    workflow,
    /runs-on:\s*macos-latest/,
    'release pipeline should build the injector on macOS so end users do not need Qt locally'
  );
  assert.match(
    workflow,
    /npm run prepare:qt-sdk/,
    'release pipeline should prepare the Qt SDK through the same project target resolver used by local builds'
  );
  assert.match(
    workflow,
    /tools\/cavalry_qt_target\.json/,
    'release pipeline should upload the single Cavalry/Qt target contract with the source artifact'
  );
  assert.match(
    workflow,
    /build_translator_injector\.sh/,
    'release pipeline should invoke the injector build script'
  );
  assert.match(
    workflow,
    /libCavalryTranslatorInjector\.dylib/,
    'release packaging should include the prebuilt injector dylib'
  );
  assert.match(
    workflow,
    /npm run tauri:build/,
    'release pipeline should build the packaged macOS Tauri app through the explicit LOCAL_BUILD_SOP Tauri path'
  );
  assert.match(
    workflow,
    /src-tauri\/target\/release\/bundle\/dmg\/\*\.dmg|src-tauri\/target\/release\/bundle\/macos/,
    'release pipeline should publish Tauri macOS artifacts for end users'
  );
});
