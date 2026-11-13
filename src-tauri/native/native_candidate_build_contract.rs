/**
 * [INPUT]: 依赖构建目标、Cargo profile、preview/candidate开关及2.8生产profile。
 * [OUTPUT]: 裁决默认构建、开发预览、ARM 2.8.1候选或显式2.8生产模式。
 * [POS]: build.rs纯构建门；production接受Mac双架构及Windows x64 release，preview仍限原Mac范围。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum NativeBuildMode {
    Disabled,
    DebugPreview,
    ReleaseCandidate,
    Production,
    Development281,
}

impl NativeBuildMode {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::DebugPreview => "debug-preview",
            Self::ReleaseCandidate => "release-candidate",
            Self::Production => "production-2.8",
            Self::Development281 => "development-2.8.1",
        }
    }
}

pub(crate) fn select_native_build_mode(
    target_os: &str,
    target_arch: &str,
    profile: &str,
    preview: Option<&str>,
    candidate: Option<&str>,
    production_profile: Option<&str>,
) -> Result<NativeBuildMode, &'static str> {
    if let Some(profile_name) = production_profile {
        if profile_name == "development-2.8.1" {
            if target_os != "macos"
                || target_arch != "aarch64"
                || !matches!(profile, "debug" | "release")
                || preview.is_some()
                || candidate.is_some()
            {
                return Err("2.8.1 candidate requires macOS arm64 with its own build profile");
            }
            return Ok(NativeBuildMode::Development281);
        }
        if profile_name != "production-2.8" {
            return Err("unsupported native production profile");
        }
        let supported = (target_os == "macos" && matches!(target_arch, "aarch64" | "x86_64"))
            || (target_os == "windows" && target_arch == "x86_64");
        if !supported || profile != "release" {
            return Err(
                "native production profile requires macOS arm64/x86_64 or Windows x86_64 release",
            );
        }
        if preview.is_some() || candidate.is_some() {
            return Err("native production profile cannot combine preview or candidate flags");
        }
        return Ok(NativeBuildMode::Production);
    }
    if target_os != "macos" || preview != Some("1") {
        return Ok(NativeBuildMode::Disabled);
    }
    match profile {
        "debug" => Ok(NativeBuildMode::DebugPreview),
        "release" if candidate == Some("1") && target_arch == "aarch64" => {
            Ok(NativeBuildMode::ReleaseCandidate)
        }
        "release" => {
            Err("native development preview release requires explicit arm64 candidate opt-in")
        }
        _ => Err("unsupported native preview Cargo profile"),
    }
}
