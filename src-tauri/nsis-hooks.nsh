; [INPUT]: 依赖 Tauri NSIS 提供的 SHCTX、MANUPRODUCTKEY 与 MANUKEY 宏，以及当前用户安装模式
; [OUTPUT]: 对外提供 NSIS_HOOK_POSTUNINSTALL，清除卸载后不再有效的安装位置元数据，同时保留用户选择留下的应用数据目录
; [POS]: src-tauri 的 Windows 卸载收尾边界，补齐 Tauri 默认仅在“删除应用数据”时移除安装位置键的语义缺口
; [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

!macro NSIS_HOOK_POSTUNINSTALL
  ; 安装路径与安装器语言属于安装元数据，不属于用户应用数据。
  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" ""
  DeleteRegValue HKCU "${MANUPRODUCTKEY}" "Installer Language"
  DeleteRegKey /ifempty SHCTX "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty HKCU "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty SHCTX "${MANUKEY}"
  DeleteRegKey /ifempty HKCU "${MANUKEY}"
!macroend
