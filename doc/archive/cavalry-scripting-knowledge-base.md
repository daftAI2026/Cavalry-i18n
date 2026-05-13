# Cavalry Scripting Knowledge Base

## Purpose

This repository uses Cavalry's **Script UI** runtime, not the older `api.UIWidget` pattern. The notes below summarize the official scripting pages most relevant to `LanguageSwitcher.js` and record the project conventions adopted from them.

## Relevant Official Pages

| Topic | URL | Why it matters here |
| --- | --- | --- |
| Getting Started with Scripting | https://cavalry.studio/docs/tech-info/scripting/scripting-getting-started/ | Explains module boundaries and where each namespace is available |
| Script UIs | https://cavalry.studio/docs/tech-info/scripting/script-uis/ | Defines the runtime used by `LanguageSwitcher.js` |
| API Module | https://cavalry.studio/docs/tech-info/scripting/api-module/ | Covers file system, process, and version/platform APIs used by the switcher |
| Web APIs | https://cavalry.studio/docs/tech-info/scripting/web-apis/ | Confirms Script UIs can use `api` together with `ui` |
| Render Scripts | https://cavalry.studio/docs/tech-info/scripting/render-scripts/ | Useful for separating render-only APIs from Script UI APIs |
| Example Scripts | https://cavalry.studio/docs/tech-info/scripting/example-scripts/ | Shows real `ui` patterns for layouts and callbacks |

## Runtime Model

| Namespace | Where available | Project relevance |
| --- | --- | --- |
| `api` | JavaScript Editor and Script UIs | File I/O, restart, version detection, app paths |
| `ui` | Script UIs | Window title, layouts, dropdowns, buttons, `ui.scriptLocation` |
| `cavalry` | JavaScript Editor and JavaScript Layers | Utility/math/path helpers, not needed by the switcher UI |
| `ctx` | JavaScript Layers | Not available in this script |
| `def` | JavaScript Deformer | Not available in this script |
| `render` | Render scripts only | Not available in this script |

## Script UI Rules That Matter Here

1. Scripts shown in **Window > Scripts** must be saved as `.js` or `.jsc` in Cavalry's Scripts folder.
2. Nested folders appear as nested menu items.
3. Any folder ending with **`_assets`** is hidden from the Scripts menu.
4. `ui.scriptLocation` gives the parent folder of the current script and is the preferred way to build relative asset paths.
5. `ui.scriptLocation` is only populated when the script is launched from the Scripts menu, not from the JavaScript Editor.
6. Script UIs are hot-loaded; closing and reopening the window is enough after edits.

## UI APIs Used by This Project

| API | Notes |
| --- | --- |
| `ui.setTitle()` | Set the dockable Script UI window title |
| `ui.add()` / `ui.addSpacing()` | Add widgets to the default layout |
| `ui.show()` | Show the Script UI window |
| `new ui.Label(text)` | Static text rows |
| `new ui.DropDown()` | Language selector |
| `new ui.Modal()` | Supported confirmation/message dialogs |
| `dropDown.addEntry()` | Add language labels |
| `dropDown.setValue()` / `dropDown.getValue()` | Set/read selected language index |
| `new ui.Button(text)` | Apply button |
| `button.onClick` | Handle language switching |
| `new ui.HLayout()` | Two-column rows with labels and controls |

## File/System APIs Used by This Project

| API | Project use |
| --- | --- |
| `api.getAppAssetsPath()` | Locate Cavalry's bundled JSON string targets |
| `api.getAppDataFolder()` | Store persistent switcher config |
| `api.filePathExists(path)` | Check whether the config already exists without generating file-read noise |
| `api.readFromFile(path)` | Read config and bundled language assets; the path must already exist |
| `api.writeToFile(path, content, overwrite=true)` | Overwrite Cavalry's JSON/QM targets and update the saved config intentionally |
| `api.deleteFilePath(path)` | Remove active `.qm` files when switching back to English |
| `api.getPlatform()` | macOS/Windows branching |
| `api.getCavalryVersion()` | Detect app updates and re-apply prompts |
| `api.runProcess()` | Quit the current Cavalry instance |
| `api.runDetachedProcess()` | Launch the replacement Cavalry instance |

## Repository Conventions Adopted From The Docs

1. Runtime assets live in `LanguageSwitcher_assets/` so they stay hidden in the Scripts menu.
2. Translation packs live in `LanguageSwitcher_assets/languages/<lang>/`.
3. Runtime asset resolution must start from `ui.scriptLocation`, not from a hard-coded Scripts folder path.
4. Config existence should be checked with `api.filePathExists()` before any read.
5. Intentional rewrites must pass `overwriteExisting=true` to `api.writeToFile(...)`.
6. Real missing translation assets or write failures should be surfaced with `ui.Modal().showMessage(...)`, and errors should also be logged to the JavaScript Console.
7. The current runtime ships in **JSON-only mode**; `.qm` files are kept in the repo but are not installed by `LanguageSwitcher.js`.

## Known Pitfalls

| Pitfall | Why it fails |
| --- | --- |
| `new api.UIWidget()` | Not the documented Script UI constructor model for Cavalry Script UIs |
| Shipping a visible `languages/` folder next to the script | It shows up as a menu subtree under Scripts |
| Calling `api.readFromFile()` on a missing path | Cavalry logs a file-read error before your script can recover |
| Calling `api.alert()` / `api.confirm()` | These are not documented Script UI APIs in the current Cavalry runtime |
| Forgetting `overwriteExisting=true` on writes | Cavalry logs `File already exists` and the write fails |
| Assuming Cavalry exposes a documented `.qm` loading path | Public docs do not describe a runtime translator-loading API or a language preference key |
| Testing `ui.scriptLocation` from the JavaScript Editor | The property is blank there; use the Scripts menu for real UI tests |

## Manual Verification Checklist

1. `LanguageSwitcher.js` opens from **Window > Scripts** without `api.UIWidget` errors.
2. `LanguageSwitcher_assets/` does **not** appear in the Scripts menu.
3. First launch does not emit repeated missing-config file errors.
4. Switching to a non-English language writes JSON and `.qm` assets, then restarts Cavalry.
5. Switching back to English removes the active `.qm` files and restores the built-in UI language.
