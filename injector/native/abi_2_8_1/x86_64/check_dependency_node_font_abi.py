#!/usr/bin/env python3
"""Read-only static audit for Cavalry 2.8.1 Intel NodeView/TextView ABI profile."""
from __future__ import annotations
import argparse
import ast
import hashlib
import json
import plistlib
import re
import subprocess
import sys
from pathlib import Path

SETTEXT_ASSIGN = '__ZNSt3__18functionIFNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEvEEaSIZN4lina8TextView7setTextERKS6_EUlvE_vEERS8_OT_'
VALUE_FUNC_SWAP = '__ZNSt3__110__function12__value_funcIFNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEvEE4swapB9nqe220106ERS9_'

# Every byte array currently present in the profile, bound to a code address.
WINDOWS = {
    'kTextViewPaintEntryWindow': (0x5be7a0, 'kTextViewPaintSymbol'),
    'kTextViewPaintReceiverStore': (0x5be7c2, 'kTextViewPaintSymbol'),
    'kTextViewPaintElideCall': (0x5be884, 'kTextViewPaintSymbol'),
    'kTextViewPaintDrawableCall': (0x5be8db, 'kTextViewPaintSymbol'),
    'kTextViewElideEntryWindow': (0x5bed30, 'kTextViewElideSymbol'),
    'kDrawablePaintEntryWindow': (0x4d57c0, 'kDrawablePaintSymbol'),
    'kDrawableParentLoadWindow': (0x51d8f, 'kDrawableParentGetterSymbol'),
    'kNodeViewVtableStoreWindow': (0x5c428f, 'kNodeViewConstructorSymbol'),
    'kNodeViewChildrenVectorWindow': (0x5c4620, 'kNodeViewConstructorSymbol'),
    'kOptionalDecorationCtorCall': (0x5c4596, 'kNodeViewConstructorSymbol'),
    'kOptionalDecorationChildPush': (0x5c4662, 'kNodeViewConstructorSymbol'),
    'kNameHeaderTextViewCtorCall': (0x5c46c9, 'kNodeViewConstructorSymbol'),
    'kNameHeaderChildPush': (0x5c4837, 'kNodeViewConstructorSymbol'),
    'kNameHeaderParentStore': (0x5c486d, 'kNodeViewConstructorSymbol'),
    'kTypeHeaderTextViewCtorCall': (0x5c48c4, 'kNodeViewConstructorSymbol'),
    'kTypeHeaderChildPush': (0x5c4a4f, 'kNodeViewConstructorSymbol'),
    'kTypeHeaderParentStore': (0x5c4a8c, 'kNodeViewConstructorSymbol'),
    'kComposerCtorCall': (0x5c4e0f, 'kNodeViewConstructorSymbol'),
    'kComposerChildPush': (0x5c4ecf, 'kNodeViewConstructorSymbol'),
    'kComposerParentStore': (0x5c4f0c, 'kNodeViewConstructorSymbol'),
    'kTextViewVtableStoreWindow': (0x5be664, 'kTextViewConstructorSymbol'),
    'kConstructorClosureVtableAndCaptureWindow': (0x5be6c4, 'kTextViewConstructorSymbol'),
    'kTextViewTargetPointerStore': (0x5be6ea, 'kTextViewConstructorSymbol'),
    'kNodeNameUpdateUsesTextViewFunction': (0x5cd180, 'kNodeNameUpdatedLambdaSymbol'),
}
CALL_WINDOWS = {
    'kMeasureCallWindows': ([0x5bedf8, 0x5bee49, 0x5bf079], 'kTextViewElideSymbol'),
    'kDrawCallWindows': ([0x4d5e2b, 0x4d5e76], 'kDrawablePaintSymbol'),
}
SYMBOL_OFFSET = {
    'kNodeViewConstructorSymbol': 'kNodeViewConstructorOffset',
    'kTextViewConstructorSymbol': 'kTextViewConstructorOffset',
    'kTextViewPaintSymbol': 'kTextViewPaintOffset',
    'kTextViewElideSymbol': 'kTextViewElideOffset',
    'kDrawablePaintSymbol': 'kDrawablePaintOffset',
    'kDrawableParentGetterSymbol': 'kDrawableParentGetterOffset',
    'kViewComposerConstructorSymbol': 'kViewComposerConstructorOffset',
    'kNodeNameUpdatedLambdaSymbol': 'kNodeNameUpdatedLambdaOffset',
    'kTextViewConstructorTargetInvokeSymbol': 'kTextViewConstructorTargetInvokeOffset',
    'kTextViewSetTextTargetInvokeSymbol': 'kTextViewSetTextTargetInvokeOffset',
    'kTextViewVtableSymbol': 'kTextViewVtableOffset',
    'kNodeViewVtableSymbol': 'kNodeViewVtableOffset',
    'kHeaderDecorationVtableSymbol': 'kHeaderDecorationVtableOffset',
    'kTextViewConstructorTargetVtableSymbol': 'kTextViewConstructorTargetVtableOffset',
    'kTextViewSetTextTargetVtableSymbol': 'kTextViewSetTextTargetVtableOffset',
}

class AuditError(RuntimeError):
    pass

def run(args: list[str]) -> str:
    p = subprocess.run(args, check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        raise AuditError(f"command failed ({p.returncode}): {' '.join(args)}\n{p.stderr.strip()}")
    return p.stdout

def header_string(header: str, name: str) -> str:
    m = re.search(rf'inline constexpr char\s+{re.escape(name)}\[\]\s*=\s*(.*?);', header, re.S)
    if not m:
        raise AuditError(f'missing C-string constant {name}')
    parts = re.findall(r'"(?:\\.|[^"\\])*"', m.group(1))
    if not parts:
        raise AuditError(f'cannot parse C-string constant {name}')
    return ''.join(ast.literal_eval(p) for p in parts)

def header_int(header: str, name: str) -> int:
    m = re.search(rf'\b{re.escape(name)}\s*=\s*(-?0x[0-9a-fA-F]+|-?\d+)\s*;', header)
    if not m:
        raise AuditError(f'missing literal integer constant {name}')
    return int(m.group(1), 0)

def header_int_array(header: str, name: str) -> list[int]:
    m = re.search(rf'\b{re.escape(name)}\s*=\s*\{{(.*?)\}}\s*;', header, re.S)
    if not m:
        raise AuditError(f'missing integer array {name}')
    return [int(x, 0) for x in re.findall(r'(?<![\w])(-?0x[0-9a-fA-F]+|-?\d+)(?![\w])', m.group(1))]

def header_bytes(header: str, name: str) -> list[int]:
    m = re.search(rf'\b{re.escape(name)}\s*=\s*\{{(.*?)\}}\s*;', header, re.S)
    if not m:
        raise AuditError(f'missing byte array {name}')
    return [int(x, 16) for x in re.findall(r'0x([0-9a-fA-F]{2})', m.group(1))]

def parse_nm(nm: str) -> dict[str, int]:
    symbols: dict[str, int] = {}
    for line in nm.splitlines():
        m = re.match(r'^([0-9a-fA-F]+)\s+\S\s+(\S+)$', line.strip())
        if m:
            symbols[m.group(2)] = int(m.group(1), 16)
    return symbols

def parse_disassembly(output: str) -> dict[int, tuple[list[int], str]]:
    instructions: dict[int, tuple[list[int], str]] = {}
    for line in output.splitlines():
        m = re.match(r'^\s*([0-9a-fA-F]+):\s+((?:[0-9a-fA-F]{2}\s+)+)(.*?)\s*$', line)
        if not m:
            continue
        address = int(m.group(1), 16)
        raw = [int(x, 16) for x in re.findall(r'[0-9a-fA-F]{2}', m.group(2))]
        instructions[address] = (raw, m.group(3))
    return instructions

def read_instruction_window(instructions: dict[int, tuple[list[int], str]], start: int, size: int) -> tuple[list[int], list[str]]:
    cur = start
    raw: list[int] = []
    disasms: list[str] = []
    while len(raw) < size:
        if cur not in instructions:
            raise AuditError(f'no decoded instruction at 0x{cur:x}')
        data, text = instructions[cur]
        if len(raw) + len(data) > size:
            raise AuditError(f'window ending at 0x{start + size:x} cuts instruction at 0x{cur:x}: {text}')
        raw.extend(data)
        disasms.append(text)
        cur += len(data)
    return raw, disasms

def check(frameworks: Path, profile: Path) -> dict[str, object]:
    frameworks = frameworks.resolve()
    profile = profile.resolve()
    extension = frameworks / 'libExtensionLayer.dylib'
    info_path = frameworks.parent / 'Info.plist'
    info = plistlib.loads(info_path.read_bytes())
    header = profile.read_text()
    if info.get('CFBundleShortVersionString') != '2.8.1':
        raise AuditError(f"official app version is {info.get('CFBundleShortVersionString')!r}, expected 2.8.1")
    archs = run(['lipo', '-archs', str(extension)]).strip().split()
    if not {'x86_64', 'arm64'}.issubset(archs):
        raise AuditError(f'ExtensionLayer is not universal: {archs}')
    extension_hash = hashlib.sha256(extension.read_bytes()).hexdigest()
    if header_string(header, 'kExtensionSha256') != extension_hash:
        raise AuditError(f'profile SHA-256 differs from ExtensionLayer: {extension_hash}')
    uuid_out = run(['dwarfdump', '--uuid', str(extension)])
    x86_uuid_match = re.search(r'UUID:\s*([0-9A-Fa-f-]+)\s+\(x86_64\)', uuid_out)
    if not x86_uuid_match:
        raise AuditError('x86_64 ExtensionLayer UUID is missing')
    x86_uuid = x86_uuid_match.group(1).upper()
    if header_string(header, 'kExtensionUuid') != x86_uuid:
        raise AuditError(f'profile x86_64 UUID differs from ExtensionLayer: {x86_uuid}')

    nm = parse_nm(run(['xcrun', 'llvm-nm', '-arch', 'x86_64', '-n', str(extension)]))
    for sym_key, off_key in SYMBOL_OFFSET.items():
        sym = header_string(header, sym_key)
        expected = header_int(header, off_key)
        if sym not in nm:
            raise AuditError(f'symbol absent from x86_64 nm: {sym}')
        if nm[sym] != expected:
            raise AuditError(f'{sym_key}: header=0x{expected:x}, nm=0x{nm[sym]:x}')

    dis_symbols = set(sym_key for _, sym_key in WINDOWS.values())
    dis_symbols.update(sym_key for _, sym_key in CALL_WINDOWS.values())
    dis_symbols.update(['kTextViewConstructorSymbol', 'kNodeNameUpdatedLambdaSymbol'])
    # Also inspect both closure invokers, setter assignment, and std::function's target-pointer swap.
    extra_symbols = {
        header_string(header, 'kTextViewConstructorTargetInvokeSymbol'),
        header_string(header, 'kTextViewSetTextTargetInvokeSymbol'),
        SETTEXT_ASSIGN,
        VALUE_FUNC_SWAP,
    }
    instructions_by_symbol: dict[str, dict[int, tuple[list[int], str]]] = {}
    for sym_key in dis_symbols:
        symbol = header_string(header, sym_key)
        instructions_by_symbol[symbol] = parse_disassembly(run([
            'xcrun', 'llvm-objdump', '--macho', '--arch=x86_64', '-d',
            '--dis-symname', symbol, str(extension),
        ]))
    for symbol in extra_symbols:
        instructions_by_symbol[symbol] = parse_disassembly(run([
            'xcrun', 'llvm-objdump', '--macho', '--arch=x86_64', '-d',
            '--dis-symname', symbol, str(extension),
        ]))

    for name, (offset, sym_key) in WINDOWS.items():
        symbol = header_string(header, sym_key)
        actual, _ = read_instruction_window(instructions_by_symbol[symbol], offset, len(header_bytes(header, name)))
        expected = header_bytes(header, name)
        if actual != expected:
            raise AuditError(f'{name} differs at 0x{offset:x}: header={bytes(expected).hex()}, actual={bytes(actual).hex()}')
    for name, (offsets, sym_key) in CALL_WINDOWS.items():
        symbol = header_string(header, sym_key)
        raw = header_bytes(header, name)
        if len(raw) != len(offsets) * 5:
            raise AuditError(f'{name} does not contain one five-byte call window per return offset')
        for index, offset in enumerate(offsets):
            expected = raw[index * 5:(index + 1) * 5]
            actual, _ = read_instruction_window(instructions_by_symbol[symbol], offset, 5)
            if actual != expected:
                raise AuditError(f'{name}[{index}] differs at 0x{offset:x}')

    measure_returns = header_int_array(header, 'kMeasureReturnOffsets')
    draw_returns = header_int_array(header, 'kDrawReturnOffsets')
    measure_call_offsets = CALL_WINDOWS['kMeasureCallWindows'][0]
    draw_call_offsets = CALL_WINDOWS['kDrawCallWindows'][0]
    if measure_returns != [offset + 5 for offset in measure_call_offsets]:
        raise AuditError(f'measure return-PC set differs from call windows: {measure_returns}')
    if draw_returns != [offset + 5 for offset in draw_call_offsets]:
        raise AuditError(f'draw return-PC set differs from call windows: {draw_returns}')
    if header_int(header, 'kTextViewElideReturnToPaintOffset') != 0x5be889 or \
       header_int(header, 'kDrawablePaintReturnToTextViewPaintOffset') != 0x5be8e0:
        raise AuditError('Lina direct-caller return PCs do not match the TextView::paint calls')
    if header_int(header, 'kTextViewElideCallOffset') != 0x5be884 or \
       header_int(header, 'kTextViewToDrawablePaintCallOffset') != 0x5be8db:
        raise AuditError('TextView::paint callsite constants differ from decoded call windows')

    # Setter/constructor source proof: both create the exact 32-byte libc++ __func object,
    # place its closure vtable at target+0, its captured string at target+8, then publish it
    # as TextView's std::function target at TextView+0x550. setText's swap uses function+0x20.
    ctor_instructions = instructions_by_symbol[header_string(header, 'kTextViewConstructorSymbol')]
    update_instructions = instructions_by_symbol[header_string(header, 'kNodeNameUpdatedLambdaSymbol')]
    ctor_invoke = instructions_by_symbol[header_string(header, 'kTextViewConstructorTargetInvokeSymbol')]
    setter_invoke = instructions_by_symbol[header_string(header, 'kTextViewSetTextTargetInvokeSymbol')]
    assign = instructions_by_symbol[SETTEXT_ASSIGN]
    swap = instructions_by_symbol[VALUE_FUNC_SWAP]
    extras = [
        ('NodeView name TextView field', update_instructions, 0x5cd13b, [0x49,0x8b,0x9e,0xb0,0x05,0x00,0x00]),
        ('setText function slot +0x530', update_instructions, 0x5cd180, [0x48,0x81,0xc3,0x30,0x05,0x00,0x00]),
        ('setText target vtable and closure +0x08', assign, 0x5cd250, [0x48,0x8d,0x05,0x61,0x5e,0xb2,0x00,0x49,0x89,0x06,0x4c,0x89,0xf7,0x48,0x83,0xc7,0x08]),
        ('setText short captured string copied to target +0x08', assign, 0x5cd267, [0x48,0x8b,0x45,0xa0,0x48,0x89,0x47,0x10,0x0f,0x28,0x45,0x90,0x0f,0x11,0x07]),
        ('TextView constructor publishes closure at +0x550', ctor_instructions, 0x5be6ea, [0x4c,0x89,0xb3,0x50,0x05,0x00,0x00]),
        ('setText std::function target slot +0x20', swap, 0x5cd514, [0x48,0x8b,0x7f,0x20,0x48,0x8b,0x46,0x20]),
        ('constructor closure reads captured libc++ string at target +0x08', ctor_invoke, 0x5bea80, [0xf6,0x46,0x08,0x01]),
        ('setText closure reads captured libc++ string at target +0x08', setter_invoke, 0x5cd480, [0xf6,0x46,0x08,0x01]),
    ]
    for label, insts, offset, expected in extras:
        actual, _ = read_instruction_window(insts, offset, len(expected))
        if actual != expected:
            raise AuditError(f'{label} differs at 0x{offset:x}: {bytes(actual).hex()}')

    # The optional leading decoration is selected by the DGLayoutNode's +0x30 type == 1.
    nodeview = instructions_by_symbol[header_string(header, 'kNodeViewConstructorSymbol')]
    layout_type_branch = [0x48,0x8b,0x48,0x30,0x48,0x83,0xf9,0x01]
    actual, _ = read_instruction_window(nodeview, 0x5c4485, len(layout_type_branch))
    if actual != layout_type_branch or header_int(header, 'kNodeViewOptionalDecorationLayoutTypeOffset') != 0x30:
        raise AuditError('NodeView optional-decoration layout-type field/branch differs')

    # Profile structural constants and frame facts used by the adapter.
    if header_int(header, 'kTextViewTextFunctionOffset') != 0x530 or header_int(header, 'kTextViewTextTargetPointerOffset') != 0x550:
        raise AuditError('TextView std::function / target pointer offsets changed')
    if header_int(header, 'kTextTargetStringOffset') != 0x08:
        raise AuditError('captured source string offset is not target+8')
    string_layout = {
        'kLibcxxStringObjectBytes': 24,
        'kLibcxxStringTagOffset': 0,
        'kLibcxxLongStringFlagMask': 1,
        'kLibcxxLongStringLengthOffset': 8,
        'kLibcxxLongStringDataOffset': 16,
        'kLibcxxShortStringDataOffset': 1,
        'kLibcxxShortStringLengthShift': 1,
        'kLibcxxShortStringCapacity': 22,
    }
    if any(header_int(header, key) != value for key, value in string_layout.items()):
        raise AuditError('x86 libc++ string size / short capacity differs')
    if header_int(header, 'kTextViewElideSavedThisOffset') != -0x10 or header_int(header, 'kDrawablePaintSavedThisOffset') != -0x10:
        raise AuditError('x86 caller-frame saved r14 slot is not fp-0x10')
    paint = instructions_by_symbol[header_string(header, 'kTextViewPaintSymbol')]
    elide = instructions_by_symbol[header_string(header, 'kTextViewElideSymbol')]
    drawable = instructions_by_symbol[header_string(header, 'kDrawablePaintSymbol')]
    for label, insts, address, expected_text in [
        ('TextView::paint assigns this to r14', paint, 0x5be7c2, 'movq\t%rdi, %r14'),
        ('TextView::elide pushes caller r14 in frame slot -0x10', elide, 0x5bed36, 'pushq\t%r14'),
        ('Drawable::paint pushes caller r14 in frame slot -0x10', drawable, 0x4d57c6, 'pushq\t%r14'),
    ]:
        if address not in insts or expected_text not in insts[address][1]:
            raise AuditError(f'frame receiver proof failed: {label}')

    return {
        'result': 'PASS',
        'bundleVersion': info.get('CFBundleShortVersionString'),
        'extensionFile': extension.name,
        'extensionSha256': extension_hash,
        'extensionUuidX86_64': x86_uuid,
        'extensionArchitectures': archs,
        'profileHeader': profile.name,
        'symbolAndVtableOffsetsChecked': len(SYMBOL_OFFSET),
        'completeInstructionByteWindowsChecked': len(WINDOWS) + sum(len(x[0]) for x in CALL_WINDOWS.values()),
        'checks': [
            'profile symbol/vtable offsets match x86_64 llvm-nm',
            'every profile byte window matches llvm-objdump and starts/ends on instruction boundaries',
            'NodeView vector, optional decoration, both header TextViews, and later ViewComposer match decoded instructions',
            'constructor and setText closures capture libc++ strings at target+0x08; TextView function/target offsets are +0x530/+0x550',
            'Measure/Draw return-PC sets follow decoded calls; optional decoration follows DGLayoutNode[+0x30] == 1',
            'TextView receiver is read from elideFP-0x10 and DrawableFP-0x10 without another frame walk',
        ],
        'readOnly': True,
    }

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('frameworks', type=Path, help='Cavalry.app/Contents/Frameworks')
    p.add_argument('out', type=Path, help='JSON receipt destination, or - for stdout')
    args = p.parse_args()
    try:
        profile = Path(__file__).with_name('dependency_node_font_abi_contract.h')
        result = check(args.frameworks, profile)
        serialized = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
        if str(args.out) == '-':
            sys.stdout.write(serialized)
        else:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(serialized)
            print(f"PASS: wrote {args.out}")
        return 0
    except (AuditError, OSError, KeyError) as e:
        print(f'FAIL: {e}', file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
