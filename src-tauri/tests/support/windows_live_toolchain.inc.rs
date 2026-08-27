/**
 * [INPUT]: 依赖 npm_execpath/npm_node_execpath、活动 Node PATH 与 Windows cmd.exe 的固定 npm 解析语义
 * [OUTPUT]: 提供 release machine record 的 npm 版本采集；优先无 shell 执行活动 npm CLI，缺失显式 CLI 时仅用固定 shell 命令解析安装器 shim
 * [POS]: Windows live support 的工具链身份边界，隔离 MSI、Volta 等 Node/npm 布局差异，不参与 Cavalry 运行或截图判断
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#[derive(Debug, PartialEq, Eq)]
struct NpmVersionCommand {
    program: OsString,
    arguments: Vec<OsString>,
}

fn resolve_npm_version_command(
    npm_execpath: Option<OsString>,
    node_execpath: Option<OsString>,
) -> NpmVersionCommand {
    let npm_execpath = npm_execpath.filter(|value| !value.to_string_lossy().trim().is_empty());
    if let Some(npm_execpath) = npm_execpath {
        let node = node_execpath
            .filter(|value| !value.to_string_lossy().trim().is_empty())
            .unwrap_or_else(|| OsString::from("node"));
        return NpmVersionCommand {
            program: node,
            arguments: vec![npm_execpath, OsString::from("--version")],
        };
    }

    NpmVersionCommand {
        program: OsString::from("cmd.exe"),
        arguments: vec![
            OsString::from("/D"),
            OsString::from("/S"),
            OsString::from("/C"),
            OsString::from("npm --version"),
        ],
    }
}

fn npm_version() -> Result<String, String> {
    let command = resolve_npm_version_command(
        env::var_os("npm_execpath"),
        env::var_os("npm_node_execpath"),
    );
    let output = ProcessBuilder::new(&command.program)
        .args(&command.arguments)
        .output()
        .map_err(|error| format!("could not execute npm version: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "npm version failed with {:?}: {}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_string())
        .ok_or_else(|| "npm version returned no version output".to_string())
}

#[test]
fn release_machine_toolchain_resolves_windows_npm_entrypoint() {
    let version = npm_version()
        .expect("Windows release evidence must resolve the npm command entrypoint");
    assert!(
        !version.trim().is_empty(),
        "Windows release evidence must record a concrete npm version"
    );
}

#[test]
fn release_machine_toolchain_prefers_active_npm_execpath() {
    let command = resolve_npm_version_command(
        Some(OsString::from(r"C:\volta\tools\npm-cli.js")),
        Some(OsString::from(r"C:\volta\tools\node.exe")),
    );

    assert_eq!(
        command,
        NpmVersionCommand {
            program: OsString::from(r"C:\volta\tools\node.exe"),
            arguments: vec![
                OsString::from(r"C:\volta\tools\npm-cli.js"),
                OsString::from("--version"),
            ],
        }
    );
}

#[test]
fn release_machine_toolchain_falls_back_to_windows_shell_resolution() {
    assert_eq!(
        resolve_npm_version_command(None, None),
        NpmVersionCommand {
            program: OsString::from("cmd.exe"),
            arguments: vec![
                OsString::from("/D"),
                OsString::from("/S"),
                OsString::from("/C"),
                OsString::from("npm --version"),
            ],
        }
    );
}
