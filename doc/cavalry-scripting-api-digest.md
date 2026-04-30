# Cavalry Scripting API Digest for This Repository

This is a source-oriented digest of the official Cavalry pages that directly affect the language switcher.

## 1. Getting Started with Scripting

**Source:** https://cavalry.studio/docs/tech-info/scripting/scripting-getting-started/

- Cavalry scripting is split into modules by runtime.
- `api` is the editing/file-system namespace.
- `cavalry` is utility/math/path support.
- `ctx`, `def`, and `render` are specialized runtimes and should not be assumed inside a Script UI.

**Project takeaway:** `LanguageSwitcher.js` should only rely on APIs documented for Script UIs plus the `api` module.

## 2. Script UIs

**Source:** https://cavalry.studio/docs/tech-info/scripting/script-uis/

### Key points

- Script UIs are opened from the Scripts menu and can be docked.
- Folders inside the Scripts directory become nested menu items.
- Folders ending in `_assets` are hidden from the menu.
- `ui.scriptLocation` resolves the script's parent directory and is the correct base for relative assets.
- The documented UI pattern is:
  - configure the global `ui` window
  - create widgets with constructors like `new ui.Button(...)`, `new ui.DropDown()`, `new ui.Label(...)`
  - register callbacks such as `button.onClick`
  - call `ui.show()`
- Confirmation and message dialogs use `new ui.Modal()` with helpers like `showConfirmation(...)` and `showMessage(...)`.

### DropDown methods relevant here

- `addEntry(rowText)`
- `getValue()`
- `setValue(index)`
- `getText()`
- `clear()`
- `onValueChanged`

**Project takeaway:** the language selector must be a `ui.DropDown`, not `api.UIWidget`.

## 3. API Module

**Source:** https://cavalry.studio/docs/tech-info/scripting/api-module/

### File-system methods used by the switcher

- `getAppAssetsPath()` — locate Cavalry's built-in JSON targets.
- `getAppDataFolder()` — store durable user config.
- `filePathExists(filePath)` — check whether a config file exists before trying to read it.
- `readFromFile(filePath)` — read text files; docs explicitly note the path should already exist.
- `writeToFile(filePath, contents, overwrite=true)` — required for intentional rewrites of existing JSON/QM/config files.
- `deleteFilePath(path)` — remove active `.qm` files when restoring English.

### Process and environment methods used by the switcher

- `getPlatform()` — branch between macOS and Windows restart logic.
- `getCavalryVersion()` — detect app updates.
- `runProcess(command, arguments)` — run a blocking process.
- `runDetachedProcess(command, arguments)` — launch the replacement app instance without blocking the current session.

**Project takeaway:** config existence should be checked with `filePathExists()` before reading it, intentional rewrites should pass `overwrite=true`, and English restore should delete the active `.qm` files rather than leaving them behind.

## 4. Example Scripts

**Source:** https://cavalry.studio/docs/tech-info/scripting/example-scripts/

- Example Script UI code uses `ui` widgets directly.
- Layout composition is done with `ui.HLayout()` and `ui.VLayout()`.
- Asset-backed buttons use `ui.scriptLocation + "/<script>_assets/..."`.

**Project takeaway:** the language switcher should follow the same layout/callback style as the official examples.

## 5. Web APIs

**Source:** https://cavalry.studio/docs/tech-info/scripting/web-apis/

- Confirms Script UIs can mix `api` and `ui`.
- Shows the same `ui.Button` and `ui.show()` pattern used in official examples.

**Project takeaway:** Script UI and `api` coexist in the same runtime, which matches this project's needs.

## 6. Render Scripts

**Source:** https://cavalry.studio/docs/tech-info/scripting/render-scripts/

- `render.*` APIs are render-queue specific.
- They are not part of the Script UI runtime.

**Project takeaway:** keep render-only concepts out of the language switcher.

## Repository Decisions Derived From These Pages

1. `LanguageSwitcher.js` is implemented as a Script UI using the documented global `ui` object.
2. Runtime language assets live in `LanguageSwitcher_assets/languages/` so Cavalry hides them in the Scripts menu.
3. The script resolves runtime files from `ui.scriptLocation`.
4. The switcher checks config existence with `api.filePathExists()` before calling `api.readFromFile()`.
5. Message and confirmation dialogs use `ui.Modal`, not undocumented `api.alert` / `api.confirm`.
6. English restore deletes the active `.qm` files via `api.deleteFilePath()`.
7. The current runtime falls back to **JSON-only translation** because Cavalry's public docs do not document a translator-loading API, the Preferences docs expose no language setting, and the inspected macOS app bundle contains no bundled `translations/` directory or `.qm` files.
