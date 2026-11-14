#!/usr/bin/env python3
"""[INPUT]: Official Cavalry 2.8.1 arm64 ExtensionLayer and this slice's ABI contract.
[OUTPUT]: Read-only vendor windows and profile checks; header indices describe the final live layout.
[POS]: Dependency Graph NodeView header text owner proof; never launches or edits Cavalry.
[PROTOCOL]: Update with the ABI contract, then check CLAUDE.md.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import Path


EXPECTED_VERSION = "2.8.1"
EXPECTED_UUID = "AF1367BD-2D7E-3EC0-A111-935E4881C655"
EXPECTED_SHA256 = "497ece2fa123a339c086e7925cc3ecb51898cf1ec1a283007f06631936b15050"
DEFAULT_APP = Path("/Applications/Cavalry.app")

SYMBOL_CONSTANTS = {
    "kNodeViewConstructorSymbol": 0x558DA0,
    "kTextViewConstructorSymbol": 0x553908,
    "kTextViewPaintSymbol": 0x553A94,
    "kTextViewElideSymbol": 0x553FB4,
    "kDrawablePaintSymbol": 0x4778B4,
    "kDrawableParentGetterSymbol": 0x4F894,
    "kViewComposerConstructorSymbol": 0x55B5F0,
    "kInOutViewConstructorSymbol": 0x55B7A0,
    "kNodeNameUpdatedLambdaSymbol": 0x560C10,
    "kTextViewSetTextTargetCallSymbol": 0x560D4C,
    "kTextViewConstructorTargetInvokeSymbol": 0x553D80,
    "kTextViewSetTextTargetInvokeSymbol": 0x560FE8,
    "kNodeViewVtableSymbol": 0xFECFB8,
    "kHeaderDecorationVtableSymbol": 0xFED000,
    "kTextViewVtableSymbol": 0xFEC9D0,
    "kTextViewConstructorTargetVtableSymbol": 0xFECA18,
    "kTextViewSetTextTargetVtableSymbol": 0xFED4A0,
}

OFFSET_CONSTANTS = {
    "kNodeViewConstructorOffset": 0x558DA0,
    "kNodeViewVtableOffset": 0xFECFB8,
    "kHeaderDecorationVtableOffset": 0xFED000,
    "kTextViewConstructorOffset": 0x553908,
    "kTextViewVtableOffset": 0xFEC9D0,
    "kTextViewConstructorTargetVtableOffset": 0xFECA18,
    "kTextViewSetTextTargetVtableOffset": 0xFED4A0,
    "kTextViewConstructorTargetInvokeOffset": 0x553D80,
    "kTextViewSetTextTargetInvokeOffset": 0x560FE8,
    "kDrawableParentGetterOffset": 0x4F894,
    "kTextViewPaintFrameSetupOffset": 0x553AA0,
    "kTextViewElideFrameSetupOffset": 0x553FD0,
    "kDrawablePaintFrameSetupOffset": 0x4778C8,
    "kNodeViewChildrenVectorOffset": 0x260,
    "kNodeViewChildrenBeginOffset": 0x260,
    "kNodeViewChildrenEndOffset": 0x268,
    "kNodeViewChildrenCapacityOffset": 0x270,
    "kNodeViewNameHeaderChildIndex": 0,
    "kNodeViewTypeHeaderChildIndex": 1,
    "kDrawableParentPointerOffset": 0x2A8,
    "kTextViewTextFunctionOffset": 0x480,
    "kTextViewTextTargetPointerOffset": 0x498,
    "kTextTargetStringOffset": 0x08,
    "kLibcxxStringObjectBytes": 0x18,
    "kLibcxxStringTagOffset": 0x17,
    "kLibcxxShortStringCapacity": 22,
    "kTextViewElideSavedThisOffset": -0x10,
    "kDrawablePaintSavedThisOffset": -0x10,
    "kNodeViewNameHeaderTextViewCtorCallOffset": 0x559198,
    "kNodeViewNameHeaderChildPushOffset": 0x5592B0,
    "kNodeViewNameHeaderParentStoreOffset": 0x5592D8,
    "kNodeViewTypeHeaderTextViewCtorCallOffset": 0x559318,
    "kNodeViewTypeHeaderChildPushOffset": 0x559434,
    "kNodeViewTypeHeaderParentStoreOffset": 0x55945C,
    "kNodeViewFirstDrawableChildPushOffset": 0x559150,
    "kNodeViewNestedTextViewCtorCallOffset": 0x559678,
    "kNodeViewInOutViewMakeCallOffset": 0x559700,
    "kNodeViewComposerCtorCallOffset": 0x55971C,
    "kNodeViewComposerChildPushOffset": 0x559780,
    "kNodeViewComposerParentStoreOffset": 0x5597A8,
    "kViewComposerTextChildParentStoreOffset": 0x55B6C4,
    "kTextViewElideCallOffset": 0x553B68,
    "kTextViewToDrawablePaintCallOffset": 0x553BCC,
    "kTextViewElideReturnToPaintOffset": 0x553B6C,
    "kDrawablePaintReturnToTextViewPaintOffset": 0x553BD0,
}

BYTE_WINDOWS = {
    0x559078: "280800b4",  # Empty layout entry skips the optional leading decoration.
    0x4F8E4: "945641f9",  # Drawable::getGlobalTransformMatrix: load parent at +0x2a8
    0x4778C8: "fd7b1ca9",  # Drawable::paint saves fp/lr
    0x4778CC: "fd030791",  # Drawable::paint establishes frame
    0x4778D4: "f40300aa",  # Drawable::paint saves receiver in x20
    0x477E14: "d7af2294",  # SimpleText fill call
    0x477E18: "88e24739",  # fill return
    0x477E54: "c7af2294",  # SimpleText stroke call
    0x477E58: "a00357f8",  # stroke return
    0x553970: "c85400b0",  # TextView vtable symbol page
    0x553974: "08412791",  # TextView vtable + 0x9d0
    0x55397C: "08410091",  # TextView vtable address point + 0x10
    0x553980: "080000f9",  # store TextView vptr
    0x5539C0: "c95400b0",  # constructor closure vtable page
    0x5539C4: "29a12891",  # closure vtable + 0xa18
    0x5539CC: "098500f8",  # store closure vptr
    0x5539D8: "e003c03d",  # capture std::string at target + 8
    0x5539DC: "0001803d",
    0x5539E0: "e90b40f9",
    0x5539E4: "090900f9",
    0x553AB0: "004c42f9",  # TextView::paint loads std::function target from +0x498
    0x553AA0: "f44f06a9",  # TextView::paint saves caller x20 at fp-0x10
    0x553AA4: "fd7b07a9",
    0x553AA8: "fdc30191",
    0x553AAC: "f40300aa",  # then sets active TextView receiver in x20
    0x553AC0: "091940f9",  # closure vtable invocation slot
    0x553AC8: "20013fd6",  # invoke closure
    0x553B68: "13010094",  # elideTextToWidth call
    0x553B6C: "889ecb39",  # returned to TextView::paint
    0x553BCC: "3a8ffc97",  # Drawable::paint call
    0x553BD0: "fd7b47a9",  # saved return chain back to TextView::paint
    0x553D80: "097cc039",  # constructor closure capture string tag
    0x553D88: "0080c03c",  # constructor closure string at +8
    0x553D8C: "0001803d",
    0x553D90: "098041f8",
    0x553D94: "090900f9",
    0x553FD0: "f44f13a9",  # elideTextToWidth saves active TextView receiver x20
    0x553FD4: "fd7b14a9",
    0x553FD8: "fd030591",  # establishes FP; saved receiver is at fp-0x10
    0x554054: "9b481f94",  # full string measure
    0x55409C: "89481f94",  # elided-prefix measure
    0x554244: "1f481f94",  # ellipsis measure
    0x558E48: "a8540090",  # NodeView vtable page
    0x558E4C: "08e13e91",  # NodeView vtable + 0xfb8
    0x558E50: "08410091",  # NodeView vtable address point + 0x10
    0x558E54: "080000f9",  # store NodeView vptr
    0x559150: "008500f8",  # first Drawable child
    0x559120: "69820991",  # NodeView child vector starts at +0x260
    0x559128: "683641f9",  # NodeView vector end at +0x268
    0x559130: "6a3a41f9",  # NodeView vector capacity at +0x270
    0x559198: "dce9ff97",  # first direct header TextView constructor
    0x5592B0: "198500f8",  # push name header at child index 1
    0x5592D8: "135501f9",  # parent pointer at child + 0x2a8
    0x559318: "7ce9ff97",  # second direct header TextView constructor
    0x559434: "198500f8",  # push type header at child index 2
    0x55945C: "135501f9",  # parent pointer at child + 0x2a8
    0x559678: "a4e8ff97",  # nested InOut TextView constructor
    0x559700: "56040094",  # wrap nested text and InOutView
    0x55971C: "b5070094",  # ViewComposer constructor
    0x559780: "148500f8",  # push ViewComposer, not its nested TextView
    0x5597A8: "135501f9",  # NodeView parent on ViewComposer
    0x55B670: "16800991",  # ViewComposer inherited child vector starts at +0x260
    0x55B674: "083441f9",  # ViewComposer inherited vector end at +0x268
    0x55B67C: "093841f9",  # ViewComposer inherited vector capacity at +0x270
    0x55B6C0: "09815ff8",  # load the most recently pushed child
    0x55B6C4: "335501f9",  # set its Drawable parent at +0x2a8
    0x560C98: "97051f94",  # dynamic name update gets current niceName
    0x560CC4: "80021291",  # updates TextView+0x480 std::function
    0x560CCC: "20000094",  # std::function assignment creates setText closure
    0x560DA8: "685400b0",  # setText target vtable page
    0x560DAC: "08c11291",  # setText target vtable + 0x4a0
    0x560DB0: "088400f8",  # store setText target vptr
    0x560DBC: "e003c03d",  # setText capture std::string at target + 8
    0x560DC0: "0000803d",
    0x560DC4: "e80b40f9",
    0x560DC8: "080800f9",
    0x560FE8: "097cc039",  # updated closure capture string tag
    0x560FF0: "0080c03c",  # updated closure string at +8
    0x560FF4: "0001803d",
    0x560FF8: "098041f8",
    0x560FFC: "090900f9",
}


class CheckError(RuntimeError):
    pass


def run(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    except OSError as error:
        raise CheckError(f"could not run {command[0]}: {error}") from error
    if result.returncode != 0:
        details = result.stderr.strip() or result.stdout.strip()
        raise CheckError(f"command failed ({result.returncode}): {' '.join(command)}\n{details}")
    return result.stdout


def parse_nm(output: str) -> dict[str, int]:
    symbols: dict[str, int] = {}
    for line in output.splitlines():
        fields = line.split()
        if len(fields) >= 2 and re.fullmatch(r"[0-9a-fA-F]+", fields[0]):
            symbols[fields[-1]] = int(fields[0], 16)
    return symbols


def parse_instructions(output: str) -> dict[int, str]:
    instructions: dict[int, str] = {}
    for line in output.splitlines():
        match = re.match(r"^\s*([0-9a-fA-F]+):\s+((?:[0-9a-fA-F]{2}\s+){3}[0-9a-fA-F]{2})(?:\s|$)", line)
        if match:
            instructions[int(match.group(1), 16)] = "".join(match.group(2).split()).lower()
    return instructions


def header_string(header: str, name: str) -> str:
    match = re.search(rf"\b{name}\[\]\s*=\s*\"([^\"]+)\"\s*;", header)
    if not match:
        raise CheckError(f"missing header string constant {name}")
    return match.group(1)


def header_offset(header: str, name: str) -> int:
    match = re.search(rf"\b{name}\s*=\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*;", header)
    if not match:
        raise CheckError(f"missing header offset constant {name}")
    return int(match.group(1), 0)


def check_bundle(app: Path, extension: Path) -> None:
    if not app.is_dir():
        raise CheckError(f"app bundle not found: {app}")
    if not extension.is_file():
        raise CheckError(f"ExtensionLayer not found: {extension}")

    header_path = Path(__file__).parent / "abi_2_8_1/dependency_node_font_abi_contract.h"
    header = header_path.read_text(encoding="utf-8")
    if EXPECTED_UUID not in header or EXPECTED_SHA256 not in header:
        raise CheckError("the ABI contract's pinned vendor UUID or SHA-256 changed")

    version = run(["/usr/libexec/PlistBuddy", "-c", "Print :CFBundleShortVersionString",
                   str(app / "Contents/Info.plist")]).strip()
    if version != EXPECTED_VERSION:
        raise CheckError(f"expected Cavalry {EXPECTED_VERSION}, found {version}")

    uuid_output = run(["dwarfdump", "--uuid", str(extension)])
    arm_uuid = re.search(r"UUID:\s*([0-9A-Fa-f-]+)\s+\(arm64\)", uuid_output)
    if not arm_uuid or arm_uuid.group(1).upper() != EXPECTED_UUID:
        raise CheckError(f"arm64 ExtensionLayer UUID mismatch: {arm_uuid.group(1) if arm_uuid else 'missing'}")
    digest_state = hashlib.sha256()
    with extension.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest_state.update(chunk)
    digest = digest_state.hexdigest()
    if digest != EXPECTED_SHA256:
        raise CheckError(f"ExtensionLayer SHA-256 mismatch: {digest}")

    nm = run(["xcrun", "llvm-nm", "--arch=arm64", "-nm", str(extension)])
    symbols = parse_nm(nm)
    for constant, expected_address in SYMBOL_CONSTANTS.items():
        symbol = header_string(header, constant)
        actual_address = symbols.get(symbol)
        if actual_address != expected_address:
            rendered = "missing" if actual_address is None else f"0x{actual_address:x}"
            raise CheckError(f"{constant} resolves to {rendered}, expected 0x{expected_address:x}")

    for constant, expected_offset in OFFSET_CONSTANTS.items():
        actual_offset = header_offset(header, constant)
        if actual_offset != expected_offset:
            raise CheckError(f"{constant} is 0x{actual_offset:x}, expected 0x{expected_offset:x}")

    targeted_symbols = {header_string(header, name) for name in SYMBOL_CONSTANTS}
    targeted_symbols.update({
        "__ZNSt3__110__function6__funcIZN4lina8TextViewC1ERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEclEv",
        "__ZNSt3__110__function6__funcIZN4lina8TextView7setTextERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEEUlvE_FS9_vEEclEv",
    })
    disassembled: dict[int, str] = {}
    for symbol in targeted_symbols:
        output = run(["xcrun", "llvm-objdump", "--macho", "--arch=arm64", "--disassemble",
                      "--dis-symname", symbol, str(extension)])
        disassembled.update(parse_instructions(output))
    for address, expected_bytes in BYTE_WINDOWS.items():
        actual_bytes = disassembled.get(address)
        if actual_bytes != expected_bytes:
            rendered = "missing" if actual_bytes is None else actual_bytes
            raise CheckError(f"instruction at 0x{address:x} is {rendered}, expected {expected_bytes}")

    print(f"PASS: Cavalry {version} arm64 ExtensionLayer {EXPECTED_UUID}")
    print(f"PASS: SHA-256 {digest}")
    print(f"PASS: {len(SYMBOL_CONSTANTS)} symbols, {len(OFFSET_CONSTANTS)} offsets, "
          f"{len(BYTE_WINDOWS)} targeted instruction windows")
    print("PASS: NodeView child order, both TextView closure producers, measure/fill/stroke frames")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=DEFAULT_APP,
                        help="official Cavalry 2.8.1 app bundle (default: /Applications/Cavalry.app)")
    parser.add_argument("--extension", type=Path,
                        help="override the bundle's Contents/Frameworks/libExtensionLayer.dylib")
    args = parser.parse_args()
    extension = args.extension or args.app / "Contents/Frameworks/libExtensionLayer.dylib"
    try:
        check_bundle(args.app, extension)
    except CheckError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
