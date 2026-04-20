// LanguageSwitcher.js — Cavalry Multi-Language Switcher
// Third-party i18n tool for Cavalry (Qt 6.6.3 2D animation software)
// Supports: English, 简体中文 (zh-Hans), 繁體中文 (zh-Hant), 日本語 (ja_JP)

(function () {
    "use strict";

    // ── Language definitions ─────────────────────────────────────────────
    var LANGUAGES = {
        "en":      "English",
        "zh-Hans": "简体中文",
        "zh-Hant": "繁體中文",
        "ja_JP":   "日本語"
    };

    var LANG_KEYS = ["en", "zh-Hans", "zh-Hant", "ja_JP"];

    // ── Plugin mapping: camelCase filename → Cavalry folder name ─────────
    var PLUGIN_MAP = {
        bilateralBlurFilter:   "Bilateral Blur Filter",
        boxBlurFilter:         "Box Blur Filter",
        bulgeFilter:           "Bulge Filter",
        chromaKeyFilter:       "Chroma Key Filter",
        directionalBlurFilter: "Directional Blur Filter",
        erosionFilter:         "Erosion Filter",
        gaussianBlurFilter:    "Gaussian Blur Filter",
        grainFilter:           "Grain Filter",
        lightSweepFilter:      "Light Sweep Filter",
        polarCoordinatesFilter:"Polar Coordinates Filter",
        spheriseFilter:        "Spherise Filter",
        zoomBlurFilter:        "Zoom Blur Filter"
    };

    // ── File list (must match languages/en/ exactly) ─────────────────────
    // Core files
    var CORE_FILES = ["nodeStrings", "appStrings", "tips", "onboarding"];

    // ── Path helpers ─────────────────────────────────────────────────────
    function getAssetsPath() {
        return api.getAppAssetsPath();
    }

    function getTranslationsPath() {
        var assetsPath = getAssetsPath();
        if (api.getPlatform() === "macOS") {
            return assetsPath + "/../MacOS/translations/";
        } else {
            return assetsPath + "/../translations/";
        }
    }

    function getConfigPath() {
        return api.getAppDataFolder() + "/cavalry-i18n.json";
    }

    function getScriptDir() {
        return api.getScriptsFolder() + "/languages/";
    }

    // ── Config read/write ────────────────────────────────────────────────
    function readConfig() {
        var configPath = getConfigPath();
        var content = api.readFromFile(configPath);
        if (!content) {
            return null;
        }
        try {
            return JSON.parse(content);
        } catch (e) {
            return null;
        }
    }

    function writeConfig(lang) {
        var config = {
            language: lang,
            cavalryVersion: api.getCavalryVersion()
        };
        var configPath = getConfigPath();
        var result = api.writeToFile(configPath, JSON.stringify(config, null, 2));
        if (!result) {
            api.alert("Write failed: " + configPath +
                "\nCould not save language configuration.");
        }
        return result;
    }

    // ── Safe write with error handling ───────────────────────────────────
    function safeWriteToFile(filePath, content) {
        var result = api.writeToFile(filePath, content);
        if (!result) {
            api.alert("Write failed: " + filePath +
                "\n\nPossible cause: No write permission to Cavalry installation directory." +
                "\nPlease try running as administrator, or install Cavalry to a user directory.");
            return false;
        }
        return true;
    }

    // ── JSON overwrite (Layer 1) ─────────────────────────────────────────
    function overwriteJSON(lang) {
        var assetsPath = getAssetsPath();
        var langDir = getScriptDir() + lang + "/";

        // nodeStrings.json → assets/Definitions/
        var content = api.readFromFile(langDir + "nodeStrings.json");
        if (content) {
            if (!safeWriteToFile(assetsPath + "/Definitions/nodeStrings.json", content)) return false;
        }

        // appStrings.json → assets/Definitions/
        content = api.readFromFile(langDir + "appStrings.json");
        if (content) {
            if (!safeWriteToFile(assetsPath + "/Definitions/appStrings.json", content)) return false;
        }

        // tips.json → assets/Learn/
        content = api.readFromFile(langDir + "tips.json");
        if (content) {
            if (!safeWriteToFile(assetsPath + "/Learn/tips.json", content)) return false;
        }

        // onboarding.json → assets/Learn/
        content = api.readFromFile(langDir + "onboarding.json");
        if (content) {
            if (!safeWriteToFile(assetsPath + "/Learn/onboarding.json", content)) return false;
        }

        // plugins/*.json → assets/Plugins/*/strings.json
        var pluginKeys = Object.keys(PLUGIN_MAP);
        for (var i = 0; i < pluginKeys.length; i++) {
            var camelName = pluginKeys[i];
            var folderName = PLUGIN_MAP[camelName];
            content = api.readFromFile(langDir + "plugins/" + camelName + ".json");
            if (content) {
                if (!safeWriteToFile(assetsPath + "/Plugins/" + folderName + "/strings.json", content)) return false;
            }
        }

        return true;
    }

    // ── QM overwrite (Layer 2) ───────────────────────────────────────────
    function overwriteQM(lang) {
        var translationsPath = getTranslationsPath();
        var langDir = getScriptDir() + lang + "/";

        if (lang === "en") {
            // Remove .qm files when switching back to English
            deleteQMFiles(translationsPath);
            return true;
        }

        // Write cavalry_xx.qm
        var cavalryQM = api.readFromFile(langDir + "cavalry_" + lang + ".qm");
        if (cavalryQM) {
            if (!safeWriteToFile(translationsPath + "cavalry_" + lang + ".qm", cavalryQM)) return false;
        }

        // Write qtbase_xx.qm
        var qtbaseQM = api.readFromFile(langDir + "qtbase_" + lang + ".qm");
        if (qtbaseQM) {
            if (!safeWriteToFile(translationsPath + "qtbase_" + lang + ".qm", qtbaseQM)) return false;
        }

        return true;
    }

    function deleteQMFiles(translationsPath) {
        // Write empty marker to signal English (no .qm needed)
        // Cavalry doesn't ship with a translations/ dir, so we just leave it
        // The absence of .qm files means Qt will use built-in English
    }

    // ── Version detection ────────────────────────────────────────────────
    function checkVersionMismatch() {
        var config = readConfig();
        if (!config) return null;

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

    // ── Restart Cavalry ──────────────────────────────────────────────────
    function restartCavalry() {
        if (api.getPlatform() === "macOS") {
            api.runDetachedProcess("open", ["-n", "/Applications/Cavalry.app"]);
            api.runProcess("osascript", ["-e", 'tell application "Cavalry" to quit']);
        } else if (api.getPlatform() === "Windows") {
            api.runDetachedProcess("cmd.exe", ["/c", "start", "", "Cavalry.exe"]);
            api.runProcess("cmd.exe", ["/c", "taskkill", "/im", "Cavalry.exe"]);
        }
    }

    // ── Apply language ───────────────────────────────────────────────────
    function applyLanguage(lang) {
        // Layer 1: JSON overwrite
        if (!overwriteJSON(lang)) return false;

        // Layer 2: QM overwrite
        if (!overwriteQM(lang)) return false;

        // Save config
        if (!writeConfig(lang)) return false;

        return true;
    }

    // ── UI ───────────────────────────────────────────────────────────────
    function buildUI() {
        var config = readConfig();
        var currentLang = config ? config.language : "en";
        var currentLabel = LANGUAGES[currentLang] || "English";

        // Check version mismatch on startup
        var mismatch = checkVersionMismatch();
        if (mismatch) {
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

        // Build dropdown
        var ui = new api.UIWidget();
        ui.setTitle("🌐 Cavalry Language Switcher");

        var currentIndex = LANG_KEYS.indexOf(currentLang);
        if (currentIndex < 0) currentIndex = 0;

        var langLabels = [];
        for (var i = 0; i < LANG_KEYS.length; i++) {
            langLabels.push(LANGUAGES[LANG_KEYS[i]]);
        }

        ui.addDropdown("language", "Language", langLabels, currentIndex);
        ui.addSeparator();
        ui.addButton("applyBtn", "Apply & Restart");

        ui.onButtonClicked = function (btnId) {
            if (btnId === "applyBtn") {
                var selectedIndex = ui.getValue("language");
                var selectedLang = LANG_KEYS[selectedIndex];
                var selectedLabel = LANGUAGES[selectedLang];

                var confirm = api.confirm(
                    "Switch language to " + selectedLabel + "?\n" +
                    "Cavalry will restart after applying."
                );
                if (!confirm) return;

                if (applyLanguage(selectedLang)) {
                    api.alert("Language switched to " + selectedLabel + ".\nCavalry will restart now.");
                    restartCavalry();
                } else {
                    api.alert("Language switch failed. Some files could not be written.");
                }
            }
        };

        return ui;
    }

    // ── Entry point ──────────────────────────────────────────────────────
    buildUI();

})();
