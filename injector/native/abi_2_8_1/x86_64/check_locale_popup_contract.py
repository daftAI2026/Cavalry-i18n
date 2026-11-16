#!/usr/bin/env python3
"""
[INPUT]: Official 2.8.1 universal Frameworks and the adjacent Intel profile headers.
[OUTPUT]: Checks locale/Popup plus Demo, Save/Open, Welcome, and DG menu call paths.
[POS]: Intel281 build-time static Mach-O checker; no GUI, runtime mutation, or source edits.
[PROTOCOL]: Keep UUID/SHA, symbols, exact call windows, stubs, and two-level GOT checks.
"""
from __future__ import annotations

import hashlib
import pathlib
import re
import subprocess
import sys

PROFILE = pathlib.Path(__file__).resolve().parent
from x86_macho_contract import (  # noqa: E402
    cpp_byte_array,
    cpp_hex,
    cpp_string,
    macho_bytes_at,
    require,
    run,
    symbol_address,
    uuid_for_arch,
)


def image(frameworks: pathlib.Path, relative: str) -> pathlib.Path:
    path = frameworks / relative
    require(path.is_file(), f"缺少ABI输入: {path}")
    return path


def sha256(path: pathlib.Path, expected: str) -> None:
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    require(actual == expected, f"{path.name} SHA256不匹配: {actual}")


def identity(path: pathlib.Path, header: str, uuid_key: str,
             sha_key: str | None = None) -> None:
    require(uuid_for_arch(path, "x86_64") == cpp_string(header, uuid_key),
            f"{path.name} x86_64 UUID不匹配")
    if sha_key is not None:
        sha256(path, cpp_string(header, sha_key))


def symbol(path: pathlib.Path, header: str, symbol_key: str,
           offset_key: str) -> None:
    name = cpp_string(header, symbol_key)
    require(symbol_address(path, name) == cpp_hex(header, offset_key),
            f"符号地址不匹配: {path.name}/{name}")


def exact_bytes(path: pathlib.Path, header: str, offset_key: str,
                bytes_key: str) -> bytes:
    expected = cpp_byte_array(header, bytes_key)
    actual = macho_bytes_at(path, cpp_hex(header, offset_key), len(expected), PROFILE)
    require(actual == expected,
            f"{path.name}机器码不匹配 {offset_key}: {actual.hex()} != {expected.hex()}")
    return actual


def got_binding(path: pathlib.Path, imported_symbol: str) -> tuple[int, str]:
    output = run("xcrun", "llvm-objdump", "--macho", "--arch=x86_64",
                 "--bind", "--lazy-bind", str(path))
    rows = []
    for line in output.splitlines():
        fields = line.split()
        if (len(fields) >= 7 and fields[0] == "__DATA_CONST" and
                fields[1] == "__got" and fields[-1] == imported_symbol):
            rows.append((int(fields[2], 16), fields[-2]))
    require(len(rows) == 1,
            f"{path.name}缺少唯一two-level GOT导入 {imported_symbol}: {rows}")
    return rows[0]


def signed_rel32(raw: bytes) -> int:
    require(len(raw) == 4, "rel32必须正好4字节")
    value = int.from_bytes(raw, "little")
    return value - 0x100000000 if value & 0x80000000 else value


def call_target(call_offset: int, call: bytes, return_offset: int) -> int:
    require(len(call) == 5 and call[0] == 0xe8,
            f"不是完整x86 near-call窗: {call.hex()}")
    require(call_offset + 5 == return_offset, "return PC不是紧跟5-byte call")
    return return_offset + signed_rel32(call[1:])


def import_stub_target(stub_offset: int, stub: bytes) -> int:
    require(len(stub) == 6 and stub[:2] == b"\xff\x25",
            f"不是x86 RIP-relative indirect-jump stub: {stub.hex()}")
    return stub_offset + 6 + signed_rel32(stub[2:6])


def check_locale_popup(frameworks: pathlib.Path) -> None:
    api = image(frameworks, "libApi.dylib")
    extension = image(frameworks, "libExtensionLayer.dylib")
    ui = image(frameworks, "libCavalryUI.dylib")
    widgets = image(frameworks, "QtWidgets.framework/Versions/A/QtWidgets")
    locale = (PROFILE / "native_locale_abi_contract.h").read_text()
    locale_x86 = (PROFILE / "native_locale_x86_64_abi_contract.h").read_text()
    popup = (PROFILE / "help_popup_layout_abi_contract.h").read_text()
    popup_x86 = popup.split("namespace x86_64 {", 1)[1]

    identity(api, locale, "kApiUuid", "kApiSha256")
    identity(extension, locale, "kExtensionUuid")
    identity(ui, popup_x86, "kCavalryUiUuid", "kCavalryUiSha256")
    identity(widgets, popup_x86, "kQtWidgetsUuid")
    symbol(api, locale, "kActiveLocaleSymbol", "kActiveLocaleEntryOffset")
    symbol(extension, locale_x86, "kRegisterNodesSetupSymbol",
           "kRegisterNodesSetupEntryOffset")
    symbol(ui, popup_x86, "kDocumentationSetContentSymbol",
           "kDocumentationSetContentOffset")
    symbol(widgets, popup_x86, "kQtLayoutActivateSymbol", "kQtLayoutActivateOffset")

    for path, header, offset_key, bytes_key in (
        (api, locale, "kActiveLocaleEntryOffset", "kActiveLocaleEntryBytes"),
        (extension, locale, "kActiveLocaleCallOffset", "kActiveLocaleCallBytes"),
        (extension, locale_x86, "kStubOffset", "kActiveLocaleStubBytes"),
        (api, locale_x86, "kGetterSretSaveOffset", "kGetterSretSaveBytes"),
        (api, locale_x86, "kGetterReturnSretOffset", "kGetterReturnSretBytes"),
        (extension, locale_x86, "kOwnerSretArgumentOffset", "kOwnerSretArgumentBytes"),
        (extension, locale_x86, "kOwnerApiArgumentOffset", "kOwnerApiArgumentBytes"),
        (extension, locale_x86, "kRegisterNodesSetupCallOffset", "kOwnerCallBytes"),
        (extension, locale_x86, "kOwnerReturnUseOffset", "kOwnerReturnUseBytes"),
        (extension, locale_x86, "kOwnerSetLocaleCallOffset", "kOwnerSetLocaleCallBytes"),
        (ui, popup_x86, "kActivateCallWindowOffset", "kActivateCallWindowBytes"),
        (ui, popup_x86, "kActivateImportStubOffset", "kActivateImportStubBytes"),
    ):
        exact_bytes(path, header, offset_key, bytes_key)

    locale_symbol = cpp_string(locale, "kActiveLocaleSymbol")
    locale_got, locale_library = got_binding(extension, locale_symbol)
    require(locale_got == cpp_hex(locale_x86, "kGotOffset") and
            locale_library == "libApi", "activeLocale不是Extension->libApi精确GOT导入")
    popup_symbol = cpp_string(popup_x86, "kQtLayoutActivateSymbol")
    popup_got, popup_library = got_binding(ui, popup_symbol)
    require(popup_got == cpp_hex(popup_x86, "kActivateGotOffset") and
            popup_library == "QtWidgets",
            "QLayout::activate不是CavalryUI->QtWidgets精确GOT导入")
    owner_call = cpp_byte_array(locale_x86, "kOwnerCallBytes")
    owner_target = call_target(cpp_hex(locale_x86, "kRegisterNodesSetupCallOffset"),
                               owner_call,
                               cpp_hex(locale_x86, "kRegisterNodesSetupReturnOffset"))
    require(owner_target == cpp_hex(locale_x86, "kStubOffset"),
            "locale owner call没有直达其导入桩")
    locale_stub = cpp_byte_array(locale_x86, "kActiveLocaleStubBytes")
    require(import_stub_target(cpp_hex(locale_x86, "kStubOffset"), locale_stub) ==
            cpp_hex(locale_x86, "kGotOffset"), "activeLocale stub没有指向其GOT")
    popup_window = cpp_byte_array(popup_x86, "kActivateCallWindowBytes")
    popup_call_offset = cpp_hex(popup_x86, "kActivateCallOffset")
    popup_call_index = popup_call_offset - cpp_hex(popup_x86, "kActivateCallWindowOffset")
    popup_target = call_target(popup_call_offset, popup_window[popup_call_index:popup_call_index + 5],
                               cpp_hex(popup_x86, "kActivateReturnOffset"))
    require(popup_target == cpp_hex(popup_x86, "kActivateImportStubOffset"),
            "Popup activate call没有直达其导入桩")
    popup_stub = cpp_byte_array(popup_x86, "kActivateImportStubBytes")
    require(import_stub_target(cpp_hex(popup_x86, "kActivateImportStubOffset"),
                               popup_stub) == cpp_hex(popup_x86, "kActivateGotOffset"),
            "Popup activate stub没有指向其GOT")


def check_demo(frameworks: pathlib.Path) -> None:
    core = image(frameworks, "libCore.dylib")
    extension = image(frameworks, "libExtensionLayer.dylib")
    h = (PROFILE / "demo_reader_abi_contract.h").read_text()
    identity(core, h, "kCoreUuid", "kCoreSha256")
    identity(extension, h, "kExtensionUuid", "kExtensionSha256")
    symbol(core, h, "kTextFromFileSymbol", "kTextFromFileExportOffset")
    symbol(extension, h, "kPresetCallbackSymbol", "kPresetCallbackEntryOffset")
    symbol(extension, h, "kRunGuiScriptSymbol", "kRunGuiScriptOffset")
    exact_bytes(core, h, "kCoreEntryWindowOffset", "kCoreEntryWindowBytes")
    exact_bytes(extension, h, "kPresetCallbackEntryOffset", "kPresetCallbackEntryBytes")
    exact_bytes(extension, h, "kPresetCallWindowOffset", "kPresetCallWindowBytes")
    exact_bytes(extension, h, "kPresetRunGuiScriptCallOffset", "kPresetRunGuiScriptCallBytes")
    stub = exact_bytes(extension, h, "kTextFromFileStubOffset", "kTextFromFileStubBytes")
    require(import_stub_target(cpp_hex(h, "kTextFromFileStubOffset"), stub) ==
            cpp_hex(h, "kTextFromFileGotOffset"), "textFromFile stub没有指向其GOT")
    text_symbol = cpp_string(h, "kTextFromFileSymbol")
    got, library = got_binding(extension, text_symbol)
    require(got == cpp_hex(h, "kTextFromFileGotOffset") and library == "libCore",
            "Demo读取不是Extension->libCore精确GOT导入")
    window = cpp_byte_array(h, "kPresetCallWindowBytes")
    call_index = cpp_hex(h, "kPresetTextFromFileCallOffset") - cpp_hex(h, "kPresetCallWindowOffset")
    require(call_target(cpp_hex(h, "kPresetTextFromFileCallOffset"),
                        window[call_index:call_index + 5],
                        cpp_hex(h, "kPresetTextFromFileReturnOffset")) ==
            cpp_hex(h, "kTextFromFileStubOffset"), "Run Preset未直达textFromFile导入桩")
    run_call = cpp_byte_array(h, "kPresetRunGuiScriptCallBytes")
    require(call_target(cpp_hex(h, "kPresetRunGuiScriptCallOffset"), run_call,
                        cpp_hex(h, "kPresetRunGuiScriptReturnOffset")) ==
            cpp_hex(h, "kRunGuiScriptOffset"), "$_1 callback未进入runGuiScript")
    require(cpp_hex(h, "kOptionalEngagedOffset") == 0x18 and
            cpp_hex(h, "kOptionalResultBytes") == 0x20,
            "optional<string>的libc++布局值与已验证ABI不符")


def check_save_open(frameworks: pathlib.Path) -> None:
    extension = image(frameworks, "libExtensionLayer.dylib")
    widgets = image(frameworks, "QtWidgets.framework/Versions/A/QtWidgets")
    h = (PROFILE / "save_scene_caption_abi_contract.h").read_text()
    identity(extension, h, "kExtensionUuid", "kExtensionSha256")
    identity(widgets, h, "kQtWidgetsUuid", "kQtWidgetsSha256")
    symbol(extension, h, "kChooseSceneSaveSymbol", "kChooseSceneSaveOffset")
    symbol(extension, h, "kChooseSceneOpenSymbol", "kChooseSceneOpenOffset")
    symbol(extension, h, "kPresentOpenFileSymbol", "kPresentOpenFileOffset")
    symbol(widgets, h, "kGetSaveFileNameSymbol", "kQtWidgetsExportOffset")
    symbol(widgets, h, "kGetOpenFileNameSymbol", "kOpenFileNameQtWidgetsExportOffset")

    save_window = exact_bytes(extension, h, "kCallWindowOffset", "kCallWindowBytes")
    save_index = cpp_hex(h, "kCallOffset") - cpp_hex(h, "kCallWindowOffset")
    require(call_target(cpp_hex(h, "kCallOffset"), save_window[save_index:save_index + 5],
                        cpp_hex(h, "kReturnOffset")) == cpp_hex(h, "kImportStubOffset"),
            "Save caption caller未直达getSaveFileName导入桩")
    save_stub = exact_bytes(extension, h, "kImportStubOffset", "kSaveImportStubBytes")
    require(import_stub_target(cpp_hex(h, "kImportStubOffset"), save_stub) ==
            cpp_hex(h, "kGetSaveFileNameGotOffset"), "Save导入桩未指向其GOT")
    save_symbol = cpp_string(h, "kGetSaveFileNameSymbol")
    require(got_binding(extension, save_symbol) ==
            (cpp_hex(h, "kGetSaveFileNameGotOffset"), "QtWidgets"),
            "Save导入不是Extension->QtWidgets精确GOT绑定")

    exact_bytes(extension, h, "kLoadCvSourceWindowOffset", "kLoadCvSourceWindowBytes")
    source_bytes = bytes(cpp_byte_array(h, "kLoadCvSourceWindowBytes"))
    require(cpp_string(h, "kLoadCvSource") == "Load .cv" and
            cpp_string(h, "kLoadCvSource").encode() in source_bytes,
            "chooseSceneOpen machine window没有精确Load .cv source")
    producer = cpp_byte_array(h, "kChooseSceneOpenProducerCallBytes")
    require(exact_bytes(extension, h, "kChooseSceneOpenProducerCallOffset",
                        "kChooseSceneOpenProducerCallBytes") == producer and
            call_target(cpp_hex(h, "kChooseSceneOpenProducerCallOffset"), producer,
                        cpp_hex(h, "kChooseSceneOpenProducerReturnOffset")) ==
            cpp_hex(h, "kPresentOpenFileOffset"),
            "chooseSceneOpen未直达presentOpenFile")
    open_window = exact_bytes(extension, h, "kOpenFileNameCallWindowOffset",
                              "kOpenFileNameCallWindowBytes")
    open_call_index = cpp_hex(h, "kOpenFileNameCallOffset") - cpp_hex(h, "kOpenFileNameCallWindowOffset")
    require(call_target(cpp_hex(h, "kOpenFileNameCallOffset"),
                        open_window[open_call_index:open_call_index + 5],
                        cpp_hex(h, "kOpenFileNameReturnOffset")) ==
            cpp_hex(h, "kOpenFileNameImportStubOffset"),
            "Open caption caller未直达getOpenFileName导入桩")
    open_stub = exact_bytes(extension, h, "kOpenFileNameImportStubOffset",
                            "kOpenFileNameImportStubBytes")
    require(import_stub_target(cpp_hex(h, "kOpenFileNameImportStubOffset"), open_stub) ==
            cpp_hex(h, "kOpenFileNameGotOffset"), "Open导入桩未指向其GOT")
    open_symbol = cpp_string(h, "kGetOpenFileNameSymbol")
    require(got_binding(extension, open_symbol) ==
            (cpp_hex(h, "kOpenFileNameGotOffset"), "QtWidgets"),
            "Open导入不是Extension->QtWidgets精确GOT绑定")


def check_welcome(frameworks: pathlib.Path) -> None:
    extension = image(frameworks, "libExtensionLayer.dylib")
    spdlog = image(frameworks, "libspdlog.1.15.dylib")
    h = (PROFILE / "welcome_log_it_abi_contract.h").read_text()
    identity(extension, h, "kExtensionUuid", "kExtensionSha256")
    identity(spdlog, h, "kSpdlogUuid", "kSpdlogSha256")
    symbol(extension, h, "kExtensionAsyncWelcomeSymbol",
           "kExtensionAsyncWelcomeSymbolOffset")
    symbol(spdlog, h, "kLogItSymbol", "kLogItOffset")
    exact_bytes(extension, h, "kExtensionAsyncWelcomeSourceRefOffset",
                "kExtensionAsyncWelcomeSourceRefBytes")
    setup = exact_bytes(extension, h, "kExtensionAsyncWelcomeCallSetupOffset",
                        "kExtensionAsyncWelcomeCallSetupBytes")
    source = exact_bytes(extension, h, "kExtensionWelcomeSourceOffset",
                         "kExtensionWelcomeSourceBytes")
    require(source == b"Welcome to Cavalry.\0", "Welcome原始source literal变化")
    ref = cpp_byte_array(h, "kExtensionAsyncWelcomeSourceRefBytes")
    require(ref[:3] == b"\x0f\x10\x05" and
            cpp_hex(h, "kExtensionAsyncWelcomeSourceRefOffset") + len(ref) +
            signed_rel32(ref[3:7]) == cpp_hex(h, "kExtensionWelcomeSourceOffset"),
            "Welcome RIP-relative source ref没有指向固定literal")
    call_index = cpp_hex(h, "kExtensionCallOffset") - cpp_hex(h, "kExtensionAsyncWelcomeCallSetupOffset")
    require(call_target(cpp_hex(h, "kExtensionCallOffset"),
                        setup[call_index:call_index + 5],
                        cpp_hex(h, "kExtensionReturnOffset")) ==
            cpp_hex(h, "kExtensionStubOffset"), "Welcome logger call未直达log_it_导入桩")
    stub = exact_bytes(extension, h, "kExtensionStubOffset", "kExtensionStubBytes")
    require(import_stub_target(cpp_hex(h, "kExtensionStubOffset"), stub) ==
            cpp_hex(h, "kExtensionGotOffset"), "Welcome导入桩未指向其GOT")
    log_symbol = cpp_string(h, "kLogItSymbol")
    require(got_binding(extension, log_symbol) ==
            (cpp_hex(h, "kExtensionGotOffset"), "libspdlog.1.15"),
            "Welcome logger不是Extension->同bundle spdlog精确GOT绑定")


def check_dg_menu(frameworks: pathlib.Path) -> None:
    extension = image(frameworks, "libExtensionLayer.dylib")
    widgets = image(frameworks, "QtWidgets.framework/Versions/A/QtWidgets")
    gui = image(frameworks, "QtGui.framework/Versions/A/QtGui")
    h = (PROFILE / "dg_context_menu_abi_contract.h").read_text()
    identity(extension, h, "kExtensionUuid", "kExtensionSha256")
    identity(widgets, h, "kQtWidgetsUuid", "kQtWidgetsSha256")
    identity(gui, h, "kQtGuiUuid", "kQtGuiSha256")
    for symbol_key, offset_key in (
        ("kToolMenuAddMenuItemSymbol", "kToolMenuAddMenuItemOffset"),
        ("kAddDuplicatorActionsSymbol", "kAddDuplicatorActionsOffset"),
        ("kAddGroupActionSymbol", "kAddGroupActionOffset"),
        ("kAddLockActionSymbol", "kAddLockActionOffset"),
        ("kAddShowInWindowActionsSymbol", "kAddShowInWindowActionsOffset"),
    ):
        symbol(extension, h, symbol_key, offset_key)
    symbol(widgets, h, "kAddActionSymbol", "kAddActionExportOffset")
    symbol(gui, h, "kActionTextSymbol", "kActionTextExportOffset")
    symbol(gui, h, "kActionSetTextSymbol", "kActionSetTextExportOffset")

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
        ("kAddActionImportStubOffset", "kToolMenuAddActionImportStubBytes"),
    )
    for offset_key, bytes_key in windows:
        exact_bytes(extension, h, offset_key, bytes_key)

    common_target = cpp_hex(h, "kToolMenuAddMenuItemOffset")
    for call_key, bytes_key, return_key in (
        ("kAddDuplicatorActionsCallOffset", "kAddDuplicatorActionsBranchBytes",
         "kAddDuplicatorActionsReturnOffset"),
        ("kAddGroupActionCallOffset", "kAddGroupActionBranchBytes",
         "kAddGroupActionReturnOffset"),
        ("kAddLockActionCallOffset", "kAddLockActionBranchBytes",
         "kAddLockActionReturnOffset"),
        ("kAddShowAttributeEditorCallOffset", "kAddShowAttributeEditorBranchBytes",
         "kAddShowAttributeEditorReturnOffset"),
        ("kAddShowSceneWindowCallOffset", "kAddShowSceneWindowBranchBytes",
         "kAddShowSceneWindowReturnOffset"),
    ):
        require(call_target(cpp_hex(h, call_key), cpp_byte_array(h, bytes_key),
                            cpp_hex(h, return_key)) == common_target,
                f"{call_key}未直达ToolMenu::addMenuItem")
    add_action_window = cpp_byte_array(h, "kToolMenuAddActionWindowBytes")
    add_action_call = cpp_hex(h, "kToolMenuAddActionCallOffset")
    index = add_action_call - cpp_hex(h, "kToolMenuAddActionWindowOffset")
    require(call_target(add_action_call, add_action_window[index:index + 5],
                        cpp_hex(h, "kToolMenuAddActionReturnOffset")) ==
            cpp_hex(h, "kAddActionImportStubOffset"),
            "ToolMenu::addMenuItem未直达QWidget::addAction导入桩")
    stub = cpp_byte_array(h, "kToolMenuAddActionImportStubBytes")
    require(import_stub_target(cpp_hex(h, "kAddActionImportStubOffset"), stub) ==
            cpp_hex(h, "kAddActionGotOffset"), "addAction导入桩未指向其GOT")
    add_action_symbol = cpp_string(h, "kAddActionSymbol")
    require(got_binding(extension, add_action_symbol) ==
            (cpp_hex(h, "kAddActionGotOffset"), "QtWidgets"),
            "菜单addAction不是Extension->QtWidgets精确GOT绑定")


def main() -> None:
    require(len(sys.argv) == 2,
            "用法: check_locale_popup_contract.py <Cavalry-2.8.1-Contents/Frameworks>")
    frameworks = pathlib.Path(sys.argv[1]).resolve()
    require(frameworks.is_dir(), f"Frameworks目录不存在: {frameworks}")
    check_locale_popup(frameworks)
    check_demo(frameworks)
    check_save_open(frameworks)
    check_welcome(frameworks)
    check_dg_menu(frameworks)
    print("PASS: 2.8.1 Intel locale getter, exact owner caller, stub and libApi GOT")
    print("PASS: 2.8.1 Intel DocumentationPopup activation caller and QtWidgets GOT")
    print("PASS: 2.8.1 Intel Demo $_1 Run Preset caller, optional ABI and libCore GOT")
    print("PASS: 2.8.1 Intel Save/Open callers, fixed Load .cv source and QtWidgets GOTs")
    print("PASS: 2.8.1 Intel async Welcome producer, literal, spdlog stub and GOT")
    print("PASS: 2.8.1 Intel five DG helper frames, shared addAction and QtWidgets GOT")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
