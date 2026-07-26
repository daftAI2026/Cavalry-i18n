#!/usr/bin/env node
/**
 * [INPUT]: 依赖 node:test、python_command.js 与仓库源码文件，读取跨平台 Tauri app、语言资源、工具脚本、编译期 C++ 翻译表、运行时噪声隔离清单、package 脚本及版本化 Release notes 契约
 * [OUTPUT]: 对外提供 npm run test:contracts 的换行与平台无关 Node 测试集合，冻结 Tauri app、full-ui、精确版本 CHANGELOG 发布摘要、macOS ExtensionLayer 四处自绘提示的定点居中翻译与其余自绘文本英文边界、Time Editor niceName/复用图层名数据与 QAbstractItemView role 写回保护、Qt ABI-safe accessibility 与 @loader_path 单 runtime、first-match (context, source) 哈希、capture-only inventory、dirty 子树与 item-model 局部补译、aboutToShow/ActionAdded/Show 菜单首次绘制前同步翻译、动态 QLabel/QLineEdit 专用 Paint 路径、ModalDialog 退出确认窗首次绘制前同步翻译、MessageBar 日志弹窗 meta-object、QTextEdit append/Copied/Undo 动态日志模板、禁止 QTextEdit 在 Paint/Show 或 inventory 路径读取整份日志、底部状态消息接入及 dyld 符号解析失败安全兜底、动态状态栏计数、冒号与 No-prefix 标签、运行时生成图层名与属性标签兜底、Canva 登录态品牌词、Forge 动力学术语与 Voronoi Shader 属性、TS message context 归属与三语 key 对称、裸 {} 占位符、ModelDisplay 中英间距、运行时噪声隔离与翻译质量契约
 * [POS]: tools 的 Tauri-only 应用合同测试，承接从旧壳层 baseline 迁出的非壳层断言，并阻止平台命令、换行、交互期全局刷新、普通运行 inventory 写盘与固定模板吞掉版本更新等回归
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawnPythonSync } = require('./python_command.js');

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
  assert.match(
    injectorSource,
    /&QMenu::aboutToShow[\s\S]{0,900}translateMenuBeforeFirstPaint\(guardedMenu\.data\(\), lang, true\)/,
    'QMenu aboutToShow is the same pre-paint chain as other menu paths; it must translate synchronously before AppKit can paint English reset labels'
  );
  assert.doesNotMatch(
    injectorSource,
    /&QMenu::aboutToShow[\s\S]{0,900}CFRunLoopPerformBlock/,
    'aboutToShow must not defer menu translation to the next run loop because that creates visible English-to-localized flicker'
  );
});

test('embedded injector translates lazy QMenu actions synchronously before first menu paint', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translateMenuBeforeFirstPaint/,
    'lazy menu actions should have an explicit before-paint translation path instead of relying only on a delayed refresh'
  );
  assert.match(
    injectorSource,
    /case QEvent::ActionAdded:[\s\S]{0,520}qobject_cast<QMenu \*>\(watched\)[\s\S]{0,520}translateMenuBeforeFirstPaint/,
    'QMenu ActionAdded events fire while Cavalry is populating menu items, so they must translate the menu synchronously before AppKit paints English text'
  );
  assert.match(
    injectorSource,
    /case QEvent::Show:[\s\S]{0,520}qobject_cast<QMenu \*>\(watched\)[\s\S]{0,520}translateMenuBeforeFirstPaint/,
    'QMenu Show events should also translate the current menu synchronously as the last pre-paint guard'
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

test('embedded injector translates dynamic QLabel and QLineEdit text before repaint', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /case QEvent::Paint:[\s\S]{0,520}translateLabelBeforePaint\(label, m_lang\)[\s\S]{0,320}translateLineEditBeforePaint\(lineEdit, m_lang\)/,
    'attribute editor floating titles and SceneTree EditableNodeName rows must use dedicated first-paint translation without traversing child widgets or actions'
  );
  assert.match(
    injectorSource,
    /translateLabelDisplayText\(QLabel \*label[\s\S]{0,220}translatedWidgetText\(lang, label->text\(\)\)[\s\S]{0,160}label->setText\(translated\)/,
    'Attribute Editor object headers such as Capsule Shape and Arrow Shape should use the same display translation path as other QLabel/RolloverLabel text'
  );
  const paintCase = injectorSource.slice(
    injectorSource.indexOf('case QEvent::Paint:'),
    injectorSource.indexOf('case QEvent::Show:', injectorSource.indexOf('case QEvent::Paint:'))
  );
  assert.doesNotMatch(
    paintCase,
    /translateRuntimeObject\(watched, m_lang\)/,
    'Paint is a hot path and must not enter generic dirty-subtree translation'
  );
  assert.match(
    injectorSource,
    /PaintTextFingerprint[\s\S]{0,320}QString lang[\s\S]{0,180}QString text[\s\S]{0,180}QString placeholder/,
    'Paint fast-path fingerprints must include language, visible text, and placeholder rather than guessing from whether text already looks localized'
  );
  assert.match(
    injectorSource,
    /translateLabelBeforePaint[\s\S]{0,520}paintTextFingerprintMatches[\s\S]{0,520}translateLabelDisplayText[\s\S]{0,520}rememberPaintTextFingerprint/,
    'QLabel Paint should skip unchanged content but translate again after an external text change'
  );
  assert.match(
    injectorSource,
    /translateLineEditBeforePaint[\s\S]{0,900}paintTextFingerprintMatches\(lineEdit, lang, lineEdit->text\(\), lineEdit->placeholderText\(\)\)[\s\S]{0,900}rememberPaintTextFingerprint/,
    'QLineEdit Paint should fingerprint both value and placeholder and refresh the fingerprint after translation'
  );
  assert.match(
    injectorSource,
    /QObject::destroyed[\s\S]{0,260}gPaintTextFingerprints\.remove\(object\)/,
    'Paint fingerprints must be removed with QObject lifetime so pointer reuse cannot suppress translation'
  );
  assert.doesNotMatch(
    injectorSource,
    /setProperty\([^\n]*cavalry[^\n]*paint|setProperty\([^\n]*fingerprint/i,
    'Paint fingerprints must not leak into dynamicProperties inventory evidence'
  );
});

test('embedded injector translates modal dialogs synchronously before first paint', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /#include <QtWidgets\/qdialog\.h>/,
    'ModalDialog/QMessageBox show-time handling should use the Qt dialog type instead of a brittle title string'
  );

  assert.match(
    injectorSource,
    /case QEvent::Show:[\s\S]{0,520}qobject_cast<QDialog \*>\(watched\)[\s\S]{0,220}translateRuntimeWidgetSubtree\(dialog, m_lang\)[\s\S]{0,120}break;/,
    'unsaved-change QMessageBox/ModalDialog must be translated synchronously on Show before the first English paint'
  );
  assert.match(
    injectorSource,
    /translateRuntimeWidgetSubtree[\s\S]{0,700}widget->findChildren<QWidget \*>\(\)/,
    'dialog first paint must translate the complete local subtree without depending on a later global refresh'
  );

  assert.match(
    injectorSource,
    /QDialogButtonBox \*buttonBox = qobject_cast<QDialogButtonBox \*>\(widget\)[\s\S]{0,180}buttonBox->buttons\(\)[\s\S]{0,180}button->setText\(translated\)/,
    'the modal pre-paint path must still translate QMessageBox buttons through QDialogButtonBox'
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

test('embedded injector normalizes mixed No-prefix widget labels', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /translatedMixedNoPrefixText/,
    'runtime labels can be partially localized by Cavalry, so No 蒙版 must still collapse to the full No Mask translation'
  );
  assert.match(
    injectorSource,
    /source\.startsWith\(QStringLiteral\("No "\)\)/,
    'mixed No-prefix fallback should handle every No + localized suffix label, not only No Mask'
  );
  assert.match(
    injectorSource,
    /lookupEmbeddedTranslation\(lang,\s*englishSuffix\)/,
    'mixed No-prefix fallback should only rewrite when the localized suffix comes from an existing embedded translation'
  );
  assert.match(
    injectorSource,
    /QString::fromUtf8\(entries\[index\]\.translation\)/,
    'mixed No-prefix fallback should return the vetted full No ... translation rather than fabricating arbitrary strings'
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
  assert.match(
    injectorSource,
    /QLineEdit::textChanged/,
    'line edit values can change after widget creation, so runtime translation must hook textChanged'
  );
  assert.match(
    injectorSource,
    /QSignalBlocker blocker\(.*lineEdit/,
    'line edit display translation should block signals so model-backed names are not renamed while being localized for display'
  );
  assert.match(
    injectorSource,
    /translatedLineEditValue[\s\S]*\\s\+\[0-9\]\+[\s\S]*baseTranslation \+ match\.captured\(2\)/,
    'line edit display translation should preserve Cavalry auto-numbered suffixes like Camera 3'
  );
  assert.match(
    injectorSource,
    /translatedWidgetText[\s\S]*\\s\+\[0-9\]\+\)\$[\s\S]*baseTranslation \+ match\.captured\(2\)/,
    'generic widget display translation should preserve Cavalry auto-numbered suffixes like Super Ellipse Shape 2 in QLabel headers and Scene View rows'
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
  assert.match(
    injectorSource,
    /QString translatedWidgetText[\s\S]{0,900}translatedCopiedLogMessage/,
    'bottom status messages such as "Copied Animation Control" use QLabel/QStatusBar widget text, so Copied templates must be available to the generic widget translation path too'
  );
  assert.match(
    injectorSource,
    /QString translatedWidgetText[\s\S]{0,1100}translatedUndoRedoLogMessage/,
    'bottom status messages such as "Undo (Create Super Ellipse)" use QLabel/QStatusBar widget text, so Undo/Redo templates must also be available to the generic widget translation path'
  );
});

test('model-backed niceName text stays English for Time Editor and item-model reuse', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );
  const generatorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'generate_embedded_translations.js'),
    'utf8'
  );
  const whitelist = readJson(path.join(repoRoot, 'tools', 'translation-whitelist.json'));
  const displayNames = readJson(path.join(repoRoot, 'tools', 'model_display_translations.json'));
  const zhHansTs = fs.readFileSync(path.join(repoRoot, 'tools', 'zh-Hans.ts'), 'utf8');
  const zhHantTs = fs.readFileSync(path.join(repoRoot, 'tools', 'zh-Hant.ts'), 'utf8');

  for (const surface of ['nodeStrings', 'plugins']) {
    assert(!whitelist[surface].translate.includes('niceName'), `${surface}.niceName should not be translated`);
    assert(whitelist[surface].no_translate.includes('niceName'), `${surface}.niceName should stay English`);
  }

  for (const [source, zhHant] of Object.entries({
    Camera: '攝影機',
    'Particle Shape': '粒子形狀',
    'Particle Emitter': '粒子發射器',
    'Forge Dynamics': 'Forge 動力學',
    'Basic Line': '基本線',
    'Text Shape': '文字形狀',
    'Cel Animation Shape': '逐格動畫形狀',
    'Shape Skew': '形狀傾斜',
    Duplicator: '複製器',
  })) {
    const entry = displayNames.entries.find((candidate) => candidate.source === source);
    assert(entry, `display-only model name map should retain ${source}`);
    assert.equal(entry['zh-Hant'], zhHant, `${source} should have a Traditional Chinese display translation`);
  }
  for (const entry of displayNames.entries) {
    for (const lang of ['zh-Hans', 'zh-Hant']) {
      assert.doesNotMatch(
        entry[lang] || '',
        /[A-Za-z][\u4e00-\u9fff]|[\u4e00-\u9fff][A-Za-z]/,
        `${entry.source} ${lang} should keep a space between Latin tokens and CJK text`
      );
    }
  }
  assert.match(
    generatorSource,
    /model_display_translations\.json[\s\S]*ModelDisplay/,
    'embedded table generation should append display-only model name translations without changing JSON niceName'
  );
  assert.match(
    generatorSource,
    /source: `\$\{entry\.source\}\.\.\.`[\s\S]*translation: `\$\{entry\.translation\}\.\.\.`/,
    'embedded table generation should derive model-name ellipsis menu labels while keeping Time Editor base niceNames English'
  );
  assert.match(
    zhHansTs,
    /<source>Create a Forge Dynamics Solver<\/source><translation>创建 Forge 动力学解算器<\/translation>/,
    'Simplified Chinese Forge Dynamics solver tooltip should use the same display term as ModelDisplay'
  );
  assert.match(
    zhHantTs,
    /<source>Create a Forge Dynamics Solver<\/source><translation>建立 Forge 動力學解算器<\/translation>/,
    'Traditional Chinese Forge Dynamics solver tooltip should use the same display term as ModelDisplay'
  );
  assert.match(
    zhHansTs,
    /<source>Forge Dynamics Shape<\/source>\s*<translation>Forge 动力学形状<\/translation>/,
    'Simplified Chinese Forge Dynamics Shape menu entry should preserve the Forge display term'
  );
  assert.match(
    zhHantTs,
    /<source>Forge Dynamics Shape<\/source>\s*<translation>Forge 動力學形狀<\/translation>/,
    'Traditional Chinese Forge Dynamics Shape menu entry should preserve the Forge display term'
  );
  assert.doesNotMatch(
    zhHansTs + zhHantTs,
    /Forge Dynamics [解求]算器/,
    'Chinese UI should not regress to mixed Forge Dynamics solver phrasing'
  );

  assert.match(
    injectorSource,
    /shouldPreserveModelBackedItemText/,
    'injector should guard model-backed item text at the QWidgetItem mutation boundary'
  );
  assert.match(
    injectorSource,
    /bool isTimeEditorItemWidget\(QWidget \*widget\)/,
    'model-backed item preservation should be scoped by widget context so the Scene View list is not treated as Time Editor'
  );
  const timeEditorContextFunction = injectorSource.match(
    /bool isTimeEditorItemWidget\(QWidget \*widget\)[\s\S]*?\r?\n}\r?\n\r?\nbool shouldPreserveModelBackedItemText/
  )[0];
  assert.match(
    timeEditorContextFunction,
    /Time Editor[\s\S]*TimeEditor/,
    'Time Editor item protection should look for the right-side Time Editor context explicitly'
  );
  assert.doesNotMatch(
    timeEditorContextFunction,
    /parentWidget\(\)|windowTitle\(\)/,
    'Time Editor item protection must not inherit a parent Scene Window title and skip the translatable left-side layer list'
  );
  assert.doesNotMatch(
    timeEditorContextFunction,
    /->accessible(Name|Description)\(\)/,
    'Time Editor context detection must read accessibility strings through QObject properties to keep the injector on Cavalry Qt 6.6.3 ABI'
  );
  if (process.platform === 'darwin') {
    const dylibPath = path.join(injectorRoot, 'libCavalryTranslatorInjector.dylib');
    const nmResult = spawnSync('nm', ['-u', dylibPath], { encoding: 'utf8' });
    assert.equal(nmResult.status, 0, nmResult.stderr);
    assert.doesNotMatch(
      nmResult.stdout,
      /__ZNK7QWidget(14accessibleName|21accessibleDescription)Ev/,
      'checked-in injector dylib must not import QWidget accessibility accessors missing from Cavalry Qt 6.6.3'
    );
    const loadCommands = spawnSync('otool', ['-l', dylibPath], { encoding: 'utf8' });
    assert.equal(loadCommands.status, 0, loadCommands.stderr);
    assert.match(
      loadCommands.stdout,
      /path @loader_path /,
      'checked-in injector must resolve Qt beside itself after it is copied into the selected Cavalry.app'
    );
    assert.doesNotMatch(
      loadCommands.stdout,
      /path .*qt_sdk.*\/lib /,
      'checked-in injector must not fall back to the build SDK and load a second Qt runtime into Cavalry'
    );
  }
  const preserveFunction = injectorSource.match(
    /bool shouldPreserveModelBackedItemText\(QWidget \*owner, const QString &sourceText\)[\s\S]*?\r?\n}\r?\n\r?\nclass EmbeddedTranslator/
  )[0];
  assert.match(
    preserveFunction,
    /owner == nullptr[\s\S]*!isTimeEditorItemWidget\(owner\)/,
    'model-backed item preservation must not blanket-skip Scene View or other non-Time-Editor item lists'
  );
  for (const source of ['Basic Line', 'Particle Emitter', 'Forge Dynamics', 'Duplicator', 'Rig Control']) {
    assert.match(
      preserveFunction,
      new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `model-backed preservation vocabulary should cover ${source}, not only one screenshot example`
    );
  }
  assert.match(
    preserveFunction,
    /\\s\+\[0-9\]\+\$/,
    'model-backed preservation should normalize Cavalry auto-suffixed names like Basic Line 2'
  );
  const generatedLayerNameFunction = injectorSource.match(
    /QString translatedGeneratedLayerName\(const QString &lang, const QString &sourceText\)[\s\S]*?\r?\n}\r?\n\r?\nQString translatedMixedNoPrefixText/
  )[0];
  assert.match(
    generatedLayerNameFunction,
    /endsWith\(kShapeSuffix\)/,
    'generated layer-name fallback should only handle explicit X Shape display labels'
  );
  assert.match(
    generatedLayerNameFunction,
    /lookupEmbeddedTranslation\(lang, base\)[\s\S]*lookupEmbeddedTranslation\(lang, QStringLiteral\("Shape"\)\)/,
    'generated layer-name fallback should derive Capsule Shape from Capsule + Shape display translations'
  );
  assert.match(
    injectorSource,
    /translatedCompoundWidgetText[\s\S]{0,500}translatedGeneratedLayerName\(lang, sourceText\)/,
    'generated layer-name fallback should run before numeric suffix preservation so Super Ellipse Shape 2 can translate'
  );
  assert.match(
    injectorSource,
    /translateListWidgetItems[\s\S]{0,900}const QString source = item->text\(\);[\s\S]{0,140}shouldPreserveModelBackedItemText\(listWidget, source\)[\s\S]{0,220}timeEditorSafeItemText\(lang, source\)[\s\S]{0,220}continue;/,
    'QListWidgetItem text should be preserved only when the list belongs to the Time Editor context, with dynamic bracket names normalized back to English'
  );
  assert.match(
    injectorSource,
    /translateTreeWidgetItem[\s\S]{0,900}const QString source = item->text\(column\);[\s\S]{0,140}shouldPreserveModelBackedItemText\(owner, source\)[\s\S]{0,220}timeEditorSafeItemText\(lang, source\)[\s\S]{0,220}continue;/,
    'QTreeWidgetItem text should be preserved only when the tree belongs to the Time Editor context, with dynamic bracket names normalized back to English'
  );
  assert.match(
    injectorSource,
    /QStringLiteral\("4-Point Warp"\)/,
    'display-layer translations for generated Add Layer labels must still preserve Time Editor item text'
  );
  assert.match(
    injectorSource,
    /QStringLiteral\("Editable Shape"\)/,
    'Editable Shape display translation must not bleed into Time Editor item-model text'
  );
  assert.doesNotMatch(
    injectorSource,
    /EmbeddedTranslator[\s\S]{0,1200}isTimelineUnsafeSourceText/,
    'global QTranslator should not own Time Editor preservation; the bug is item-model mutation, not lookup alone'
  );

  const compareNiceNames = (englishValue, localizedValue, label) => {
    if (Array.isArray(englishValue)) {
      assert(Array.isArray(localizedValue), `${label} should keep array shape`);
      assert.equal(localizedValue.length, englishValue.length, `${label} should keep array length`);
      englishValue.forEach((item, index) => compareNiceNames(item, localizedValue[index], `${label}[${index}]`));
      return;
    }
    if (englishValue && typeof englishValue === 'object') {
      assert(localizedValue && typeof localizedValue === 'object', `${label} should keep object shape`);
      for (const key of Object.keys(englishValue)) {
        if (key === 'niceName') {
          assert.deepEqual(localizedValue[key], englishValue[key], `${label}.niceName should stay English`);
        }
        compareNiceNames(englishValue[key], localizedValue[key], `${label}.${key}`);
      }
    }
  };

  for (const language of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
    compareNiceNames(
      readJson(path.join(repoRoot, 'languages', 'en', 'nodeStrings.json')),
      readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json')),
      `${language}/nodeStrings.json`
    );

    const pluginDir = path.join(repoRoot, 'languages', 'en', 'plugins');
    for (const file of fs.readdirSync(pluginDir).filter((candidate) => candidate.endsWith('.json'))) {
      compareNiceNames(
        readJson(path.join(pluginDir, file)),
        readJson(path.join(repoRoot, 'languages', language, 'plugins', file)),
        `${language}/plugins/${file}`
      );
    }
  }
});

test('Apply Character Spacing pair labels translate in Qt display while Time Editor item names stay English', () => {
  const englishNodes = readJson(path.join(repoRoot, 'languages', 'en', 'nodeStrings.json'));
  const whitelist = readJson(path.join(repoRoot, 'tools', 'translation-whitelist.json'));
  const expectedDataLayerPairs = {
    'zh-Hans': {
      pairs: 'Matches',
      'pairs.matchString': 'Match String',
      'pairs.spacing': 'Character Spacing',
    },
    'zh-Hant': {
      pairs: 'Matches',
      'pairs.matchString': 'Match String',
      'pairs.spacing': 'Character Spacing',
    },
    ja_JP: {
      pairs: 'Matches',
      'pairs.matchString': 'Match String',
      'pairs.spacing': 'Character Spacing',
    },
  };

  assert(whitelist.nodeStrings.no_translate.includes('pairs'), 'pairs data is reused by Time Editor and should stay English');
  assert(whitelist.nodeStrings.no_translate.includes('pairs.matchString'), 'Match String data is reused by Time Editor and should stay English');
  assert(whitelist.nodeStrings.no_translate.includes('pairs.spacing'), 'Character Spacing data is reused by Time Editor and should stay English');

  const findNode = (nodes) =>
    nodes.flatMap((section) => section.values || []).find((node) => node.nodeType === 'applyCharacterSpacing');

  const englishNode = findNode(englishNodes);
  assert(englishNode, 'English applyCharacterSpacing nodeStrings entry should exist');
  assert.equal(englishNode.attributes.pairs, 'Matches', 'en applyCharacterSpacing.attributes.pairs');
  assert.equal(englishNode.attributes['pairs.matchString'], 'Match String', 'en applyCharacterSpacing.attributes.pairs.matchString');
  assert.equal(englishNode.attributes['pairs.spacing'], 'Character Spacing', 'en applyCharacterSpacing.attributes.pairs.spacing');

  for (const [language, entries] of Object.entries(expectedDataLayerPairs)) {
    const localizedNode = findNode(readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json')));
    assert(localizedNode, `${language} applyCharacterSpacing nodeStrings entry should exist`);
    for (const [key, value] of Object.entries(entries)) {
      assert.equal(localizedNode.attributes[key], value, `${language} applyCharacterSpacing.attributes.${key}`);
    }
  }

  const expectedDisplayTranslations = {
    'zh-Hans': {
      Matches: '匹配',
      'Match String': '匹配字符串',
      'Character Spacing': '字符间距',
    },
    'zh-Hant': {
      Matches: '匹配',
      'Match String': '匹配字元串',
      'Character Spacing': '字元間距',
    },
    ja_JP: {
      Matches: 'マッチ',
      'Match String': 'マッチ文字列',
      'Character Spacing': '文字間隔',
    },
  };

  for (const [language, entries] of Object.entries(expectedDisplayTranslations)) {
    const ts = fs.readFileSync(path.join(repoRoot, 'tools', `${language}.ts`), 'utf8');
    for (const [source, translation] of Object.entries(entries)) {
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedTranslation = translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(
        ts,
        new RegExp(`<source>${escapedSource}<\\/source>\\s*<translation>${escapedTranslation}<\\/translation>`),
        `${language} TS display layer should translate ${source}`
      );
    }
  }

  const injectorSource = fs.readFileSync(path.join(injectorRoot, 'CavalryTranslatorInjector.mm'), 'utf8');
  assert.match(
    injectorSource,
    /translatedWidgetText[\s\S]*\\\.\[0-9\]\+/,
    'red-box Attribute Editor labels like Matches.0 should translate by preserving the .<n> suffix'
  );
  assert.match(
    injectorSource,
    /translatedDynamicBracketLayerName[\s\S]*QRegularExpression pattern\(QStringLiteral\("\^\(\.\*\?\)\\\\s\+\\\\\[\(\[0-9\]\+\)\\\\\.\(\[\^\\\\\]\]\+\)\\\\\]\$"\)\)/,
    'red-box Scene View names like String Generator 2 [2.Match String] should translate with a numeric bracket regex'
  );
  assert.match(
    injectorSource,
    /timeEditorSafeItemText[\s\S]*translatedDynamicBracketLayerName\(lang, sourceText, true\)/,
    'yellow-box Time Editor item names should use the same dynamic bracket parser in reverse to force English text'
  );
  assert.match(
    injectorSource,
    /normalizeTimeEditorModelRows\(QAbstractItemView \*view, QAbstractItemModel \*model[\s\S]*Qt::DisplayRole[\s\S]*Qt::EditRole[\s\S]*model->setData\(index, safeText, role\)/,
    'yellow-box Time Editor generic QAbstractItemView model roles must be normalized because the right-side strip is not guaranteed to be QListWidgetItem/QTreeWidgetItem'
  );
  assert.match(
    injectorSource,
    /normalizeTimeEditorItemModel\(QAbstractItemView \*view[\s\S]*!isTimeEditorItemWidget\(view\)[\s\S]*view->model\(\)[\s\S]*normalizeTimeEditorModelRows\(view, model, QModelIndex\(\), lang, 0\)/,
    'yellow-box Time Editor generic item-model normalization must stay scoped to the Time Editor view'
  );
  assert.match(
    injectorSource,
    /qobject_cast<QAbstractItemView \*>\(widget\)[\s\S]*normalizeTimeEditorItemModel\(itemView, lang\)/,
    'runtime widget translation should visit generic QAbstractItemView models, not only QListWidgetItem/QTreeWidgetItem wrappers'
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
  const runtimeObjectFunction = injectorSource.slice(
    injectorSource.indexOf('void translateRuntimeObject'),
    injectorSource.indexOf('void translateRuntimeWidgetSubtree')
  );
  assert.doesNotMatch(
    injectorSource,
    /scheduleInteractiveRefresh/,
    'ordinary runtime events must not retain a hidden path back to QApplication::allWidgets()'
  );
  assert.doesNotMatch(
    injectorSource,
    /eventFilter[\s\S]{0,1600}refreshQtUiTranslations/,
    'eventFilter must not directly or nearby indirectly trigger the full UI refresh path'
  );
  assert.match(
    runtimeObjectFunction,
    /Qt::FindDirectChildrenOnly/,
    'ordinary dirty translation should stay bounded to the changed object and direct children'
  );
  assert.doesNotMatch(
    runtimeObjectFunction,
    /widget->findChildren<QWidget \*>\(\)/,
    'ordinary clicks and ChildAdded events must not recursively walk a large top-level widget subtree'
  );
  assert.match(
    injectorSource,
    /drainDirtyObjects[\s\S]{0,1200}scheduleCaptureInventoryDump\(lang\)/,
    'dirty translation may schedule a capture-only trailing inventory, but must not synchronously write one per event'
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
  assert.match(
    injectorSource,
    /EmbeddedTranslator[\s\S]{0,1800}exactTranslationKey\(context, sourceText\)[\s\S]{0,900}QHash<QByteArray, QString>/,
    'QTranslator exact (context, source) lookup should use a hash index instead of scanning every generated entry'
  );
  assert.match(
    injectorSource,
    /if \(!m_translations\.contains\(key\)\)[\s\S]{0,260}m_translations\.insert\(key/,
    'duplicate exact keys must preserve the generated table first-match-wins behavior'
  );
  assert.match(
    injectorSource,
    /rebuildTranslationCache[\s\S]{0,900}if \(!source\.isEmpty\(\) && !translation\.isEmpty\(\)\) \{[\s\S]{0,180}gTranslationBySource\.insert\(source, translation\)/,
    'source-only display lookup must preserve its existing last-match-wins cache behavior independently of exact QTranslator keys'
  );
  assert.match(
    injectorSource,
    /translatedLineEditValue[\s\S]{0,520}static const QRegularExpression kNumericSuffixPattern[\s\S]{0,260}kNumericSuffixPattern\.match\(sourceText\)/,
    'fixed hot-path patterns should compile once instead of reconstructing QRegularExpression on every Paint/text change'
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

test('embedded injector translates four exact ExtensionLayer self-painted hints without moving their center', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );
  const generatedTranslations = fs.readFileSync(
    path.join(injectorRoot, 'generated_translations.inc'),
    'utf8'
  );

  for (const source of [
    'Double click here to import Assets.',
    'Drag layers here to see their settings.',
    'Drag some JavaScript here to make a Snippet.',
    'Use the Create menu to add a layer to your Composition.',
  ]) {
    assert.match(
      injectorSource,
      new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `centered empty-state allowlist should contain ${source}`
    );
  }
  assert.match(
    injectorSource,
    /"Use the Create menu to add a layer to your Composition\."/,
    'the final centered empty-state hint must remain an exact source match'
  );
  for (const [language, source, translation] of [
    ['zh-Hans', 'Double click here to import Assets.', '双击此处以导入素材'],
    ['zh-Hans', 'Drag layers here to see their settings.', '将图层拖到此处以查看其设置'],
    ['zh-Hans', 'Drag some JavaScript here to make a Snippet.', '将 JavaScript 拖到此处以创建代码片段'],
    ['zh-Hans', 'Use the Create menu to add a layer to your Composition.', '使用“创建”菜单将图层添加到合成中'],
    ['zh-Hant', 'Double click here to import Assets.', '連按兩下此處以匯入素材'],
    ['zh-Hant', 'Drag layers here to see their settings.', '將圖層拖曳至此以查看其設定'],
    ['zh-Hant', 'Drag some JavaScript here to make a Snippet.', '將 JavaScript 拖到此處以建立程式碼片段'],
    ['zh-Hant', 'Use the Create menu to add a layer to your Composition.', '使用「建立」選單將圖層新增至合成'],
    ['ja_JP', 'Double click here to import Assets.', 'ここをダブルクリックしてアセットをインポートします'],
    ['ja_JP', 'Drag layers here to see their settings.', 'レイヤーをここにドラッグして設定を確認します'],
    ['ja_JP', 'Drag some JavaScript here to make a Snippet.', 'JavaScript をここにドラッグしてスニペットを作成してください'],
    ['ja_JP', 'Use the Create menu to add a layer to your Composition.', '「作成」メニューを使用してコンポジションにレイヤーを追加します'],
  ]) {
    assert.match(
      generatedTranslations,
      new RegExp(
        `"${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}", "${translation}"`
      ),
      `${language} centered hint must match the generated translation exactly: ${source}`
    );
  }
  for (const source of [
    'Double click here to import Assets.',
    'Drag layers here to see their settings.',
    'Drag some JavaScript here to make a Snippet.',
    'Use the Create menu to add a layer to your Composition.',
    'No Connections.',
    'No presets yet.',
    'Drag colours here.',
    'Drag colors here.',
    'No Project Set.',
    'No bookmarks yet.',
    'Organise Pre-Comp Overrides here.',
    'Drag an Attribute connection here.',
    "Drag in Compositions or use the '+ Current Composition' button.",
    'Right Click on Attributes to add them to this window.',
  ]) {
    assert.doesNotMatch(
      generatedTranslations,
      new RegExp(
        `"${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}", "[^"\\r\\n]*[。．]"`,
        'u'
      ),
      `empty-state and drag/drop translations must not end with a full stop: ${source}`
    );
  }
  assert.match(
    injectorSource,
    /drawPointTextWithoutInterpose[\s\S]{0,500}painter->drawText\(point, text, 0, 0\)/,
    'the pass-through must use Qt 6.6.3\'s equivalent four-argument overload instead of a fallible RTLD_NEXT lookup'
  );
  assert.match(
    injectorSource,
    /qtPainterDrawPointTextInterposeTarget[\s\S]{0,900}kQPainterDrawPointTextInterpose/,
    'the point-text overload must be installed as an explicit dyld interpose entry'
  );
  assert.match(
    injectorSource,
    /translated\.isEmpty\(\)[\s\S]{0,180}drawPointTextWithoutInterpose\(painter, point, text\)/,
    'missing language or translation data must draw the original hint instead of swallowing it'
  );
  assert.doesNotMatch(
    injectorSource,
    /originalQPainterDrawPointText|RTLD_NEXT[^\n]*QPainter8drawText/,
    'the centered hint path must not depend on fallible dynamic symbol resolution'
  );
  assert.match(
    injectorSource,
    /sourceWidth[\s\S]{0,700}translatedWidth[\s\S]{0,420}point\.x\(\) \+ static_cast<qreal>\(sourceWidth - translatedWidth\) \/ 2\.0[\s\S]{0,160}point\.y\(\)/,
    'the replacement must compensate only the text width delta so the visual center and vertical baseline stay fixed'
  );
  assert.match(
    injectorSource,
    /displayFont\.setStyleStrategy\(QFont::PreferDefault\)[\s\S]{0,700}painter->setFont\(sourceFont\)/,
    'the targeted draw path must enable CJK fallback temporarily and restore the original painter font afterwards'
  );
  assert.doesNotMatch(
    injectorSource,
    /_dyld_register_func_for_add_image|patchExtensionLayerImage|patchCStringSection|kExtensionLayerLiteralPatches/,
    'fixed-length ExtensionLayer literals must not be rewritten because their QByteArrayView lengths are compiled into the call sites'
  );
  assert.match(
    injectorSource,
    /非白名单 ExtensionLayer 自绘提示保留英文原文/,
    'the feature must stay allowlist-scoped instead of translating every self-painted ExtensionLayer string'
  );
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

test('embedded injector inventory exposes MessageBar meta-object diagnostics', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /MessageBar[\s\S]{0,160}LogMessage/,
    'MessageBar and LogMessage widgets should stay in diagnostic inventory even when their visible text is self-painted'
  );
  assert.match(
    injectorSource,
    /widgetMetaObjectMethods|methodSignature/,
    'diagnostic inventory should expose Qt meta-object methods so message history can be wired through signals/properties instead of guessing'
  );
  assert.match(
    injectorSource,
    /metaObjectMethods/,
    'serialized diagnostic widgets should include metaObjectMethods for live capture artifacts'
  );
});

test('embedded injector translates MessageBar QTextEdit log popout text at append time', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /QTextEdit/,
    'MessageBar log popout uses QTextEdit and must be part of the runtime widget translation surface'
  );
  assert.doesNotMatch(
    injectorSource,
    /QEvent::Paint[\s\S]{0,360}textEditForObject|QEvent::Show[\s\S]{0,360}textEditForObject/,
    'MessageBar popup animation must stay native; QTextEdit history should not be rescanned from Paint/Show events'
  );
  assert.doesNotMatch(
    injectorSource,
    /translateTextEditDocument/,
    'MessageBar translation should replace log text at append-time instead of scanning the whole QTextDocument during popup animation'
  );
  assert.doesNotMatch(
    injectorSource,
    /toPlainText\s*\(/,
    'runtime refresh/inventory must not materialize QTextEdit history; MessageBar popup animation should not pay an O(history) log read'
  );
  assert.match(
    injectorSource,
    /__ZN9QTextEdit6appendERK7QString|replacementQTextEditAppend|translatedTextEditAppendText/,
    'MessageBar log popout appends entries through QTextEdit::append, so the injector should translate that public Qt append surface'
  );
  assert.match(
    injectorSource,
    /appendTextEditWithoutInterpose[\s\S]{0,520}insertHtml|appendTextEditWithoutInterpose[\s\S]{0,520}insertText/,
    'if dyld cannot resolve the next QTextEdit::append symbol, the replacement must still append the original log text instead of swallowing the message'
  );
  assert.doesNotMatch(
    injectorSource,
    /if\s*\(\s*original\s*==\s*nullptr\s*\)\s*\{\s*return;\s*\}/,
    'QTextEdit::append interposing must not turn symbol-resolution failure into a blank MessageBar popup'
  );
  assert.match(
    injectorSource,
    /translatedCopiedLogMessage[\s\S]{0,620}Copied\\\\s\+/,
    'MessageBar history contains dynamic "Copied <object>" entries, so the injector should translate the template instead of requiring exact whole-sentence matches'
  );
  assert.match(
    injectorSource,
    /translatedCopiedLogMessage[\s\S]{0,900}translatedWidgetText\(lang,\s*copiedTarget\)/,
    'Copied log templates should reuse the existing object translation table for targets such as Align and Polygon Shape'
  );
  assert.match(
    injectorSource,
    /已复制「%1」[\s\S]{0,220}已複製「%1」[\s\S]{0,220}コピーしました/,
    'Copied log templates should be localized for zh-Hans, zh-Hant, and ja_JP'
  );
  assert.match(
    injectorSource,
    /translatedUndoRedoLogMessage[\s\S]{0,720}Undo\|Redo[\s\S]{0,720}translatedWidgetText\(lang,\s*undoTarget\)/,
    'MessageBar history contains dynamic "Undo (<operation>)" entries, so the injector should translate the template and reuse the existing operation translation table'
  );
  assert.match(
    injectorSource,
    /撤销（%1）[\s\S]{0,260}復原（%1）[\s\S]{0,260}元に戻す/,
    'Undo log templates should be localized for zh-Hans, zh-Hant, and ja_JP'
  );
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

test('Qt SDK contract preserves macOS builds and prepares the Windows x64 SDK from one version truth', () => {
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
  const packageScripts = JSON.parse(packageJson).scripts;
  const buildScript = fs.readFileSync(path.join(repoRoot, 'tools', 'build_translator_injector.sh'), 'utf8');
  const resolverPath = path.join(repoRoot, 'tools', 'resolve_cavalry_qt_sdk.js');
  const resolverApi = require(resolverPath);
  const workflowSource = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');
  const windowsConfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.windows.conf.json'), 'utf8')
  );
  const targetPath = path.join(repoRoot, 'tools', 'cavalry_qt_target.json');
  const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const resolver = fs.readFileSync(resolverPath, 'utf8');
  const pythonResolver = fs.readFileSync(path.join(repoRoot, 'tools', 'python_command.js'), 'utf8');

  assert.match(
    packageJson,
    /"prepare:qt-sdk": "node tools\/resolve_cavalry_qt_sdk\.js --ensure"/,
    'the existing macOS SDK preparation command must remain compatible'
  );
  assert.equal(
    packageScripts['prepare:qt-sdk:windows'],
    'node tools/resolve_cavalry_qt_sdk.js --platform windows --ensure'
  );
  assert.match(
    packageScripts['build:injector'] || '',
    /resolve_cavalry_qt_sdk\.js --print-env --ensure.*build_translator_injector\.sh/,
    'default injector builds should resolve the target SDK from the project contract instead of scattering 6.6.3 inline'
  );
  assert.equal(target.qtVersion, '6.6.3');
  assert.equal(target.cavalryVersion, '2.7.2');
  assert.deepEqual(Object.keys(target.platforms).sort(), ['macos', 'windows']);
  assert.equal(target.platforms.macos.sdkPath, 'qt_sdk/6.6.3/macos');
  assert.equal(target.platforms.macos.aqt.host, 'mac');
  assert.equal(target.platforms.macos.aqt.arch, 'clang_64');
  assert.equal(target.platforms.windows.sdkPath, 'qt_sdk/6.6.3/msvc2019_64');
  assert.equal(target.platforms.windows.aqt.host, 'windows');
  assert.equal(target.platforms.windows.aqt.arch, 'win64_msvc2019_64');
  assert.equal(resolverApi.parseArgs(['--platform', 'windows']).platform, 'windows');
  assert.deepEqual(resolverApi.selectPlatformTarget(target, 'windows'), {
    cavalryVersion: '2.7.2',
    qtVersion: '6.6.3',
    platform: 'windows',
    sdkPath: 'qt_sdk/6.6.3/msvc2019_64',
    aqt: target.platforms.windows.aqt,
  });
  assert.throws(
    () => resolverApi.selectPlatformTarget(target, 'linux'),
    /Unsupported Qt SDK platform "linux"/
  );
  const fakeWindowsQt = fs.mkdtempSync(path.join(os.tmpdir(), 'cavalry-windows-qt-'));
  try {
    fs.mkdirSync(path.join(fakeWindowsQt, 'mkspecs'), { recursive: true });
    fs.writeFileSync(
      path.join(fakeWindowsQt, 'mkspecs', 'qconfig.pri'),
      'QT_VERSION = 6.6.3\n'
    );
    assert.equal(resolverApi.sdkQtVersion(fakeWindowsQt, 'windows'), '6.6.3');
  } finally {
    fs.rmSync(fakeWindowsQt, { recursive: true, force: true });
  }
  assert.match(
    resolver,
    /install-qt[\s\S]*target\.aqt\.host[\s\S]*target\.aqt\.target[\s\S]*target\.qtVersion[\s\S]*target\.aqt\.arch/,
    'resolver should be able to download exactly the target Qt SDK for CI'
  );
  assert.match(
    resolver,
    /resolvePythonCommand[\s\S]*import aqt[\s\S]*VIRTUAL_ENV/,
    'resolver should route aqt through the shared Python command boundary without mutating the managed system Python'
  );
  assert.match(
    pythonResolver,
    /env\.PYTHON[\s\S]*command:\s*'py'[\s\S]*'-3'[\s\S]*command:\s*'python'/,
    'shared Python command resolution should honor PYTHON and probe py -3/python on Windows'
  );
  assert.match(
    workflowSource,
    /python3 -m venv "\$RUNNER_TEMP\/aqt-venv"[\s\S]*pip install aqtinstall[\s\S]*PYTHON=\$RUNNER_TEMP\/aqt-venv\/bin\/python/,
    'macOS packaging should install aqtinstall inside a local venv and pass that Python to the resolver'
  );
  assert.equal(
    packageScripts['build:tauri:windows'],
    'npm run prepare:qt-sdk:windows && tauri build --target x86_64-pc-windows-msvc --config src-tauri/tauri.windows.conf.json && node tools/windows_nsis_provenance.js --record',
    'the public Windows build entry must prepare Qt, build the explicit x64 target, and record provenance'
  );
  assert.equal(
    windowsConfig.build.beforeBuildCommand,
    'npm run prepare:tauri:windows-bundle',
    'the Tauri Windows hook must build the injector and prepare provenance before bundling'
  );
  assert.equal(
    packageScripts['prepare:tauri:windows-bundle'],
    'npm run build:injector:windows && node tools/windows_nsis_provenance.js --prepare',
    'the bundle hook must publish the Windows injector before fingerprinting package inputs'
  );
  assert.match(
    workflowSource,
    /windows_check:[\s\S]*npm run build:tauri:windows/,
    'Windows CI must use the same self-contained x64 build entry as local packaging'
  );
  assert.doesNotMatch(
    workflowSource,
    /python -m aqt install-qt windows/,
    'Windows CI must not duplicate the target Qt version and architecture outside cavalry_qt_target.json'
  );
  assert.match(
    workflowSource,
    /matrix:[\s\S]*aarch64-apple-darwin[\s\S]*x86_64-apple-darwin[\s\S]*CSC_IDENTITY_AUTO_DISCOVERY:\s*false[\s\S]*APPLE_SIGNING_IDENTITY:\s*"-"[\s\S]*unset CI[\s\S]*npm run tauri:build -- --target \$\{\{ matrix\.rust_target \}\}[\s\S]*bash tools\/stamp_dmg_icon\.sh src-tauri\/target\/\$\{\{ matrix\.rust_target \}\}\/release\/bundle\/dmg/,
    'macOS packaging should mirror LOCAL_BUILD_SOP by disabling automatic signing discovery, forcing Tauri ad-hoc signing, unsetting CI for Finder DMG layout, and building/stamping both Apple Silicon and Intel targets'
  );
  assert.doesNotMatch(
    workflowSource,
    /\.dmg\.zip/,
    'macOS packaging should expose the direct DMG release shape instead of wrapping the installer in a zip'
  );
  assert.match(
    workflowSource,
    /Extract version changelog[\s\S]*extract_release_changelog\.js[\s\S]*--version "\$INTERNAL_APP_VERSION"[\s\S]*--output release-changes\.md[\s\S]*Write GitHub Release notes[\s\S]*Cavalry Language Switcher 是一个面向 Cavalry \$\{TARGET_CAVALRY_VERSION\}[\s\S]*## p\$\{RELEASE_PATCH\} 更新内容 \/ Changes[\s\S]*cat release-changes\.md[\s\S]*Apple M 芯片[\s\S]*Intel 芯片[\s\S]*支持语言[\s\S]*日本語[\s\S]*English/,
    'tag releases should combine the product body with the exact internal-version CHANGELOG section'
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
    /clang\+\+[\s\S]{0,240}-O2/,
    'the shipped runtime injector must use a stable optimized build rather than clang default -O0'
  );
  assert.match(
    buildScript,
    /-Wl,-rpath,@loader_path/,
    'the injector must bind to the selected app bundle rather than a build-machine absolute Qt path'
  );
  assert.doesNotMatch(
    buildScript,
    /-Wl,-rpath,"\$QT_FRAMEWORKS"/,
    'the injector must not retain a runtime fallback to the build SDK because duplicate Qt runtimes abort Cavalry'
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
    injectorSource,
    /simplified\(\)|\\s\+/,
    'normalization should collapse runtime whitespace so menu labels reset with odd spacing still hit embedded translations'
  );
  assert.match(
    generated,
    /"MenuBarManager", "Set Project", ".*"/,
    'embedded translations should include the real Set Project menu label captured from the runtime inventory'
  );
});

test('embedded injector handles dynamic layer context menu labels without static one-off entries', () => {
  const injectorSource = fs.readFileSync(
    path.join(injectorRoot, 'CavalryTranslatorInjector.mm'),
    'utf8'
  );

  assert.match(
    injectorSource,
    /lookupDynamicMenuTranslation/,
    'runtime lookup should include a small dynamic fallback for labels like Copy 1 Layer and user-numbered Rig Control menu items'
  );
  assert.match(
    injectorSource,
    /Copy\\s\+\[0-9\]\+\\s\+Layer|Copy\\\\s\+\(\[0-9\]\+\)\\\\s\+Layer/,
    'dynamic fallback should translate Copy <n> Layer context menu actions without enumerating every count'
  );
  assert.match(
    injectorSource,
    /Rig Control\\s\+\[0-9\]\+|Rig Control\\\\s\+\(\[0-9\]\+\)/,
    'dynamic fallback should translate numbered Rig Control labels while preserving the user-visible suffix'
  );
  assert.match(
    injectorSource,
    /Rename\.\.\./,
    'dynamic fallback should cover Rename... because the static table only contains the bare Rename command'
  );
  assert.match(
    injectorSource,
    /Add Keyframe on frame\\s\+\(\[0-9\]\+\)|Add Keyframe on frame\\\\s\+\(\[0-9\]\+\)/,
    'dynamic fallback should translate Time Editor Add Keyframe on frame <n> actions without enumerating every frame number'
  );
  assert.match(
    injectorSource,
    /selectedCountPattern[\s\S]{0,120}\[0-9\]\+[\s\S]{0,120}selected/,
    'dynamic fallback should translate status labels like 8 selected without enumerating every selection count'
  );
  assert.match(
    injectorSource,
    /offlineAuthPattern[\s\S]{0,180}\[0-9\]\+[\s\S]{0,120}days/,
    'dynamic fallback should translate offline re-authentication countdown labels without hard-coding the remaining day count'
  );
  assert.match(
    injectorSource,
    /endsWith\(QStringLiteral\(":"\)\)[\s\S]{0,220}left\(normalizedSource\.size\(\) - 1\)/,
    'dynamic fallback should translate colon-suffixed labels like Looping: from the existing bare Looping entry'
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
  fs.mkdirSync(path.join(tempRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'docs', 'libExtensionLayer-curated-ui.txt'), 'curated\n');

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

test('compiled UI source map is generated in the local cache, not tracked under docs', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.equal(
    fs.existsSync(path.join(repoRoot, 'docs', 'compiled-ui-source-map.json')),
    false,
    'compiled UI source map should be regenerated from the local Cavalry.app instead of tracked under docs/'
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
  assert.match(
    injectorSource,
    /runtimeInventoryCaptureEnabled[\s\S]{0,520}CAVALRY_I18N_SESSION_DIR[\s\S]{0,520}CAVALRY_I18N_CAPTURE_RUNTIME[\s\S]{0,520}CAVALRY_I18N_DUMP_ITEM_MODELS/,
    'runtime inventory must be gated behind an explicit session/capture environment instead of ordinary language switching'
  );
  assert.match(
    injectorSource,
    /dumpQtMenuInventory\(const QString &lang\)[\s\S]{0,300}!runtimeInventoryCaptureEnabled\(\)[\s\S]{0,120}return true;/,
    'the inventory gate must run before QApplication::allWidgets so normal launches do not scan or write diagnostic state'
  );
  assert.match(
    injectorSource,
    /NSString \*runtimeSessionDir\(\)[\s\S]{0,260}static NSString \*sessionDir[\s\S]{0,180}dispatch_once/,
    'one process must reuse one session path instead of creating a UUID directory per dump'
  );
  assert.match(
    injectorSource,
    /NSString \*bundleExecutableHash\(\)[\s\S]{0,260}static NSString \*bundleHash[\s\S]{0,180}dispatch_once/,
    'capture provenance should hash the Cavalry executable once per process, not once per inventory export'
  );
  assert.match(
    injectorSource,
    /if \(dumpOnlyEnglish\)[\s\S]{0,260}!runtimeInventoryCaptureEnabled\(\)[\s\S]{0,260}runtime inventory disabled/,
    'ordinary English mode must remain write-free while explicit English dump-only sessions retain their retry/export path'
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
    /unset CI[\s\S]*npm run tauri:build -- --target \$\{\{ matrix\.rust_target \}\}[\s\S]*bash tools\/stamp_dmg_icon\.sh src-tauri\/target\/\$\{\{ matrix\.rust_target \}\}\/release\/bundle\/dmg[\s\S]*npm run check:app[\s\S]*npm run test:contracts[\s\S]*npm run check:tauri[\s\S]*npm run test:tauri[\s\S]*PACKAGED_APP_PATH="\$app_path" PACKAGED_EXPECTED_ARCH="\$\{\{ matrix\.expected_arch \}\}" npm run test:tauri:packaged[\s\S]*bash tools\/check_dmg_layout\.sh "\$bundle_root\/dmg"/,
    'macOS packaging workflow should mirror LOCAL_BUILD_SOP for each matrix architecture, omitting only manual-smoke and GUI window regression'
  );
  assert.doesNotMatch(
    workflowSource,
    /npm run test:tauri:manual-smoke|npm run test:tauri:ui/,
    'GitHub packaging must omit only the local manual smoke and GUI window regression gates'
  );
  assert.doesNotMatch(
    workflowSource,
    /run: npm run build$|docs\/compiled-ui-source-map\.json|docs\/translation-whitelist\.json/,
    'workflow should not keep the legacy build command or docs-scoped gate artifacts'
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
  const zhHantTs = fs.readFileSync(path.join(repoRoot, 'tools', 'zh-Hant.ts'), 'utf8');
  const jaTs = fs.readFileSync(path.join(repoRoot, 'tools', 'ja_JP.ts'), 'utf8');

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
    zhHantTs,
    /<source>ToolBox<\/source>\s*<translation>工具箱<\/translation>/,
    'Traditional Chinese live runtime window titles must not fall back to English ToolBox'
  );
  assert.match(
    jaTs,
    /<source>ToolBox<\/source>\s*<translation>ツールボックス<\/translation>/,
    'Japanese live runtime window titles must not fall back to English ToolBox'
  );
  for (const [catalog, translation, language] of [
    [zhHansTs, '退出', 'Simplified Chinese'],
    [zhHantTs, '結束', 'Traditional Chinese'],
    [jaTs, '終了', 'Japanese'],
  ]) {
    assert.match(
      catalog,
      new RegExp(`<source>Exit</source>\\s*<translation>${translation}</translation>`),
      `${language} File menu must translate the ExtensionLayer Exit action`
    );
  }
  assert.match(
    zhHansTs,
    /<source>&lt;i&gt;Click to see next message&lt;\/i&gt;<\/source>\s*<translation>&lt;i&gt;点击查看下一条消息&lt;\/i&gt;<\/translation>/,
    'Tips panel HTML labels should be translated as exact runtime widget strings'
  );
  assert.match(
    zhHantTs,
    /<source>&lt;i&gt;Click to see next message&lt;\/i&gt;<\/source>\s*<translation>&lt;i&gt;點擊查看下一則訊息&lt;\/i&gt;<\/translation>/,
    'Traditional Chinese Tips panel HTML labels should not fall back to the bare text entry'
  );
  assert.match(
    jaTs,
    /<source>&lt;i&gt;Click to see next message&lt;\/i&gt;<\/source>\s*<translation>&lt;i&gt;クリックして次のメッセージを表示&lt;\/i&gt;<\/translation>/,
    'Japanese Tips panel HTML labels should not fall back to the bare text entry'
  );
  for (const [source, zhHans, zhHant, ja] of [
    ['Copy Animated Attribute', '复制动画属性', '複製動畫屬性', 'アニメーション属性をコピー'],
    ['Clip(s)', '片段', '片段', 'クリップ'],
    ['4-Point Warp', '四点变形', '四點變形', '4点ワープ'],
    ['Editable Shape', '可编辑形状', '可編輯形狀', '編集可能シェイプ'],
    ['Erosion', '腐蚀', '侵蝕', 'エロージョン'],
    ['Falloff', '衰减', '衰減', 'フォールオフ'],
    ['Motion Stretch', '运动拉伸', '運動拉伸', 'モーションストレッチ'],
    ['Polar Coordinates', '极坐标', '極座標', '極座標'],
    ['Spring', '弹簧', '彈簧', 'スプリング'],
    ['Trails', '轨迹', '軌跡', 'トレイル'],
    ['Velocity Context', '速度方向上下文', '速度方向上下文', '速度方向コンテキスト'],
    ['Velocity Magnitude Context', '速度大小上下文', '速度大小上下文', '速度の大きさコンテキスト'],
    ['Remapping', '重映射', '重映射', 'リマッピング'],
    ['None...', '无...', '無...', 'なし...'],
    ['Draw Extents', '绘制范围', '繪製範圍', '範囲を描画'],
    ['Column Span', '跨列', '跨列', '列スパン'],
    ['Row Span', '跨行', '跨行', '行スパン'],
    ['Start Frame', '起始帧', '起始幀', '開始フレーム'],
    ['Seed', '种子', '種子', 'シード'],
    ['Lifespan', '生命周期', '生命週期', '寿命'],
    ['Emitters', '发射器', '發射器', 'エミッター'],
    ['Turbulence', '湍流', '湍流', 'タービュランス'],
    ['Gravity', '重力', '重力', '重力'],
    ['Drag Force', '阻力', '阻力', 'ドラッグ力'],
    ['Mass', '质量', '質量', '質量'],
    ['Ground Friction', '地面摩擦', '地面摩擦', '地面摩擦'],
    ['Ground Bounce', '地面弹跳', '地面彈跳', '地面バウンス'],
    ['Velocity Iterations', '速度迭代', '速度迭代', '速度反復'],
    ['Position Iterations', '位置迭代', '位置迭代', '位置反復'],
    ['Fields', '场', '場', 'フィールド'],
    ['Un-Parent', '解除父级', '解除父級', '親子付けを解除'],
    ['Timing Mode', '时序模式', '時序模式', 'タイミングモード'],
    ['Group By Parent', '按父级分组', '按父級分組', '親でグループ化'],
    ['Parent Timing Mode', '父级时序模式', '父級時序模式', '親のタイミングモード'],
    ['Reverse Parent Order', '反转父级顺序', '反轉父級順序', '親の順序を反転'],
    ['You are working in an unsaved scene.', '你正在未保存的场景中工作。', '你正在未儲存的場景中工作。', '未保存のシーンで作業しています。'],
    ['Click to see next message', '点击查看下一条消息', '點擊查看下一則訊息', 'クリックして次のメッセージを表示'],
  ]) {
    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(zhHansTs, new RegExp(`<source>${escapedSource}<\\/source>\\s*<translation>${zhHans}<\\/translation>`));
    assert.match(zhHantTs, new RegExp(`<source>${escapedSource}<\\/source>\\s*<translation>${zhHant}<\\/translation>`));
    assert.match(jaTs, new RegExp(`<source>${escapedSource}<\\/source>\\s*<translation>${ja}<\\/translation>`));
  }
});

test('compiled runtime catalogs cover evidenced palette, scene, and tool surfaces', () => {
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const { parseTs } = require(generatorPath);
  const catalogs = new Map([
    ['zh-Hans', path.join(repoRoot, 'tools', 'zh-Hans.ts')],
    ['zh-Hant', path.join(repoRoot, 'tools', 'zh-Hant.ts')],
    ['ja_JP', path.join(repoRoot, 'tools', 'ja_JP.ts')],
  ]);
  const expectations = [
    ['MenuBarManager', 'Reveal in Finder', '在访达中显示', '在 Finder 中顯示', 'Finder に表示'],
    ['MenuBarManager', 'Reveal in Finder...', '在访达中显示...', '在 Finder 中顯示...', 'Finder に表示...'],
    ['cavalry::PaletteListWidget', 'Palette Name:', '调色板名称:', '調色盤名稱:', 'パレット名:'],
    ['Widget', 'Palette Name:', '调色板名称:', '調色盤名稱:', 'パレット名:'],
    ['Widget', 'Reveal in Explorer...', '在文件资源管理器中显示...', '在檔案總管中顯示...', 'エクスプローラーで表示...'],
    ['Widget', 'New Name:', '新名称:', '新名稱:', '新しい名前:'],
    ['PaletteWidget', 'Palette Name:', '调色板名称:', '調色盤名稱:', 'パレット名:'],
    ['PaletteWidget', 'Set W3C Name', '设置 W3C 名称', '設定 W3C 名稱', 'W3C 名を設定'],
    ['assets::Window', 'Reveal in Explorer...', '在文件资源管理器中显示...', '在檔案總管中顯示...', 'エクスプローラーで表示...'],
    ['cavalry::DGWindow', 'Bookmark Name:', '书签名称:', '書籤名稱:', 'ブックマーク名:'],
    ['MenuBarManager', 'This Scene has missing layer types:', '此场景缺少以下图层类型：', '此場景缺少以下圖層類型：', 'このシーンに次のレイヤータイプがありません：'],
    ['MenuBarManager', 'This Scene has corrupt References:', '此场景包含损坏的引用：', '此場景包含損壞的參照：', 'このシーンには破損した参照があります：'],
    ['MenuBarManager', 'This Scene has missing assets:', '此场景缺少素材：', '此場景缺少素材：', 'このシーンに不足しているアセットがあります：'],
    ['MenuBarManager', 'This Scene has missing fonts:', '此场景缺少字体：', '此場景缺少字體：', 'このシーンに不足しているフォントがあります：'],
    ['MenuBarManager', 'Are you sure you want to delete the Render Item(s)?', '确定要删除渲染项目吗？', '確定要刪除算繪項目嗎？', 'レンダリング項目を削除してもよろしいですか？'],
    ['MenuBarManager', 'Delete Render Item(s)', '删除渲染项目', '刪除算繪項目', 'レンダリング項目を削除'],
    ['MeshToolSettings', 'Soft Selection: ', '软选择： ', '軟選擇： ', 'ソフト選択： '],
    ['MeshToolSettings', 'Soft Selection Size: ', '软选择大小： ', '軟選擇大小： ', 'ソフト選択サイズ： '],
    ['PencilToolSettings', 'Stability Radius: ', '稳定半径： ', '穩定半徑： ', '安定化半径： '],
    ['PrimitiveToolSettingsBase', 'Draw in 2.5D: ', '在 2.5D 中绘制： ', '在 2.5D 中繪製： ', '2.5Dで描画： '],
    ['LineToolSettings', 'Stroke Width', '描边宽度', '描邊寬度', 'ストローク幅'],
    ['LineToolSettings', 'Cap Style', '端头样式', '端頭樣式', 'キャップスタイル'],
    ['LineToolSettings', 'Line Style: ', '线条样式： ', '線條樣式： ', 'ラインスタイル： '],
    ['TrackingToolSettings', 'Supervision Strength: ', '监督强度： ', '監督強度： ', '監督強度： '],
    ['TrackingToolSettings', 'Supervised: ', '受监督： ', '受監督： ', '監督あり： '],
    ['TrackingToolSettings', 'Show Grid: ', '显示网格： ', '顯示網格： ', 'グリッドを表示： '],
    ['TrackingToolSettings', 'Preset: ', '预设： ', '預設： ', 'プリセット： '],
  ];

  for (const [language, filePath] of catalogs) {
    const languageIndex = language === 'zh-Hans' ? 2 : language === 'zh-Hant' ? 3 : 4;
    const entries = new Map(
      parseTs(filePath).map(({ context, source, translation }) => [
        `${context}\u001f${source}`,
        translation,
      ])
    );
    for (const expectation of expectations) {
      const [context, source] = expectation;
      assert.equal(
        entries.get(`${context}\u001f${source}`),
        expectation[languageIndex],
        `${language} must translate evidenced ${context} / ${JSON.stringify(source)}`
      );
    }
  }
});

test('Windows Pencil warning uses two exact MessageBar append callers', () => {
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const { parseTs } = require(generatorPath);
  const source =
    "Pencil Tool: You're drawing too far away from the camera, try drawing in 2d.";
  const expectations = new Map([
    ['zh-Hans', '铅笔工具：绘制位置离相机太远，请尝试在 2D 中绘制'],
    ['zh-Hant', '鉛筆工具：繪製位置離攝影機太遠，請嘗試在 2D 中繪製'],
    ['ja_JP', '鉛筆ツール：カメラから離れすぎのため2Dで描画してください'],
  ]);

  for (const [language, translation] of expectations) {
    const fileName = language === 'ja_JP' ? 'ja_JP.ts' : `${language}.ts`;
    const entries = new Map(
      parseTs(path.join(repoRoot, 'tools', fileName)).map((entry) => [
        `${entry.context}\u001f${entry.source}`,
        entry.translation,
      ])
    );
    assert.equal(
      entries.get(`MessageBar\u001f${source}`),
      translation,
      `${language} must carry the exact Pencil warning used by MessageBar`
    );
  }

  const sourcesHeader = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'cavalry_i18n_extension_layer_sources.h'),
    'utf8'
  );
  const qtHooks = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'cavalry_i18n_extension_layer_qt_hooks.cpp'),
    'utf8'
  );
  const aggregateHook = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'cavalry_i18n_extension_layer_hook.cpp'),
    'utf8'
  );
  const vendorContract = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'cavalry_i18n_vendor_messagebar_contract.cpp'),
    'utf8'
  );
  const hookTest = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'cavalry_i18n_messagebar_qt_hook_test.cpp'),
    'utf8'
  );
  const cmake = fs.readFileSync(
    path.join(injectorRoot, 'windows', 'CMakeLists.txt'),
    'utf8'
  );

  assert.match(sourcesHeader, /kStaticMessageBarSources/);
  assert.match(qtHooks, /cavalryExtensionLayerMessageBarAppendReplacement/);
  assert.match(qtHooks, /approvedReturnAddresses/);
  assert.match(qtHooks, /_ReturnAddress\(\)/);
  assert.match(qtHooks, /lastIndexOf\(QStringLiteral\("<br>"\)\)/);
  assert.doesNotMatch(qtHooks, /toPlainText\s*\(|setPlainText\s*\(/);
  assert.match(aggregateHook, /\?append@QTextEdit@@QEAAXAEBVQString@@@Z/);
  assert.match(vendorContract, /kExpectedQTextEditAppendCallCount\s*=\s*3/);
  assert.match(vendorContract, /0x00FB40F4/);
  assert.match(vendorContract, /0x00FB4B91/);
  assert.match(vendorContract, /kExcludedJsLoggerAppendCallRva\s*=\s*0x010DF4B0/);
  assert.match(vendorContract, / \{\} <b>\{\}<\/b> <br>\{\}/);
  assert.match(hookTest, /excluded js_logger caller/);
  assert.match(hookTest, /raw source without br/);
  assert.match(hookTest, /null return address/);
  assert.match(hookTest, /unknown MessageBar body/);
  assert.match(hookTest, /forward-only callback tombstone/);
  assert.match(cmake, /cavalryi18n_messagebar_qt_hook_test/);
});

test('Canva authentication copy preserves brand names across runtime translations', () => {
  const expectedEntries = {
    'zh-Hans': {
      'A new tab has been opened in your default browser so you can log in to Canva there.':
        '已在默认浏览器中打开新标签页，方便你在其中登录 Canva。',
      'Failed to fetch user info: could not connect to Canva': '获取用户信息失败：无法连接 Canva',
      'Go to Canva': '前往 Canva',
      'Share usage data to help improve Cavalry': '共享使用数据以帮助改进 Cavalry',
      'Sign in with Canva': '使用 Canva 登录',
      'Sign-in timed out. Please try again.': '登录超时。请重试。',
      'Signing out...': '正在退出登录...',
      'Token exchange failed: could not connect to Canva': '令牌交换失败：无法连接 Canva',
      'Token refresh failed: could not connect to Canva': '令牌刷新失败：无法连接 Canva',
      'Token revocation failed: could not connect to Canva': '令牌撤销失败：无法连接 Canva',
      'Upload to Canva': '上传到 Canva',
      'When you use Cavalry, usage data can really help us make improvements, but only if you agree.':
        '使用 Cavalry 时，若你同意，使用数据能帮助我们改进。',
      'Your Canva authorisation has been revoked. Please sign in again.': '你的 Canva 授权已被撤销。请重新登录。',
      'Your render will not be uploaded to Canva.': '你的渲染不会上传到 Canva。',
    },
    'zh-Hant': {
      'A new tab has been opened in your default browser so you can log in to Canva there.':
        '已在預設瀏覽器中開啟新分頁，方便你在其中登入 Canva。',
      'Failed to fetch user info: could not connect to Canva': '取得使用者資訊失敗：無法連線至 Canva',
      'Go to Canva': '前往 Canva',
      'Share usage data to help improve Cavalry': '共享使用資料以幫助改進 Cavalry',
      'Sign in with Canva': '使用 Canva 登入',
      'Sign-in timed out. Please try again.': '登入逾時。請重試。',
      'Signing out...': '正在登出...',
      'Token exchange failed: could not connect to Canva': '權杖交換失敗：無法連線至 Canva',
      'Token refresh failed: could not connect to Canva': '權杖重新整理失敗：無法連線至 Canva',
      'Token revocation failed: could not connect to Canva': '權杖撤銷失敗：無法連線至 Canva',
      'Upload to Canva': '上傳到 Canva',
      'When you use Cavalry, usage data can really help us make improvements, but only if you agree.':
        '使用 Cavalry 時，若你同意，使用資料能幫助我們改進。',
      'Your Canva authorisation has been revoked. Please sign in again.': '你的 Canva 授權已被撤銷。請重新登入。',
      'Your render will not be uploaded to Canva.': '你的算圖不會上傳到 Canva。',
    },
    ja_JP: {
      'A new tab has been opened in your default browser so you can log in to Canva there.':
        'デフォルトブラウザで新しいタブを開きました。そこで Canva にログインできます。',
      'Failed to fetch user info: could not connect to Canva': 'ユーザー情報の取得に失敗しました: Canva に接続できません',
      'Go to Canva': 'Canva に移動',
      'Share usage data to help improve Cavalry': '使用データを共有して Cavalry の改善に役立てる',
      'Sign in with Canva': 'Canva でサインイン',
      'Sign-in timed out. Please try again.': 'サインインがタイムアウトしました。もう一度お試しください。',
      'Signing out...': 'サインアウトしています...',
      'Token exchange failed: could not connect to Canva': 'トークン交換に失敗しました: Canva に接続できません',
      'Token refresh failed: could not connect to Canva': 'トークン更新に失敗しました: Canva に接続できません',
      'Token revocation failed: could not connect to Canva': 'トークン取り消しに失敗しました: Canva に接続できません',
      'Upload to Canva': 'Canva にアップロード',
      'When you use Cavalry, usage data can really help us make improvements, but only if you agree.':
        '同意した場合のみ、Cavalry の使用データが改善に役立てられます。',
      'Your Canva authorisation has been revoked. Please sign in again.':
        'Canva の認証が取り消されました。もう一度サインインしてください。',
      'Your render will not be uploaded to Canva.': 'レンダーは Canva にアップロードされません。',
    },
  };

  for (const [language, entries] of Object.entries(expectedEntries)) {
    const source = fs.readFileSync(path.join(repoRoot, 'tools', `${language}.ts`), 'utf8');
    for (const [english, translation] of Object.entries(entries)) {
      const escapedEnglish = english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedTranslation = translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(
        source,
        new RegExp(`<source>${escapedEnglish}<\\/source>\\s*<translation>${escapedTranslation}<\\/translation>`),
        `${language} should preserve Canva/Cavalry brand wording for "${english}"`
      );
    }
  }
});

test('runtime-generated Attribute Editor labels are translated without touching Time Editor model names', () => {
  const expectedEntries = {
    'zh-Hans': {
      Strength: '强度',
      Falloffs: '衰减',
      'Color Mode': '颜色模式',
      'Bend Angle': '弯曲角度',
      Direction: '方向',
      'Kill On Collision': '碰撞时销毁',
      'Set Sensor': '设为传感器',
      Sensor: '传感器',
      'Set Friction': '设置摩擦',
      Friction: '摩擦',
      'Set Bounce': '设置弹跳',
      Bounce: '弹跳',
      'Set Density': '设置密度',
      Density: '密度',
      'Set Gravity Scale': '设置重力缩放',
      'Gravity Scale': '重力缩放',
      'Fade Changes': '淡化变化',
      'Fade Time': '淡化时间',
      'Input Shapes': '输入形状',
      Stretch: '拉伸',
      Controllers: '控制器',
      'Input Guides': '输入参考线',
      'Projection Target': '投影目标',
      'Input Color': '输入颜色',
      'Affect Only': '仅影响',
      'Affect Id': '影响 ID',
      'Custom Color': '自定义颜色',
      'Draw Color': '绘制颜色',
      Amount: '数量',
      'Horizontal Alignment': '水平对齐',
      'Vertical Alignment': '垂直对齐',
      Amplitude: '振幅',
      'Sample Mode': '采样模式',
      'Direction Mode': '方向模式',
      'Initial Direction': '初始方向',
      'Initial Speed': '初始速度',
      'Override Lifespan': '覆盖生命周期',
      'Blend Mode': '混合模式',
      'Greyscale Mode': '灰度模式',
      Force: '力',
      'Maintain Transform': '保持变换',
      'Show Preview': '显示预览',
      'Physics Mode': '物理模式',
      'Force Magnitude': '力大小',
      'Override Mass': '覆盖质量',
      'Multi Stroke': '多重描边',
      Premultiply: '预乘',
      'Draw Mode': '绘制模式',
      'Use CMYK': '使用 CMYK',
      'Black Gamma': '黑色 Gamma',
      'Out Resolution': '输出分辨率',
      Gradient: '渐变',
      Cycles: '周期数',
      'Dash, Gap (e.g. "4, 2")': '虚线，间隔（例如 "4, 2"）',
      'Screen Space': '屏幕空间',
      Tiling: '平铺',
      Offset: '偏移',
      Padding: '内边距',
      'Number Of Waves': '波形数量',
      'Input Shape': '输入形状',
      'Emitter Type': '发射器类型',
      'Direction Type': '方向类型',
      'Particles Per Point': '每点粒子数',
      'Particles Per Pixel': '每像素粒子数',
      'Use Emitter Velocity': '使用发射器速度',
      'Emitter Velocity': '发射器速度',
      'Scale Over Lifespan': '生命周期缩放',
      'Rotation Over Lifespan': '生命周期旋转',
      'Color Over Lifespan': '生命周期颜色',
      'Image Blend Mode': '图像混合模式',
      'Image Quality': '图像质量',
      'Fit To Lifespan': '适配生命周期',
      'Loop Sequence': '循环序列',
      'Image Index Offset': '图像索引偏移',
      'World Scale': '世界缩放',
      'Time Step': '时间步长',
      'Use Cache': '使用缓存',
      'Cache File Path': '缓存文件路径',
      'Base Layer': '基础层',
      Bidirectional: '双向',
      Border: '边框',
      'Gap Type': '间隙类型',
      'Line Mode': '线条模式',
      'Line Size': '线条大小',
      'Shadow Mask Scale': '阴影蒙版缩放',
      'Unlock Offset': '解锁偏移',
      'Frequency Scale': '频率缩放',
      'Speed Limit': '速度限制',
      'Use Fixed Size': '使用固定大小',
      'Fixed Size': '固定大小',
      'Excel Sheet': 'Excel 工作表',
      Asset: '素材',
      'Optionally enter some indices, e.g: 1, 2, 4:6': '可输入部分索引，例如：1, 2, 4:6',
      'Shuffle Type': '随机排序类型',
      'Keep Punctuation': '保留标点',
      'Shuffle Text': '随机文本',
      'Font Size': '字号',
      'Style Behaviours': '样式行为',
      'Material Behaviours': '材质行为',
      'Vignette Shape': '暗角形状',
      'Blind Color': '百叶窗颜色',
      'Level 0 Color': '层级 0 颜色',
      'Level 1 Color': '层级 1 颜色',
      'Level 2 Color': '层级 2 颜色',
      'Level 3 Color': '层级 3 颜色',
      'Level 4 Color': '层级 4 颜色',
      Octaves: '倍频程',
      Lacunarity: '间隙度',
      Gain: '增益',
      Curl: '卷曲',
      'Curl Amplitude': '卷曲振幅',
      'Shape Style': '形状样式',
      'Particle Radius': '粒子半径',
      'Scale Strength': '缩放强度',
      'Rotation Scalar': '旋转标量',
      'Gradient Mode': '渐变模式',
      'Scale Mode': '缩放模式',
      'Sequence Mode': '序列模式',
      Cyan: '青色',
      'Cyan Transform': '青色变换',
      Magenta: '品红',
      'Magenta Transform': '品红变换',
      Yellow: '黄色',
      'Yellow Transform': '黄色变换',
      Black: '黑色',
      'Black Transform': '黑色变换',
      'Draw Capture Margin': '绘制捕获边距',
      'Draw Flow Margin': '绘制流动边距',
      'Capture Margin': '捕获边距',
      'Capture Force': '捕获力',
      'Capture Graph': '捕获图',
      'Flow Margin': '流动边距',
      'Flow Force': '流动力',
      'Flow Variance': '流动变化',
      'Force Velocity': '力矢量',
      'Adaptive Wave Counts': '自适应波数',
      'Capsule Shape': '胶囊形状',
      'Arrow Shape': '箭头形状',
      'Cogwheel Shape': '齿轮形状',
      'Super Ellipse Shape': '超级椭圆形状',
      'Arc Shape': '圆弧形状',
      'Star Shape': '星形',
      'Polygon Shape': '多边形',
      'Ellipse Shape': '椭圆',
      'Rectangle Shape': '矩形',
      'No Mask': '无蒙版',
      'Third Shaders': '第三着色器',
      'No Third Shaders': '无第三着色器',
    },
    'zh-Hant': {
      Strength: '強度',
      Falloffs: '衰減',
      'Color Mode': '顏色模式',
      'Bend Angle': '彎曲角度',
      Direction: '方向',
      'Kill On Collision': '碰撞時銷毀',
      'Set Sensor': '設為感測器',
      Sensor: '感測器',
      'Set Friction': '設定摩擦',
      Friction: '摩擦',
      'Set Bounce': '設定彈跳',
      Bounce: '彈跳',
      'Set Density': '設定密度',
      Density: '密度',
      'Set Gravity Scale': '設定重力縮放',
      'Gravity Scale': '重力縮放',
      'Fade Changes': '淡化變化',
      'Fade Time': '淡化時間',
      'Input Shapes': '輸入形狀',
      Stretch: '拉伸',
      Controllers: '控制器',
      'Input Guides': '輸入參考線',
      'Projection Target': '投影目標',
      'Input Color': '輸入顏色',
      'Affect Only': '僅影響',
      'Affect Id': '影響 ID',
      'Custom Color': '自訂顏色',
      'Draw Color': '繪製顏色',
      Amount: '數量',
      'Horizontal Alignment': '水平對齊',
      'Vertical Alignment': '垂直對齊',
      Amplitude: '振幅',
      'Sample Mode': '採樣模式',
      'Direction Mode': '方向模式',
      'Initial Direction': '初始方向',
      'Initial Speed': '初始速度',
      'Override Lifespan': '覆蓋生命週期',
      'Blend Mode': '混合模式',
      'Greyscale Mode': '灰階模式',
      Force: '力',
      'Maintain Transform': '保持變換',
      'Show Preview': '顯示預覽',
      'Physics Mode': '物理模式',
      'Force Magnitude': '力大小',
      'Override Mass': '覆蓋質量',
      'Multi Stroke': '多重描邊',
      Premultiply: '預乘',
      'Draw Mode': '繪製模式',
      'Use CMYK': '使用 CMYK',
      'Black Gamma': '黑色 Gamma',
      'Out Resolution': '輸出解析度',
      Gradient: '漸層',
      Cycles: '週期數',
      'Dash, Gap (e.g. "4, 2")': '虛線，間隔（例如 "4, 2"）',
      'Screen Space': '螢幕空間',
      Tiling: '平鋪',
      Offset: '偏移',
      Padding: '內邊距',
      'Number Of Waves': '波形數量',
      'Input Shape': '輸入形狀',
      'Emitter Type': '發射器類型',
      'Direction Type': '方向類型',
      'Particles Per Point': '每點粒子數',
      'Particles Per Pixel': '每像素粒子數',
      'Use Emitter Velocity': '使用發射器速度',
      'Emitter Velocity': '發射器速度',
      'Scale Over Lifespan': '生命週期縮放',
      'Rotation Over Lifespan': '生命週期旋轉',
      'Color Over Lifespan': '生命週期顏色',
      'Image Blend Mode': '影像混合模式',
      'Image Quality': '影像品質',
      'Fit To Lifespan': '適配生命週期',
      'Loop Sequence': '循環序列',
      'Image Index Offset': '影像索引偏移',
      'World Scale': '世界縮放',
      'Time Step': '時間步長',
      'Use Cache': '使用快取',
      'Cache File Path': '快取檔案路徑',
      'Base Layer': '基礎層',
      Bidirectional: '雙向',
      Border: '邊框',
      'Gap Type': '間隙類型',
      'Line Mode': '線條模式',
      'Line Size': '線條大小',
      'Shadow Mask Scale': '陰影蒙版縮放',
      'Unlock Offset': '解鎖偏移',
      'Frequency Scale': '頻率縮放',
      'Speed Limit': '速度限制',
      'Use Fixed Size': '使用固定大小',
      'Fixed Size': '固定大小',
      'Excel Sheet': 'Excel 工作表',
      Asset: '素材',
      'Optionally enter some indices, e.g: 1, 2, 4:6': '可輸入部分索引，例如：1, 2, 4:6',
      'Shuffle Type': '隨機排序類型',
      'Keep Punctuation': '保留標點',
      'Shuffle Text': '隨機文字',
      'Font Size': '字號',
      'Style Behaviours': '樣式行為',
      'Material Behaviours': '材質行為',
      'Vignette Shape': '暗角形狀',
      'Blind Color': '百葉窗顏色',
      'Level 0 Color': '層級 0 顏色',
      'Level 1 Color': '層級 1 顏色',
      'Level 2 Color': '層級 2 顏色',
      'Level 3 Color': '層級 3 顏色',
      'Level 4 Color': '層級 4 顏色',
      Octaves: '倍頻程',
      Lacunarity: '間隙度',
      Gain: '增益',
      Curl: '捲曲',
      'Curl Amplitude': '捲曲振幅',
      'Shape Style': '形狀樣式',
      'Particle Radius': '粒子半徑',
      'Scale Strength': '縮放強度',
      'Rotation Scalar': '旋轉標量',
      'Gradient Mode': '漸層模式',
      'Scale Mode': '縮放模式',
      'Sequence Mode': '序列模式',
      Cyan: '青色',
      'Cyan Transform': '青色變換',
      Magenta: '洋紅',
      'Magenta Transform': '洋紅變換',
      Yellow: '黃色',
      'Yellow Transform': '黃色變換',
      Black: '黑色',
      'Black Transform': '黑色變換',
      'Draw Capture Margin': '繪製擷取邊距',
      'Draw Flow Margin': '繪製流動邊距',
      'Capture Margin': '擷取邊距',
      'Capture Force': '擷取力',
      'Capture Graph': '擷取圖',
      'Flow Margin': '流動邊距',
      'Flow Force': '流動力',
      'Flow Variance': '流動變化',
      'Force Velocity': '力向量',
      'Adaptive Wave Counts': '自適應波數',
      'Capsule Shape': '膠囊形狀',
      'Arrow Shape': '箭頭形狀',
      'Cogwheel Shape': '齒輪形狀',
      'Super Ellipse Shape': '超級橢圓形狀',
      'Arc Shape': '圓弧形狀',
      'Star Shape': '星形',
      'Polygon Shape': '多邊形',
      'Ellipse Shape': '橢圓',
      'Rectangle Shape': '矩形',
      'No Mask': '無遮罩',
      'Third Shaders': '第三著色器',
      'No Third Shaders': '無第三著色器',
    },
    ja_JP: {
      Strength: '強度',
      Falloffs: 'フォールオフ',
      'Color Mode': 'カラーモード',
      'Bend Angle': '曲げ角度',
      Direction: '方向',
      'Kill On Collision': '衝突時に消去',
      'Set Sensor': 'センサーに設定',
      Sensor: 'センサー',
      'Set Friction': '摩擦を設定',
      Friction: '摩擦',
      'Set Bounce': 'バウンスを設定',
      Bounce: 'バウンス',
      'Set Density': '密度を設定',
      Density: '密度',
      'Set Gravity Scale': '重力スケールを設定',
      'Gravity Scale': '重力スケール',
      'Fade Changes': 'フェード変更',
      'Fade Time': 'フェード時間',
      'Input Shapes': '入力シェイプ',
      Stretch: 'ストレッチ',
      Controllers: 'コントローラー',
      'Input Guides': '入力ガイド',
      'Projection Target': '投影ターゲット',
      'Input Color': '入力カラー',
      'Affect Only': '影響のみ',
      'Affect Id': '影響 ID',
      'Custom Color': 'カスタムカラー',
      'Draw Color': '描画カラー',
      Amount: '量',
      'Horizontal Alignment': '水平整列',
      'Vertical Alignment': '垂直整列',
      Amplitude: '振幅',
      'Sample Mode': 'サンプルモード',
      'Direction Mode': '方向モード',
      'Initial Direction': '初期方向',
      'Initial Speed': '初期速度',
      'Override Lifespan': '寿命を上書き',
      'Blend Mode': '描画モード',
      'Greyscale Mode': 'グレースケールモード',
      Force: '力',
      'Maintain Transform': 'トランスフォームを保持',
      'Show Preview': 'プレビュー表示',
      'Physics Mode': '物理モード',
      'Force Magnitude': '力の大きさ',
      'Override Mass': '質量を上書き',
      'Multi Stroke': 'マルチストローク',
      Premultiply: 'プリマルチプライ',
      'Draw Mode': '描画モード',
      'Use CMYK': 'CMYK を使用',
      'Black Gamma': 'ブラックガンマ',
      'Out Resolution': '出力解像度',
      Gradient: 'グラデーション',
      Cycles: 'サイクル数',
      'Dash, Gap (e.g. "4, 2")': 'ダッシュ, 間隔 (例: "4, 2")',
      'Screen Space': 'スクリーン空間',
      Tiling: 'タイリング',
      Offset: 'オフセット',
      Padding: 'パディング',
      'Number Of Waves': '波数',
      'Input Shape': '入力シェイプ',
      'Emitter Type': 'エミッタータイプ',
      'Direction Type': '方向タイプ',
      'Particles Per Point': 'ポイントあたりのパーティクル',
      'Particles Per Pixel': 'ピクセルあたりのパーティクル',
      'Use Emitter Velocity': 'エミッター速度を使用',
      'Emitter Velocity': 'エミッター速度',
      'Scale Over Lifespan': '寿命中のスケール',
      'Rotation Over Lifespan': '寿命中の回転',
      'Color Over Lifespan': '寿命中のカラー',
      'Image Blend Mode': '画像描画モード',
      'Image Quality': '画像品質',
      'Fit To Lifespan': '寿命にフィット',
      'Loop Sequence': 'ループシーケンス',
      'Image Index Offset': '画像インデックスオフセット',
      'World Scale': 'ワールドスケール',
      'Time Step': 'タイムステップ',
      'Use Cache': 'キャッシュを使用',
      'Cache File Path': 'キャッシュファイルパス',
      'Base Layer': 'ベースレイヤー',
      Bidirectional: '双方向',
      Border: 'ボーダー',
      'Gap Type': '間隔タイプ',
      'Line Mode': 'ラインモード',
      'Line Size': 'ラインサイズ',
      'Shadow Mask Scale': 'シャドウマスクスケール',
      'Unlock Offset': 'オフセットを解除',
      'Frequency Scale': '周波数スケール',
      'Speed Limit': '速度制限',
      'Use Fixed Size': '固定サイズを使用',
      'Fixed Size': '固定サイズ',
      'Excel Sheet': 'Excel シート',
      Asset: 'アセット',
      'Optionally enter some indices, e.g: 1, 2, 4:6': '必要に応じて一部のインデックスを入力、例: 1, 2, 4:6',
      'Shuffle Type': 'シャッフルタイプ',
      'Keep Punctuation': '句読点を保持',
      'Shuffle Text': 'シャッフルテキスト',
      'Font Size': 'フォントサイズ',
      'Style Behaviours': 'スタイルビヘイビア',
      'Material Behaviours': 'マテリアルビヘイビア',
      'Vignette Shape': 'ビネット形状',
      'Blind Color': 'ブラインドの色',
      'Level 0 Color': 'レベル 0 カラー',
      'Level 1 Color': 'レベル 1 カラー',
      'Level 2 Color': 'レベル 2 カラー',
      'Level 3 Color': 'レベル 3 カラー',
      'Level 4 Color': 'レベル 4 カラー',
      Octaves: 'オクターブ',
      Lacunarity: 'ラキュナリティ',
      Gain: 'ゲイン',
      Curl: 'カール',
      'Curl Amplitude': 'カール振幅',
      'Shape Style': 'シェイプスタイル',
      'Particle Radius': 'パーティクル半径',
      'Scale Strength': 'スケール強度',
      'Rotation Scalar': '回転スカラー',
      'Gradient Mode': 'グラデーションモード',
      'Scale Mode': 'スケールモード',
      'Sequence Mode': 'シーケンスモード',
      Cyan: 'シアン',
      'Cyan Transform': 'シアン変換',
      Magenta: 'マゼンタ',
      'Magenta Transform': 'マゼンタ変換',
      Yellow: 'イエロー',
      'Yellow Transform': 'イエロー変換',
      Black: 'ブラック',
      'Black Transform': 'ブラック変換',
      'Draw Capture Margin': 'キャプチャマージンを描画',
      'Draw Flow Margin': 'フローマージンを描画',
      'Capture Margin': 'キャプチャマージン',
      'Capture Force': 'キャプチャ力',
      'Capture Graph': 'キャプチャグラフ',
      'Flow Margin': 'フローマージン',
      'Flow Force': 'フロー力',
      'Flow Variance': 'フロー変動',
      'Force Velocity': '力ベクトル',
      'Adaptive Wave Counts': '適応波数',
      'Capsule Shape': 'カプセルシェイプ',
      'Arrow Shape': '矢印シェイプ',
      'Cogwheel Shape': '歯車シェイプ',
      'Super Ellipse Shape': 'スーパー楕円シェイプ',
      'Arc Shape': '円弧シェイプ',
      'Star Shape': '星形',
      'Polygon Shape': '多角形',
      'Ellipse Shape': '楕円',
      'Rectangle Shape': '長方形',
      'No Mask': 'マスクなし',
      'Third Shaders': 'サードシェーダー',
      'No Third Shaders': 'サードシェーダーなし',
    },
  };

  for (const [language, entries] of Object.entries(expectedEntries)) {
    const source = fs.readFileSync(path.join(repoRoot, 'tools', `${language}.ts`), 'utf8');
    for (const [english, translation] of Object.entries(entries)) {
      const escapedEnglish = english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedTranslation = translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(
        source,
        new RegExp(`<source>${escapedEnglish}<\\/source>\\s*<translation>${escapedTranslation}<\\/translation>`),
        `${language} TS should translate generated Attribute Editor label ${english}`
      );
    }
  }

  const generatedTable = fs.readFileSync(path.join(injectorRoot, 'generated_translations.inc'), 'utf8');
  assert.doesNotMatch(
    generatedTable,
    /"Super Ellipse Shape 2"/,
    'auto-numbered layer names should not be translated as standalone strings; the numeric suffix must be preserved by the runtime regex'
  );
});

test('Forge Dynamics nodeStrings include direct labels for generated property names', () => {
  const expectedAttributes = {
    en: {
      groundFriction: 'Ground Friction',
      groundBounce: 'Ground Bounce',
      velocityIterations: 'Velocity Iterations',
      positionIterations: 'Position Iterations',
      fields: 'Fields',
    },
    'zh-Hans': {
      groundFriction: '地面摩擦',
      groundBounce: '地面弹跳',
      velocityIterations: '速度迭代',
      positionIterations: '位置迭代',
      fields: '场',
    },
    'zh-Hant': {
      groundFriction: '地面摩擦',
      groundBounce: '地面彈跳',
      velocityIterations: '速度迭代',
      positionIterations: '位置迭代',
      fields: '場',
    },
    ja_JP: {
      groundFriction: '地面摩擦',
      groundBounce: '地面バウンス',
      velocityIterations: '速度反復',
      positionIterations: '位置反復',
      fields: 'フィールド',
    },
  };

  for (const [language, attributes] of Object.entries(expectedAttributes)) {
    const nodeStrings = readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json'));
    const node = nodeStrings
      .flatMap((section) => section.values || [])
      .find((candidate) => candidate.nodeType === 'forgeDynamicsShape');

    assert(node, `${language} should contain forgeDynamicsShape node strings`);
    for (const [key, value] of Object.entries(attributes)) {
      assert.equal(node.attributes[key], value, `${language} forgeDynamicsShape.attributes.${key}`);
    }
  }
});

test('Voronoi Shader nodeStrings include runtime loop length label', () => {
  const expectedAttributes = {
    en: 'Loop Length',
    'zh-Hans': '循环长度',
    'zh-Hant': '循環長度',
    ja_JP: 'ループ長',
  };

  for (const [language, value] of Object.entries(expectedAttributes)) {
    const nodeStrings = readJson(path.join(repoRoot, 'languages', language, 'nodeStrings.json'));
    const node = nodeStrings
      .flatMap((section) => section.values || [])
      .find((candidate) => candidate.nodeType === 'voronoiShader');

    assert(node, `${language} should contain voronoiShader node strings`);
    assert.equal(node.attributes.loopLength, value, `${language} voronoiShader.attributes.loopLength`);
  }
});

test('QuickAdd runtime pruning removes only empty Add Layer rows', () => {
  const injector = fs.readFileSync(path.join(repoRoot, 'injector', 'CavalryTranslatorInjector.mm'), 'utf8');
  assert.match(
    injector,
    /pruneQuickAddEmptyItems\(QListWidget \*listWidget\)[\s\S]*hasAncestorClass\(listWidget,\s*"QuickAddWindow"\)/,
    'empty Add Layer row pruning must be scoped to the QuickAddWindow list, not global item models'
  );
  assert.match(
    injector,
    /normalizeMenuText\(item->text\(\)\)\.isEmpty\(\)[\s\S]*delete listWidget->takeItem\(row\)/,
    'QuickAdd pruning should remove only rows whose display title is empty'
  );
  assert.match(
    injector,
    /hookItemViewModelChanges[\s\S]{0,2200}QAbstractItemModel::rowsInserted[\s\S]{0,900}QAbstractItemModel::modelReset[\s\S]{0,900}QAbstractItemModel::dataChanged/,
    'QuickAdd rows populated after Show must enqueue only their owning item view for translation/pruning'
  );
  assert.match(
    injector,
    /qobject_cast<QAbstractItemView \*>\(widget\)[\s\S]{0,240}hookItemViewModelChanges\(itemView, lang\)/,
    'runtime item views must install exact model-change hooks during startup and local Show translation'
  );
  assert.doesNotMatch(
    injector,
    /scheduleInteractiveRefresh/,
    'QuickAdd async population must not be repaired by restoring a global refresh'
  );
});

test('Add Layer definition tags remain source tokens for Cavalry tag chips', () => {
  const english = readJson(path.join(repoRoot, 'languages', 'en', 'Definitions', 'nodeDefinitions.json'));
  const expected = new Map(
    english
      .filter((definition) => definition.nodeType === 'duplicator' || definition.nodeType === 'basicLine')
      .map((definition) => [definition.nodeType, definition.tags])
  );

  for (const language of ['zh-Hans', 'zh-Hant', 'ja_JP']) {
    const definitions = readJson(path.join(repoRoot, 'languages', language, 'Definitions', 'nodeDefinitions.json'));
    for (const [nodeType, tags] of expected) {
      const definition = definitions.find((candidate) => candidate.nodeType === nodeType);
      assert.deepEqual(
        definition?.tags,
        tags,
        `${language} ${nodeType}.tags should stay as source tokens so Add Layers can render tag chips`
      );
    }
  }
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
  assert.deepEqual(
    contracts.translation_reuse_cap.controlled_source_variants['将颜色拖到此处'],
    [
      'Drag colors here',
      'Drag colors here.',
      'Drag colours here',
      'Drag colours here.',
    ]
  );
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

  const result = spawnPythonSync(
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

test('translation validator preserves bare brace runtime placeholders', () => {
  const validatorTools = path.join(repoRoot, 'tools');
  const probe = [
    'import json',
    'import sys',
    `sys.path.insert(0, ${JSON.stringify(validatorTools)})`,
    'import validate_translations as validator',
    'print(json.dumps(validator.placeholder_tokens("Resolution {} {0} %1 {{name}}")))',
  ].join(';');
  const result = spawnPythonSync(['-c', probe], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    ['{}', '{0}', '%1', '{{name}}']
  );
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

  const result = spawnPythonSync(
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

test('translation validator permits only the declared spelling and punctuation variants', () => {
  const { tempRoot, extractionPath } = makeValidatorFixtureRepo();
  const validatorPath = path.join(tempRoot, 'tools', 'validate_translations.py');
  const reportPath = path.join(tempRoot, 'p5-report.json');
  const summaryPath = path.join(tempRoot, 'p5-summary.md');
  const whitelistPath = path.join(tempRoot, 'tools', 'translation-whitelist.json');
  const tsPath = path.join(tempRoot, 'tools', 'zh-Hans.ts');
  const whitelist = readJson(whitelistPath);
  whitelist._forbidden_patterns = {
    translation_reuse_cap: {
      id: 'FP-12',
      max_distinct_sources: 2,
      min_translation_length: 6,
      controlled_vocabulary: [],
      controlled_source_variants: {
        将颜色拖到此处: [
          'Drag colors here',
          'Drag colors here.',
          'Drag colours here',
          'Drag colours here.',
        ],
      },
    },
  };
  writeJson(whitelistPath, whitelist);

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1" language="zh-Hans">',
      '<context>',
      '<name>MenuBarManager</name>',
      '<message><source>Drag colors here</source><translation>将颜色拖到此处</translation></message>',
      '<message><source>Drag colors here.</source><translation>将颜色拖到此处</translation></message>',
      '<message><source>Drag colours here</source><translation>将颜色拖到此处</translation></message>',
      '<message><source>Drag colours here.</source><translation>将颜色拖到此处</translation></message>',
      '</context>',
      '</TS>',
    ].join('\n')
  );

  const result = spawnPythonSync(
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

  assert.equal(
    report.languages.zh_Hans.forbidden_patterns.by_pattern['FP-12'] || 0,
    0,
    result.stderr || result.stdout
  );
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
  const result = spawnPythonSync(
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

test('add-layer runtime labels cover short translated tags while model niceNames stay English', () => {
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
    'zh-Hans': 'Lattice',
    'zh-Hant': 'Lattice',
    ja_JP: 'Lattice',
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

  const generated = fs.readFileSync(generatedPath, 'utf8').replace(/\r\n?/g, '\n');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8').replace(/\r\n?/g, '\n');
  assert.equal(
    generated,
    checkedIn,
    'generated_translations.inc should be regenerated from tools/*.ts whenever translation sources change'
  );
});

test('embedded translation generator rejects TS messages outside a context', () => {
  const tempRoot = makeTempDir();
  const tsPath = path.join(tempRoot, 'orphan.ts');
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const { parseTs } = require(generatorPath);

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1">',
      '  <context>',
      '    <name>MenuBarManager</name>',
      '    <message><source>Valid</source><translation>有效</translation></message>',
      '  </context>',
      '  <message><source>Orphan</source><translation>孤儿</translation></message>',
      '</TS>',
      '',
    ].join('\n')
  );

  assert.throws(
    () => parseTs(tsPath),
    /orphan\.ts contains <message> outside <context>/,
    'messages outside a TS context would be silently absent from the runtime translation table'
  );
});

test('embedded translation generator preserves deliberate TS source whitespace', () => {
  const tempRoot = makeTempDir();
  const tsPath = path.join(tempRoot, 'preserved-space.ts');
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const { parseTs } = require(generatorPath);

  fs.writeFileSync(
    tsPath,
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<TS version="2.1">',
      '  <context>',
      '    <name>ToolSettings</name>',
      '    <message>',
      '      <source xml:space="preserve">Soft Selection: </source>',
      '      <translation xml:space="preserve">软选择： </translation>',
      '    </message>',
      '  </context>',
      '</TS>',
      '',
    ].join('\n')
  );

  assert.deepEqual(parseTs(tsPath), [
    {
      context: 'ToolSettings',
      source: 'Soft Selection: ',
      translation: '软选择： ',
    },
  ]);
});

test('compiled runtime TS catalogs keep context and source keys symmetric', () => {
  const generatorPath = path.join(repoRoot, 'tools', 'generate_embedded_translations.js');
  const { parseTs } = require(generatorPath);
  const catalogPaths = new Map([
    ['zh-Hans', path.join(repoRoot, 'tools', 'zh-Hans.ts')],
    ['zh-Hant', path.join(repoRoot, 'tools', 'zh-Hant.ts')],
    ['ja_JP', path.join(repoRoot, 'tools', 'ja_JP.ts')],
  ]);
  const keySet = (filePath) =>
    new Set(parseTs(filePath).map(({ context, source }) => `${context}\u001f${source}`));
  const baseline = keySet(catalogPaths.get('zh-Hans'));

  for (const [language, filePath] of catalogPaths) {
    if (language === 'zh-Hans') {
      continue;
    }
    const actual = keySet(filePath);
    const missing = [...baseline].filter((key) => !actual.has(key)).sort();
    const unexpected = [...actual].filter((key) => !baseline.has(key)).sort();
    assert.deepEqual(
      { missing, unexpected },
      { missing: [], unexpected: [] },
      `${language} compiled/runtime catalog must match the zh-Hans (context, source) key set`
    );
  }
});

test('runtime noise quarantine keeps unproven short tokens out of embedded translations', () => {
  const generatorSource = fs.readFileSync(
    path.join(repoRoot, 'tools', 'generate_embedded_translations.js'),
    'utf8'
  );
  const generated = fs.readFileSync(path.join(injectorRoot, 'generated_translations.inc'), 'utf8');
  const quarantine = readJson(path.join(repoRoot, 'tools', 'runtime-noise-quarantine.json'));
  const quarantinedSources = quarantine.tokens
    .filter((entry) => entry.decision === 'do_not_translate')
    .map((entry) => entry.source);
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  assert.match(
    generatorSource,
    /runtime-noise-quarantine\.json/,
    'embedded translation generator should read the runtime noise quarantine before rendering entries'
  );
  assert.equal(quarantinedSources.length, 20, 'audited 2026-05-19 runtime noise batch should contain 20 tokens');
  assert.equal(new Set(quarantinedSources).size, quarantinedSources.length, 'runtime noise quarantine should not contain duplicate sources');

  for (const source of quarantinedSources) {
    assert.doesNotMatch(
      generated,
      new RegExp(`"MenuBarManager", "${escapeRegExp(source)}",`),
      `${source} should not be embedded as a runtime translation without provenance`
    );
  }

  for (const source of ['RGB', 'HSV', 'IK', 'Hue', 'Red', 'X', 'Y', 'Z']) {
    assert(!quarantinedSources.includes(source), `${source} is a legitimate short UI token and must not be quarantined`);
  }
});

test('release workflow prebuilds the injector and publishes Tauri macOS artifacts', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'build.yml'), 'utf8');
  const macConfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'src-tauri', 'tauri.macos.conf.json'), 'utf8')
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

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
    /^\s+tools\/\s*$/m,
    'release pipeline should upload the complete tools dependency closure with the source artifact'
  );
  assert.equal(
    macConfig.build.beforeBuildCommand,
    'npm run build:injector',
    'the explicit macOS Tauri config should prebuild the injector before packaging'
  );
  assert.match(
    packageJson.scripts['build:injector'],
    /build_translator_injector\.sh/,
    'the macOS Tauri prebuild command should invoke the injector build script'
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
    /src-tauri\/target\/\$\{\{ matrix\.rust_target \}\}\/release\/bundle\/dmg\/\*\.dmg[\s\S]*src-tauri\/target\/\$\{\{ matrix\.rust_target \}\}\/release\/bundle\/macos/,
    'release pipeline should publish Tauri macOS artifacts for both target architectures'
  );
});
