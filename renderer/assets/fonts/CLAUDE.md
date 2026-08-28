# fonts/
> L2 | 父级: ../CLAUDE.md

成员清单
Geist-Variable.woff2: Geist Sans v1.7.2 可变字体，承担 renderer 标题、正文、标签与控件排印；拉丁字形优先，CJK 由系统字体回退。
GeistMono-Variable.woff2: Geist Mono v1.7.2 可变字体，仅用于安装路径、状态与短操作标识，避免整段界面被等宽字体主导。
OFL.txt: Geist 字体对应的 SIL Open Font License 1.1，约束字体资产的再分发与修改。

依赖方向:

字体由 renderer/styles.css 通过本地相对路径加载，打包和离线运行不得回退到远程 URL。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
