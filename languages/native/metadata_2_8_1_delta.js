/**
 * [INPUT]: 官方2.8.1帮助说明差分与AGY经baoyu-translate出稿，主代理逐条审定。
 * [OUTPUT]: 六条源绑定三语说明与两个删除键；复用其余506条已审说明。
 * [POS]: 构建期2.8.1帮助增量；不修改函数签名或进入UI registry。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
module.exports = {
  "provenance": {
    "cavalryVersion": "2.8.1",
    "draftProvider": "AGY CLI",
    "skillPath": ".agents/skills/baoyu-translate/SKILL.md",
    "mode": "refined",
    "approvedBy": "primary-agent",
    "reviewScope": "All six source/context pairs and 18 translations; preserve current metadata signatures. No live acceptance.",
    "independentReviewProvider": null
  },
  "removedKeys": [
    "gui_api_function_metadata.json#/encrypt/description",
    "gui_api_function_metadata.json#/encryptFile/description"
  ],
  "entries": [
    {
      "key": "gui_api_function_metadata.json#/backgroundRender/description",
      "source": "Renders a specific item in the render queue in the background, or in the foreground if background rendering is unavailable.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "在后台渲染渲染队列中的指定项；若后台渲染不可用，则在前台渲染。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "在背景算繪算繪佇列中的指定項目；若背景算繪無法使用，則在前景算繪。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "レンダリングキュー内の指定されたアイテムをバックグラウンドでレンダリングします。バックグラウンドレンダリングが利用できない場合はフォアグラウンドでレンダリングします。"
        }
      }
    },
    {
      "key": "gui_api_function_metadata.json#/backgroundRenderAll/description",
      "source": "Renders all items in the render queue in the background, or in the foreground if background rendering is unavailable.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "在后台渲染渲染队列中的所有项；若后台渲染不可用，则在前台渲染。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "在背景算繪算繪佇列中的所有項目；若背景算繪無法使用，則在前景算繪。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "レンダリングキュー内のすべてのアイテムをバックグラウンドでレンダリングします。バックグラウンドレンダリングが利用できない場合はフォアグラウンドでレンダリングします。"
        }
      }
    },
    {
      "key": "gui_api_function_metadata.json#/jsonFromAsset/description",
      "source": "Converts the content of a specified asset to JSON format. For an Excel file, this is its first sheet.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "将指定资源的内容转换为 JSON 格式。对于 Excel 文件，转换其第一个工作表。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "將指定素材的內容轉換為 JSON 格式。對於 Excel 檔案，會轉換其第一個工作表。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "指定されたアセットのコンテンツを JSON 形式に変換します。Excel ファイルの場合は、最初のシートが対象になります。"
        }
      }
    },
    {
      "key": "api_function_metadata.json#/importPalette/description",
      "source": "Imports a .pal, .ase, or .theme palette file from outside Cavalry into the library or project palettes folder. .ase and .theme files are converted to .pal. Returns the destination path. Refuses unsupported extensions and path-traversal attempts.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "将 Cavalry 外部的 .pal、.ase 或 .theme 调色板文件导入库或项目调色板文件夹中。.ase 和 .theme 文件会转换为 .pal。返回目标路径。拒绝不支持的扩展名和路径遍历尝试。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "將 Cavalry 外部的 .pal、.ase 或 .theme 調色盤檔案匯入調色盤資料庫或專案調色盤資料夾中。.ase 與 .theme 檔案會轉換為 .pal。傳回目標路徑。拒絕不受支援的副檔名以及路徑遍歷嘗試。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "Cavalry の外部から .pal、.ase、または .theme パレットファイルをライブラリまたはプロジェクトのパレットフォルダーにインポートします。.ase ファイルと .theme ファイルは .pal に変換されます。保存先パスを返します。サポートされていない拡張子やパストラバーサルの試行は拒否されます。"
        }
      }
    },
    {
      "key": "gui_api_function_metadata.json#/encode/description",
      "source": "Encodes the given content into a non-human-readable format and returns it as a string. Encoding hides content; it does not secure it.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "将给定内容编码为非人类可读格式并以字符串形式返回。编码仅隐藏内容，不提供安全保护。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "將指定內容編碼為非人類可讀格式並以字串形式傳回。編碼僅隱藏內容，不提供安全保護。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "指定されたコンテンツを人間が判読できない形式にエンコードし、文字列として返します。エンコードはコンテンツを隠すだけであり、保護するものではありません。"
        }
      }
    },
    {
      "key": "gui_api_function_metadata.json#/encodeFile/description",
      "source": "Encodes the given file into a non-human-readable format and saves it to the specified location. Encoding hides content; it does not secure it.",
      "notes": [
        "Script help; machine parameters, types and identifiers remain unchanged."
      ],
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "将给定文件编码为非人类可读格式并保存到指定位置。编码仅隐藏内容，不提供安全保护。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "將指定檔案編碼為非人類可讀格式並儲存到指定位置。編碼僅隱藏內容，不提供安全保護。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "指定されたファイルを人間が判読できない形式にエンコードし、指定された場所に保存します。エンコードはコンテンツを隠すだけであり、保護するものではありません。"
        }
      }
    }
  ]
};
