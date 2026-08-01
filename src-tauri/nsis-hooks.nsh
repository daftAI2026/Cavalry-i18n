; [INPUT]: 依赖 Tauri NSIS 提供的 SHCTX、MANUPRODUCTKEY 与 MANUKEY 宏，以及当前用户安装模式
; [OUTPUT]: 对外提供 PREUNINSTALL 双语义选择与 POSTUNINSTALL 元数据清理；交互卸载可保留当前翻译，或先恢复英文并移除自有运行时
; [POS]: src-tauri 的 Windows 卸载生命周期边界；更新/静默/被动卸载默认保留数据面，显式 English 清理失败则中止卸载
; [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

LangString CAVALRY_I18N_UNINSTALL_CHOICE 1033 "Keep the current Cavalry translation after uninstall?$\r$\n$\r$\nYes: remove only the Switcher and keep the current translation.$\r$\nNo: restore Cavalry to English and remove the translation runtime.$\r$\nCancel: stop uninstalling."
LangString CAVALRY_I18N_UNINSTALL_CHOICE 2052 "卸载后保留 Cavalry 当前翻译吗？$\r$\n$\r$\n是：仅卸载切换器，保留当前翻译。$\r$\n否：先恢复 Cavalry 英文并移除翻译运行时。$\r$\n取消：停止卸载。"
LangString CAVALRY_I18N_UNINSTALL_CHOICE 1028 "解除安裝後保留 Cavalry 目前翻譯嗎？$\r$\n$\r$\n是：僅解除安裝切換器，保留目前翻譯。$\r$\n否：先恢復 Cavalry 英文並移除翻譯執行階段。$\r$\n取消：停止解除安裝。"
LangString CAVALRY_I18N_UNINSTALL_CHOICE 1041 "アンインストール後も Cavalry の現在の翻訳を残しますか？$\r$\n$\r$\nはい：スイッチャーのみ削除し、現在の翻訳を残します。$\r$\nいいえ：Cavalry を英語に戻し、翻訳ランタイムを削除します。$\r$\nキャンセル：アンインストールを中止します。"

LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1033 "Cavalry could not be safely restored to English. No unknown runtime files were removed, and the Switcher will remain installed. Close Cavalry and try again, or choose to keep the translation."
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 2052 "无法安全地把 Cavalry 恢复为英文。未知运行时文件没有被删除，切换器也会保留。请关闭 Cavalry 后重试，或选择保留翻译。"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1028 "無法安全地把 Cavalry 恢復為英文。未知執行階段檔案沒有被刪除，切換器也會保留。請關閉 Cavalry 後重試，或選擇保留翻譯。"
LangString CAVALRY_I18N_UNINSTALL_RESTORE_FAILED 1041 "Cavalry を安全に英語へ戻せませんでした。不明なランタイムファイルは削除されず、スイッチャーも残ります。Cavalry を閉じて再試行するか、翻訳を残してください。"

!macro NSIS_HOOK_PREUNINSTALL
  ; 更新・静默・被动卸载属于控制面替换，不得隐式改变 Cavalry 数据面。
  ${If} $UpdateMode = 1
  ${OrIf} $PassiveMode = 1
  ${OrIf} ${Silent}
    Goto cavalry_i18n_keep_translation
  ${EndIf}
  ; 从未成功管理过 Cavalry 时没有可恢复的数据面，也不应凭猜测扫描安装目录。
  IfFileExists "$APPDATA\${BUNDLEID}\state.json" 0 cavalry_i18n_keep_translation

  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$(CAVALRY_I18N_UNINSTALL_CHOICE)" IDYES cavalry_i18n_keep_translation IDNO cavalry_i18n_restore_english
  Abort

  cavalry_i18n_restore_english:
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
