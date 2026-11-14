/**
 * [INPUT]: 依赖native_candidate_build_contract的纯构建模式裁决。
 * [OUTPUT]: 验证Mac preview、Mac双架构和Windows x64显式production构建模式。
 * [POS]: 构建入口的无副作用合同；不运行App或读用户状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[path = "../native/native_candidate_build_contract.rs"]
mod contract;

use contract::{select_native_build_mode as select, NativeBuildMode as Mode};

#[test]
fn default_release_stays_legacy_even_with_stray_candidate_flag() {
    for candidate in [None, Some("1"), Some("true")] {
        assert_eq!(
            select("macos", "aarch64", "release", None, candidate, None),
            Ok(Mode::Disabled)
        );
    }
}

#[test]
fn native_release_candidate_requires_its_existing_preview_opt_in() {
    for candidate in [None, Some("0"), Some("true")] {
        assert!(select("macos", "aarch64", "release", Some("1"), candidate, None).is_err());
    }
    assert!(select("macos", "x86_64", "release", Some("1"), Some("1"), None).is_err());
    assert_eq!(
        select("macos", "aarch64", "release", Some("1"), Some("1"), None),
        Ok(Mode::ReleaseCandidate)
    );
}

#[test]
fn existing_debug_preview_and_other_platforms_are_unchanged() {
    assert_eq!(
        select("macos", "aarch64", "debug", Some("1"), None, None),
        Ok(Mode::DebugPreview)
    );
    for os in ["windows", "linux"] {
        assert_eq!(
            select(os, "aarch64", "release", Some("1"), Some("1"), None),
            Ok(Mode::Disabled)
        );
    }
    assert!(select("macos", "aarch64", "custom", Some("1"), Some("1"), None).is_err());
}

#[test]
fn production_requires_exact_profile_supported_platform_release_and_no_preview_flags() {
    assert_eq!(
        select(
            "windows",
            "x86_64",
            "release",
            None,
            None,
            Some("production-2.8")
        ),
        Ok(Mode::Production)
    );
    assert_eq!(
        select(
            "macos",
            "aarch64",
            "release",
            None,
            None,
            Some("production-2.8")
        ),
        Ok(Mode::Production)
    );
    assert_eq!(
        select(
            "macos",
            "x86_64",
            "release",
            None,
            None,
            Some("production-2.8")
        ),
        Ok(Mode::Production)
    );
    for (os, arch, profile, preview, candidate, production) in [
        (
            "windows",
            "aarch64",
            "release",
            None,
            None,
            Some("production-2.8"),
        ),
        (
            "macos",
            "armv7",
            "release",
            None,
            None,
            Some("production-2.8"),
        ),
        (
            "macos",
            "aarch64",
            "debug",
            None,
            None,
            Some("production-2.8"),
        ),
        (
            "macos",
            "aarch64",
            "release",
            Some("1"),
            None,
            Some("production-2.8"),
        ),
        (
            "macos",
            "aarch64",
            "release",
            None,
            Some("1"),
            Some("production-2.8"),
        ),
        (
            "macos",
            "aarch64",
            "release",
            None,
            None,
            Some("production-2.7"),
        ),
    ] {
        assert!(select(os, arch, profile, preview, candidate, production).is_err());
    }
    assert_eq!(
        select("macos", "aarch64", "release", None, None, None),
        Ok(Mode::Disabled)
    );
}

#[test]
fn native_build_modes_embed_stable_compile_time_labels() {
    assert_eq!(Mode::Disabled.as_str(), "disabled");
    assert_eq!(Mode::DebugPreview.as_str(), "debug-preview");
    assert_eq!(Mode::ReleaseCandidate.as_str(), "release-candidate");
    assert_eq!(Mode::Production.as_str(), "production-2.8");
}
