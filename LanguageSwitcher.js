// LanguageSwitcher.js — Cavalry Multi-Language Switcher
// Third-party i18n tool for Cavalry (Qt 6.6.3 2D animation software)
// Supports: English, 简体中文 (zh-Hans), 繁體中文 (zh-Hant), 日本語 (ja_JP)

(function () {
    "use strict";

    var LANGUAGES = {
        "en": "English",
        "zh-Hans": "简体中文",
        "zh-Hant": "繁體中文",
        "ja_JP": "日本語"
    };

    var LANG_KEYS = ["en", "zh-Hans", "zh-Hant", "ja_JP"];

    var JSON_TARGETS = [
        { relativePath: "nodeStrings.json", destinationPath: "Definitions/nodeStrings.json", label: "node strings" },
        { relativePath: "appStrings.json", destinationPath: "Definitions/appStrings.json", label: "application strings" },
        { relativePath: "tips.json", destinationPath: "Learn/tips.json", label: "tips" },
        { relativePath: "onboarding.json", destinationPath: "Learn/onboarding.json", label: "onboarding strings" }
    ];

    var PLUGIN_MAP = {
        bilateralBlurFilter: "Bilateral Blur Filter",
        boxBlurFilter: "Box Blur Filter",
        bulgeFilter: "Bulge Filter",
        chromaKeyFilter: "Chroma Key Filter",
        directionalBlurFilter: "Directional Blur Filter",
        erosionFilter: "Erosion Filter",
        gaussianBlurFilter: "Gaussian Blur Filter",
        grainFilter: "Grain Filter",
        lightSweepFilter: "Light Sweep Filter",
        polarCoordinatesFilter: "Polar Coordinates Filter",
        spheriseFilter: "Spherise Filter",
        zoomBlurFilter: "Zoom Blur Filter"
    };

    function getRuntimeAssetsPath() {
        return ui.scriptLocation + "/LanguageSwitcher_assets";
    }

    function getLanguagePacksPath() {
        return getRuntimeAssetsPath() + "/languages";
    }

    function getLanguagePackPath(lang) {
        return getLanguagePacksPath() + "/" + lang;
    }

    function getAppAssetsPath() {
        return api.getAppAssetsPath();
    }

    function getTranslationsPath() {
        var assetsPath = getAppAssetsPath();
        if (api.getPlatform() === "macOS") {
            return assetsPath + "/../MacOS/translations/";
        }
        return assetsPath + "/../translations/";
    }

    function getConfigPath() {
        return api.getAppDataFolder() + "/cavalry-i18n.json";
    }

    function getDefaultConfig() {
        return {
            language: "en",
            cavalryVersion: api.getCavalryVersion()
        };
    }

    function ensureConfigFile() {
        api.writeToFile(getConfigPath(), JSON.stringify(getDefaultConfig(), null, 2), false);
    }

    function readConfig() {
        ensureConfigFile();

        var content = api.readFromFile(getConfigPath());
        if (!content) {
            return getDefaultConfig();
        }

        try {
            var parsed = JSON.parse(content);
            if (!parsed.language || !LANGUAGES[parsed.language]) {
                parsed.language = "en";
            }
            if (!parsed.cavalryVersion) {
                parsed.cavalryVersion = api.getCavalryVersion();
            }
            return parsed;
        } catch (e) {
            api.alert(
                "Could not parse cavalry-i18n.json.\n" +
                "The configuration will be reset to English."
            );
            writeConfig("en");
            return getDefaultConfig();
        }
    }

    function writeConfig(lang) {
        var config = {
            language: lang,
            cavalryVersion: api.getCavalryVersion()
        };

        var result = api.writeToFile(getConfigPath(), JSON.stringify(config, null, 2));
        if (!result) {
            api.alert(
                "Write failed: " + getConfigPath() +
                "\nCould not save language configuration."
            );
        }
        return result;
    }

    function safeWriteToFile(filePath, content) {
        var result = api.writeToFile(filePath, content);
        if (!result) {
            api.alert(
                "Write failed: " + filePath +
                "\n\nPossible cause: No write permission to the Cavalry installation directory." +
                "\nPlease try running as administrator, or install Cavalry to a user directory."
            );
            return false;
        }
        return true;
    }

    function readLanguageAsset(lang, relativePath, label) {
        var fullPath = getLanguagePackPath(lang) + "/" + relativePath;
        var content = api.readFromFile(fullPath);

        if (!content) {
            api.alert(
                "Missing language asset: " + label +
                "\n" + fullPath +
                "\n\nMake sure LanguageSwitcher_assets was copied together with LanguageSwitcher.js."
            );
            return null;
        }

        return content;
    }

    function overwriteJSON(lang) {
        var appAssetsPath = getAppAssetsPath();
        var i;
        var content;

        for (i = 0; i < JSON_TARGETS.length; i++) {
            content = readLanguageAsset(lang, JSON_TARGETS[i].relativePath, JSON_TARGETS[i].label);
            if (!content) {
                return false;
            }
            if (!safeWriteToFile(appAssetsPath + "/" + JSON_TARGETS[i].destinationPath, content)) {
                return false;
            }
        }

        var pluginKeys = Object.keys(PLUGIN_MAP);
        for (i = 0; i < pluginKeys.length; i++) {
            var camelName = pluginKeys[i];
            var folderName = PLUGIN_MAP[camelName];
            content = readLanguageAsset(lang, "plugins/" + camelName + ".json", "plugin strings for " + folderName);
            if (!content) {
                return false;
            }
            if (!safeWriteToFile(appAssetsPath + "/Plugins/" + folderName + "/strings.json", content)) {
                return false;
            }
        }

        return true;
    }

    function deleteQMFiles(previousLang, expectFilesToExist) {
        if (!previousLang || previousLang === "en") {
            return true;
        }

        var translationsPath = getTranslationsPath();
        var qmFiles = [
            translationsPath + "cavalry_" + previousLang + ".qm",
            translationsPath + "qtbase_" + previousLang + ".qm"
        ];

        for (var i = 0; i < qmFiles.length; i++) {
            if (!api.deleteFilePath(qmFiles[i])) {
                if (!expectFilesToExist) {
                    continue;
                }
                api.alert(
                    "Could not remove translation file:\n" + qmFiles[i] +
                    "\n\nPlease check write permissions to the Cavalry installation directory."
                );
                return false;
            }
        }

        return true;
    }

    function overwriteQM(lang, previousLang, expectFilesToExist) {
        if (lang === "en") {
            return deleteQMFiles(previousLang, expectFilesToExist);
        }

        var translationsPath = getTranslationsPath();
        var cavalryQM = readLanguageAsset(lang, "cavalry_" + lang + ".qm", "Cavalry Qt translation");
        var qtbaseQM = readLanguageAsset(lang, "qtbase_" + lang + ".qm", "Qt base translation");

        if (!cavalryQM || !qtbaseQM) {
            return false;
        }

        if (!safeWriteToFile(translationsPath + "cavalry_" + lang + ".qm", cavalryQM)) {
            return false;
        }
        if (!safeWriteToFile(translationsPath + "qtbase_" + lang + ".qm", qtbaseQM)) {
            return false;
        }

        return true;
    }

    function checkVersionMismatch(config) {
        var savedVersion = config.cavalryVersion;
        var currentVersion = api.getCavalryVersion();

        if (savedVersion && savedVersion !== currentVersion) {
            return {
                oldVersion: savedVersion,
                newVersion: currentVersion,
                language: config.language
            };
        }

        return null;
    }

    function restartCavalry() {
        if (api.getPlatform() === "macOS") {
            api.runDetachedProcess("open", ["-n", "/Applications/Cavalry.app"]);
            api.runProcess("osascript", ["-e", 'tell application "Cavalry" to quit']);
        } else if (api.getPlatform() === "Windows") {
            api.runDetachedProcess("cmd.exe", ["/c", "start", "", "Cavalry.exe"]);
            api.runProcess("cmd.exe", ["/c", "taskkill", "/im", "Cavalry.exe"]);
        }
    }

    function applyLanguage(lang) {
        var config = readConfig();
        var previousLang = config.language || "en";
        var expectFilesToExist = config.cavalryVersion === api.getCavalryVersion();

        if (!overwriteJSON(lang)) {
            return false;
        }

        if (!overwriteQM(lang, previousLang, expectFilesToExist)) {
            return false;
        }

        if (!writeConfig(lang)) {
            return false;
        }

        return true;
    }

    function buildUI() {
        var config = readConfig();
        var currentLang = config.language || "en";
        var currentLabel = LANGUAGES[currentLang] || "English";

        var mismatch = checkVersionMismatch(config);
        if (mismatch && mismatch.language !== "en") {
            var langLabel = LANGUAGES[mismatch.language] || mismatch.language;
            var reapply = api.confirm(
                "Cavalry has been updated from " + mismatch.oldVersion +
                " to " + mismatch.newVersion + ".\n" +
                "Your language (" + langLabel + ") has been reset.\n\n" +
                "Click OK to re-apply " + langLabel + "."
            );

            if (reapply) {
                if (applyLanguage(mismatch.language)) {
                    api.alert("Language re-applied successfully.\nCavalry will restart now.");
                    restartCavalry();
                    return;
                }
            }
        }

        ui.setTitle("Cavalry Language Switcher");
        ui.setMinimumWidth(340);

        var currentTitle = new ui.Label("Current Language");
        var currentValue = new ui.Label(currentLabel);
        currentValue.setBackgroundColor(ui.getThemeColor("AlternateBase"));
        currentValue.setContentsMargins(8, 4, 8, 4);

        var currentRow = new ui.HLayout();
        currentRow.add(currentTitle);
        currentRow.addStretch();
        currentRow.add(currentValue);

        var selectorTitle = new ui.Label("Switch To");
        var languageDropDown = new ui.DropDown();
        languageDropDown.setMinimumWidth(180);

        for (var i = 0; i < LANG_KEYS.length; i++) {
            languageDropDown.addEntry(LANGUAGES[LANG_KEYS[i]]);
        }

        var currentIndex = LANG_KEYS.indexOf(currentLang);
        languageDropDown.setValue(currentIndex < 0 ? 0 : currentIndex);

        var selectorRow = new ui.HLayout();
        selectorRow.add(selectorTitle);
        selectorRow.addStretch();
        selectorRow.add(languageDropDown);

        var applyButton = new ui.Button("Apply & Restart");
        applyButton.onClick = function () {
            var selectedIndex = languageDropDown.getValue();
            var selectedLang = LANG_KEYS[selectedIndex];
            var selectedLabel = LANGUAGES[selectedLang];

            var confirmed = api.confirm(
                "Switch language to " + selectedLabel + "?\n" +
                "Cavalry will restart after applying."
            );

            if (!confirmed) {
                return;
            }

            if (applyLanguage(selectedLang)) {
                api.alert("Language switched to " + selectedLabel + ".\nCavalry will restart now.");
                restartCavalry();
            }
        };

        ui.add(currentRow);
        ui.add(selectorRow);
        ui.addSpacing(6);
        ui.add(applyButton);
        ui.show();
    }

    buildUI();
})();
