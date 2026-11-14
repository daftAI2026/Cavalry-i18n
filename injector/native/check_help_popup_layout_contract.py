"""
[INPUT]: 依赖401根布局表、精确arm64帮助调用与候选LLVM Bind表。
[OUTPUT]: 核验调用方原函数透传、401表、Qt two-level绑定和窄布局边界。
[POS]: 候选构建后的静态ABI门；不启动Cavalry或授予实屏消费信用。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import sys

from check_candidate_contract import (
    arm64_macho_bytes_at, cpp_byte_array, cpp_hex, cpp_string, require, run,
)
from macho_bindings import (
    BindingRequirement, read_bindings, validate_bindings,
    validate_no_flat_namespace,
)


def arm_popup_adapter_contract(adapter: str) -> bool:
    arm_alias = re.search(
        r"#else\s+namespace popup_abi = native_help_popup_layout::abi;"
        r"\s+namespace help_abi = native_help_description::contract;",
        adapter,
    ) is not None
    return (arm_alias and
            "gExpectedReturn.store" in adapter and
            "imageAddress(ui, popup_abi::kActivateReturnOffset)" in adapter and
            "isExactActivationCaller(caller, expected)" in adapter and
            adapter.count("original(layout)") == 1)


def symbol_address(image: pathlib.Path, symbol: str, *, local: bool = False) -> int:
    mode = "-a" if local else "-gU"
    rows = [line.split() for line in run(
        "xcrun", "nm", "-arch", "arm64", mode, str(image)).splitlines()
        if line.split() and line.split()[-1] == symbol]
    require(len(rows) == 1, f"{image.name}缺少唯一导出: {symbol}")
    return int(rows[0][0], 16)


def stub_bytes(image: pathlib.Path, offset: int, length: int) -> bytes:
    dump = run("xcrun", "otool", "-arch", "arm64", "-s", "__TEXT",
               "__stubs", str(image))
    words: dict[int, bytes] = {}
    for line in dump.splitlines():
        match = re.match(r"^([0-9a-fA-F]{16})\s+((?:[0-9a-fA-F]{8}\s*)+)$", line)
        if not match:
            continue
        base = int(match.group(1), 16)
        for index, word in enumerate(match.group(2).split()):
            words[base + index * 4] = int(word, 16).to_bytes(4, "little")
    return b"".join(words.get(offset + step, b"")
                    for step in range(0, length, 4))


def main() -> None:
    require(len(sys.argv) == 5,
            "用法: check_help_popup_layout_contract.py ROOT OUT FRAMEWORKS CANDIDATE")
    root, out, frameworks, candidate = map(pathlib.Path, sys.argv[1:])
    root = root.resolve()
    out = out.resolve()
    frameworks = frameworks.resolve()
    candidate = candidate.resolve()
    native = root / "injector/native"
    abi = (native / "help_popup_layout_abi_contract.h").read_text()
    adapter = (native / "help_popup_layout_adapter.mm").read_text()
    policy = (native / "help_popup_layout_policy.h").read_text()
    build = (native / "build_candidate.sh").read_text()
    layout_file = out / "help-description-table.inc.layout.inc"
    receipt_file = out / "help-description-table.inc.receipt.json"
    require(layout_file.is_file() and receipt_file.is_file(),
            "缺少构建期401根布局表或其回执")
    receipt = json.loads(receipt_file.read_text())
    layout_sha = hashlib.sha256(layout_file.read_bytes()).hexdigest()
    require(receipt["output"]["layoutSha256"] == layout_sha
            and receipt["output"]["layoutRootEntries"] == 401,
            "布局表哈希或401根分母与producer回执不一致")
    layout_text = layout_file.read_text()
    require("struct Row {" in layout_text
            and "kRows[]" in layout_text and "kRowCount" in layout_text,
            "构建产物不是批准的根布局表")

    expected_values = {
        "kDocumentationSetContentOffset": 0x92394,
        "kActivateCallWindowOffset": 0x924F4,
        "kActivateReturnOffset": 0x92500,
        "kActivateImportStubOffset": 0xAD15C,
        "kQtLayoutActivateOffset": 0x3CDA0,
    }
    for name, value in expected_values.items():
        require(cpp_hex(abi, name) == value,
                f"调用合同偏移漂移: {name}")
    require(cpp_string(abi, "kQtWidgetsUuid") ==
            "01652E29-047E-3528-9DC2-1BD084292E50",
            "QtWidgets arm64 UUID不匹配")
    require(cpp_string(abi, "kDocumentationSetContentSymbol") ==
            "__ZN18DocumentationPopup10setContentERK7QStringS2_S2_S2_S2_"
            and cpp_string(abi, "kQtLayoutActivateSymbol") ==
            "__ZN7QLayout8activateEv",
            "帮助布局调用符号不匹配")

    ui = frameworks / "libCavalryUI.dylib"
    widgets = frameworks / "QtWidgets.framework/Versions/A/QtWidgets"
    require(ui.is_file() and widgets.is_file(),
            "缺少同bundle CavalryUI或QtWidgets ABI映像")
    help_abi = (native / "help_description_abi_contract.h").read_text()
    ui_sha = hashlib.sha256(ui.read_bytes()).hexdigest()
    ui_uuid = cpp_string(help_abi, "kCavalryUiUuid")
    require(ui_sha == cpp_string(help_abi, "kCavalryUiSha256"),
            "CavalryUI SHA与已有帮助ABI合同不一致")
    require(re.search(rf"^UUID: {re.escape(ui_uuid)} \(arm64\)(?:\s|$)",
                      run("xcrun", "dwarfdump", "--uuid", str(ui)),
                      re.MULTILINE) is not None,
            "CavalryUI arm64 UUID与已有帮助ABI合同不一致")
    widgets_uuid = cpp_string(abi, "kQtWidgetsUuid")
    require(re.search(rf"^UUID: {re.escape(widgets_uuid)} \(arm64\)(?:\s|$)",
                      run("xcrun", "dwarfdump", "--uuid", str(widgets)),
                      re.MULTILINE) is not None,
            "QtWidgets arm64 UUID与布局合同不一致")
    require(symbol_address(ui, cpp_string(abi,
            "kDocumentationSetContentSymbol"), local=True)
            == cpp_hex(abi, "kDocumentationSetContentOffset"),
            "DocumentationPopup::setContent地址与锁定偏移不一致")
    require(symbol_address(widgets, cpp_string(abi,
            "kQtLayoutActivateSymbol"))
            == cpp_hex(abi, "kQtLayoutActivateOffset"),
            "QLayout::activate地址与锁定偏移不一致")

    call_bytes = arm64_macho_bytes_at(
        ui, cpp_hex(abi, "kActivateCallWindowOffset"),
        len(cpp_byte_array(abi, "kActivateCallWindowBytes")), out)
    require(call_bytes == cpp_byte_array(abi, "kActivateCallWindowBytes"),
            "setContent内activate调用窗字节不匹配")
    import_stub = stub_bytes(
        ui, cpp_hex(abi, "kActivateImportStubOffset"),
        len(cpp_byte_array(abi, "kActivateImportStubBytes")))
    require(import_stub == cpp_byte_array(abi, "kActivateImportStubBytes"),
            "CavalryUI QtWidgets import stub字节不匹配")

    require(arm_popup_adapter_contract(adapter)
            and "gExpectedReturn.store" in adapter,
            "adapter必须只准入精确return PC并对所有路径单次原函数透传")
    require(adapter.count("measureCatalogEnvelope(") == 1
            and "static const int envelopeWidth" in adapter
            and "native_help_popup_metadata::kRowCount" in adapter
            and "NATIVE_HELP_LAYOUT_ROWS" in adapter,
            "adapter必须只在首次精确帮助调用缓存401布局宽度")
    require(all(token not in adapter for token in (
        "QTimer", "setFixedWidth", "setFixedHeight", "setFixedSize",
        "setGeometry(", "setFont(", "setStyleSheet(", "setText(",
        "adjustSize(", "->activate(", "std::thread", "QSettings",
        "open(", "ifstream", "ofstream", "getenv(")),
        "adapter不得改文字/字体、固定高度、定时、二次激活或执行运行期文件IO")
    require(all(token not in adapter + policy for token in (
        "processEvents(", "sendPostedEvents(", "QEventLoop", "QTimer")),
        "布局路径不得泵事件或延迟重排")
    require("naturalLabelWidth" in policy and "setMaximumWidth" in policy
            and "Qt::AlignTop" in policy
            and "top->setContentsMargins(" not in policy
            and "row->setContentsMargins(" not in policy
            and "top->setSpacing(" not in policy
            and "row->setSpacing(" not in policy
            and len(adapter.splitlines()) <= 800
            and len(policy.splitlines()) <= 800,
            "布局策略必须仅用宿主自然宽、上限、对齐与原padding")
    require('"$NATIVE_DIR/help_popup_layout_adapter.mm"' in build
            and "NATIVE_HELP_LAYOUT_ROWS" in build
            and "QtGui" in build and "QtWidgets" in build,
            "显式候选构建未接入布局adapter、表或Qt依赖")

    exports = run("xcrun", "nm", "-gU", str(candidate))
    require(any(line.split() and line.split()[-1]
                == "_nativeHelpLayoutActivateInterpose"
                for line in exports.splitlines()),
            "候选缺少布局interpose入口")
    layout_symbol = cpp_string(abi, "kQtLayoutActivateSymbol")
    bindings = read_bindings(candidate, "arm64")
    binding_errors = validate_bindings(
        bindings, [BindingRequirement(
            layout_symbol, "QtWidgets", ("__interpose", "__got"))])
    binding_errors.extend(validate_no_flat_namespace(bindings))
    require(not binding_errors,
            "candidate QtWidgets QLayout binding contract failed:\n  - " +
            "\n  - ".join(binding_errors))

    print("PASS: 401-row table receipt and approved source identity")
    print("PASS: exact setContent QLayout::activate arm64 source window")
    print("PASS: narrow return-PC gate, one cached width, one original call")
    print("PASS: unknown callers use one original activation; no font/content/padding edits or event pumping")


if __name__ == "__main__":
    main()
