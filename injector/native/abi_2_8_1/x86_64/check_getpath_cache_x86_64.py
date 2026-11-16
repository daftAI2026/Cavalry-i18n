"""
[INPUT]: 依赖官方2.8 Core/Extension/Skia x86 slice与owner合同。
[OUTPUT]: 核验缓存GetPath两帧、ToolHelp/质量生产者及Core导入。
[POS]: 编译前静态ABI门；不运行Cavalry或授予字体全局准入。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys

from x86_macho_contract import (
    cpp_byte_array, cpp_hex, cpp_string, macho_bytes_at, require, run,
    symbol_address, uuid_for_arch,
)


def main() -> None:
    require(len(sys.argv) == 3,
            "用法: check_getpath_cache_x86_64.py FRAMEWORKS OUT.json")
    frameworks = pathlib.Path(sys.argv[1]).resolve()
    output = pathlib.Path(sys.argv[2]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    native = pathlib.Path(__file__).resolve().parent
    contract = (native / "getpath_cache_x86_64_abi_contract.h").read_text()
    graph = (native / "getpath_graph_empty_x86_64_abi_contract.h").read_text()
    core = frameworks / "libCore.dylib"
    extension = frameworks / "libExtensionLayer.dylib"
    skia = frameworks / "libskia.dylib"
    require(all(path.is_file() for path in (core, extension, skia)),
            "缺少官方Core、Extension或Skia映像")

    actual_uuids = {
        "core": uuid_for_arch(core, "x86_64"),
        "extension": uuid_for_arch(extension, "x86_64"),
        "skia": uuid_for_arch(skia, "x86_64"),
    }
    require(actual_uuids == {
        "core": cpp_string(contract, "kCoreUuid"),
        "extension": cpp_string(contract, "kExtensionUuid"),
        "skia": cpp_string(graph, "kSkiaUuid"),
    }, "官方x86 UUID与缓存owner合同不一致")

    symbols = {
        "core.MakePathFromText": symbol_address(
            core, cpp_string(contract, "kMakePathFromTextSymbol"), local=False),
        "extension.getOrCreateTextPath": symbol_address(
            extension, cpp_string(contract, "kGetOrCreateTextPathSymbol")),
        "extension.setupToolHelp": symbol_address(
            extension, cpp_string(contract, "kToolHelpProducerSymbol")),
        "extension.renderFrame": symbol_address(
            extension, cpp_string(contract, "kViewportStatusProducerSymbol")),
    }
    expected_symbols = {
        "core.MakePathFromText": 0x72670,
        "extension.getOrCreateTextPath": cpp_hex(
            contract, "kGetOrCreateTextPathFunctionOffset"),
        "extension.setupToolHelp": cpp_hex(
            contract, "kToolHelpProducerFunctionOffset"),
        "extension.renderFrame": cpp_hex(
            contract, "kViewportQualityProducerFunctionOffset"),
    }
    require(symbols == expected_symbols,
            f"owner函数地址与官方x86合同不一致：{symbols}")

    windows = {
        "cachedGetPath": (
            extension, cpp_hex(contract, "kCachedGetPathWindowOffset"),
            cpp_byte_array(contract, "kCachedGetPathWindowBytes")),
        "toolHelpA": (
            extension, cpp_hex(contract, "kToolHelpProducerAWindowOffset"),
            cpp_byte_array(contract, "kToolHelpProducerAWindowBytes")),
        "toolHelpB": (
            extension, cpp_hex(contract, "kToolHelpProducerBWindowOffset"),
            cpp_byte_array(contract, "kToolHelpProducerBWindowBytes")),
        "viewportQuality": (
            extension, cpp_hex(contract, "kViewportQualityProducerWindowOffset"),
            cpp_byte_array(contract, "kViewportQualityProducerWindowBytes")),
    }
    observed_windows: dict[str, dict[str, object]] = {}
    for name, (image, offset, expected) in windows.items():
        actual = macho_bytes_at(image, offset, len(expected), output.parent)
        require(actual == expected, f"官方x86机器码窗不匹配：{name}")
        observed_windows[name] = {
            "image": image.name, "offset": f"0x{offset:x}",
            "length": len(actual), "sha256": hashlib.sha256(actual).hexdigest(),
        }

    core_window_offset = cpp_hex(graph, "kCoreGetPathCallOffset") - 19
    core_window = cpp_byte_array(graph, "kCoreGetPathCallWindowBytes")
    require(macho_bytes_at(core, core_window_offset, len(core_window), output.parent)
            == core_window, "Core MakePathFromText→Skia GetPath窗口不匹配")
    imports = run("dyld_info", "-arch", "x86_64", "-imports", str(extension))
    require("__ZN7cavalry16MakePathFromText" in imports and
            "(from libCore)" in next((line for line in imports.splitlines()
                                   if "__ZN7cavalry16MakePathFromText" in line), ""),
            "Extension缓存路径未导入同bundle Core MakePathFromText")
    fixups = run("dyld_info", "-arch", "x86_64", "-fixups", str(extension))
    require("libCore/__ZN7cavalry16MakePathFromText" in fixups,
            "Extension缓存路径缺少Core two-level fixup")

    receipt = {
        "status": "PASS_OFFICIAL_X86_CACHED_GETPATH_ABI",
        "scope": "static official binary identity and exact x86_64 windows",
        "officialImages": {
            name: {
                "path": str(path),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "uuid": actual_uuids[name],
            }
            for name, path in (("core", core), ("extension", extension),
                               ("skia", skia))
        },
        "symbols": {name: f"0x{address:x}" for name, address in symbols.items()},
        "windows": observed_windows,
        "ownerChain": {
            "coreGetPathReturn": f"0x{cpp_hex(contract, 'kCoreGetPathReturnOffset'):x}",
            "extensionCacheReturn": f"0x{cpp_hex(contract, 'kCachedGetPathReturnOffset'):x}",
            "toolHelpReturns": [
                f"0x{cpp_hex(contract, 'kToolHelpProducerReturnAOffset'):x}",
                f"0x{cpp_hex(contract, 'kToolHelpProducerReturnBOffset'):x}",
            ],
            "viewportQualityReturn":
                f"0x{cpp_hex(contract, 'kViewportQualityProducerReturnOffset'):x}",
        },
        "staticCoreImportAndFixup": "PASS",
        "runtimeAdmission": "NOT_OPENED",
    }
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print("PASS: Core GetPath → Extension text-path cache → exact producer windows")
    print(f"RECEIPT: {output}")


if __name__ == "__main__":
    main()
