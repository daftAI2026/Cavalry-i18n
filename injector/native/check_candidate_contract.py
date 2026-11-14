"""
[INPUT]: 依赖候选源码、冻结表、Frameworks与LLVM候选Bind表。
[OUTPUT]: 核验225槽GetPath及字体/FPS/Graph/标题/Fast/Mesh ABI；聚合two-level绑定错误。
[POS]: 候选静态门；核GetPath精确veneer、source-bound文本与二进制ABI。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import json
import pathlib
import re
import struct
import subprocess
import sys
import tempfile

from getpath_mesh_source_contract import verify_mesh_getpath_contract
from getpath_toolhelp_source_contract import verify_toolhelp_source_contract
from macho_bindings import (
    BindingRequirement, read_bindings, validate_bindings,
    validate_no_flat_namespace,
)


def run(*command: str) -> str:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise SystemExit(f"命令失败: {' '.join(command)}\n{result.stderr}")
    return result.stdout


def source_instructions(source: str, symbol: str) -> list[str]:
    lines = source.splitlines()
    label = f"{symbol}:"
    start = next((index for index, raw in enumerate(lines)
                  if raw.split("//", 1)[0].strip() == label), None)
    if start is None:
        raise SystemExit(f"缺少固定veneer入口: {label}")
    instructions: list[str] = []
    for raw in lines[start + 1:]:
        line = raw.split("//", 1)[0].strip()
        if not line:
            continue
        if line.endswith(":"):
            instructions.append(line)
        else:
            instructions.append(" ".join(line.split()))
    return instructions


def compiled_function_lines(disassembly: str, symbol: str) -> list[str]:
    lines = disassembly.splitlines()
    label_pattern = re.compile(
        r"^\s*(?:[0-9a-fA-F]+\s+)?<?([_A-Za-z.$][_A-Za-z0-9.$]*)>?:\s*$")
    start = None
    for index, line in enumerate(lines):
        match = label_pattern.match(line)
        if match and match.group(1) == symbol:
            start = index + 1
            break
    if start is None:
        raise SystemExit(f"反汇编缺少指定函数: {symbol}")
    body: list[str] = []
    for line in lines[start:]:
        if label_pattern.match(line):
            break
        body.append(line)
    return body


def compiled_function_instructions(disassembly: str, symbol: str) -> list[str]:
    instructions: list[str] = []
    for line in compiled_function_lines(disassembly, symbol):
        match = re.match(r"^\s*[0-9a-fA-F]+\s+(.*)$", line)
        if match:
            instructions.append(" ".join(match.group(1).split()))
    if not instructions:
        raise SystemExit(f"指定函数没有机器指令: {symbol}")
    return instructions


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def disassembly_bytes(disassembly: str) -> dict[int, bytes]:
    instructions: dict[int, bytes] = {}
    for line in disassembly.splitlines():
        match = re.match(
            r"^\s*([0-9a-fA-F]+):\s*((?:[0-9a-fA-F]{2}\s+){4})", line)
        if match:
            instructions[int(match.group(1), 16)] = bytes.fromhex(match.group(2))
    return instructions


def bytes_at(instructions: dict[int, bytes], offset: int, length: int) -> bytes:
    if length % 4 != 0:
        raise ValueError("arm64指令范围必须按4字节对齐")
    return b"".join(instructions.get(offset + step, b"")
                    for step in range(0, length, 4))


def native_entry(root: pathlib.Path, relative: str, key: str) -> dict[str, object]:
    path = root / relative
    line = next((item.strip() for item in path.read_text().splitlines()
                 if f'"key":"{key}"' in item), None)
    if line is None:
        raise SystemExit(f"native语言源缺少键: {key}")
    try:
        return json.loads(line.rstrip(","))
    except json.JSONDecodeError as error:
        raise SystemExit(f"native语言源条目不是JSON: {key}: {error}") from error


def cpp_string(header: str, name: str) -> str:
    match = re.search(rf'{re.escape(name)}\[\]\s*=\s*"([^"]+)"', header)
    if match is None:
        raise SystemExit(f"ABI头缺少固定字符串: {name}")
    return match.group(1)


def cpp_hex(header: str, name: str) -> int:
    match = re.search(
        rf'{re.escape(name)}\s*=\s*(0x[0-9a-fA-F]+|[0-9]+)', header)
    if match is None:
        raise SystemExit(f"ABI头缺少固定偏移: {name}")
    return int(match.group(1), 0)


def cpp_byte_array(header: str, name: str) -> bytes:
    match = re.search(
        rf'{re.escape(name)}\s*=\s*\{{([^}}]+)\}}', header, re.DOTALL)
    if match is None:
        raise SystemExit(f"ABI头缺少固定机器码: {name}")
    return bytes(int(value, 16) for value in
                 re.findall(r'0x([0-9a-fA-F]{2})', match.group(1)))


def arm64_macho_bytes_at(
    image: pathlib.Path, offset: int, length: int, out_dir: pathlib.Path
) -> bytes:
    architectures = run("xcrun", "lipo", "-archs", str(image)).split()
    require("arm64" in architectures, f"映像缺少arm64 slice: {image.name}")
    with tempfile.TemporaryDirectory(prefix="fast-caller.", dir=out_dir) as temp:
        selected = image
        if len(architectures) > 1:
            selected = pathlib.Path(temp) / image.name
            run("xcrun", "lipo", "-thin", "arm64", "-output",
                str(selected), str(image))
        file_size = selected.stat().st_size
        with selected.open("rb") as stream:
            header = stream.read(32)
            require(len(header) == 32, f"Mach-O头不完整: {image.name}")
            magic, cpu_type = struct.unpack_from("<II", header)
            require(magic == 0xFEEDFACF and cpu_type == 0x0100000C,
                    f"arm64 Mach-O格式不匹配: {image.name}")
            command_count = struct.unpack_from("<I", header, 16)[0]
            cursor = 32
            text_segment = None
            for _ in range(command_count):
                stream.seek(cursor)
                command_header = stream.read(8)
                require(len(command_header) == 8,
                        f"Mach-O load command不完整: {image.name}")
                command, command_size = struct.unpack("<II", command_header)
                require(command_size >= 8 and cursor + command_size <= file_size,
                        f"Mach-O load command越界: {image.name}")
                if command == 0x19 and command_size >= 72:
                    stream.seek(cursor + 8)
                    name = stream.read(16).split(b"\0", 1)[0]
                    stream.seek(cursor + 24)
                    vm_address, vm_size, file_offset, file_bytes = struct.unpack(
                        "<QQQQ", stream.read(32))
                    if name == b"__TEXT":
                        text_segment = (vm_address, vm_size,
                                        file_offset, file_bytes)
                cursor += command_size
            require(text_segment is not None and
                    text_segment[0] == 0 and text_segment[2] == 0,
                    "Extension __TEXT必须从映像偏移0映射")
            require(offset + length <= text_segment[1] and
                    offset + length <= text_segment[3] and
                    offset + length <= file_size,
                    "Fast调用窗超出Extension __TEXT")
            stream.seek(offset)
            data = stream.read(length)
            require(len(data) == length, "Fast调用窗读取不完整")
            return data


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("用法: check_candidate_contract.py ROOT OUT_DIR FRAMEWORKS CANDIDATE")
    root, out_dir, frameworks, candidate = map(pathlib.Path, sys.argv[1:])
    root = root.resolve()
    out_dir = out_dir.resolve()
    frameworks = frameworks.resolve()
    candidate = candidate.resolve()
    source = root / "injector/native"
    main_source = (source / "native_font_candidate.mm").read_text()
    getpath = (source / "getpath_font_adapter.inc").read_text()
    owner = (source / "getpath_owner_adapter.h").read_text()
    getpath_abi = (source / "getpath_font_abi_contract.h").read_text()
    locale = (source / "native_locale_adapter.inc").read_text()
    verify_mesh_getpath_contract(root, source)
    verify_toolhelp_source_contract(root, source)
    snapshot = (source / "native_locale_snapshot.h").read_text()
    bindings = (source / "skia_original_bindings.inc").read_text()
    policy = (source / "getpath_font_policy.h").read_text()
    texts = (source / "getpath_font_texts.inc").read_text()
    graph_texts = (source / "getpath_graph_editor_empty_texts.inc").read_text()
    title_policy = (source / "title_format_policy.h").read_text()
    title_abi = (source / "title_format_abi_contract.h").read_text()
    title_adapter = (source / "title_format_adapter.inc").read_text()
    fast_abi = (source / "fast_search_unicode_abi_contract.h").read_text()
    fast_policy = (source / "fast_search_unicode_policy.h").read_text()
    fast_adapter = (source / "fast_search_unicode_adapter.mm").read_text()
    fast_test = (source / "fast_search_unicode_contract_test.cpp").read_text()
    build_script = (source / "build_candidate.sh").read_text()
    abi_probe_path = out_dir / "title-format-fmt10-abi.s"
    require(abi_probe_path.is_file(), "缺少已编译的fmt10 arm64 ABI探针")
    abi_probe = abi_probe_path.read_text()
    veneer_source = (source / "getpath_font_veneer.S").read_text()
    source_ops = source_instructions(veneer_source, "_getPathFontVeneer")
    expected_ops = ["mov x5, x30", "mov x6, x29", "b _getPathFontDispatch"]

    fast_symbol = cpp_string(fast_abi, "kConstructorSymbol")
    require(cpp_string(fast_abi, "kExtensionUuid") ==
            "448DD50E-75F4-3F2D-A46B-2C9F00DF9408" and
            cpp_string(fast_abi, "kQtVersion") == "6.9.2" and
            cpp_string(fast_abi, "kPattern") == r"[\\s\\-_\\W]" and
            fast_symbol ==
            "__ZN18QRegularExpressionC1ERK7QString6QFlagsINS_13PatternOptionEE" and
            cpp_hex(fast_abi, "kOptionsOffset") == 0x730f18 and
            cpp_hex(fast_abi, "kCallOffset") == 0x730f1c and
            cpp_hex(fast_abi, "kReturnOffset") == 0x730f20 and
            cpp_hex(fast_abi, "kImportStubOffset") == 0xdbcef4 and
            cpp_hex(fast_abi, "kConstructorOffset") == 0x2664c8 and
            cpp_hex(fast_abi, "kNoPatternOption") == 0 and
            cpp_hex(fast_abi, "kUnicodePropertiesOption") == 0x40 and
            cpp_byte_array(fast_abi, "kOptionsBytes") == bytes.fromhex("02 00 80 d2") and
            cpp_byte_array(fast_abi, "kCallBytes") == bytes.fromhex("f6 2f 1a 94"),
            "Fast C1固定ABI合同与已审阅arm64输入不一致")
    require("frameworksPathForExecutable" in fast_adapter and
            "_NSGetExecutablePath" in fast_adapter and
            "pthread_once" in fast_adapter and
            "gExpectedReturn" in fast_adapter and
            "pattern == QStringLiteral(\"[\\\\s\\\\-_\\\\W]\")" in fast_adapter and
            "options == abi::kNoPatternOption && exactPattern()" in fast_policy and
            "gOriginal.store(reinterpret_cast<Constructor>(constructor)" in fast_adapter and
            "initializeFastSearchAtLoad" in fast_adapter and
            "catch (" not in fast_adapter,
            "Fast适配必须短路精确caller门并保留原C1异常")
    require("patternChecked" in fast_test and
            "capture.options == abi::kUnicodePropertiesOption" in fast_test and
            "exceptionPropagated" in fast_test and
            len(fast_adapter.splitlines()) <= 300,
            "Fast合同测试或适配源不符合窄边界")
    require("CAVALRY_QT_PREFIX" in build_script and
            'QT_HEADERS="$QT_PREFIX/include"' in build_script and
            "QT_VERSION_PATCH 2" in build_script and
            '-F "$FRAMEWORKS_DIR" -framework QtCore -framework QtGui -framework QtWidgets' in build_script and
            "-Wl,-headerpad_max_install_names" in build_script and
            "-Wl,-rpath,@loader_path" in build_script and
            "-Wl,-rpath,@executable_path/../Frameworks" in build_script and
            "@rpath/QtCore.framework/Versions/A/QtCore" in build_script and
            "@rpath/QtGui.framework/Versions/A/QtGui" in build_script and
            "@rpath/QtWidgets.framework/Versions/A/QtWidgets" in build_script,
            "候选构建必须用显式6.9.2头并直链目标bundle QtCore/QtGui/QtWidgets")
    require(all(token not in fast_adapter for token in (
        "CAVALRY_I18N_", "getenv(", "unsetenv(", "/Users/luo/",
        "open(", "::write(", "ofstream")),
        "Fast产品适配不得读取测试配置或写运行诊断")

    extension_image = frameworks / "libExtensionLayer.dylib"
    qt_core_image = frameworks / "QtCore.framework/Versions/A/QtCore"
    qt_gui_image = frameworks / "QtGui.framework/Versions/A/QtGui"
    qt_widgets_image = frameworks / "QtWidgets.framework/Versions/A/QtWidgets"
    require(extension_image.is_file() and qt_core_image.is_file()
            and qt_gui_image.is_file() and qt_widgets_image.is_file(),
            "候选需要同bundle Extension、QtCore、QtGui与QtWidgets映像")
    frameworks_contract = {
        "libCore.dylib": "55C6FCB7-E0DA-3AC1-8C45-055CC6ECEAD9",
        "libExtensionLayer.dylib": "448DD50E-75F4-3F2D-A46B-2C9F00DF9408",
        "libskia.dylib": "E6258D2F-A1BB-3CEE-9DBA-6DB3BA0303D2",
        "libApi.dylib": "475E0957-00C1-325C-BC45-58D35DD5EB86",
        "libfmt.10.dylib": cpp_string(title_abi, "kFmtUuid"),
    }
    for filename, uuid in frameworks_contract.items():
        image = frameworks / filename
        require(image.is_file(), f"缺少同bundle ABI输入: {image}")
        uuid_report = run("xcrun", "dwarfdump", "--uuid", str(image))
        require(re.search(rf"^UUID: {re.escape(uuid)} \(arm64\)(?:\s|$)",
                          uuid_report, re.MULTILINE) is not None,
                f"{filename} arm64 UUID与候选ABI合同不匹配")

    archs = run("xcrun", "lipo", "-archs", str(candidate)).split()
    require(archs == ["arm64"], f"candidate架构必须只有arm64: {archs}")
    exported = run("xcrun", "nm", "-gU", str(candidate))
    required_exports = {
        "_timelineMeasureVeneer", "_timelineDrawVeneer",
        "_timelineMeasureDispatch", "_timelineDrawDispatch",
        "_viewportBlobVeneer", "_viewportBlobDispatch",
        "_getPathFontVeneer", "_getPathFontDispatch",
        "_nativeActiveLocaleInterpose",
        "_nativeTitleVformatInterpose",
        "_fastSearchUnicodeConstructorInterpose",
        "_nativeHelpLayoutActivateInterpose",
    }
    export_names = {line.split()[-1] for line in exported.splitlines() if line.split()}
    missing_exports = sorted(required_exports - export_names)
    require(not missing_exports, f"candidate缺少已验导出: {missing_exports}")

    veneer_disasm = run("xcrun", "otool", "-tvV", "-p", "_getPathFontVeneer",
                        str(candidate))
    compiled_ops = compiled_function_instructions(
        veneer_disasm, "_getPathFontVeneer")
    require(source_ops == expected_ops,
            f"源码veneer必须只有三条指令: {source_ops}")
    require(compiled_ops == expected_ops,
            f"编译veneer必须精确匹配三条指令: {compiled_ops}")

    load_flags = run("xcrun", "otool", "-hv", str(candidate))
    load_commands = run("xcrun", "otool", "-l", str(candidate))
    dependencies = run("xcrun", "otool", "-L", str(candidate))
    require("TWOLEVEL" in load_flags, "candidate未启用two-level namespace")
    require("@rpath/libApi.dylib" in dependencies and
            "@rpath/libskia.dylib" in dependencies and
            "@rpath/libfmt.10.dylib" in dependencies,
            "candidate必须以@rpath two-level导入Api、Skia与fmt10")
    require("@rpath/libCavalryNativeFontCandidate.dylib" in dependencies,
            "candidate install ID必须保持@rpath")
    require(str(frameworks) not in dependencies and str(root) not in dependencies,
            "candidate load command泄漏构建机路径")
    qt_dependencies = {
        "QtCore": ("@rpath/QtCore.framework/Versions/A/QtCore", qt_core_image),
        "QtGui": ("@rpath/QtGui.framework/Versions/A/QtGui", qt_gui_image),
        "QtWidgets": ("@rpath/QtWidgets.framework/Versions/A/QtWidgets", qt_widgets_image),
    }
    for name, (install_name, image) in qt_dependencies.items():
        rows = [line for line in dependencies.splitlines() if name in line]
        require(len(rows) == 1 and install_name in rows[0]
                and "current version 6.9.2" in rows[0],
                f"candidate必须只加载同bundle {name} 6.9.2")
        runtime_load = run("xcrun", "otool", "-arch", "arm64", "-L", str(image))
        require("current version 6.9.2" in runtime_load,
                f"所选bundle的{name}不是6.9.2运行时")
    require("@loader_path" in load_commands and
            "@executable_path/../Frameworks" in load_commands,
            "QtCore @rpath必须兼容同目录候选和外置预览候选")
    qt_constructor_rows = [
        line for line in run("xcrun", "nm", "-arch", "arm64", "-gU",
                             str(qt_core_image)).splitlines()
        if line.split() and line.split()[-1] == fast_symbol
    ]
    require(len(qt_constructor_rows) == 1 and
            int(qt_constructor_rows[0].split()[0], 16) ==
            cpp_hex(fast_abi, "kConstructorOffset"),
            "QtCore C1导出地址与固定6.9.2合同不同")

    call_window = arm64_macho_bytes_at(
        extension_image,
        cpp_hex(fast_abi, "kOptionsOffset"),
        cpp_hex(fast_abi, "kCallOffset") + 4 -
        cpp_hex(fast_abi, "kOptionsOffset"), out_dir)
    options_length = len(cpp_byte_array(fast_abi, "kOptionsBytes"))
    call_start = cpp_hex(fast_abi, "kCallOffset") - cpp_hex(fast_abi, "kOptionsOffset")
    call_bytes = call_window[call_start:call_start +
                             len(cpp_byte_array(fast_abi, "kCallBytes"))]
    require(call_window[:options_length] == cpp_byte_array(fast_abi, "kOptionsBytes") and
            call_bytes == cpp_byte_array(fast_abi, "kCallBytes"),
            "Extension Fast选项指令或C1调用字节与合同不同")
    fps_call_bytes = arm64_macho_bytes_at(
        extension_image,
        cpp_hex(getpath_abi, "kViewportFpsGetPathCallOffset"),
        len(cpp_byte_array(getpath_abi, "kViewportFpsGetPathCallBytes")), out_dir)
    require(fps_call_bytes == cpp_byte_array(
                getpath_abi, "kViewportFpsGetPathCallBytes"),
            "Extension FPS MakePathFromText调用字节与合同不同")
    graph_call_window = arm64_macho_bytes_at(
        extension_image,
        cpp_hex(getpath_abi, "kGraphEditorEmptyStateCallWindowOffset"),
        len(cpp_byte_array(getpath_abi, "kGraphEditorEmptyStateCallWindowBytes")),
        out_dir)
    expected_graph_call_window = cpp_byte_array(
        getpath_abi, "kGraphEditorEmptyStateCallWindowBytes")
    require(graph_call_window == expected_graph_call_window and
            cpp_hex(getpath_abi, "kGraphEditorEmptyStateMakePathCallOffset") ==
            cpp_hex(getpath_abi, "kGraphEditorEmptyStateCallWindowOffset") + 12 and
            cpp_hex(getpath_abi, "kGraphEditorEmptyStateProducerReturn") ==
            cpp_hex(getpath_abi, "kGraphEditorEmptyStateMakePathCallOffset") + 4 and
            graph_call_window[8:16] == bytes.fromhex("e0 c3 02 91 28 94 20 94"),
            "GraphEditor空状态MakePathFromText调用窗与arm64合同不同")
    graph_call_instruction = int.from_bytes(graph_call_window[12:16], "little")
    graph_call_immediate = graph_call_instruction & 0x03ffffff
    if graph_call_immediate & 0x02000000:
        graph_call_immediate -= 0x04000000
    make_path_stub_offset = cpp_hex(
        getpath_abi, "kMakePathFromTextImportStubOffset")
    require(cpp_hex(getpath_abi, "kGraphEditorEmptyStateMakePathCallOffset") +
            graph_call_immediate * 4 == make_path_stub_offset,
            "GraphEditor MakePath call没有到达已锁定的Extension import stub")
    make_path_symbol = cpp_string(getpath_abi, "kMakePathFromTextSymbol")
    make_path_imports = run("dyld_info", "-arch", "arm64", "-imports",
                            str(extension_image))
    require(re.search(rf"{re.escape(make_path_symbol)}\s+\(from libCore\)",
                      make_path_imports) is not None,
            "Extension没有从libCore导入MakePathFromText")
    instruction = int.from_bytes(call_bytes, "little")
    immediate = instruction & 0x03ffffff
    if immediate & 0x02000000:
        immediate -= 0x04000000
    require(cpp_hex(fast_abi, "kCallOffset") + immediate * 4 ==
            cpp_hex(fast_abi, "kImportStubOffset"),
            "Extension Fast C1调用没有到达锁定的import stub")

    locale_symbol = "__ZN7cavalry12activeLocaleEP3Api"
    skia_symbols = (
        "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath",
        "__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint",
        "__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint",
        "__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding",
    )
    bindings = read_bindings(candidate, "arm64")
    fmt_symbol = cpp_string(title_abi, "kVformatSymbol")
    binding_requirements = [
        BindingRequirement(locale_symbol, "libApi", ("__interpose", "__got")),
        *(BindingRequirement(symbol, "libskia", ("__interpose", "__got"))
          for symbol in skia_symbols),
        BindingRequirement(fmt_symbol, "libfmt.10", ("__interpose",)),
        BindingRequirement(fast_symbol, "QtCore", ("__interpose", "__got")),
        BindingRequirement("_qVersion", "QtCore", ()),
    ]
    binding_errors = validate_bindings(bindings, binding_requirements)
    binding_errors.extend(validate_no_flat_namespace(bindings))
    require(not binding_errors,
            "candidate required binding contract failed:\n  - " +
            "\n  - ".join(binding_errors))
    require(locale.count("kActiveLocaleGotOffset") == 1 and
            "extensionGotTargetsInterposer" in locale and
            "kActiveLocaleEntryOffset" in locale,
            "运行时必须核对原getter入口与Extension实际GOT")
    require("forwardNativeLocale" in main_source and
            "forwardNativeLocale" in snapshot and
            "noexcept" not in main_source.split(
                'extern "C" __attribute__((noinline)) std::string nativeActiveLocaleInterpose',
                1)[1].split("{", 1)[0],
            "native getter必须一次透传并允许原异常传播")
    require("forwardUnknownOwner(owner, forward)" in getpath and
            "forwardUnknownOwner" in owner,
            "GetPath未知owner必须走被测public透传核心")
    require("getpath_font_abi_contract.h" in main_source and
            "native_getpath::owner(" in getpath and
            "currentThreadStack()" in getpath and "readSelf(" in getpath,
            "GetPath owner必须复用既有栈帧与readSelf adapter")
    require("case native_locale::Locale::Unset:" in getpath and
            "case native_locale::Locale::English:" in getpath and
            "case native_locale::Locale::Unknown: return nullptr;" in getpath,
            "English与未知locale必须沿原路径透传，不选择GetPath文本lane")
    require("callerFrameRecord" in owner and
            "kViewportFpsProducerReturn" in owner and
            "kGraphEditorEmptyStateProducerReturn" in owner and
            "kCacheOwnerReturnOffset" in owner,
            "GetPath必须单读区分FPS/Graph直绘与旧缓存链")
    require("native_getpath_font::exactText(" in getpath and
            "native_getpath_font::viewportFpsText(" in getpath and
            "native_getpath_font::viewportFpsPrefix(locale)" in getpath and
            "const native_locale::Locale locale = gLocale.value()" in getpath and
            "getPathEntries(locale)" in getpath and
            "dispatchVerifiedText(" in getpath,
            "GetPath必须用唯一native locale lane及共享字体核心")
    require("kEntriesPerLocale = 75" in policy and
            "kMaxTextBytes = 512" in policy and
            "kMaxTextBytes" in getpath and
            "Owner::ViewportFps" in policy and
            len(re.findall(r"\{native_getpath_font::Owner::(?:ToolHelp|ViewportStatus),", texts)) == 225,
            "GetPath必须保留512上限和225条固定UI文本")
    graph_entries = re.findall(
        r'\{Owner::GraphEditorEmptyState,\s*"([^"\n]+)"\}', graph_texts)
    require(len(graph_entries) == 3 and set(graph_entries) == {
                "选择图层或属性以查看其关键帧",
                "選取圖層或屬性以檢視其關鍵幀",
                "レイヤーまたは属性を選択するとキーフレームが表示されます",
            } and "forwardUnapprovedGraphEditorEmptyText" in getpath and
            "exactGraphEditorEmptyText" in policy and
            "Owner::GraphEditorEmptyState" in getpath,
            "GraphEditor只能使用catalog批准的三语完整空状态文本")
    fps_entry = native_entry(
        root, "languages/native/remaining_global_ui_06.js", "viewport.fps")
    fps_rows = [line for line in (
        root / "languages/native/remaining_global_ui_06.js").read_text().splitlines()
        if '"key":"viewport.fps"' in line]
    fps_translations = fps_entry.get("translations", {})
    expected_fps = {
        "zh-Hans": "帧率：{0}",
        "zh-Hant": "幀率：{0}",
        "ja_JP": "フレームレート: {0}",
    }
    require(len(fps_rows) == 1 and fps_entry.get("source") == "FPS: {0}" and
            all(fps_translations.get(locale, {}).get("text") == value
                for locale, value in expected_fps.items()) and
            all(value[:-3] in policy for value in expected_fps.values()),
            "FPS前缀必须绑定唯一批准源与三语viewport.fps值")
    require("gLocale" in main_source and
            "gNativeLocaleSnapshot" not in main_source and
            "std::atomic<Locale> gLocale" not in main_source,
            "语言事实必须只保留一个native gLocale快照")
    require(title_adapter.count("original(format, arguments)") == 1 and
            "__builtin_return_address(0)" in title_adapter and
            "kVformatReturnOffset" in title_adapter and
            "kFormatDescriptor" in title_adapter and
            "kFormatStringLength" in title_adapter and
            "kFormatStringOffset" in title_adapter,
            "标题适配必须锁唯一LR、格式地址/长度、descriptor并只调用原vformat一次")
    original_call = title_adapter.index("original(format, arguments)")
    source_snapshot_call = title_adapter.index(
        "readTitleSourceStringSnapshots(arguments")
    first_try = title_adapter.find("    try {")
    require(source_snapshot_call < original_call and first_try > original_call and
            "catch (...)" in title_adapter[first_try:],
            "标题本地化异常只能在原fmt单次调用完成后回退；原异常必须传播")
    require("kProjectFallbackDistance = 0xe0" in title_abi and
            "kProjectFallbackLength = 4" in title_abi and
            "kSceneFallbackDistance = 0x100" in title_abi and
            "kSceneFallbackLength = 8" in title_abi and
            "isFallbackAt" in title_policy and
            "segmentEquals(source, projectOffset, \"None\")" in title_policy and
            "segmentEquals(source, sceneOffset, \"Untitled\")" in title_policy,
            "标题占位符必须校验真实fallback输入和占位文本")
    require("kProjectSourceObjectFromValues = 0xd8" in title_abi and
            "kSceneSourceObjectFromValues = 0xc0" in title_abi and
            "kLibCppStringObjectBytes = 24" in title_abi and
            "kLibCppShortLengthOffset = 23" in title_abi and
            "kFramePointerFromStackPointer = 0x220" in title_abi and
            "kFormatValuesFromStackPointer = 0x100" in title_abi and
            "kProjectSourceFromFramePointer = 0x48" in title_abi and
            "kSceneSourceFromFramePointer = 0x60" in title_abi and
            "isEmptyShortString" in title_policy and
            "readTitleSourceStringSnapshots" in title_adapter,
            "标题占位符还必须读取原caller的24字节libc++源对象")
    require(all(token in title_adapter for token in (
                "matchesCode(extension, title_contract::kCallerFrameOffset",
                "matchesCode(extension, title_contract::kSourceStringGettersOffset",
                "matchesCode(extension, title_contract::kSourceStringWindowOffset",
                "matchesCode(extension, title_contract::kFallbackValueWindowOffset",
                "matchesCode(extension, title_contract::kFormatValuesWindowOffset")),
            "运行时标题ABI门必须锁caller frame/getter/空值/fallback/参数布局")
    require("suffix" in title_adapter and "Restricted" in title_abi and
            "source.data() + sceneEnd" in title_policy,
            "标题适配必须保留原CString后缀与末尾字节")
    require("gLocale.value()" in title_adapter and
            "gTitleFormatContractReady" in title_adapter and
            "findMachOSymbol" in title_adapter and "readSelf(" in title_adapter,
            "标题适配必须复用唯一locale、已加载映像符号与只读快照")

    title_key_sources = (
        ("languages/native/remaining_global_ui_02.js", "colorWindow.header.project"),
        ("languages/native/remaining_global_ui_02.js", "colorWindow.header.scene"),
        ("languages/native/remaining_global_ui_01.js", "cli.log.none"),
        ("languages/native/remaining_global_ui_04.js", "recovery.untitled"),
    )
    title_translations: dict[str, dict[str, str]] = {}
    for relative, key in title_key_sources:
        entry = native_entry(root, relative, key)
        translations = entry.get("translations", {})
        title_translations[key] = {
            "zh-Hans": translations["zh-Hans"]["text"],
            "zh-Hant": translations["zh-Hant"]["text"],
            "ja_JP": translations["ja_JP"]["text"],
        }
        require(key in title_policy, f"标题策略未绑定approved native key: {key}")
        require(all(value in title_policy for value in title_translations[key].values()),
                f"标题策略与native翻译源不一致: {key}")

    fmt_image = frameworks / "libfmt.10.dylib"
    title_call = run("xcrun", "llvm-objdump", "--macho", "--arch=arm64",
                      "--disassemble-symbols=__ZN3Gui14updateAppTitleEv",
                      str(extension_image))
    fmt_disassembly = run("xcrun", "llvm-objdump", "--macho", "--arch=arm64",
                          "--disassemble-symbols=" + cpp_string(title_abi, "kVformatSymbol"),
                          str(fmt_image))
    extension_bytes = bytes_at(
        disassembly_bytes(title_call), cpp_hex(title_abi, "kCallSetupOffset"),
        len(cpp_byte_array(title_abi, "kCallSetupBytes")))
    caller_frame_bytes = bytes_at(
        disassembly_bytes(title_call), cpp_hex(title_abi, "kCallerFrameOffset"),
        len(cpp_byte_array(title_abi, "kCallerFrameBytes")))
    source_getter_bytes = bytes_at(
        disassembly_bytes(title_call),
        cpp_hex(title_abi, "kSourceStringGettersOffset"),
        len(cpp_byte_array(title_abi, "kSourceStringGettersBytes")))
    source_string_bytes = bytes_at(
        disassembly_bytes(title_call),
        cpp_hex(title_abi, "kSourceStringWindowOffset"),
        len(cpp_byte_array(title_abi, "kSourceStringWindowBytes")))
    fallback_value_bytes = bytes_at(
        disassembly_bytes(title_call),
        cpp_hex(title_abi, "kFallbackValueWindowOffset"),
        len(cpp_byte_array(title_abi, "kFallbackValueWindowBytes")))
    format_values_bytes = bytes_at(
        disassembly_bytes(title_call),
        cpp_hex(title_abi, "kFormatValuesWindowOffset"),
        len(cpp_byte_array(title_abi, "kFormatValuesWindowBytes")))
    fmt_bytes = bytes_at(
        disassembly_bytes(fmt_disassembly), cpp_hex(title_abi, "kVformatOffset"),
        len(cpp_byte_array(title_abi, "kVformatEntryBytes")))
    require(extension_bytes == cpp_byte_array(title_abi, "kCallSetupBytes"),
            "真实Gui::updateAppTitle fmt调用序列与arm64合同不同")
    require(caller_frame_bytes == cpp_byte_array(title_abi, "kCallerFrameBytes"),
            "真实标题caller frame与arm64合同不同")
    require(source_getter_bytes == cpp_byte_array(
                title_abi, "kSourceStringGettersBytes"),
            "真实标题原始project/scene getter与arm64合同不同")
    require(source_string_bytes == cpp_byte_array(title_abi, "kSourceStringWindowBytes"),
            "真实标题源字符串对象/空值分支与arm64合同不同")
    require(fallback_value_bytes == cpp_byte_array(
                title_abi, "kFallbackValueWindowBytes"),
            "真实标题fallback值构造与arm64合同不同")
    require(format_values_bytes == cpp_byte_array(
                title_abi, "kFormatValuesWindowBytes"),
            "真实标题fmt参数栈布局与arm64合同不同")
    require(fmt_bytes == cpp_byte_array(title_abi, "kVformatEntryBytes"),
            "真实libfmt.10 vformat导出入口与arm64合同不同")
    fmt_load = run("xcrun", "otool", "-L", str(fmt_image))
    require("current version 10.2.1" in fmt_load,
            "fmt输入不是锁定的10.2.1运行时映像")

    probe_match = re.search(
        r"(?ms)^_titleFormatAbiProbe:.*?^\s*\.cfi_endproc", abi_probe)
    require(probe_match is not None, "clang ABI探针缺少titleFormatAbiProbe函数")
    probe_body = probe_match.group(0)
    require(all(token in probe_body for token in (
        "mov\tx9, x8", "stur\tx0", "stur\tx1", "str\tx2", "str\tx3",
        "ldr\tx0", "ldr\tx1", "ldr\tx2", "ldr\tx3",
        "bl\t" + fmt_symbol)),
        "clang ABI探针未证明sret x8、borrowed view x0/x1和args x2/x3")

    require(all(token not in main_source + getpath + locale + texts + title_adapter +
                title_policy + title_abi for token in (
        "CAVALRY_I18N_", "getenv(", "unsetenv(", "portable_test_config.h",
        "/Users/luo/", "open(", "::write(", "receipt")),
        "产品源不得包含canary配置或诊断落盘")
    require(len(main_source.splitlines()) <= 800,
            f"native_font_candidate.mm超出800行: {len(main_source.splitlines())}")

    checks = [
        "PASS: 5 input image arm64 UUID contracts, including fmt 10.2.1",
        "PASS: arm64-only candidate and 11 required exports",
        "PASS: source and compiled GetPath veneer exact three instructions",
        "PASS: activeLocale Api, four Skia and fmt vformat two-level fixups",
        "PASS: Fast C1 and help layout use selected Qt 6.9.2 two-level imports",
        "PASS: Extension Fast option/call bytes and C1 import-stub branch match",
        "PASS: runtime original-entry and Extension GOT gates",
        "PASS: native getter once/exception and GetPath unknown-owner source gates",
        "PASS: exact FPS direct caller bytes and two-return owner contract",
        "PASS: exact GraphEditor caller bytes, direct frame owner and three full strings",
        "PASS: one gLocale, 512-byte GetPath cap, 225 source-bound UI strings",
        "PASS: exact Gui::updateAppTitle caller, format pointer/length and descriptor",
        "PASS: fmt10 ABI probe matches sret x8, format view x0/x1, args x2/x3",
        "PASS: title projection uses catalog labels and source-empty plus fallback guards",
        "PASS: caller frame, project/scene getters, empty branches, fallback values and fmt stack windows match",
        "PASS: no canary configuration or diagnostic persistence in candidate source",
    ]
    report = out_dir / "candidate-contract-checks.txt"
    report.write_text("\n".join(checks) + "\n")

    title_abi_report = {
        "scope": "static-arm64-only; no app launch or runtime GUI evidence",
        "extension": {
            "uuid": cpp_string(title_abi, "kExtensionUuid"),
            "caller": cpp_string(title_abi, "kUpdateAppTitleSymbol"),
            "callerOffset": f"0x{cpp_hex(title_abi, 'kUpdateAppTitleOffset'):x}",
            "fmtCallOffset": f"0x{cpp_hex(title_abi, 'kVformatCallOffset'):x}",
            "returnPc": f"0x{cpp_hex(title_abi, 'kVformatReturnOffset'):x}",
            "formatPointerOffset": f"0x{cpp_hex(title_abi, 'kFormatStringOffset'):x}",
            "formatLength": cpp_hex(title_abi, "kFormatStringLength"),
            "descriptor": f"0x{cpp_hex(title_abi, 'kFormatDescriptor'):x}",
            "callSetupBytes": extension_bytes.hex(" "),
            "callerFrameOffset":
                f"0x{cpp_hex(title_abi, 'kCallerFrameOffset'):x}",
            "callerFrameBytes": caller_frame_bytes.hex(" "),
            "sourceGettersOffset":
                f"0x{cpp_hex(title_abi, 'kSourceStringGettersOffset'):x}",
            "sourceGettersBytes": source_getter_bytes.hex(" "),
            "sourceStringWindowOffset":
                f"0x{cpp_hex(title_abi, 'kSourceStringWindowOffset'):x}",
            "sourceStringWindowBytes": source_string_bytes.hex(" "),
            "fallbackValueWindowOffset":
                f"0x{cpp_hex(title_abi, 'kFallbackValueWindowOffset'):x}",
            "fallbackValueWindowBytes": fallback_value_bytes.hex(" "),
            "formatValuesWindowOffset":
                f"0x{cpp_hex(title_abi, 'kFormatValuesWindowOffset'):x}",
            "formatValuesWindowBytes": format_values_bytes.hex(" "),
        },
        "fmt": {
            "arm64Uuid": cpp_string(title_abi, "kFmtUuid"),
            "version": "10.2.1",
            "export": fmt_symbol,
            "exportOffset": f"0x{cpp_hex(title_abi, 'kVformatOffset'):x}",
            "entryBytes": fmt_bytes.hex(" "),
            "twoLevelImport": True,
        },
        "compiledAbiProbe": {
            "source": "injector/native/candidate_contract_test.cpp",
            "commandMode": "clang++ -std=c++17 -arch arm64 -O0 -fno-optimize-sibling-calls",
            "assembly": abi_probe_path.name,
            "hiddenStringResult": "x8",
            "formatStringView": "x0/x1",
            "formatArguments": "x2/x3",
            "types": "16-byte trivially-copyable borrowed view and descriptor/pointer pair",
        },
        "sourceStringEmptiness": {
            "layout": "24-byte libc++ string object snapshot",
            "shortLengthTagOffset": cpp_hex(title_abi, "kLibCppShortLengthOffset"),
            "emptyShortTag": 0,
            "framePointerFromCallStackPointer":
                f"0x{cpp_hex(title_abi, 'kFramePointerFromStackPointer'):x}",
            "formatValuesFromCallStackPointer":
                f"0x{cpp_hex(title_abi, 'kFormatValuesFromStackPointer'):x}",
            "projectObjectFromFramePointer":
                f"-0x{cpp_hex(title_abi, 'kProjectSourceFromFramePointer'):x}",
            "sceneObjectFromFramePointer":
                f"-0x{cpp_hex(title_abi, 'kSceneSourceFromFramePointer'):x}",
            "projectObjectOffsetFromFormatValues":
                f"0x{cpp_hex(title_abi, 'kProjectSourceObjectFromValues'):x}",
            "sceneObjectOffsetFromFormatValues":
                f"0x{cpp_hex(title_abi, 'kSceneSourceObjectFromValues'):x}",
            "projectFallbackAlsoRequiresPointerAndExactText": True,
            "sceneFallbackAlsoRequiresPointerAndExactText": True,
            "dynamicShortNoneAndUntitledRemainNames": True,
        },
        "translations": title_translations,
        "liveAcceptance": False,
    }
    title_abi_report_path = out_dir / "title-format-abi-proof.json"
    title_abi_report_path.write_text(
        json.dumps(title_abi_report, ensure_ascii=False, indent=2) + "\n")
    print("\n".join(checks))
    print(f"REPORT: {report}")
    print(f"TITLE_ABI_PROOF: {title_abi_report_path}")


if __name__ == "__main__":
    main()
