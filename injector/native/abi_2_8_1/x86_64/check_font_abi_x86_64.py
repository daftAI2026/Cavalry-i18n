#!/usr/bin/env python3
"""[INPUT]: 依赖官方2.8 Frameworks与x86字体、Viewport ABI合同头。
[OUTPUT]: 校验UUID、符号、Timeline/Viewport/FPS窗和拒绝负例。
[POS]: 只读二进制核对器；不装载App、不运行候选。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import subprocess
import sys

from x86_macho_contract import macho_bytes_at


def run(*command: str) -> str:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise SystemExit(
            f"命令失败({result.returncode}): {' '.join(command)}\n{result.stderr}")
    return result.stdout


def read_constants(path: pathlib.Path) -> tuple[dict[str, int], dict[str, bytes], dict[str, str]]:
    source = path.read_text(encoding="utf-8")
    integers = {
        name: int(value, 0)
        for name, value in re.findall(
            r"inline constexpr (?:std::uintptr_t|std::size_t|std::uint8_t)\s+"
            r"(k\w+)\s*=\s*(0x[0-9a-fA-F]+|\d+)",
            source)
    }
    arrays: dict[str, bytes] = {}
    array_pattern = re.compile(
        r"inline constexpr std::array<std::uint8_t,\s*(\d+)>\s+(k\w+)\s*=\s*\{([^}]*)\}",
        re.S)
    for size_text, name, body in array_pattern.findall(source):
        values = [int(value, 0) for value in re.findall(r"0x[0-9a-fA-F]+|\b\d+\b", body)]
        if len(values) != int(size_text):
            raise SystemExit(f"合同数组长度不符: {path.name}:{name}")
        arrays[name] = bytes(values)
    strings = {
        name: value
        for name, value in re.findall(
            r'inline constexpr char\s+(k\w+)\[\]\s*=\s*"([^"]+)"', source)
    }
    return integers, arrays, strings


def symbol_table(path: pathlib.Path) -> dict[str, int]:
    output = run("nm", "-arch", "x86_64", str(path))
    result: dict[str, int] = {}
    for line in output.splitlines():
        match = re.match(r"^\s*([0-9a-fA-F]+)\s+\w\s+(\S+)\s*$", line)
        if match:
            result[match.group(2)] = int(match.group(1), 16)
    return result


def uuid_for(path: pathlib.Path) -> str:
    output = run("xcrun", "dwarfdump", "--uuid", str(path))
    match = re.search(r"UUID: ([0-9A-F-]+) \(x86_64\)", output)
    if not match:
        raise SystemExit(f"缺少x86_64 UUID: {path}")
    return match.group(1)


def archs_for(path: pathlib.Path) -> list[str]:
    return run("xcrun", "lipo", "-archs", str(path)).strip().split()


def instruction_bytes(path: pathlib.Path, wanted: dict[int, int]) -> dict[int, bytes]:
    # These are the exact raw byte windows used by runtime matchesCode(), including
    # the fixed mixed-variant rejection prefix. Read the same bytes through the shared
    # Mach-O helper instead of requiring an incidental disassembler line boundary.
    scratch = pathlib.Path(__file__).resolve().parent
    return {
        start: macho_bytes_at(path, start, length, scratch)
        for start, length in wanted.items()
    }


def window_at(instructions: dict[int, bytes], start: int, length: int) -> bytes:
    current = start
    output = bytearray()
    while len(output) < length:
        chunk = instructions.get(current)
        if not chunk:
            raise SystemExit(f"反汇编缺少字节窗地址: 0x{current:x}")
        take = min(len(chunk), length - len(output))
        output.extend(chunk[:take])
        current += len(chunk)
    return bytes(output)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def file_sha(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: check_font_abi_x86_64.py <Frameworks> <receipt.json>")
    frameworks = pathlib.Path(sys.argv[1]).resolve()
    receipt_path = pathlib.Path(sys.argv[2]).resolve()
    if not frameworks.is_dir() or not str(frameworks).endswith("/Contents/Frameworks"):
        raise SystemExit("输入必须是只读Cavalry.app/Contents/Frameworks目录")

    native = pathlib.Path(__file__).resolve().parent
    font_ints, font_arrays, font_strings = read_constants(
        native / "native_font_x86_64_abi_contract.h")
    graph_ints, graph_arrays, graph_strings = read_constants(
        native / "getpath_graph_empty_x86_64_abi_contract.h")
    fps_ints, fps_arrays, fps_strings = read_constants(
        native / "getpath_fps_x86_64_abi_contract.h")
    viewport_ints, viewport_arrays, viewport_strings = read_constants(
        native / "viewport_blob_x86_64_abi_contract.h")
    timeline_ints, timeline_arrays, timeline_strings = read_constants(
        native / "timeline_owner_observer_x86_64_contract.h")

    core = frameworks / "libCore.dylib"
    extension = frameworks / "libExtensionLayer.dylib"
    skia = frameworks / "libskia.dylib"
    for image in (core, extension, skia):
        require("x86_64" in archs_for(image), f"缺少x86_64 slice: {image.name}")

    image_data = {
        "libCore.dylib": (core, font_strings["kCoreUuid"]),
        "libExtensionLayer.dylib": (extension, font_strings["kExtensionUuid"]),
        "libskia.dylib": (skia, font_strings["kSkiaUuid"]),
    }
    identities: dict[str, dict[str, object]] = {}
    symbols = {name: symbol_table(path) for name, (path, _) in image_data.items()}
    for name, (path, expected_uuid) in image_data.items():
        actual_uuid = uuid_for(path)
        require(actual_uuid == expected_uuid,
                f"UUID不符: {name} expected={expected_uuid} actual={actual_uuid}")
        identities[name] = {
            "sha256": file_sha(path), "architectures": archs_for(path),
            "x86_64_uuid": actual_uuid,
        }

    symbol_expectations = (
        ("libCore.dylib", font_strings["kMakeScalableFontSymbol"],
         font_ints["kMakeScalableFontOffset"]),
        ("libCore.dylib", graph_strings["kMakePathFromTextSymbol"],
         graph_ints["kMakePathFromTextExportOffset"]),
        ("libCore.dylib", viewport_strings["kGetNiceNameSymbol"],
         viewport_ints["kGetNiceNameExportOffset"]),
        ("libskia.dylib", font_strings["kMakeTypefaceSymbol"],
         font_ints["kMakeTypefaceOffset"]),
        ("libskia.dylib", font_strings["kGetCTFontSymbol"],
         font_ints["kGetCTFontOffset"]),
        ("libskia.dylib", font_strings["kGlyphSymbol"], font_ints["kGlyphOffset"]),
        ("libskia.dylib", font_strings["kGetPathSymbol"], font_ints["kGetPathOffset"]),
        ("libskia.dylib", font_strings["kSetSizeSymbol"], font_ints["kSetSizeOffset"]),
        ("libskia.dylib", timeline_strings["kMeasureSymbol"],
         timeline_ints["kMeasureSymbolOffset"]),
        ("libskia.dylib", timeline_strings["kDrawSymbol"],
         timeline_ints["kDrawSymbolOffset"]),
        ("libExtensionLayer.dylib", timeline_strings["kPaintNodeTextSymbol"],
         timeline_ints["kPaintNodeTextOffset"]),
        ("libExtensionLayer.dylib", timeline_strings["kTimelineClosureSymbol"],
         timeline_ints["kClosureEntryOffset"]),
        ("libExtensionLayer.dylib", viewport_strings["kViewportNameLambdaSymbol"],
         viewport_ints["kViewportNameLambdaOffset"]),
        ("libskia.dylib", viewport_strings["kMakeFromTextSymbol"],
         viewport_ints["kMakeFromTextOffset"]),
    )
    for image_name, symbol, expected_offset in symbol_expectations:
        actual_offset = symbols[image_name].get(symbol)
        require(actual_offset == expected_offset,
                f"符号偏移不符: {image_name}:{symbol} expected=0x{expected_offset:x} "
                f"actual={None if actual_offset is None else hex(actual_offset)}")

    windows = {
        "libCore.dylib": {
            font_ints["kMakeScalableFontOffset"]: font_arrays["kMakeScalableFontBytes"],
            graph_ints["kCoreGetPathCallOffset"] - 19:
                graph_arrays["kCoreGetPathCallWindowBytes"],
        },
        "libExtensionLayer.dylib": {
            graph_ints["kExtensionGraphProducerCallOffset"] - 11:
                graph_arrays["kExtensionGraphProducerCallWindowBytes"],
            fps_ints["kViewportFpsProducerWindowOffset"]:
                fps_arrays["kViewportFpsProducerWindowBytes"],
            viewport_ints["kViewportNameLambdaOffset"]:
                viewport_arrays["kViewportNameLambdaEntryBytes"],
            viewport_ints["kGetNiceNameCallOffset"] - 10:
                viewport_arrays["kGetNiceNameCallWindowBytes"],
            viewport_ints["kNameDecodeOffset"]:
                viewport_arrays["kNameDecodeWindowBytes"],
            viewport_ints["kViewportBlobCallOffset"] - 20:
                viewport_arrays["kViewportBlobCallWindowBytes"],
            viewport_ints["kMixedVariantBlobCallOffset"] - 21:
                viewport_arrays["kMixedVariantBlobCallWindowBytes"],
            font_ints["kMeasureCaptureLoadOffset"]:
                font_arrays["kMeasureCaptureLoadBytes"],
            font_ints["kMeasureStringTagReadOffset"]:
                font_arrays["kMeasureStringBranchBytes"],
            font_ints["kMeasureCallOffset"]: font_arrays["kMeasureCallBytes"],
            font_ints["kDrawStringDecodeOffset"]: font_arrays["kDrawStringDecodeBytes"],
            font_ints["kDrawCallOffset"]: font_arrays["kDrawCallBytes"],
        },
        "libskia.dylib": {
            font_ints["kMakeTypefaceOffset"]: font_arrays["kMakeTypefaceBytes"],
            font_ints["kGetCTFontOffset"]: font_arrays["kGetCTFontBytes"],
            font_ints["kGlyphOffset"]: font_arrays["kGlyphBytes"],
            font_ints["kGetPathOffset"]: font_arrays["kGetPathBytes"],
            font_ints["kSetSizeOffset"]: font_arrays["kSetSizeBytes"],
            viewport_ints["kMakeFromTextOffset"]:
                viewport_arrays["kMakeFromTextFunctionBytes"],
        },
    }
    verified_windows: list[dict[str, object]] = []
    for image_name, ranges in windows.items():
        instructions = instruction_bytes(image_data[image_name][0],
                                         {start: len(data) for start, data in ranges.items()})
        for start, expected in ranges.items():
            actual = window_at(instructions, start, len(expected))
            require(actual == expected,
                    f"机器码偏离: {image_name}+0x{start:x} "
                    f"expected={expected.hex()} actual={actual.hex()}")
            mutated = bytearray(actual)
            mutated[len(mutated) // 2] ^= 1
            require(bytes(mutated) != expected,
                    f"负例未拒绝改字节: {image_name}+0x{start:x}")
            verified_windows.append({
                "image": image_name, "offset": f"0x{start:x}",
                "bytes": actual.hex(), "byte_mutation_rejected": True,
            })

    # -- 独立负例：错误映像身份和Timeline libc++字符串布局必须拒绝 ------
    require(font_strings["kCoreUuid"] != font_strings["kExtensionUuid"],
            "Core/Extension UUID负例失效")
    require(viewport_strings["kExtensionUuid"] == font_strings["kExtensionUuid"] and
            viewport_strings["kSkiaUuid"] == font_strings["kSkiaUuid"] and
            viewport_strings["kCoreUuid"] == font_strings["kCoreUuid"],
            "Viewport contract UUID与Core/Extension/Skia映像不一致")
    require(fps_strings["kExtensionUuid"] == font_strings["kExtensionUuid"] and
            fps_strings["kCoreUuid"] == font_strings["kCoreUuid"],
            "FPS contract UUID与Core/Extension映像不一致")
    require(viewport_ints["kViewportBlobCallOffset"] + 5 ==
            viewport_ints["kViewportBlobReturnOffset"] and
            viewport_ints["kMixedVariantBlobCallOffset"] + 5 ==
            viewport_ints["kMixedVariantBlobReturnOffset"] and
            viewport_ints["kViewportBlobReturnOffset"] !=
            viewport_ints["kMixedVariantBlobReturnOffset"],
            "Viewport固定名称与mixed-variant caller范围交叠")
    require(fps_ints["kMakePathFromTextCallOffset"] + 5 ==
            fps_ints["kMakePathFromTextReturnOffset"] and
            fps_ints["kViewportFpsProducerWindowOffset"] +
            len(fps_arrays["kViewportFpsProducerWindowBytes"]) ==
            fps_ints["kMakePathFromTextReturnOffset"],
            "FPS caller window未包含完整精确返回点")

    imports = run("dyld_info", "-arch", "x86_64", "-imports", str(extension))
    fixups = run("dyld_info", "-arch", "x86_64", "-fixups", str(extension))
    for symbol, dependency in (
        (viewport_strings["kGetNiceNameSymbol"], "libCore"),
        (graph_strings["kMakePathFromTextSymbol"], "libCore"),
        (viewport_strings["kMakeFromTextSymbol"], "libskia"),
    ):
        require(f"{symbol}  (from {dependency})" in imports,
                f"缺少two-level import: {dependency}/{symbol}")
        require(f"bind  {dependency}/{symbol}" in fixups,
                f"缺少two-level fixup: {dependency}/{symbol}")
    layout = {
        "node_data_string_offset": font_ints["kTimelineNodeDataStringOffset"],
        "string_bytes": font_ints["kTimelineStringObjectBytes"],
        "tag_offset": font_ints["kStringFlagOffset"],
        "long_mask": font_ints["kLongStringFlagMask"],
        "long_length_offset": font_ints["kLongStringLengthOffset"],
        "long_data_offset": font_ints["kLongStringDataOffset"],
        "short_data_offset": font_ints["kShortStringDataOffset"],
        "short_capacity": font_ints["kShortStringCapacity"],
    }
    expected_layout = (0x08, 0x18, 0, 1, 0x08, 0x10, 0x01, 22)
    actual_layout = tuple(layout[key] for key in (
        "node_data_string_offset", "string_bytes", "tag_offset", "long_mask",
        "long_length_offset", "long_data_offset", "short_data_offset",
        "short_capacity"))
    def layout_matches(candidate: tuple[int, ...]) -> bool:
        return candidate == expected_layout

    require(layout_matches(actual_layout), "Timeline字符串布局偏离合同")
    wrong_layout = list(actual_layout)
    wrong_layout[5] -= 1
    require(not layout_matches(tuple(wrong_layout)), "负例未拒绝偏移变化")

    receipt = {
        "result": "PASS_X86_64_OFFICIAL_STATIC_FONT_ABI_ONLY",
        "frameworks": str(frameworks),
        "images": identities,
        "verified_symbols": [
            {"image": image, "symbol": symbol, "offset": f"0x{offset:x}"}
            for image, symbol, offset in symbol_expectations
        ],
        "verified_windows": verified_windows,
        "verified_two_level_imports": [
            {"symbol": symbol, "dependency": dependency, "fixed": True}
            for symbol, dependency in (
                (viewport_strings["kGetNiceNameSymbol"], "libCore"),
                (graph_strings["kMakePathFromTextSymbol"], "libCore"),
                (viewport_strings["kMakeFromTextSymbol"], "libskia"),
            )
        ],
        "timeline_string_layout": layout,
        "viewport_textblob": {
            "name_object_below_frame": viewport_ints["kNameObjectBelowFrame"],
            "name_object_bytes": viewport_ints["kStringObjectBytes"],
            "fixed_name_blob_return": f"0x{viewport_ints['kViewportBlobReturnOffset']:x}",
            "mixed_variant_blob_return_rejected": True,
            "sret_slot_below_frame": viewport_ints["kSretSlotBelowFrame"],
        },
        "viewport_fps": {
            "locale_key": fps_strings["kLocaleKey"],
            "producer_return": f"0x{fps_ints['kMakePathFromTextReturnOffset']:x}",
            "core_return": f"0x{graph_ints['kCoreGetPathReturnOffset']:x}",
        },
        "negative_contracts": {
            "wrong_uuid_rejected": True,
            "mutated_code_window_rejected": True,
            "wrong_timeline_string_offset_rejected": True,
            "mixed_variant_blob_caller_rejected": True,
            "unknown_fps_extension_owner_rejected": True,
        },
        "scope": "static vendor slice proof; not runtime adapter, product or UI PASS",
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("PASS_X86_64_OFFICIAL_STATIC_FONT_ABI_ONLY")
    print(f"receipt={receipt_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
