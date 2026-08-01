; [INPUT]: 依赖 Tauri NSIS 提供的 SHCTX、MANUPRODUCTKEY 与 MANUKEY 宏，以及当前用户安装模式
; [OUTPUT]: 对外提供翻译卸载选项页、PREUNINSTALL 条件恢复与 POSTUNINSTALL 元数据清理
; [POS]: src-tauri 的 Windows 卸载生命周期边界；本页只解释 Cavalry 翻译取舍，更新/静默/被动卸载无交互保留，显式 English 清理失败才中止卸载
; [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

!include nsDialogs.nsh

Var CavalryI18nRestoreCheckbox
Var CavalryI18nRestoreRequested

LangString CAVALRY_I18N_UNINSTALL_OPTIONS_TITLE 1033 "Cavalry translation"
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_TITLE 2052 "Cavalry 翻译"
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_TITLE 1028 "Cavalry 翻譯"
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_TITLE 1041 "Cavalry の翻訳"

LangString CAVALRY_I18N_UNINSTALL_OPTIONS_SUBTITLE 1033 "Choose whether uninstalling the Switcher also changes Cavalry."
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_SUBTITLE 2052 "选择卸载切换器时是否同时更改 Cavalry。"
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_SUBTITLE 1028 "選擇解除安裝切換器時是否同時變更 Cavalry。"
LangString CAVALRY_I18N_UNINSTALL_OPTIONS_SUBTITLE 1041 "スイッチャーの削除時に Cavalry も変更するか選択します。"

LangString CAVALRY_I18N_UNINSTALL_RESTORE_CHECKBOX 1033 "Restore Cavalry to English and remove the translation runtime"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_CHECKBOX 2052 "将 Cavalry 恢复为英文，并移除翻译运行时"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_CHECKBOX 1028 "將 Cavalry 恢復為英文，並移除翻譯執行階段"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_CHECKBOX 1041 "Cavalry を英語に戻し、翻訳ランタイムを削除する"

LangString CAVALRY_I18N_UNINSTALL_KEEP_DETAIL 1033 "Unchecked: remove only the Switcher and keep the current translation."
LangString CAVALRY_I18N_UNINSTALL_KEEP_DETAIL 2052 "不勾选：只卸载切换器，保留 Cavalry 当前翻译。"
LangString CAVALRY_I18N_UNINSTALL_KEEP_DETAIL 1028 "不勾選：只解除安裝切換器，保留 Cavalry 目前翻譯。"
LangString CAVALRY_I18N_UNINSTALL_KEEP_DETAIL 1041 "未選択：スイッチャーだけを削除し、現在の翻訳を残します。"

LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1033 "Cavalry could not be safely restored to English. No unknown runtime files were removed, and the Switcher will remain installed. Close Cavalry and try again, or choose to keep the translation."
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 2052 "无法安全地把 Cavalry 恢复为英文。未知运行时文件没有被删除，切换器也会保留。请关闭 Cavalry 后重试，或选择保留翻译。"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1028 "無法安全地把 Cavalry 恢復為英文。未知執行階段檔案沒有被刪除，切換器也會保留。請關閉 Cavalry 後重試，或選擇保留翻譯。"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1041 "Cavalry を安全に英語へ戻せませんでした。不明なランタイムファイルは削除されず、スイッチャーも残ります。Cavalry を閉じて再試行するか、翻訳を残してください。"

UninstPage custom un.CavalryI18nUninstallOptions un.CavalryI18nUninstallOptionsLeave

Function un.CavalryI18nUninstallOptions
  StrCpy $CavalryI18nRestoreRequested ${BST_UNCHECKED}

  ; 更新、静默与被动卸载不显示选项页，也不改变 Cavalry 数据面。
  ; installer hooks 先于 Tauri 的模式变量声明被解析，因此在这里镜像
  ; un.onInit 的同一 GetOptions 判定；PREUNINSTALL 再消费 Tauri 变量。
  ${If} ${Silent}
    Abort
  ${EndIf}
  ${GetOptions} $CMDLINE "/P" $0
  ${IfNot} ${Errors}
    Abort
  ${EndIf}
  ${GetOptions} $CMDLINE "/UPDATE" $0
  ${IfNot} ${Errors}
    Abort
  ${EndIf}
  ; 普通交互卸载始终显示选择；是否存在可恢复目标由可信 Rust 事务判定。
  !insertmacro MUI_HEADER_TEXT "$(CAVALRY_I18N_UNINSTALL_OPTIONS_TITLE)" "$(CAVALRY_I18N_UNINSTALL_OPTIONS_SUBTITLE)"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 12u 100% 22u "$(CAVALRY_I18N_UNINSTALL_RESTORE_CHECKBOX)"
  Pop $CavalryI18nRestoreCheckbox
  ${NSD_SetState} $CavalryI18nRestoreCheckbox ${BST_UNCHECKED}

  ${NSD_CreateLabel} 0 48u 100% 16u "$(CAVALRY_I18N_UNINSTALL_KEEP_DETAIL)"
  Pop $0

  nsDialogs::Show
FunctionEnd

Function un.CavalryI18nUninstallOptionsLeave
  ${NSD_GetState} $CavalryI18nRestoreCheckbox $CavalryI18nRestoreRequested
FunctionEnd

!macro NSIS_HOOK_PREUNINSTALL
  ; 更新、静默、被动卸载属于控制面替换，不得隐式改变 Cavalry 数据面。
  ${If} $UpdateMode = 1
  ${OrIf} $PassiveMode = 1
  ${OrIf} ${Silent}
    Goto cavalry_i18n_keep_translation
  ${EndIf}
  ${If} $CavalryI18nRestoreRequested != ${BST_CHECKED}
    Goto cavalry_i18n_keep_translation
  ${EndIf}

  IfFileExists "$INSTDIR\${MAINBINARYNAME}.exe" 0 cavalry_i18n_restore_failed
  ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" "--uninstall-restore-english"' $0
  ${If} $0 != 0
    Goto cavalry_i18n_restore_failed
  ${EndIf}
  Goto cavalry_i18n_keep_translation

  cavalry_i18n_restore_failed:
    MessageBox MB_OK|MB_ICONSTOP "$(CAVALRY_I18N_UNINSTALL_RESTORE_FAILED)"
    Abort

  cavalry_i18n_keep_translation:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 安装路径与安装器语言属于安装元数据，不属于用户应用数据。
  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" ""
  DeleteRegValue HKCU "${MANUPRODUCTKEY}" "Installer Language"
  DeleteRegKey /ifempty SHCTX "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty HKCU "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty SHCTX "${MANUKEY}"
  DeleteRegKey /ifempty HKCU "${MANUKEY}"
!macroend
