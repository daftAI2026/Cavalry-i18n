# injector/native/abi_2_8_1/
> L3 | 父级: ../CLAUDE.md

本目录保存 `CAVALRY_NATIVE_TARGET_281` 使用的Cavalry 2.8.1 arm64 ABI合同；当前默认arm64 builder会设置该宏。14个既有合同头保留未定义宏时的2.8.0历史源，定义目标宏后由对应源头包含本目录版本。

`dependency_node_font_abi_contract.h` 是281 arm64新增合同；Name/Type相对位置为0/1，可选ComplexRoundRectView前项使两者后移一项；Composer不准入，2.8.0没有该字体准入。
`title_format_abi_contract.h` 只包含281 arm64 fmt11合同；x86_64沿用默认2.8.0编译路径。
`timeline_system_fallback_contract.h` 锁定281 SkFont::setSize窗口，首指令字节为`01 e4 00 6f`。

成员清单

- `demo_reader_abi_contract.h`、`easing_menu_abi_contract.h`、`fast_search_unicode_abi_contract.h`、`getpath_font_abi_contract.h`、`guide_body_abi_contract.h`、`help_description_abi_contract.h`、`help_popup_layout_abi_contract.h`、`native_locale_abi_contract.h`、`save_scene_caption_abi_contract.h`、`welcome_log_it_abi_contract.h`：281 arm64各自的UUID、导出、调用窗与GOT合同；Save caption另锁`chooseSceneOpen`构造的`Load .cv`及精确`getOpenFileName` caller/import；Welcome只锁Extension async revalidation producer及单一Extension GOT。
- `timeline_owner_observer_contract.h`、`timeline_system_fallback_contract.h`、`viewport_owner_snapshot.h`：281 arm64 Timeline、Skia字体入口与Viewport owner合同。
- `title_format_abi_contract.h`：仅281 arm64的fmt11标题合同，不声明Intel合同。
- `dependency_node_font_abi_contract.h`：281 arm64 Dependency Graph NodeView owner合同。
- `contract_snapshot_test.py`：验证14个默认合同快照及本目录15个profile合同摘要；不调用vendor或启动App。

本目录提供当前默认arm64 builder使用的281合同及目标专用构建/检查输入；owner接线由共享运行源按目标宏选择。未定义宏的280历史合同不消费这些输入，不代表Intel已适配281。
`build_candidate.sh` 由source-bound builder生成DG/TransformTool表，运行Node/C++窄合同与只读官方call/frame ABI checker；最终候选仍受本profile现有全量合同门约束。

[PROTOCOL]: 合同变更时更新本目录快照及父级CLAUDE.md

目标专用构建输入：build_candidate.sh沿用已有完整编译/fixture流程；check_candidate_contract.py核共享字体入口、Load .cv source/caller/QtWidgets two-level import、三语TS来源及Welcome async合同；check_help_popup_layout_contract.py核281调用窗。candidate_static_contract_test.py覆盖实际vendor字节和旧setSize反例；runtime admission fixture用只拒绝主程序的stub loader验证Extension/spdlog双映像准入和唯一返回PC。viewport_probe.inc仅保存281 Viewport caller字节窗，主分派仍用共享实现。
