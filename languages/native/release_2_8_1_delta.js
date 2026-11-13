/**
 * [INPUT]: Cavalry 2.8.1 target-locked UI source/notes/vendor Japanese and AGY CLI translations; 2.8.0 approvals remain the reuse base.
 * [OUTPUT]: Provides 33 source-bound tri-locale updates/additions and 12 source-bound removed-key records for the 2.8.1 selector.
 * [POS]: Version-specific native approval delta; selected only by approvedEntries('2.8.1'), never by the 2.8.0 default.
 * [PROTOCOL]: AGY生成后由主代理对照source/notes/术语复核；独立外部审校和实屏另验。变更时检查CLAUDE.md。
 */
'use strict';
module.exports = {
  "provenance": {
    "cavalryVersion": "2.8.1",
    "targetPath": "tools/cavalry_native_target_2_8_1.json",
    "targetSha256": "e606fc03915d5763bfcf08bab6a61e6787fb53cec31415d124bc2b9c07cc9ac8",
    "sourceCatalogs": [
      {
        "catalogId": "Definitions/Translation/appStrings",
        "sourcePath": "Definitions/Translation/appStrings_en-GB.source.json",
        "sourceSha256": "79fc4745b1eb9c87af3e750df51e6ba8987b1f52e48876d68a29c1aebedeb32e",
        "japanesePath": "Definitions/Translation/appStrings_ja-JP.translation.json",
        "japaneseSha256": "4b4c326b864722d3f1d760f5383704cf0081907a6852600a9a9a2b58016b7247"
      },
      {
        "catalogId": "Definitions/Translation/nodeStrings",
        "sourcePath": "Definitions/Translation/nodeStrings_en-GB.source.json",
        "sourceSha256": "09f9c938274a96d58a6b95ca82ef81ab07d60abfc2ec8136ffff72898e1b00e9",
        "japanesePath": "Definitions/Translation/nodeStrings_ja-JP.translation.json",
        "japaneseSha256": "5d0e0e015395453aab476d9cb9947a9f409ef7ecbafe2de62fd5d50d269ca65e"
      }
    ],
    "skillPath": ".agents/skills/baoyu-translate/SKILL.md",
    "extendPath": ".baoyu-skills/baoyu-translate/EXTEND.md",
    "mode": "refined",
    "draftProvider": "AGY CLI",
    "draftRunId": "0d477914-7812-4f51-9d6d-b561da96c55e",
    "independentReviewProvider": null,
    "approvedBy": "primary-agent",
    "reviewScope": "Primary-agent review of source, notes, terminology and format; no live UI acceptance.",
    "migration": {
      "sourceChanged": 22,
      "metadataChanged": 4,
      "newKeys": 7,
      "removedKeys": 12,
      "unapprovedDontTranslate": 95
    }
  },
  "entries": [
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.button.accountSettings"
      ],
      "source": "Account Settings",
      "notes": [
        "Button on a toast about the user’s AI usage limit. “Account Settings” is the name of the Canva page it opens, where the user manages their account and billing."
      ],
      "vendorJapanese": "Account Settings",
      "key": "aiCredits.button.accountSettings",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "账户设置"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "帳戶設定"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "アカウント設定"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.cooldown"
      ],
      "source": "You can generate again in {0}.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown after an AI generation is rate-limited.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the wait time, e.g. \"30 seconds\" or \"2 minutes\".",
        "Example - \"You can generate again in 30 seconds.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You can generate again in {0}.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.cooldown",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你可以在 {0} 后再次生成。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你可以在 {0} 後再次生成。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "{0} 後に再度生成できます。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.insufficient"
      ],
      "source": "You do not have enough credits remaining to perform this operation.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when an AI generation is refused for lacking sufficient credits.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You do not have enough credits remaining to perform this operation.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.insufficient",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你的剩余额度不足以执行此操作。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你的剩餘額度不足以執行此操作。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "この操作を実行するためのクレジット残量が不足しています。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.limit.day"
      ],
      "source": "You’ve used all of your plan’s daily AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 100% of their daily AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You’ve used all of your plan’s daily AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.limit.day",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已用完方案的每日 AI 使用限额。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已用完方案的每日 AI 使用上限。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの1日の AI 使用上限に達しました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.limit.fallback"
      ],
      "source": "You’ve used all of your plan’s AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 100% of their AI credit limit and the limit has no reset period.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You’ve used all of your plan’s AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.limit.fallback",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已用完方案的 AI 使用限额。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已用完方案的 AI 使用上限。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの AI 使用上限に達しました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.limit.month"
      ],
      "source": "You’ve used all of your plan’s monthly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 100% of their monthly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You’ve used all of your plan’s monthly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.limit.month",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已用完方案的每月 AI 使用限额。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已用完方案的每月 AI 使用上限。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの月間 AI 使用上限に達しました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.limit.week"
      ],
      "source": "You’ve used all of your plan’s weekly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 100% of their weekly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You’ve used all of your plan’s weekly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.limit.week",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已用完方案的每周 AI 使用限额。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已用完方案的每週 AI 使用上限。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの週間 AI 使用上限に達しました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.limit.year"
      ],
      "source": "You’ve used all of your plan’s yearly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 100% of their yearly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens."
      ],
      "vendorJapanese": "You’ve used all of your plan’s yearly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.limit.year",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已用完方案的每年 AI 使用限额。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已用完方案的每年 AI 使用上限。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの年間 AI 使用上限に達しました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.warning90.day"
      ],
      "source": "You’ve passed {0}% of your plan’s daily AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 90% of their daily AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the warning threshold reached, as a whole percentage (always 90).",
        "Example - \"You’ve passed 90% of your plan’s daily AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You’ve passed {0}% of your plan’s daily AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.warning90.day",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已超过方案每日 AI 使用限额的 {0}%。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已超過方案每日 AI 使用上限的 {0}%。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの1日の AI 使用上限の {0}% を超えました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.warning90.fallback"
      ],
      "source": "You’ve passed {0}% of your plan’s AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 90% of their AI credit limit and the limit has no reset period.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the warning threshold reached, as a whole percentage (always 90).",
        "Example - \"You’ve passed 90% of your plan’s AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You’ve passed {0}% of your plan’s AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.warning90.fallback",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已超过方案 AI 使用限额的 {0}%。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已超過方案 AI 使用上限的 {0}%。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの AI 使用上限の {0}% を超えました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.warning90.month"
      ],
      "source": "You’ve passed {0}% of your plan’s monthly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 90% of their monthly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the warning threshold reached, as a whole percentage (always 90).",
        "Example - \"You’ve passed 90% of your plan’s monthly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You’ve passed {0}% of your plan’s monthly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.warning90.month",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已超过方案每月 AI 使用限额的 {0}%。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已超過方案每月 AI 使用上限的 {0}%。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの月間 AI 使用上限の {0}% を超えました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.warning90.week"
      ],
      "source": "You’ve passed {0}% of your plan’s weekly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 90% of their weekly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the warning threshold reached, as a whole percentage (always 90).",
        "Example - \"You’ve passed 90% of your plan’s weekly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You’ve passed {0}% of your plan’s weekly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.warning90.week",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已超过方案每周 AI 使用限额的 {0}%。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已超過方案每週 AI 使用上限的 {0}%。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの週間 AI 使用上限の {0}% を超えました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiCredits.toast.warning90.year"
      ],
      "source": "You’ve passed {0}% of your plan’s yearly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "notes": [
        "Toast shown when the signed-in user reaches 90% of their yearly AI credit limit.",
        "“Account Settings” is the name of the Canva page the toast’s button opens.",
        "placeholder0 - the warning threshold reached, as a whole percentage (always 90).",
        "Example - \"You’ve passed 90% of your plan’s yearly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.\""
      ],
      "vendorJapanese": "You’ve passed {0}% of your plan’s yearly AI usage limit.\n\nFor more information on your AI limits, head to Account Settings.",
      "key": "aiCredits.toast.warning90.year",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你已超过方案每年 AI 使用限额的 {0}%。\n\n如需详细了解 AI 限额，请前往账户设置。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "你已超過方案每年 AI 使用上限的 {0}%。\n\n如需進一步了解 AI 上限，請前往帳戶設定。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プランの年間 AI 使用上限の {0}% を超えました。\n\nAI の上限について詳しくは、アカウント設定をご確認ください。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiStudio.log.backgroundRemovalTooLarge"
      ],
      "source": "This asset is {0}×{1}px. Background Removal supports up to {2}px on the longest side.",
      "notes": [
        "AI Studio panel. Tooltip on the disabled Remove Background button, and log message, when the selected video's resolution exceeds the model's limit.",
        "placeholder0 - the asset's width in pixels.",
        "placeholder1 - the asset's height in pixels.",
        "placeholder2 - the model's maximum supported dimension in pixels.",
        "Example - \"This asset is 5120×2880px. Background Removal supports up to 3840px on the longest side.\""
      ],
      "vendorJapanese": "This asset is {0}×{1}px. Background Removal supports up to {2}px on the longest side.",
      "key": "aiStudio.log.backgroundRemovalTooLarge",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "此素材尺寸为 {0}×{1}px。背景移除支持的最长边上限为 {2}px。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "此素材尺寸為 {0}×{1}px。背景移除支援的最長邊上限為 {2}px。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "このアセットは {0}×{1}px です。背景削除でサポートされている最長辺は最大 {2}px です。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "aiStudio.log.backgroundRemovalTooLong"
      ],
      "source": "This asset is {0}s long. Background Removal supports assets up to {1}s.",
      "notes": [
        "AI Studio panel. Tooltip on the disabled Remove Background button, and log message, when the selected video is longer than the model's limit.",
        "placeholder0 - the asset's duration in whole seconds.",
        "placeholder1 - the model's maximum supported length in seconds.",
        "Example - \"This asset is 14s long. Background Removal supports assets up to 10s.\""
      ],
      "vendorJapanese": "This asset is {0}s long. Background Removal supports assets up to {1}s.",
      "key": "aiStudio.log.backgroundRemovalTooLong",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "此素材时长为 {0} 秒。背景移除支持的素材时长上限为 {1} 秒。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "此素材時長為 {0} 秒。背景移除支援的素材時長上限為 {1} 秒。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "このアセットの長さは {0} 秒です。背景削除で対応しているアセットは最大 {1} 秒です。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "canvaPreflight.controlCentre.atLimit"
      ],
      "source": "{0, plural, one {# Control Centre Attribute} other {# Control Centre Attributes}}, you have reached the limit.",
      "notes": [
        "Pre-Flight information: the number of Control Centre Attributes (\"Control Centre\" is a Cavalry feature; \"Attributes\" = layer properties) is exactly the most Canva accepts. Export is still allowed.",
        "placeholder0 - the count.",
        "Example - \"10 Control Centre Attributes, you have reached the limit.\""
      ],
      "vendorJapanese": "{0, plural, one {# Control Centre Attribute} other {# Control Centre Attributes}}, you have reached the limit.",
      "key": "canvaPreflight.controlCentre.atLimit",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "{0, plural, one {# 个控制中心属性} other {# 个控制中心属性}}，已达到上限。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "{0, plural, one {# 個控制中心屬性} other {# 個控制中心屬性}}，已達到上限。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "{0, plural, one {# 個のコントロールセンター属性} other {# 個のコントロールセンター属性}}、上限に達しました。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "canvaPreflight.duration.title"
      ],
      "source": "The animation is {0}s long, this is over the limit of {1}s.",
      "notes": [
        "Pre-Flight error. \"s\" = seconds.",
        "placeholder0 - the animation's length in seconds, with at most one decimal place.",
        "placeholder1 - the limit in seconds.",
        "Example - \"The animation is 75.5s long, this is over the limit of 60s.\""
      ],
      "vendorJapanese": "The animation is {0}s long, this is over the limit of {1}s.",
      "key": "canvaPreflight.duration.title",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "动画时长为 {0} 秒，已超出 {1} 秒的上限。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "動畫時長為 {0} 秒，已超出 {1} 秒的上限。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "アニメーションの長さが {0} 秒であり、上限の {1} 秒を超えています。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "canvaPreflight.section.errors"
      ],
      "source": "Errors – must be resolved before export",
      "notes": [
        "Section heading in the Pre-Flight results list, above the problems that stop the scene being exported to Canva."
      ],
      "vendorJapanese": "Errors – must be resolved before export",
      "key": "canvaPreflight.section.errors",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "错误 – 导出前必须解决"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "錯誤 – 匯出前必須解決"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "エラー – エクスポート前に解決が必要"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "canvaPreflight.title.issues"
      ],
      "source": "Pre-Flight detected {0, plural, one {# issue} other {# issues}}",
      "notes": [
        "Title showing the number of issues found by the Pre-Flight check. \"Pre-Flight\" is the name of the pre-export check feature.",
        "placeholder0 - the number of issues, which can be 0.",
        "Example - \"Pre-Flight detected 2 issues\""
      ],
      "vendorJapanese": "Pre-Flight detected {0, plural, one {# issue} other {# issues}}",
      "key": "canvaPreflight.title.issues",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "预检发现 {0, plural, one {# 个问题} other {# 个问题}}"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "預檢發現 {0, plural, one {# 個問題} other {# 個問題}}"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "プリフライトで {0, plural, one {# 件の問題} other {# 件の問題}}が見つかりました"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.button.saveEncoded"
      ],
      "source": "Save Encoded...",
      "notes": [
        "Button label; saves the script in an encoded, non-human-readable format. The ellipsis indicates it opens a save dialog."
      ],
      "vendorJapanese": "Save Encoded...",
      "key": "jsEditor.button.saveEncoded",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "编码保存..."
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "編碼儲存..."
        },
        "ja_JP": {
          "decision": "translate",
          "text": "エンコードして保存..."
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.dialog.exportEncoded"
      ],
      "source": "Export as Encoded JavaScript",
      "notes": [
        "Save dialog title; \"Encoded\" means the script is saved in a non-human-readable format."
      ],
      "vendorJapanese": "Export as Encoded JavaScript",
      "key": "jsEditor.dialog.exportEncoded",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "导出为编码 JavaScript"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "匯出為編碼 JavaScript"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "エンコード済みJavaScriptとしてエクスポート"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.log.encodedScriptSaved"
      ],
      "source": "Saved encoded script to {0}",
      "notes": [
        "Message after saving a script in an encoded, non-human-readable format.",
        "placeholder0 - the file path it was saved to.",
        "Example - \"Saved encoded script to /Users/x/script.jsc\""
      ],
      "vendorJapanese": "Saved encoded script to {0}",
      "key": "jsEditor.log.encodedScriptSaved",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "已将编码脚本保存到 {0}"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "已將編碼腳本儲存至 {0}"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "エンコードされたスクリプトを {0} に保存しました"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.log.encodingFailed"
      ],
      "source": "Unable to write encoded script (encoding failed).",
      "notes": [
        "\"encoded\" and \"encoding\" refer to saving in a non-human-readable format."
      ],
      "vendorJapanese": "Unable to write encoded script (encoding failed).",
      "key": "jsEditor.log.encodingFailed",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "无法写入编码脚本（编码失败）。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "無法寫入編碼腳本（編碼失敗）。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "エンコードされたスクリプトを書き込めませんでした（エンコードに失敗しました）。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.comp.clearGuides"
      ],
      "source": "Clear Guides",
      "notes": [
        "Menu item; removes every ruler guide from the current Composition."
      ],
      "vendorJapanese": "Clear Guides",
      "key": "menu.comp.clearGuides",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "清除参考线"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "清除參考線"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "ガイドをクリア"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.help.sendAnalytics"
      ],
      "source": "Share Usage Data",
      "notes": [
        "Menu item/toggle for opt-in usage analytics/data."
      ],
      "vendorJapanese": "Share Usage Data",
      "key": "menu.help.sendAnalytics",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "共享使用数据"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "分享使用資料"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "利用データを共有"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.help.sendCrashReports"
      ],
      "source": "Send Crash Reports",
      "notes": [
        "Menu item/toggle for opt-in crash reporting."
      ],
      "vendorJapanese": "Send Crash Reports",
      "key": "menu.help.sendCrashReports",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "发送崩溃报告"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "傳送當機報告"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "クラッシュレポートを送信"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.log.analyticsToggled"
      ],
      "source": "Usage data {0}.",
      "notes": [
        "Log/info message shown when the user toggles usage-data collection on or off.",
        "placeholder0 - the word \"enabled\" or \"disabled\".",
        "Example - \"Usage data enabled.\""
      ],
      "vendorJapanese": "Usage data {0}.",
      "key": "menu.log.analyticsToggled",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "使用数据已{0}。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "使用資料已{0}。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "利用データは{0}です。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.log.crashReportingEnabled"
      ],
      "source": "Crash Reporting enabled.",
      "notes": [
        "\"Crash Reporting\" refers to the feature that sends reports when the app crashes."
      ],
      "vendorJapanese": "Crash Reporting enabled.",
      "key": "menu.log.crashReportingEnabled",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "崩溃报告已启用。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "當機報告已啟用。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "クラッシュレポーティングを有効にしました。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.units.disabled"
      ],
      "source": "disabled",
      "notes": [
        "Word substituted into other log messages, e.g. \"Usage data disabled.\""
      ],
      "vendorJapanese": "disabled",
      "key": "menu.units.disabled",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "禁用"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "停用"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "無効"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "menu.units.enabled"
      ],
      "source": "enabled",
      "notes": [
        "Word substituted into other log messages (e.g. \"Usage data enabled.\"), the opposite state to \"disabled\"."
      ],
      "vendorJapanese": "enabled",
      "key": "menu.units.enabled",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "启用"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "啟用"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "有効"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "signIn.analytics.label"
      ],
      "source": "Share usage data to help improve Cavalry.",
      "notes": [
        "Checkbox label for opting in to sending usage data."
      ],
      "vendorJapanese": "Share usage data to help improve Cavalry.",
      "key": "signIn.analytics.label",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "分享使用数据以帮助改进 Cavalry。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "分享使用資料以協助改進 Cavalry。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "利用データを共有して Cavalry の改善に協力する。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "signIn.analytics.tooltip"
      ],
      "source": "When you use Cavalry, usage data can really help us make improvements, but only if you agree.",
      "notes": [
        "Checkbox tooltip for opting in to sending usage data."
      ],
      "vendorJapanese": "When you use Cavalry, usage data can really help us make improvements, but only if you agree.",
      "key": "signIn.analytics.tooltip",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "你使用 Cavalry 时，使用数据确实能帮助我们改进产品，但前提是你同意分享。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "使用 Cavalry 時，使用資料確實能協助我們改進產品，但必須先取得你的同意。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "Cavalry の利用データは、同意いただいた場合に限り、製品の改善に役立ちます。"
        }
      }
    },
    {
      "catalogId": "Definitions/Translation/nodeStrings",
      "fieldPath": [
        "attributes",
        "filterQuality",
        "tooltip"
      ],
      "source": "Determine the image quality in both the Viewport and for renders – particularly when resizing images:\n\n<b>None (Fastest)</b> - No resampling will be performed when the images are resized – this is the lowest quality setting.\n\n<b>Bilinear</b> - Basic resampling is performed. This is low quality but it is very fast.\n\n<b>Mipmaps</b> - Mipmaps are pre-calculated, optimised, low resolution versions of the image created via Bilinear interpolation. These are used to get the best quality and performance when scaling images down.\n\n<b>Bicubic</b> - This is the slowest method but produces the best quality when scaling images up.",
      "notes": [
        "As in \"no resampling will be performed when the images are resized\" — \"resampling\" is the technical process of recalculating pixel colours at a new size."
      ],
      "owner": "imageShader",
      "vendorJapanese": "Determine the image quality in both the Viewport and for renders – particularly when resizing images:\n\n<b>None (Fastest)</b> - No resampling will be performed when the images are resized – this is the lowest quality setting.\n\n<b>Bilinear</b> - Basic resampling is performed. This is low quality but it is very fast.\n\n<b>Mipmaps</b> - Mipmaps are pre-calculated, optimised, low resolution versions of the image created via Bilinear interpolation. These are used to get the best quality and performance when scaling images down.\n\n<b>Bicubic</b> - This is the slowest method but produces the best quality when scaling images up.",
      "key": "attrInfo:imageShader.filterQuality",
      "translations": {
        "zh-Hans": {
          "decision": "translate",
          "text": "设置图像在视口和渲染中的质量，尤其是在缩放图像时：\n\n<b>无（最快）</b> - 缩放图像时不进行重采样，这是质量最低的设置。\n\n<b>双线性</b> - 执行基本重采样。质量较低，但速度很快。\n\n<b>Mipmap</b> - Mipmap 是通过双线性插值预先计算并优化的低分辨率图像版本；缩小图像时使用它们，以兼顾画质与性能。\n\n<b>双三次</b> - 此方法最慢，但放大图像时能提供最佳画质。"
        },
        "zh-Hant": {
          "decision": "translate",
          "text": "設定圖像在檢視區與算繪時的品質，尤其是縮放圖像時：\n\n<b>無（最快）</b> - 縮放圖像時不會重新取樣，這是品質最低的設定。\n\n<b>雙線性</b> - 執行基本重新取樣。品質較低，但速度很快。\n\n<b>Mipmap</b> - Mipmap 是透過雙線性插值預先計算並最佳化的低解析度圖像版本；縮小圖像時會使用它們，以兼顧品質與效能。\n\n<b>雙三次</b> - 此方法最慢，但放大圖像時可提供最佳品質。"
        },
        "ja_JP": {
          "decision": "translate",
          "text": "ビューポートとレンダリングでの画像品質を設定します。特に画像を拡大縮小する場合に影響します。\n\n<b>なし（最速）</b> - 画像のサイズ変更時に再サンプリングを行いません。最も低い品質設定です。\n\n<b>バイリニア</b> - 基本的な再サンプリングを行います。品質は低めですが、非常に高速です。\n\n<b>ミップマップ</b> - バイリニア補間で事前計算・最適化された低解像度版の画像です。画像を縮小するときに使うと、品質と性能のバランスを保てます。\n\n<b>バイキュービック</b> - 最も低速ですが、画像を拡大するときに最高の品質になります。"
        }
      }
    }
  ],
  "removedEntries": [
    {
      "key": "aiCredits.button.upgradeForMore",
      "source": "Upgrade for more",
      "notes": [
        "Button on the toast shown when the user has hit (100% of) their AI credit limit.",
        "A crown icon is drawn to the left of this text by the button itself - do not add one."
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "aiCredits.time.hours",
      "source": "{0, plural, one {# hour} other {# hours}}",
      "notes": [
        "A length of time, used inside a message telling the user how long until their AI limit refreshes.",
        "placeholder0 - a whole number of hours.",
        "Example - \"2 hours\""
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "aiCredits.toast.cooldownUpgrade",
      "source": "You can generate again in {0}. To skip the wait, upgrade your plan.",
      "notes": [
        "Toast shown after an AI generation is rate-limited, for an account that can upgrade to remove the wait.",
        "placeholder0 - the wait time, e.g. \"30 seconds\" or \"2 minutes\".",
        "Example - \"You can generate again in 2 minutes. To skip the wait, upgrade your plan.\""
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "canvaPreflight.footer.blocked",
      "source": "Please fix the errors above to export.",
      "notes": [
        "Validation errors are preventing an export."
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "canvaPreflight.subtitle.passed",
      "source": "Scene is ready for Canva.",
      "notes": [
        "\"Scene\" = the Cavalry project."
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "canvaPreflight.title.passed",
      "source": "Pre-Flight passed",
      "notes": [
        "\"Pre-Flight\" is the name of the pre-export check feature."
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "csvAsset.log.sheetMissing",
      "source": "Excel Sheet does not exist: {0}",
      "notes": [
        "placeholder0 - a sheet index number.",
        "Example - \"Excel Sheet does not exist: 2\""
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "csvAsset.log.sheetMissing"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "jsEditor.button.saveEncrypted",
      "source": "Save Encrypted...",
      "notes": [
        "Button label; saves the script in an encrypted, non-human-readable format. The ellipsis indicates it opens a save dialog."
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.button.saveEncrypted"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "jsEditor.dialog.exportEncrypted",
      "source": "Export as Encrypted JavaScript",
      "notes": [
        "Dialog/file-type description; \"Encrypted\" means the script is saved in a non-human-readable, protected format."
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.dialog.exportEncrypted"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "jsEditor.log.encryptedScriptSaved",
      "source": "Saved encrypted script to {0}",
      "notes": [
        "placeholder0 - the file path it was saved to.",
        "Example - \"Saved encrypted script to /Users/x/script.cvjse\""
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.log.encryptedScriptSaved"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "jsEditor.log.encryptionFailed",
      "source": "Unable to write encrypted script (encryption failed).",
      "notes": [
        "\"encrypted\" means saved in a protected, non-human-readable format."
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "jsEditor.log.encryptionFailed"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    },
    {
      "key": "preferences.option.showFeedbackPill",
      "source": "Show Feedback button in Message Bar",
      "notes": [
        "Preference checkbox label; ‘Message Bar’ refers to a specific area of the app’s interface."
      ],
      "catalogId": "Definitions/Translation/appStrings",
      "fieldPath": [
        "preferences.option.showFeedbackPill"
      ],
      "reason": "Absent from the locked Cavalry 2.8.1 official catalogs."
    }
  ]
};
