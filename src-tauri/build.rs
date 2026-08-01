/**
 * [INPUT]: 依赖 tauri_build、sha2、四语言 JSON 源与 Windows generic/QPA 发布 DLL。
 * [OUTPUT]: 生成 Tauri runtime context，并把发布资源的 SHA-256 信任锚写入 OUT_DIR 供提权 worker 编译期嵌入。
 * [POS]: src-tauri 的构建钩子；在用户可写安装资源之外固定 Windows source provenance，不参与运行时路径发现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    env, fs,
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

const LANGUAGES: [&str; 4] = ["en", "zh-Hans", "zh-Hant", "ja_JP"];
const GENERIC_RELATIVE_PATH: &str = "injector/windows/generic/cavalryi18n.dll";
const QPA_RELATIVE_PATH: &str = "injector/windows/qpa/qwindows.dll";

fn main() {
    generate_source_provenance_catalog();
    tauri_build::build();
}

fn generate_source_provenance_catalog() {
    println!("cargo:rerun-if-env-changed=PROFILE");
    let manifest_dir =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"));
    let repository_root = manifest_dir
        .parent()
        .expect("src-tauri must be inside the repository root");
    let target_is_windows = env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows");
    let mut language_entries = Vec::<(String, String)>::new();

    if target_is_windows {
        for language in LANGUAGES {
            let language_root = repository_root.join("languages").join(language);
            println!("cargo:rerun-if-changed={}", language_root.display());
            collect_language_hashes(repository_root, &language_root, &mut language_entries);
        }
    }
    language_entries.sort_by(|left, right| left.0.cmp(&right.0));

    let generic_hash = runtime_hash(repository_root, GENERIC_RELATIVE_PATH, target_is_windows);
    let qpa_hash = runtime_hash(repository_root, QPA_RELATIVE_PATH, target_is_windows);
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
    write_catalog(
        &out_dir.join("source_provenance_catalog.rs"),
        &language_entries,
        generic_hash.as_deref(),
        qpa_hash.as_deref(),
    );
}

fn collect_language_hashes(
    repository_root: &Path,
    directory: &Path,
    output: &mut Vec<(String, String)>,
) {
    let metadata = fs::symlink_metadata(directory).unwrap_or_else(|error| {
        panic!(
            "required language source directory {} is unavailable: {error}",
            directory.display()
        )
    });
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        panic!(
            "required language source directory must be an ordinary directory: {}",
            directory.display()
        );
    }

    let mut children = fs::read_dir(directory)
        .unwrap_or_else(|error| {
            panic!(
                "could not enumerate language source directory {}: {error}",
                directory.display()
            )
        })
        .map(|entry| {
            entry
                .expect("language source entry could not be read")
                .path()
        })
        .collect::<Vec<_>>();
    children.sort();
    for path in children {
        let metadata = fs::symlink_metadata(&path).unwrap_or_else(|error| {
            panic!(
                "could not inspect language source {}: {error}",
                path.display()
            )
        });
        if metadata.file_type().is_symlink() {
            panic!("language source cannot be a symlink: {}", path.display());
        }
        if metadata.is_dir() {
            collect_language_hashes(repository_root, &path, output);
        } else if metadata.is_file()
            && path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
        {
            let relative = path
                .strip_prefix(repository_root)
                .expect("language source escaped the repository root");
            let key = relative.to_string_lossy().replace('\\', "/");
            println!("cargo:rerun-if-changed={}", path.display());
            output.push((key, sha256_file(&path)));
        }
    }
}

fn runtime_hash(
    repository_root: &Path,
    relative_path: &str,
    target_is_windows: bool,
) -> Option<String> {
    let path = repository_root.join(relative_path);
    println!("cargo:rerun-if-changed={}", path.display());
    if !target_is_windows {
        return None;
    }
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
            Some(sha256_file(&path))
        }
        Ok(_) => panic!(
            "Windows runtime source must be an ordinary file: {}",
            path.display()
        ),
        Err(error) if env::var("PROFILE").as_deref() != Ok("release") => {
            println!(
                "cargo:warning=debug Windows build omits runtime trust anchor {}: {error}",
                path.display()
            );
            None
        }
        Err(error) => panic!(
            "release Windows build requires runtime source {}: {error}",
            path.display()
        ),
    }
}

fn sha256_file(path: &Path) -> String {
    let mut file = File::open(path)
        .unwrap_or_else(|error| panic!("could not open source {}: {error}", path.display()));
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .unwrap_or_else(|error| panic!("could not hash source {}: {error}", path.display()));
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    format!("{:x}", hasher.finalize())
}

fn write_catalog(
    path: &Path,
    language_entries: &[(String, String)],
    generic_hash: Option<&str>,
    qpa_hash: Option<&str>,
) {
    let mut file = File::create(path)
        .unwrap_or_else(|error| panic!("could not create {}: {error}", path.display()));
    writeln!(
        file,
        "const EMBEDDED_LANGUAGE_SOURCE_SHA256: &[(&str, &str)] = &["
    )
    .expect("could not write source provenance catalog");
    for (relative_path, digest) in language_entries {
        writeln!(file, "    ({relative_path:?}, {digest:?}),")
            .expect("could not write language source digest");
    }
    writeln!(file, "];").expect("could not finish language source digest table");
    writeln!(
        file,
        "const EMBEDDED_GENERIC_SHA256: Option<&str> = {generic_hash:?};"
    )
    .expect("could not write generic source digest");
    writeln!(
        file,
        "const EMBEDDED_QPA_SHA256: Option<&str> = {qpa_hash:?};"
    )
    .expect("could not write QPA source digest");
}
