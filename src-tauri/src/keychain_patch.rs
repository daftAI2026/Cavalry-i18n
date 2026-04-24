/**
 * [INPUT]: 依赖 std fs/path，读取 Mach-O fat/thin dylib 的符号表、间接符号表与指令字节
 * [OUTPUT]: 对外提供 patch_keychain_query_attributes、patch_keychain_query_attributes_bytes、build_synthetic_keychain_dylib 和 per-function 补丁报告
 * [POS]: src-tauri/src 的 Keychain 二进制补丁核心，被 privilege 系统边界调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, path::Path};

const FAT_MAGIC: u32 = 0xcafebabe;
const MH_MAGIC_64: u32 = 0xfeedfacf;
const LC_SEGMENT_64: u32 = 0x19;
const LC_SYMTAB: u32 = 0x2;
const LC_DYSYMTAB: u32 = 0xb;
const S_NON_LAZY_SYMBOL_POINTERS: u32 = 0x6;
const S_LAZY_SYMBOL_POINTERS: u32 = 0x7;
const CPU_TYPE_X86_64: u32 = 0x01000007;
const CPU_TYPE_ARM64: u32 = 0x0100000c;
const ARM64_NOP_WORD: u32 = 0xd503201f;
const ARM64_NOP: [u8; 4] = [0x1f, 0x20, 0x03, 0xd5];

const TARGETS: [(&str, &str); 5] = [
    ("createQuery", "__ZN7cavalry8keychain11createQuery"),
    ("valueExists", "__ZN7cavalry8keychain11valueExists"),
    ("setValue", "__ZN7cavalry8keychain8setValue"),
    ("getValue", "__ZN7cavalry8keychain8getValue"),
    ("eraseValue", "__ZN7cavalry8keychain10eraseValue"),
];
const ATTRS: [(&str, &str); 2] = [
    ("kSecAttrAccessGroup", "_kSecAttrAccessGroup"),
    ("kSecAttrSynchronizable", "_kSecAttrSynchronizable"),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeychainPatchReport {
    pub functions: usize,
    pub patched_callsites: usize,
    pub already_patched_callsites: usize,
    pub details: Vec<KeychainPatchDetail>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeychainPatchDetail {
    pub function: String,
    pub attribute: String,
    pub patched_callsites: usize,
    pub already_patched_callsites: usize,
}

#[derive(Clone)]
struct Slice {
    cputype: u32,
    offset: usize,
    size: usize,
}

#[derive(Clone)]
struct Segment {
    vmaddr: u64,
    filesize: u64,
    fileoff: u64,
}

#[derive(Clone)]
struct Section {
    sectname: String,
    segname: String,
    addr: u64,
    size: u64,
    flags: u32,
    reserved1: u32,
}

#[derive(Clone)]
struct Symbol {
    name: String,
    value: u64,
}

struct MachO {
    arch: &'static str,
    base: usize,
    segments: Vec<Segment>,
    sections: Vec<Section>,
    symbols: Vec<Symbol>,
    indirect: Vec<u32>,
}

struct FunctionBounds {
    name: &'static str,
    start: u64,
    end: u64,
}

pub fn patch_keychain_query_attributes(app_path: &Path) -> Result<KeychainPatchReport, String> {
    let target = app_path
        .join("Contents")
        .join("Frameworks")
        .join("libExtensionLayer.dylib");
    if !target.exists() {
        return Err(format!(
            "libExtensionLayer.dylib not found at {}",
            target.display()
        ));
    }

    let bytes = fs::read(&target).map_err(|error| error.to_string())?;
    let (patched, report) = patch_keychain_query_attributes_bytes(&bytes)?;
    if report.patched_callsites > 0 {
        fs::write(&target, patched).map_err(|error| error.to_string())?;
    }
    Ok(report)
}

pub fn patch_keychain_query_attributes_bytes(
    input: &[u8],
) -> Result<(Vec<u8>, KeychainPatchReport), String> {
    let mut bytes = input.to_vec();
    let mut report = empty_report();
    for slice in parse_slices(&bytes)? {
        let macho = parse_macho(&bytes, &slice)?;
        patch_slice(&mut bytes, &macho, &mut report)?;
    }
    Ok((bytes, report))
}

fn empty_report() -> KeychainPatchReport {
    KeychainPatchReport {
        functions: TARGETS.len(),
        patched_callsites: 0,
        already_patched_callsites: 0,
        details: TARGETS
            .iter()
            .flat_map(|(function, _)| {
                ATTRS.iter().map(move |(attribute, _)| KeychainPatchDetail {
                    function: (*function).to_string(),
                    attribute: (*attribute).to_string(),
                    patched_callsites: 0,
                    already_patched_callsites: 0,
                })
            })
            .collect(),
    }
}

fn parse_slices(bytes: &[u8]) -> Result<Vec<Slice>, String> {
    if bytes.len() < 4 {
        return Err("libExtensionLayer.dylib is too small to be a Mach-O binary.".into());
    }
    if read_u32_be(bytes, 0)? == FAT_MAGIC {
        let count = read_u32_be(bytes, 4)? as usize;
        let mut slices = Vec::new();
        for index in 0..count {
            let offset = 8 + index * 20;
            slices.push(Slice {
                cputype: read_u32_be(bytes, offset)?,
                offset: read_u32_be(bytes, offset + 8)? as usize,
                size: read_u32_be(bytes, offset + 12)? as usize,
            });
        }
        return Ok(slices);
    }
    if read_u32_le(bytes, 0)? != MH_MAGIC_64 {
        return Err("libExtensionLayer.dylib is not a supported 64-bit Mach-O binary.".into());
    }
    Ok(vec![Slice {
        cputype: read_u32_le(bytes, 4)?,
        offset: 0,
        size: bytes.len(),
    }])
}

fn parse_macho(bytes: &[u8], slice: &Slice) -> Result<MachO, String> {
    let base = slice.offset;
    let end = base + slice.size;
    if end > bytes.len() || read_u32_le(bytes, base)? != MH_MAGIC_64 {
        return Err("Unsupported Mach-O slice inside libExtensionLayer.dylib.".into());
    }
    let ncmds = read_u32_le(bytes, base + 16)? as usize;
    let mut command = base + 32;
    let mut segments = Vec::new();
    let mut sections = Vec::new();
    let mut symtab = None;
    let mut dysymtab = None;

    for _ in 0..ncmds {
        let cmd = read_u32_le(bytes, command)?;
        let cmdsize = read_u32_le(bytes, command + 4)? as usize;
        if cmd == LC_SEGMENT_64 {
            segments.push(Segment {
                vmaddr: read_u64_le(bytes, command + 24)?,
                filesize: read_u64_le(bytes, command + 48)?,
                fileoff: read_u64_le(bytes, command + 40)?,
            });
            let nsects = read_u32_le(bytes, command + 64)? as usize;
            let mut section = command + 72;
            for _ in 0..nsects {
                sections.push(Section {
                    sectname: read_cstring(bytes, section, section + 16),
                    segname: read_cstring(bytes, section + 16, section + 32),
                    addr: read_u64_le(bytes, section + 32)?,
                    size: read_u64_le(bytes, section + 40)?,
                    flags: read_u32_le(bytes, section + 64)?,
                    reserved1: read_u32_le(bytes, section + 68)?,
                });
                section += 80;
            }
        } else if cmd == LC_SYMTAB {
            symtab = Some((
                read_u32_le(bytes, command + 8)? as usize,
                read_u32_le(bytes, command + 12)? as usize,
                read_u32_le(bytes, command + 16)? as usize,
                read_u32_le(bytes, command + 20)? as usize,
            ));
        } else if cmd == LC_DYSYMTAB {
            dysymtab = Some((
                read_u32_le(bytes, command + 56)? as usize,
                read_u32_le(bytes, command + 60)? as usize,
            ));
        }
        command += cmdsize;
    }

    let (symoff, nsyms, stroff, strsize) =
        symtab.ok_or_else(|| "Mach-O symbol table was not found.".to_string())?;
    let (indirectsymoff, nindirectsyms) =
        dysymtab.ok_or_else(|| "Mach-O indirect symbol table was not found.".to_string())?;

    let mut symbols = Vec::new();
    for index in 0..nsyms {
        let entry = base + symoff + index * 16;
        let strx = read_u32_le(bytes, entry)? as usize;
        symbols.push(Symbol {
            name: read_cstring(bytes, base + stroff + strx, base + stroff + strsize),
            value: read_u64_le(bytes, entry + 8)?,
        });
    }
    let mut indirect = Vec::new();
    for index in 0..nindirectsyms {
        indirect.push(read_u32_le(bytes, base + indirectsymoff + index * 4)?);
    }

    Ok(MachO {
        arch: if slice.cputype == CPU_TYPE_ARM64 {
            "arm64"
        } else {
            "x86_64"
        },
        base,
        segments,
        sections,
        symbols,
        indirect,
    })
}

fn patch_slice(
    bytes: &mut [u8],
    macho: &MachO,
    report: &mut KeychainPatchReport,
) -> Result<(), String> {
    let pointers = pointer_symbols(macho);
    let functions = function_bounds(macho)?;

    for function in functions {
        for (label, symbol) in ATTRS {
            let pointer = pointers
                .iter()
                .find_map(|(name, address)| (*name == symbol).then_some(*address))
                .ok_or_else(|| format!("Missing Keychain symbol: {symbol}"))?;
            let callsite = if macho.arch == "arm64" {
                find_arm64_callsite(bytes, macho, &function, pointer, label)?
            } else {
                find_x86_callsite(bytes, macho, &function, pointer, label)?
            };
            if callsite.2 {
                record_callsite(report, function.name, label, false);
            } else if macho.arch == "arm64" {
                bytes[callsite.0..callsite.0 + 4].copy_from_slice(&ARM64_NOP);
                record_callsite(report, function.name, label, true);
            } else {
                for byte in &mut bytes[callsite.0..callsite.0 + callsite.1] {
                    *byte = 0x90;
                }
                record_callsite(report, function.name, label, true);
            }
        }
    }
    Ok(())
}

fn record_callsite(
    report: &mut KeychainPatchReport,
    function: &str,
    attribute: &str,
    patched: bool,
) {
    let detail = report
        .details
        .iter_mut()
        .find(|detail| detail.function == function && detail.attribute == attribute)
        .expect("patch detail target must exist");
    if patched {
        report.patched_callsites += 1;
        detail.patched_callsites += 1;
    } else {
        report.already_patched_callsites += 1;
        detail.already_patched_callsites += 1;
    }
}

fn pointer_symbols(macho: &MachO) -> Vec<(&str, u64)> {
    let mut out = Vec::new();
    for section in &macho.sections {
        let section_type = section.flags & 0xff;
        if section_type != S_NON_LAZY_SYMBOL_POINTERS && section_type != S_LAZY_SYMBOL_POINTERS {
            continue;
        }
        for index in 0..(section.size / 8) as usize {
            let indirect_index = section.reserved1 as usize + index;
            if let Some(symbol_index) = macho.indirect.get(indirect_index) {
                if let Some(symbol) = macho.symbols.get(*symbol_index as usize) {
                    out.push((symbol.name.as_str(), section.addr + (index as u64) * 8));
                }
            }
        }
    }
    out
}

fn function_bounds(macho: &MachO) -> Result<Vec<FunctionBounds>, String> {
    let text = macho
        .sections
        .iter()
        .find(|section| section.segname == "__TEXT" && section.sectname == "__text")
        .ok_or_else(|| "Mach-O __TEXT,__text section was not found.".to_string())?;
    let mut text_symbols = macho
        .symbols
        .iter()
        .filter(|symbol| symbol.value >= text.addr && symbol.value < text.addr + text.size)
        .collect::<Vec<_>>();
    text_symbols.sort_by_key(|symbol| symbol.value);

    TARGETS
        .iter()
        .map(|(name, prefix)| {
            let symbol = text_symbols
                .iter()
                .find(|symbol| symbol.name.starts_with(prefix))
                .ok_or_else(|| format!("Could not find {name} in libExtensionLayer.dylib."))?;
            let end = text_symbols
                .iter()
                .find(|next| next.value > symbol.value)
                .map(|next| next.value)
                .unwrap_or(text.addr + text.size);
            Ok(FunctionBounds {
                name,
                start: symbol.value,
                end,
            })
        })
        .collect()
}

fn vm_to_file(macho: &MachO, address: u64) -> Result<usize, String> {
    let segment = macho
        .segments
        .iter()
        .find(|segment| address >= segment.vmaddr && address <= segment.vmaddr + segment.filesize)
        .ok_or_else(|| format!("Could not map Mach-O address 0x{address:x} to a file offset."))?;
    Ok(macho.base + (segment.fileoff + (address - segment.vmaddr)) as usize)
}

fn find_arm64_callsite(
    bytes: &[u8],
    macho: &MachO,
    function: &FunctionBounds,
    pointer: u64,
    label: &str,
) -> Result<(usize, usize, bool), String> {
    let start = vm_to_file(macho, function.start)?;
    let end = vm_to_file(macho, function.end)?;
    let mut offset = start;
    while offset + 8 <= end {
        let address = function.start + (offset - start) as u64;
        if decode_arm64_adrp_target(bytes, offset, address)? == Some(pointer) {
            let limit = end.min(offset + 96);
            let mut call = offset + 8;
            while call + 4 <= limit {
                let word = read_u32_le(bytes, call)?;
                if word & 0xfc000000 == 0x94000000 {
                    return Ok((call, 4, false));
                }
                if word == ARM64_NOP_WORD {
                    return Ok((call, 4, true));
                }
                call += 4;
            }
            return Err(format!("{} {label} callsite was not found.", function.name));
        }
        offset += 4;
    }
    Err(format!(
        "{} {label} reference callsite was not found.",
        function.name
    ))
}

fn decode_arm64_adrp_target(
    bytes: &[u8],
    offset: usize,
    address: u64,
) -> Result<Option<u64>, String> {
    let adrp = read_u32_le(bytes, offset)?;
    let ldr = read_u32_le(bytes, offset + 4)?;
    if adrp & 0x9f000000 != 0x90000000 || ldr & 0xffc00000 != 0xf9400000 {
        return Ok(None);
    }
    if (adrp & 0x1f) != ((ldr >> 5) & 0x1f) {
        return Ok(None);
    }
    let immlo = (adrp >> 29) & 0x3;
    let immhi = (adrp >> 5) & 0x7ffff;
    let delta = sign_extend(((immhi << 2) | immlo) as i64, 21) << 12;
    let page = (address & !0xfff) as i64;
    let page_offset = (((ldr >> 10) & 0xfff) * 8) as i64;
    Ok(Some((page + delta + page_offset) as u64))
}

fn find_x86_callsite(
    bytes: &[u8],
    macho: &MachO,
    function: &FunctionBounds,
    pointer: u64,
    label: &str,
) -> Result<(usize, usize, bool), String> {
    let start = vm_to_file(macho, function.start)?;
    let end = vm_to_file(macho, function.end)?;
    for offset in start..end.saturating_sub(7) {
        let address = function.start + (offset - start) as u64;
        if x86_rip_target(bytes, offset, address)? != Some(pointer) {
            continue;
        }
        let limit = end.min(offset + 128);
        for call in offset + 7..limit {
            let length = x86_call_len(bytes, call);
            if length > 0 {
                return Ok((call, length, false));
            }
            if bytes.get(call..call + 3) == Some(&[0x90, 0x90, 0x90]) {
                return Ok((call, 3, true));
            }
        }
        return Err(format!("{} {label} callsite was not found.", function.name));
    }
    Err(format!(
        "{} {label} reference callsite was not found.",
        function.name
    ))
}

fn x86_rip_target(bytes: &[u8], offset: usize, address: u64) -> Result<Option<u64>, String> {
    if bytes.get(offset) != Some(&0x48) || bytes.get(offset + 1) != Some(&0x8b) {
        return Ok(None);
    }
    let modrm = bytes[offset + 2];
    if modrm & 0xc7 != 0x05 {
        return Ok(None);
    }
    let disp = read_i32_le(bytes, offset + 3)? as i64;
    Ok(Some((address as i64 + 7 + disp) as u64))
}

fn x86_call_len(bytes: &[u8], offset: usize) -> usize {
    match bytes.get(offset..offset + 3) {
        Some([0xe8, _, _]) => 5,
        Some([0xff, b, _]) if b & 0x38 == 0x10 => 2,
        Some([rex, 0xff, b]) if (0x40..=0x4f).contains(rex) && b & 0x38 == 0x10 => 3,
        _ => 0,
    }
}

pub fn build_synthetic_keychain_dylib(arch: Option<&str>, fat: bool) -> Vec<u8> {
    if !fat {
        return build_thin(arch.unwrap_or("arm64"), false);
    }
    let arm = build_thin("arm64", false);
    let x86 = build_thin("x86_64", false);
    let arm_offset = 0x1000usize;
    let x86_offset = align(arm_offset + arm.len(), 0x1000);
    let mut bytes = vec![0; x86_offset + x86.len()];
    write_u32_be(&mut bytes, 0, FAT_MAGIC);
    write_u32_be(&mut bytes, 4, 2);
    write_u32_be(&mut bytes, 8, CPU_TYPE_ARM64);
    write_u32_be(&mut bytes, 16, arm_offset as u32);
    write_u32_be(&mut bytes, 20, arm.len() as u32);
    write_u32_be(&mut bytes, 24, 12);
    write_u32_be(&mut bytes, 28, CPU_TYPE_X86_64);
    write_u32_be(&mut bytes, 36, x86_offset as u32);
    write_u32_be(&mut bytes, 40, x86.len() as u32);
    write_u32_be(&mut bytes, 44, 12);
    bytes[arm_offset..arm_offset + arm.len()].copy_from_slice(&arm);
    bytes[x86_offset..x86_offset + x86.len()].copy_from_slice(&x86);
    bytes
}

pub fn build_synthetic_keychain_dylib_missing_sync_get_value() -> Vec<u8> {
    build_thin("arm64", true)
}

fn build_thin(arch: &str, missing_sync_get_value: bool) -> Vec<u8> {
    let cputype = if arch == "arm64" {
        CPU_TYPE_ARM64
    } else {
        CPU_TYPE_X86_64
    };
    let function_size = 0x80usize;
    let text_offset = 0x400usize;
    let text_addr = 0x1000u64;
    let data_offset = 0x900usize;
    let data_addr = 0x3000u64;
    let text_size = function_size * TARGETS.len();
    let symoff = align(data_offset + 0x10, 8);
    let names = TARGETS
        .iter()
        .map(|(_, symbol)| *symbol)
        .chain(ATTRS.iter().map(|(_, symbol)| *symbol))
        .collect::<Vec<_>>();
    let mut str_offsets = Vec::new();
    let mut strsize = 1usize;
    for name in &names {
        str_offsets.push(strsize);
        strsize += name.len() + 1;
    }
    let stroff = symoff + names.len() * 16;
    let indirect = align(stroff + strsize, 4);
    let mut bytes = vec![0; align(indirect + 8, 16)];
    write_u32_le(&mut bytes, 0, MH_MAGIC_64);
    write_u32_le(&mut bytes, 4, cputype);
    write_u32_le(&mut bytes, 12, 6);
    write_u32_le(&mut bytes, 16, 4);
    write_u32_le(&mut bytes, 20, 408);
    write_segment(
        &mut bytes,
        32,
        "__TEXT",
        text_addr,
        text_size as u64,
        text_offset as u64,
        text_size as u64,
        "__text",
        "__TEXT",
        text_addr,
        text_size as u64,
        text_offset as u32,
        0,
        0,
    );
    write_segment(
        &mut bytes,
        184,
        "__DATA_CONST",
        data_addr,
        0x10,
        data_offset as u64,
        0x10,
        "__got",
        "__DATA_CONST",
        data_addr,
        0x10,
        data_offset as u32,
        S_NON_LAZY_SYMBOL_POINTERS,
        0,
    );
    write_u32_le(&mut bytes, 336, LC_SYMTAB);
    write_u32_le(&mut bytes, 340, 24);
    write_u32_le(&mut bytes, 344, symoff as u32);
    write_u32_le(&mut bytes, 348, names.len() as u32);
    write_u32_le(&mut bytes, 352, stroff as u32);
    write_u32_le(&mut bytes, 356, strsize as u32);
    write_u32_le(&mut bytes, 360, LC_DYSYMTAB);
    write_u32_le(&mut bytes, 364, 80);
    write_u32_le(&mut bytes, 416, indirect as u32);
    write_u32_le(&mut bytes, 420, 2);

    for (index, (name, _)) in TARGETS.iter().enumerate() {
        let fn_addr = text_addr + (index * function_size) as u64;
        let fn_offset = text_offset + index * function_size;
        let missing = missing_sync_get_value && *name == "getValue";
        if arch == "arm64" {
            write_arm_ref_call(&mut bytes, fn_offset, fn_addr, data_addr);
            if !missing {
                write_arm_ref_call(&mut bytes, fn_offset + 0x20, fn_addr + 0x20, data_addr + 8);
            }
        } else {
            write_x86_ref_call(&mut bytes, fn_offset, fn_addr, data_addr);
            if !missing {
                write_x86_ref_call(&mut bytes, fn_offset + 0x20, fn_addr + 0x20, data_addr + 8);
            }
        }
    }
    for (index, name) in names.iter().enumerate() {
        let entry = symoff + index * 16;
        write_u32_le(&mut bytes, entry, str_offsets[index] as u32);
        bytes[entry + 4] = 0x0f;
        bytes[entry + 5] = if index < TARGETS.len() { 1 } else { 0 };
        let value = if index < TARGETS.len() {
            text_addr + (index * function_size) as u64
        } else {
            0
        };
        write_u64_le(&mut bytes, entry + 8, value);
        bytes[stroff + str_offsets[index]..stroff + str_offsets[index] + name.len()]
            .copy_from_slice(name.as_bytes());
    }
    write_u32_le(&mut bytes, indirect, TARGETS.len() as u32);
    write_u32_le(&mut bytes, indirect + 4, TARGETS.len() as u32 + 1);
    bytes
}

fn write_segment(
    bytes: &mut [u8],
    offset: usize,
    seg: &str,
    vmaddr: u64,
    vmsize: u64,
    fileoff: u64,
    filesize: u64,
    sect: &str,
    sectseg: &str,
    sectaddr: u64,
    sectsize: u64,
    sectoff: u32,
    flags: u32,
    reserved1: u32,
) {
    write_u32_le(bytes, offset, LC_SEGMENT_64);
    write_u32_le(bytes, offset + 4, 152);
    bytes[offset + 8..offset + 8 + seg.len()].copy_from_slice(seg.as_bytes());
    write_u64_le(bytes, offset + 24, vmaddr);
    write_u64_le(bytes, offset + 32, vmsize);
    write_u64_le(bytes, offset + 40, fileoff);
    write_u64_le(bytes, offset + 48, filesize);
    write_u32_le(bytes, offset + 64, 1);
    let section = offset + 72;
    bytes[section..section + sect.len()].copy_from_slice(sect.as_bytes());
    bytes[section + 16..section + 16 + sectseg.len()].copy_from_slice(sectseg.as_bytes());
    write_u64_le(bytes, section + 32, sectaddr);
    write_u64_le(bytes, section + 40, sectsize);
    write_u32_le(bytes, section + 48, sectoff);
    write_u32_le(bytes, section + 64, flags);
    write_u32_le(bytes, section + 68, reserved1);
}

fn write_arm_ref_call(bytes: &mut [u8], offset: usize, address: u64, pointer: u64) {
    write_u32_le(bytes, offset, encode_adrp(address, pointer));
    write_u32_le(
        bytes,
        offset + 4,
        0xf9400000 | ((((pointer % 4096) / 8) as u32) << 10) | (8 << 5) | 8,
    );
    write_u32_le(
        bytes,
        offset + 8,
        0x94000000 | ((((0x5000i64 - (address + 8) as i64) / 4) as u32) & 0x03ffffff),
    );
}

fn encode_adrp(address: u64, target: u64) -> u32 {
    let delta = ((target / 4096) as i64 - (address / 4096) as i64) as u32;
    0x90000008 | ((delta & 0x3) << 29) | (((delta >> 2) & 0x7ffff) << 5)
}

fn write_x86_ref_call(bytes: &mut [u8], offset: usize, address: u64, pointer: u64) {
    bytes[offset..offset + 3].copy_from_slice(&[0x48, 0x8b, 0x05]);
    write_i32_le(
        bytes,
        offset + 3,
        (pointer as i64 - (address + 7) as i64) as i32,
    );
    bytes[offset + 7..offset + 10].copy_from_slice(&[0x41, 0xff, 0xd5]);
}

fn sign_extend(value: i64, bits: u32) -> i64 {
    let shift = 64 - bits;
    (value << shift) >> shift
}

fn align(value: usize, boundary: usize) -> usize {
    value.div_ceil(boundary) * boundary
}

fn read_cstring(bytes: &[u8], offset: usize, limit: usize) -> String {
    let mut end = offset;
    while end < limit && end < bytes.len() && bytes[end] != 0 {
        end += 1;
    }
    String::from_utf8_lossy(&bytes[offset..end]).to_string()
}

fn read_u32_le(bytes: &[u8], offset: usize) -> Result<u32, String> {
    bytes
        .get(offset..offset + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(u32::from_le_bytes)
        .ok_or_else(|| "Unexpected end of Mach-O data.".to_string())
}

fn read_u32_be(bytes: &[u8], offset: usize) -> Result<u32, String> {
    bytes
        .get(offset..offset + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(u32::from_be_bytes)
        .ok_or_else(|| "Unexpected end of Mach-O data.".to_string())
}

fn read_i32_le(bytes: &[u8], offset: usize) -> Result<i32, String> {
    bytes
        .get(offset..offset + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(i32::from_le_bytes)
        .ok_or_else(|| "Unexpected end of Mach-O data.".to_string())
}

fn read_u64_le(bytes: &[u8], offset: usize) -> Result<u64, String> {
    bytes
        .get(offset..offset + 8)
        .and_then(|slice| slice.try_into().ok())
        .map(u64::from_le_bytes)
        .ok_or_else(|| "Unexpected end of Mach-O data.".to_string())
}

fn write_u32_le(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn write_u32_be(bytes: &mut [u8], offset: usize, value: u32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
}

fn write_i32_le(bytes: &mut [u8], offset: usize, value: i32) {
    bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn write_u64_le(bytes: &mut [u8], offset: usize, value: u64) {
    bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}
