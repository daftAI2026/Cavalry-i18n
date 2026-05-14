/**
 * [INPUT]: 依赖 tauri_build 的 build script 集成能力与 src-tauri/tauri.conf.json
 * [OUTPUT]: 对外提供 Cargo build.rs 入口，生成 Tauri runtime context
 * [POS]: src-tauri 的构建钩子，位于 Cargo 配置与 Tauri 代码生成之间
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
fn main() {
    tauri_build::build();
}
