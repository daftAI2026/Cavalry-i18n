/**
 * [INPUT]: 依赖 CommandRunner 的受控 detached process 端口；只接收编译期枚举 ProjectLink，不接收 renderer URL。
 * [OUTPUT]: 提供 ProjectLink::from_id 与 open_project_link，将 repository/license 映射为固定 HTTPS 地址并交给平台默认浏览器。
 * [POS]: privilege 的最小外部导航适配器；守住任意 URL 不跨越 renderer 边界，复用现有系统进程抽象而不引入 opener 依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::CommandRunner;

const REPOSITORY_URL: &str = "https://github.com/daftAI2026/Cavalry-i18n";
const LICENSE_URL: &str = "https://github.com/daftAI2026/Cavalry-i18n/blob/main/LICENSE";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectLink {
    Repository,
    License,
}

impl ProjectLink {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "repository" => Some(Self::Repository),
            "license" => Some(Self::License),
            _ => None,
        }
    }

    fn url(self) -> &'static str {
        match self {
            Self::Repository => REPOSITORY_URL,
            Self::License => LICENSE_URL,
        }
    }
}

pub fn open_project_link<R: CommandRunner>(
    link: ProjectLink,
    runner: &mut R,
) -> Result<(), String> {
    let url = link.url().to_string();

    #[cfg(target_os = "macos")]
    return runner.spawn_detached("open", &[url]);

    #[cfg(target_os = "windows")]
    return runner.spawn_detached(
        "rundll32.exe",
        &["url.dll,FileProtocolHandler".to_string(), url],
    );

    #[cfg(target_os = "linux")]
    return runner.spawn_detached("xdg-open", &[url]);

    #[allow(unreachable_code)]
    Err("Opening project links is unsupported on this platform.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::privilege::RecordingRunner;

    #[test]
    fn project_link_ids_are_closed_and_urls_are_compile_time_fixed() {
        assert_eq!(
            ProjectLink::from_id("repository"),
            Some(ProjectLink::Repository)
        );
        assert_eq!(ProjectLink::from_id("license"), Some(ProjectLink::License));
        assert_eq!(ProjectLink::from_id("https://attacker.invalid"), None);
        assert_eq!(ProjectLink::Repository.url(), REPOSITORY_URL);
        assert_eq!(ProjectLink::License.url(), LICENSE_URL);
    }

    #[test]
    fn project_link_uses_the_platform_browser_adapter() {
        let mut runner = RecordingRunner::default();
        open_project_link(ProjectLink::License, &mut runner).unwrap();
        assert_eq!(runner.commands.len(), 1);
        assert!(runner.commands[0].args.iter().any(|arg| arg == LICENSE_URL));
        #[cfg(target_os = "macos")]
        assert_eq!(runner.commands[0].program, "open");
        #[cfg(target_os = "windows")]
        assert_eq!(runner.commands[0].program, "rundll32.exe");
        #[cfg(target_os = "linux")]
        assert_eq!(runner.commands[0].program, "xdg-open");
    }
}
