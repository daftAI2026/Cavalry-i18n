#!/usr/bin/env python3
"""
[INPUT]: 依赖只读官方2.8 Frameworks、builder生成的源码manifest与x86_64 observer合同。
[OUTPUT]: 核精确机器码，真实编译/链接x86_64 veneer并执行寄存器合同。
[POS]: 单一Timeline ABI离线验证入口；不构建或接入完整native候选。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import shlex
import stat
import subprocess
import sys
from typing import Sequence

sys.dont_write_bytecode = True
NATIVE_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(NATIVE_DIR))
import check_candidate_contract as candidate_contract  # noqa: E402
import native_source_manifest_x86_64 as source_manifest  # noqa: E402

EXPECTED_EXTENSION_SHA = (
    "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050"
)
EXPECTED_SKIA_SHA = (
    "1c43f8db00fad9899f196cea294995407d40a7aa04d3da80ff51882230d4e493"
)
class CheckError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckError(message)


def record_command(
    name: str,
    command: Sequence[str],
    out_dir: pathlib.Path,
    *,
    required: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        list(command), text=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, check=False,
    )
    content = (
        f"$ {shlex.join(command)}\n{result.stdout}"
        f"\n[exit={result.returncode}]\n"
    )
    (out_dir / f"{name}.log").write_text(content)
    (out_dir / f"{name}.exit").write_text(f"{result.returncode}\n")
    if required and result.returncode != 0:
        raise CheckError(f"{name}失败，查看 {name}.log")
    return result


def hash_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def check_source_identity(
    root: pathlib.Path, out_dir: pathlib.Path,
    manifest_path: pathlib.Path,
) -> None:
    manifest_path = manifest_path.resolve()
    require(manifest_path.is_file(), "缺少builder生成的当前source manifest")
    (out_dir / manifest_path.name).write_bytes(manifest_path.read_bytes())
    manifest = json.loads(manifest_path.read_text())
    require(manifest.get("current", {}).get("root") == "repository/",
            "source manifest必须绑定repository根")
    expected_files = manifest["current"]["files"]
    require(isinstance(expected_files, dict) and expected_files,
            "source manifest必须列出源码闭包")
    require(manifest["current"].get("fileCount") == len(expected_files),
            "source manifest文件数与清单不一致")
    current_files = source_manifest.collect_source_files(root)
    mismatches: list[str] = []
    for relative, expected in expected_files.items():
        source = current_files.get(relative)
        if source is None:
            mismatches.append(relative + ":missing")
            continue
        data = source.read_bytes()
        expected_mode = expected["mode"]
        if isinstance(expected_mode, str):
            expected_mode = int(expected_mode, 8)
        same = (
            hashlib.sha256(data).hexdigest() == expected["sha256"]
            and len(data) == expected["bytes"]
            and stat.S_IMODE(source.stat().st_mode) == expected_mode
        )
        if not same:
            mismatches.append(relative + ":changed")

    added = sorted(set(current_files) - set(expected_files))
    missing = sorted(set(expected_files) - set(current_files))
    require(not mismatches and not added and not missing,
            "当前候选源偏离逐文件manifest: " +
            ", ".join(mismatches + ["added:" + x for x in added] +
                      ["missing:" + x for x in missing]))

    receipt = {
        "status": "PASS_SOURCE_FORK_INTEGRITY",
        "sourceManifestSha256": hash_file(manifest_path),
        "currentFileCount": len(expected_files),
        "sourceFilesMatch": True,
        "mismatches": mismatches,
    }
    (out_dir / "source-integrity.json").write_text(
        json.dumps(receipt, indent=2) + "\n"
    )


def parse_contract() -> tuple[
    str, dict[str, int], dict[str, bytes], dict[str, str]
]:
    path = NATIVE_DIR / "timeline_owner_observer_x86_64_contract.h"
    source = path.read_text()
    symbols = {
        name: candidate_contract.cpp_string(source, name)
        for name in (
            "kMeasureSymbol", "kDrawSymbol", "kPaintNodeTextSymbol",
            "kTimelineClosureSymbol",
        )
    }
    offsets = {
        name: candidate_contract.cpp_hex(source, name)
        for name in (
            "kPaintNodeTextOffset", "kClosureCallOffset",
            "kClosureEntryOffset", "kClosureCaptureOffset",
            "kMeasureCaptureLoadOffset", "kMeasureArgSetupOffset",
            "kMeasureCallOffset",
            "kMeasureReturnOffset", "kMeasureReturnUseOffset",
            "kDrawCaptureLoadOffset", "kDrawTextArgSetupOffset",
            "kDrawFloatArgSetupOffset", "kDrawCallOffset",
            "kDrawReturnOffset", "kCapturePointerOffset",
            "kMeasureSymbolOffset", "kDrawSymbolOffset",
        )
    }
    arrays = {
        name: candidate_contract.cpp_byte_array(source, name)
        for name in (
            "kClosureCallBytes", "kClosureCaptureBytes",
            "kMeasureCaptureLoadBytes", "kMeasureOpaqueByteReadBytes",
            "kMeasureArgSetupBytes", "kMeasureCallBytes",
            "kMeasureReturnUseBytes",
            "kDrawCaptureLoadBytes", "kDrawCallBytes",
            "kDrawTextArgSetupBytes", "kDrawFloatArgSetupBytes",
        )
    }
    return source, offsets, arrays, symbols


def selected_vendor_instructions(
    extension: pathlib.Path, offsets: dict[str, int],
    arrays: dict[str, bytes], out_dir: pathlib.Path, symbols: dict[str, str],
) -> dict[int, tuple[bytes, str]]:
    addresses = {offsets[key] for key in (
        "kClosureCallOffset", "kClosureCaptureOffset", "kMeasureCaptureLoadOffset",
        "kMeasureCallOffset", "kMeasureReturnUseOffset", "kDrawCaptureLoadOffset", "kDrawCallOffset",
    )}
    addresses.add(offsets["kMeasureCaptureLoadOffset"] + 4)
    ranges = tuple((offsets[key], arrays[array]) for key, array in (
        ("kMeasureArgSetupOffset", "kMeasureArgSetupBytes"),
        ("kDrawTextArgSetupOffset", "kDrawTextArgSetupBytes"),
        ("kDrawFloatArgSetupOffset", "kDrawFloatArgSetupBytes"),
    ))
    found: dict[int, tuple[bytes, str]] = {}
    pattern = re.compile(r"^\s*([0-9a-fA-F]+):\s*((?:[0-9a-fA-F]{2}\s+)+)(.*)$")
    with (out_dir / "vendor-x86_64-instructions.log").open("w") as log:
        for index, symbol in enumerate((symbols["kPaintNodeTextSymbol"], symbols["kTimelineClosureSymbol"])):
            command = ["xcrun", "llvm-objdump", "--macho", "--arch=x86_64", "-d",
                       "--dis-symname", symbol, str(extension)]
            result = record_command(f"vendor-function-{index}", command, out_dir)
            log.write(f"$ {shlex.join(command)}\n")
            for line in result.stdout.splitlines():
                match = pattern.match(line)
                if match is None:
                    continue
                address = int(match.group(1), 16)
                if address not in addresses and not any(
                        begin <= address < begin + len(expected) for begin, expected in ranges):
                    continue
                found[address] = (bytes.fromhex(match.group(2)), match.group(3).strip())
                log.write(line + "\n")
    (out_dir / "vendor-x86_64-instructions.exit").write_text("0\n")
    return found


def instruction_window_bytes(
    instructions: dict[int, tuple[bytes, str]], start: int, length: int,
) -> bytes:
    stop = start + length
    cursor = start
    result = bytearray()
    while cursor < stop:
        instruction = instructions.get(cursor)
        require(instruction is not None,
                f"官方反汇编缺少指令: 0x{cursor:x}")
        encoded = instruction[0]
        result.extend(encoded)
        cursor += len(encoded)
    require(cursor == stop, f"调用窗口未按指令边界结束: 0x{stop:x}")
    return bytes(result)


def verify_official_abi(
    frameworks: pathlib.Path, out_dir: pathlib.Path,
    offsets: dict[str, int], arrays: dict[str, bytes], symbols: dict[str, str],
) -> None:
    extension = frameworks / "libExtensionLayer.dylib"
    skia = frameworks / "libskia.dylib"
    require(frameworks.name == "Frameworks", "输入不是所选App的Frameworks")
    require(extension.is_file() and skia.is_file(), "缺少官方Extension/libskia")

    ext_arch = record_command(
        "vendor-extension-arch",
        ["xcrun", "lipo", "-archs", str(extension)], out_dir,
    ).stdout.split()
    skia_arch = record_command(
        "vendor-skia-arch",
        ["xcrun", "lipo", "-archs", str(skia)], out_dir,
    ).stdout.split()
    require("x86_64" in ext_arch and "arm64" in ext_arch,
            "官方Extension缺少预期双slice")
    require("x86_64" in skia_arch and "arm64" in skia_arch,
            "官方libskia缺少预期双slice")

    extension_sha = hash_file(extension)
    skia_sha = hash_file(skia)
    require(extension_sha == EXPECTED_EXTENSION_SHA,
            "官方Extension整文件SHA偏离只读采样")
    require(skia_sha == EXPECTED_SKIA_SHA,
            "官方libskia整文件SHA偏离只读采样")
    (out_dir / "vendor-sha256.log").write_text(
        f"{extension_sha}  {extension}\n{skia_sha}  {skia}\n"
    )
    (out_dir / "vendor-sha256.exit").write_text("0\n")

    uuid_text = record_command(
        "vendor-uuids", ["xcrun", "dwarfdump", "--uuid", str(extension), str(skia)],
        out_dir,
    ).stdout
    require("AEAD00DA-F97D-3DD0-9602-D5668F1341A2 (x86_64)" in uuid_text,
            "官方Extension x86_64 UUID偏离")
    require("86ACD2F2-91F5-308C-BBAE-23183E8D218D (x86_64)" in uuid_text,
            "官方libskia x86_64 UUID偏离")

    ext_symbols = record_command(
        "vendor-extension-nm",
        ["xcrun", "nm", "-arch", "x86_64", str(extension)], out_dir,
    ).stdout
    skia_symbols = record_command(
        "vendor-skia-nm",
        ["xcrun", "nm", "-arch", "x86_64", str(skia)], out_dir,
    ).stdout
    expected_ext = {
        symbols["kPaintNodeTextSymbol"]: offsets["kPaintNodeTextOffset"],
        symbols["kTimelineClosureSymbol"]: offsets["kClosureEntryOffset"],
    }
    for symbol, address in expected_ext.items():
        rows = [line.split() for line in ext_symbols.splitlines()
                if line.split() and line.split()[-1] == symbol]
        require(len(rows) == 1 and int(rows[0][0], 16) == address,
                f"Extension符号偏移不匹配: {symbol}")
    require(offsets["kPaintNodeTextOffset"] < offsets["kClosureCallOffset"]
            < offsets["kClosureEntryOffset"],
            "闭包调用点不在paintNodeText与$_0符号地址之间")
    for key in ("kMeasureSymbol", "kDrawSymbol"):
        rows = [line.split() for line in skia_symbols.splitlines()
                if line.split() and line.split()[-1] == symbols[key]]
        expected = offsets["kMeasureSymbolOffset" if key == "kMeasureSymbol"
                           else "kDrawSymbolOffset"]
        require(len(rows) == 1 and int(rows[0][0], 16) == expected,
                f"libskia导出偏移不匹配: {symbols[key]}")

    imports = record_command(
        "vendor-extension-imports",
        ["dyld_info", "-arch", "x86_64", "-imports", str(extension)], out_dir,
    ).stdout
    require(symbols["kMeasureSymbol"] in imports and "(from libskia)" in imports,
            "Extension未按x86_64双层导入measureText")
    require(symbols["kDrawSymbol"] in imports and "(from libskia)" in imports,
            "Extension未按x86_64双层导入drawSimpleText")

    instructions = selected_vendor_instructions(
        extension, offsets, arrays, out_dir, symbols,
    )
    expected_bytes = {
        offsets["kClosureCallOffset"]: arrays["kClosureCallBytes"],
        offsets["kClosureCaptureOffset"]: arrays["kClosureCaptureBytes"],
        offsets["kMeasureCaptureLoadOffset"]:
            arrays["kMeasureCaptureLoadBytes"],
        offsets["kMeasureCaptureLoadOffset"] + 4:
            arrays["kMeasureOpaqueByteReadBytes"],
        offsets["kMeasureCallOffset"]: arrays["kMeasureCallBytes"],
        offsets["kMeasureReturnUseOffset"]:
            arrays["kMeasureReturnUseBytes"],
        offsets["kDrawCaptureLoadOffset"]:
            arrays["kDrawCaptureLoadBytes"],
        offsets["kDrawCallOffset"]: arrays["kDrawCallBytes"],
    }
    for address, expected in expected_bytes.items():
        actual = instructions.get(address)
        require(actual is not None and actual[0] == expected,
                f"官方x86_64机器码偏离合同: 0x{address:x}")
    require(symbols["kTimelineClosureSymbol"] in
            instructions[offsets["kClosureCallOffset"]][1],
            "paintNodeText未调用固定$_0 closure")
    require(symbols["kMeasureSymbol"] in
            instructions[offsets["kMeasureCallOffset"]][1],
            "精确measure call site未绑定SkFont::measureText")
    require(symbols["kDrawSymbol"] in
            instructions[offsets["kDrawCallOffset"]][1],
            "精确draw call site未绑定SkCanvas::drawSimpleText")
    for offset_key, array_key, label in (
        ("kMeasureArgSetupOffset", "kMeasureArgSetupBytes", "Measure参数寄存器"),
        ("kDrawTextArgSetupOffset", "kDrawTextArgSetupBytes", "Draw文本/长度寄存器"),
        ("kDrawFloatArgSetupOffset", "kDrawFloatArgSetupBytes", "Draw数值/字体/paint寄存器"),
    ):
        actual = instruction_window_bytes(
            instructions, offsets[offset_key], len(arrays[array_key]),
        )
        require(actual == arrays[array_key], f"官方x86_64{label}机器码偏离合同")
    require("%rdi, %rbx" in instructions[offsets["kClosureCaptureOffset"]][1],
            "$_0未将closure保存到callee-saved%rbx")
    require(offsets["kMeasureCallOffset"] +
            len(arrays["kMeasureCallBytes"]) == offsets["kMeasureReturnOffset"],
            "Measure return PC不是原call后的首地址")
    require(offsets["kDrawCallOffset"] +
            len(arrays["kDrawCallBytes"]) == offsets["kDrawReturnOffset"],
            "Draw return PC不是原call后的首地址")


def compile_and_link(native: pathlib.Path, out_dir: pathlib.Path) -> pathlib.Path:
    veneer_obj = out_dir / "timeline_owner_observer_x86_64.o"
    probe_obj = out_dir / "timeline_owner_observer_x86_64_probe.o"
    binary = out_dir / "timeline_owner_observer_x86_64_veneer_contract_test"
    record_command("compile-veneer-x86_64", [
        "xcrun", "--sdk", "macosx", "clang", "-arch", "x86_64",
        "-c", str(native / "timeline_owner_observer_x86_64.S"),
        "-o", str(veneer_obj),
    ], out_dir)
    record_command("compile-probe-x86_64", [
        "xcrun", "--sdk", "macosx", "clang", "-arch", "x86_64",
        "-c", str(native / "timeline_owner_observer_x86_64_probe.S"),
        "-o", str(probe_obj),
    ], out_dir)
    record_command("link-veneer-contract-x86_64", [
        "xcrun", "--sdk", "macosx", "clang++", "-arch", "x86_64",
        "-mmacosx-version-min=12.0", "-std=c++17", "-Wall", "-Wextra",
        "-Werror", "-I", str(native),
        str(native / "timeline_owner_observer_x86_64_veneer_contract_test.cpp"),
        str(veneer_obj), str(probe_obj), "-o", str(binary),
    ], out_dir)

    file_output = record_command(
        "linked-binary-file",
        ["/usr/bin/file", str(binary)], out_dir,
    ).stdout
    architectures = record_command(
        "linked-binary-arch",
        ["xcrun", "lipo", "-archs", str(binary)], out_dir,
    ).stdout.split()
    require("x86_64" in file_output and architectures == ["x86_64"],
            "合同程序不是thin x86_64 Mach-O")
    record_command(
        "linked-binary-symbols",
        ["xcrun", "nm", "-arch", "x86_64", "-gU", str(binary)], out_dir,
    )
    record_command(
        "linked-binary-disassembly",
        ["xcrun", "llvm-objdump", "--macho", "--arch=x86_64", "-d", str(binary)],
        out_dir,
    )
    return binary


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "用法: python3 check_timeline_owner_observer_x86_64.py "
            "<readonly-Cavalry-2.8-Contents/Frameworks> <evidence-output-dir> "
            "<builder-source-manifest.json>",
            file=sys.stderr,
        )
        return 2

    frameworks = pathlib.Path(sys.argv[1]).resolve()
    out_dir = pathlib.Path(sys.argv[2]).resolve()
    manifest_path = pathlib.Path(sys.argv[3]).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    source_root = NATIVE_DIR.parents[1]
    summary_path = out_dir / "x86_64-veneer-summary.json"
    summary: dict[str, object] = {
        "status": "RUNNING",
        "scope": "Timeline owner observer veneer only",
        "fullNativeCandidatePass": False,
        "sourceRoot": str(source_root),
        "frameworks": str(frameworks),
    }
    try:
        check_source_identity(source_root, out_dir, manifest_path)
        _, offsets, arrays, symbols = parse_contract()
        verify_official_abi(frameworks, out_dir, offsets, arrays, symbols)
        binary = compile_and_link(NATIVE_DIR, out_dir)
        run_result = record_command(
            "run-veneer-contract-x86_64",
            ["arch", "-x86_64", str(binary)], out_dir,
            required=False,
        )
        if run_result.returncode != 0:
            raise CheckError(
                "x86_64对象/链接成功，但vendor-free测试程序未通过或Rosetta不可用"
            )
        summary.update({
            "status": "PASS_X86_64_TIMELINE_VENEER_CONTRACT_ONLY",
            "officialExtensionSha256": EXPECTED_EXTENSION_SHA,
            "officialSkiaSha256": EXPECTED_SKIA_SHA,
            "binary": str(binary),
            "binarySha256": hash_file(binary),
            "runtimeContract": "PASS",
            "fullNativeCandidatePass": False,
        })
        (out_dir / "x86_64-veneer-summary.exit").write_text("0\n")
        (out_dir / "x86_64-veneer-summary.json").write_text(
            json.dumps(summary, indent=2) + "\n"
        )
        print(json.dumps(summary, indent=2))
        return 0
    except Exception as error:  # 失败也保留每个已结束命令的原始输出。
        summary["status"] = "FAIL"
        summary["error"] = str(error)
        (out_dir / "x86_64-veneer-summary.exit").write_text("1\n")
        summary_path.write_text(json.dumps(summary, indent=2) + "\n")
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
