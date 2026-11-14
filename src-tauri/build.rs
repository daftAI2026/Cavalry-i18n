/**
 * [INPUT]: 依赖 tauri_build、cc、sha2、macOS AppKit handoff 源、四语言 JSON 源与 Windows generic/QPA 发布 DLL；显式macOS native模式另读固定target工件manifest、官方域摘要及目标架构dylib，并将BuildMode写入OUT_DIR。
 * [OUTPUT]: 按BuildMode固化当前2.8.1原生资源；Windows x64 production复用资源manifest；Mac继续验证目标架构runtime。
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

#[path = "native/native_preview_injector_contract.rs"]
mod native_preview_injector_contract;

#[path = "native/native_candidate_build_contract.rs"]
mod native_candidate_build_contract;
use native_candidate_build_contract::{select_native_build_mode, NativeBuildMode};

const LANGUAGES: [&str; 4] = ["en", "zh-Hans", "zh-Hant", "ja_JP"];
const GENERIC_RELATIVE_PATH: &str = "injector/windows/generic/cavalryi18n.dll";
const QPA_RELATIVE_PATH: &str = "injector/windows/qpa/qwindows.dll";

fn main() {
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_ENABLE_NATIVE_PREVIEW");
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_NATIVE_RELEASE_CANDIDATE");
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_NATIVE_BUILD_PROFILE");
    let native_mode = select_native_build_mode(
        &env::var("CARGO_CFG_TARGET_OS").unwrap_or_default(),
        &env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default(),
        &env::var("PROFILE").unwrap_or_default(),
        env::var("CAVALRY_I18N_ENABLE_NATIVE_PREVIEW")
            .ok()
            .as_deref(),
        env::var("CAVALRY_I18N_NATIVE_RELEASE_CANDIDATE")
            .ok()
            .as_deref(),
        env::var("CAVALRY_I18N_NATIVE_BUILD_PROFILE")
            .ok()
            .as_deref(),
    )
    .expect("native build mode rejected");
    println!("cargo:rustc-check-cfg=cfg(cavalry_native_windows)");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && native_mode != NativeBuildMode::Disabled
    {
        println!("cargo:rustc-cfg=cavalry_native_windows");
    }
    build_macos_permission_handoff();
    generate_source_provenance_catalog(native_mode);
    embed_native_build_mode(native_mode);
    embed_native_resource_manifest(native_mode);
    embed_native_runtime_injector(native_mode);
    tauri_build::build();
}

// -- 将构建模式固定进OUT_DIR；运行时不读取环境变量 --------------------
fn embed_native_build_mode(mode: NativeBuildMode) {
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
    fs::write(output.join("native_build_mode.txt"), mode.as_str())
        .expect("native build mode could not be embedded");
}

// -- 显式native构建核对资源profile与payload摘要 ------------------------
fn embed_native_resource_manifest(mode: NativeBuildMode) {
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_ENABLE_NATIVE_PREVIEW");
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_NATIVE_BUILD_PROFILE");
    let input = Path::new("target/native-language-packs/manifest.json");
    println!("cargo:rerun-if-changed={}", input.display());
    let bytes = if mode != NativeBuildMode::Disabled {
        for source in [
            "../languages/native",
            "../tools/native_resource_bundle.js",
            "../tools/native_language_pack.js",
            "../tools/native_schema_supplement.js",
            "../tools/native_schema_gap_sources.js",
            "../tools/native_plugin_caption_supplement.js",
            "../tools/native_official_target.js",
            "../tools/native_translation_format.js",
            "../package-lock.json",
            "../tools/cavalry_native_target.json",
        ] {
            println!("cargo:rerun-if-changed={source}");
        }
        let mut check = std::process::Command::new("node");
        check.args(["../tools/native_resource_bundle.js", "--check"]);
        if mode == NativeBuildMode::Production {
            check.args(["--profile", "production-2.8"]);
        }
        let checked = check
            .status()
            .expect("native resource freshness check requires Node and npm dependencies");
        assert!(
            checked.success(),
            "native resources are stale, incomplete, or from another profile; rebuild from approved official assets"
        );
        let metadata = fs::symlink_metadata(input)
            .expect("native profile requires approved native resources before compiling");
        assert!(
            metadata.is_file() && !metadata.file_type().is_symlink(),
            "native preview manifest must be a regular file"
        );
        fs::read(input).expect("native preview manifest could not be read")
    } else {
        Vec::new()
    };
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
    fs::write(output.join("native_resource_manifest.json"), bytes)
        .expect("native compile-time resource manifest could not be written");
}

// -- 预览可选；候选与生产模式必须嵌入匹配目标架构的runtime -----------
fn embed_native_runtime_injector(mode: NativeBuildMode) {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        // Windows原生资源单独打包，不把Mac dylib当作运行时输入。
        let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
        fs::write(output.join("native_runtime_injector.dylib"), [])
            .expect("empty platform runtime boundary");
        return;
    }
    println!("cargo:rerun-if-env-changed=CAVALRY_I18N_NATIVE_INJECTOR_FILE");
    let bytes = if mode != NativeBuildMode::Disabled {
        load_native_runtime_injector()
    } else {
        Vec::new()
    };
    assert!(
        !matches!(
            mode,
            NativeBuildMode::ReleaseCandidate | NativeBuildMode::Production
        ) || !bytes.is_empty(),
        "native candidate/production mode requires CAVALRY_I18N_NATIVE_INJECTOR_FILE"
    );
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is required"));
    fs::write(output.join("native_runtime_injector.dylib"), bytes)
        .expect("native runtime injector compile-time artifact could not be written");
}

fn load_native_runtime_injector() -> Vec<u8> {
    let Some(value) = env::var_os("CAVALRY_I18N_NATIVE_INJECTOR_FILE") else {
        return Vec::new();
    };
    let configured_path = PathBuf::from(value);
    assert!(
        !configured_path.as_os_str().is_empty(),
        "CAVALRY_I18N_NATIVE_INJECTOR_FILE must not be empty"
    );
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    assert!(
        matches!(target_arch.as_str(), "aarch64" | "x86_64"),
        "native runtime injector requires a supported macOS architecture"
    );

    let manifest_dir =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"));
    let configured_path = if configured_path.is_absolute() {
        configured_path
    } else {
        manifest_dir.join(configured_path)
    };
    println!("cargo:rerun-if-changed={}", configured_path.display());
    let source = no_symlink_regular_file(&configured_path)
        .unwrap_or_else(|error| panic!("native runtime injector input rejected: {error}"));
    let bytes = fs::read(&source)
        .unwrap_or_else(|error| panic!("native runtime injector input could not be read: {error}"));
    native_preview_injector_contract::validate_dylib_for_arch(&bytes, &target_arch)
        .unwrap_or_else(|error| panic!("native runtime injector input rejected: {error}"));
    bytes
}

fn no_symlink_regular_file(path: &Path) -> Result<PathBuf, String> {
    use std::path::Component;

    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        env::current_dir()
            .map_err(|error| format!("current directory unavailable: {error}"))?
            .join(path)
    };
    let components = path.components().collect::<Vec<_>>();
    let mut current = PathBuf::new();
    for (index, component) in components.iter().enumerate() {
        current.push(component.as_os_str());
        if matches!(component, Component::RootDir | Component::Prefix(_)) {
            continue;
        }
        let metadata = fs::symlink_metadata(&current)
            .map_err(|error| format!("path component unavailable: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("path contains a symbolic link".into());
        }
        if index + 1 < components.len() && !metadata.is_dir() {
            return Err("path parent is not a directory".into());
        }
    }
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("file metadata unavailable: {error}"))?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("input is not a regular file".into());
    }
    Ok(path)
}

fn build_macos_permission_handoff() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }
    let source = Path::new("native/macos_permission_handoff.m");
    println!("cargo:rerun-if-changed={}", source.display());
    cc::Build::new()
        .file(source)
        .flag("-fobjc-arc")
        .flag("-fmodules")
        .compile("cavalry_permission_handoff");
    for framework in ["AppKit", "CoreGraphics", "QuartzCore"] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}

fn generate_source_provenance_catalog(mode: NativeBuildMode) {
    println!("cargo:rerun-if-env-changed=PROFILE");
    let manifest_dir =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"));
    let repository_root = manifest_dir
        .parent()
        .expect("src-tauri must be inside the repository root");
    let target_is_windows = env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows");
    let mut language_entries = Vec::<(String, String)>::new();

    if target_is_windows && mode == NativeBuildMode::Disabled {
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
