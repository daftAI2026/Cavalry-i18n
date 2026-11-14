#!/usr/bin/env python3
"""
[INPUT]: 依赖只读Cavalry 2.8.1 Frameworks与281 arm64 source-bound合同。
[OUTPUT]: 核五个ToolMenu caller、两层frame prologue、QAction导入call及UUID。
[POS]: DG/TransformTool菜单静态ABI门；不启动App、不触碰QObject或菜单模型。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import pathlib
import re
import sys
import tempfile

NATIVE_DIR = pathlib.Path(__file__).resolve().parent
PROFILE_DIR = NATIVE_DIR / "abi_2_8_1"
sys.path[0:0] = [str(PROFILE_DIR), str(NATIVE_DIR)]
from check_candidate_contract import (  # noqa: E402
    arm64_bl_target,
    arm64_macho_bytes_at,
    cpp_byte_array,
    cpp_hex,
    cpp_string,
    require,
    run,
)


def main() -> None:
    require(len(sys.argv) == 2,
            "用法: check_dg_context_menu_contract.py <Cavalry-2.8.1-Contents/Frameworks>")
    frameworks = pathlib.Path(sys.argv[1]).resolve()
    extension = frameworks / "libExtensionLayer.dylib"
    require(extension.is_file(), f"缺少Extension ABI输入: {extension}")
    header = (NATIVE_DIR / "dg_context_menu_abi_contract.h").read_text()
    uuid = cpp_string(header, "kExtensionUuid")
    uuid_report = run("xcrun", "dwarfdump", "--uuid", str(extension))
    require(re.search(rf"^UUID: {re.escape(uuid)} \(arm64\)(?:\s|$)",
                      uuid_report, re.MULTILINE) is not None,
            "Extension arm64 UUID不匹配")

    symbols = (
        ("kToolMenuAddMenuItemSymbol", "kToolMenuAddMenuItemOffset"),
        ("kAddDuplicatorActionsSymbol", "kAddDuplicatorActionsOffset"),
        ("kAddGroupActionSymbol", "kAddGroupActionOffset"),
        ("kAddLockActionSymbol", "kAddLockActionOffset"),
        ("kAddShowInWindowActionsSymbol", "kAddShowInWindowActionsOffset"),
    )
    nm_output = run("xcrun", "nm", "-arch", "arm64", "-a", str(extension))
    symbol_offsets: dict[str, int] = {}
    for line in nm_output.splitlines():
        fields = line.split()
        if len(fields) >= 2:
            try:
                symbol_offsets[fields[-1]] = int(fields[0], 16)
            except ValueError:
                continue
    for symbol_name, offset_name in symbols:
        symbol = cpp_string(header, symbol_name)
        require(symbol_offsets.get(symbol) == cpp_hex(header, offset_name),
                f"符号地址不匹配: {symbol}")

    windows = (
        ("kToolMenuFrameWindowOffset", "kToolMenuFrameWindowBytes"),
        ("kToolMenuAddActionWindowOffset", "kToolMenuAddActionWindowBytes"),
        ("kAddDuplicatorActionsFrameWindowOffset", "kAddDuplicatorActionsFrameWindowBytes"),
        ("kAddDuplicatorActionsCallOffset", "kAddDuplicatorActionsBranchBytes"),
        ("kAddGroupActionFrameWindowOffset", "kAddGroupActionFrameWindowBytes"),
        ("kAddGroupActionCallOffset", "kAddGroupActionBranchBytes"),
        ("kAddLockActionFrameWindowOffset", "kAddLockActionFrameWindowBytes"),
        ("kAddLockActionCallOffset", "kAddLockActionBranchBytes"),
        ("kAddShowInWindowActionsFrameWindowOffset", "kAddShowInWindowActionsFrameWindowBytes"),
        ("kAddShowAttributeEditorCallOffset", "kAddShowAttributeEditorBranchBytes"),
        ("kAddShowSceneWindowCallOffset", "kAddShowSceneWindowBranchBytes"),
    )
    with tempfile.TemporaryDirectory(prefix="dg-context-menu-abi-") as temp:
        scratch = pathlib.Path(temp)
        for offset_name, bytes_name in windows:
            offset = cpp_hex(header, offset_name)
            expected = cpp_byte_array(header, bytes_name)
            actual = arm64_macho_bytes_at(extension, offset, len(expected), scratch)
            require(actual == expected,
                    f"Extension arm64机器码不匹配: {offset_name} "
                    f"expected={expected.hex()} actual={actual.hex()}")

    helper_calls = (
        ("kAddDuplicatorActionsCallOffset", "kAddDuplicatorActionsBranchBytes"),
        ("kAddGroupActionCallOffset", "kAddGroupActionBranchBytes"),
        ("kAddLockActionCallOffset", "kAddLockActionBranchBytes"),
        ("kAddShowAttributeEditorCallOffset", "kAddShowAttributeEditorBranchBytes"),
        ("kAddShowSceneWindowCallOffset", "kAddShowSceneWindowBranchBytes"),
    )
    common_target = cpp_hex(header, "kToolMenuAddMenuItemOffset")
    for offset_name, bytes_name in helper_calls:
        call_offset = cpp_hex(header, offset_name)
        call_bytes = cpp_byte_array(header, bytes_name)
        require(arm64_bl_target(call_offset, call_bytes) == common_target,
                f"helper没有直接调用ToolMenu::addMenuItem: {offset_name}")
    require(arm64_bl_target(
        cpp_hex(header, "kToolMenuAddActionCallOffset"),
        cpp_byte_array(header, "kToolMenuAddActionBranchBytes")) ==
        cpp_hex(header, "kAddActionImportStubOffset"),
        "ToolMenu::addMenuItem没有直接调用QWidget::addAction导入桩")

    print("PASS: Cavalry 2.8.1 arm64 ToolMenu/helper symbols, caller frames, "
          "call windows and branch targets")


if __name__ == "__main__":
    main()
