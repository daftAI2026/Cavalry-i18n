"""[INPUT]: Intel281标题合同、同bundle Extension/fmt11与已链接候选。
[OUTPUT]: 核对标题符号、源对象/参数字节窗、唯一fmt11 import和two-level绑定。
[POS]: Intel目标构建后只读门；不运行或修改Cavalry。
[PROTOCOL]: 随标题合同及父级CLAUDE.md更新。
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

from x86_macho_contract import (
    cpp_byte_array, cpp_hex, cpp_string, macho_bytes_at, require, run,
    symbol_address, uuid_for_arch,
)
from macho_bindings import BindingRequirement, read_bindings, validate_bindings


def main() -> None:
    require(len(sys.argv) == 4, 'usage: check_title_contract.py FRAMEWORKS CANDIDATE OUT.json')
    frameworks, candidate, output = map(Path, sys.argv[1:])
    output.parent.mkdir(parents=True, exist_ok=True)
    header = (Path(__file__).parent / 'title_format_abi_contract.h').read_text()
    extension = frameworks / 'libExtensionLayer.dylib'
    fmt = frameworks / 'libfmt.11.dylib'
    for image, uuid_key, symbol_key, offset_key in (
        (extension, 'kExtensionUuid', 'kUpdateAppTitleSymbol', 'kUpdateAppTitleOffset'),
        (fmt, 'kFmtUuid', 'kVformatSymbol', 'kVformatOffset'),
    ):
        require(uuid_for_arch(image, 'x86_64') == cpp_string(header, uuid_key), f'{image.name}: UUID drift')
        require(symbol_address(image, cpp_string(header, symbol_key)) == cpp_hex(header, offset_key),
                f'{image.name}: symbol drift')
    windows = []
    for name in ('kCallerFrame', 'kSourceStringGetters', 'kSourceStringWindow',
                 'kFallbackValueWindow', 'kFormatValuesWindow', 'kCallSetup', 'kVformatImportStub'):
        expected = cpp_byte_array(header, name + 'Bytes')
        offset = cpp_hex(header, name + 'Offset')
        actual = macho_bytes_at(extension, offset, len(expected), output.parent)
        require(actual == expected, f'{name}: Intel title byte window drift')
        windows.append({'name': name, 'offset': hex(offset), 'bytes': len(expected)})
    entry = cpp_byte_array(header, 'kVformatEntryBytes')
    require(macho_bytes_at(fmt, cpp_hex(header, 'kVformatOffset'), len(entry), output.parent) == entry,
            'fmt11 vformat entry drift')
    call = cpp_hex(header, 'kVformatCallOffset')
    call_bytes = macho_bytes_at(extension, call, 5, output.parent)
    stub = cpp_hex(header, 'kVformatImportStubOffset')
    require(call_bytes[0] == 0xe8 and call + 5 + int.from_bytes(call_bytes[1:], 'little', signed=True) == stub,
            'title call must target the exact fmt11 stub')
    require(cpp_hex(header, 'kVformatReturnOffset') == call + 5, 'title return PC drift')
    stub_bytes = cpp_byte_array(header, 'kVformatImportStubBytes')
    got = cpp_hex(header, 'kVformatGotOffset')
    require(stub_bytes[:2] == b'\xff\x25' and
            stub + 6 + int.from_bytes(stub_bytes[2:], 'little', signed=True) == got,
            'fmt11 stub/GOT relationship drift')
    symbol = cpp_string(header, 'kVformatSymbol')
    fixups = run('dyld_info', '-arch', 'x86_64', '-fixups', str(extension))
    rows = [line for line in fixups.splitlines() if symbol in line]
    require(len(rows) == 1 and f'0x{got:08X}' in rows[0] and f'libfmt.11/{symbol}' in rows[0],
            'Extension must import vformat once from its own fmt11')
    errors = validate_bindings(read_bindings(candidate, 'x86_64'), [
        BindingRequirement(symbol, 'libfmt.11', ('__interpose', '__got')),
    ])
    require(not errors, '\n'.join(errors))
    for key, expected in (('kFormatString', b'Project: {} - Scene: {} {}\0'),
                          ('kRestrictedSuffix', b'- Restricted\0'), ('kEmptySuffix', b'\0')):
        require(macho_bytes_at(extension, cpp_hex(header, key + 'Offset'), len(expected), output.parent) == expected,
                f'{key}: source bytes drift')
    output.write_text(json.dumps({'target': '2.8.1', 'architecture': 'x86_64',
                                  'result': 'PASS_STATIC_NOT_LIVE', 'windows': windows}, indent=2) + '\n')
    print('PASS: Intel281 fmt11 title call, source layout, import and candidate binding')


if __name__ == '__main__':
    main()
