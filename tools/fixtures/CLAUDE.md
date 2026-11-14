# fixtures/
> L2 | 父级: ../CLAUDE.md

成员清单
legacy-p12-updater-manifest.json: 已发行Cavalry 2.7.2-p12公开latest.json的2521B原文字节锁输入；离线转换后由2.8双feed发布器附带为冻结p12 latest.json，保留原1.0.6/三平台签名，不证明archive验签。
cavalry_native_target_2_8_0.json: Cavalry 2.8.0历史target快照，仅供原审批source/notes合同测试；不由资源构建器或生产Rust target加载。
make_fake_cavalry_bundle.js: fake Cavalry.app 工厂，写入 Info.plist、JSON 资产、插件 strings、Mach-O 头与 Resources 目录。

依赖边界:
fixtures 只描述测试世界；不得包含真实 Cavalry.app、大二进制或用户机器绝对路径。

法则: 临时生成·路径归一·无真实副作用

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
