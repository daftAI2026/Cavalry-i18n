# UI SDK 验收与历史对照

当前组件交互以固定版本 SDK 的默认 Web Components 为准，遵循维护者 2026-11-16 裁决。项目保留现有配色、排版、400×504 默认窗口、翻译事务及权限边界。SDK 拥有搜索、焦点、弹层、通知队列、计时与滑动；macOS 权限交接通过 SDK Close action 的 `waitUntil` 等待原生 ACK。

```bash
npm ci
npx playwright install chromium webkit
npm run build:ui-sdk
node tools/ui-parity/run.js --contract sdk-default --engine chromium --output /tmp/cavalry-sdk-chromium
node tools/ui-parity/run.js --contract sdk-default --engine webkit --output /tmp/cavalry-sdk-webkit
```

当前合同覆盖四语首次pointerdown/up、空值占位行对齐、按住拖动选择、已选重开、选择/禁用/搜索、取消优先确认及 Escape、切换成功/失败/忙碌、Tooltip、原生 F6/Tab/保留通知队列、日志阅读位置和恢复跟随、更新百分比、固定链接/About、权限 native ACK、版本引导、窗口宽度、三种手势目标与 Reduce Motion。测试专用 Agent 与组件在同一个 bundle 内，通过公开 query/act 验证有效值接线、未知值拒绝和禁用 action；Agent 不进入产品包。SDK 本身的完整行为由其上游测试负责，本项目验证实际页面接线。

`report.json` 保存合同、引擎、四语、候选 commit/文件 SHA、CSP/fixture、逐例断言、截图、错误和组件覆盖。用 `--cases` 和 `--locales` 缩小复验；未知参数值拒绝。完整运行要求清单中的7类 Web 组件、日志 helper 和6类业务组合被实际覆盖。`sourceChangedDuringRun` 拒绝把来源变化的证据记作通过。

历史 main 的严格像素/旧交互对照保留为 `--contract legacy`，不再作为 SDK 默认搜索、焦点、队列和弹层行为的预期：

```bash
node tools/ui-parity/run.js --contract legacy --reference <固定commit> --self-reference --cases controls --locales en --output /tmp/cavalry-legacy-control
```

历史对照使用同一输入和暂停时钟，稳定截图 RGB 零容差；`--probe visual` 注入错误字号、`--probe state` 注入错误语言，验证历史比较器能拒绝回归。SDK 默认合同的截图用于当前皮肤复核，单臂执行不冒称与旧界面像素相同。浏览器使用真实 Tauri CSP 和 fake bridge，不写真实宿主。真实 Mac 构建和 WKWebView 验收单独记账。

## 性能前后对照

性能使用独立入口，真实时钟、动画和绘制帧，不复用上面的暂停时钟。参考官方 `vercel-labs/ui/tests/perf` 的工作量、回收后资源和 gzip9 方法；它的 Agent benchmark 衡量工具调用/token，不能替代渲染性能。

```bash
node tools/ui-parity/benchmark.js --before 6988f7c --after origin/main \
  --working-tree --batch-before --samples 32 --cycles 200 --output /tmp/cavalry-sdk-performance
```

`--working-tree` 绑定当前候选文件 SHA；`--batch-before` 仅给固定旧 renderer 同样的通用日志帧合并优化，避免把通用优化计为 SDK 收益。`--enforce-after-budgets` 要求 Chromium 100行批量的 style recalculation 不超过20次，回归返回非零。

默认 Chromium/WebKit、400×504、scale2、四语轮转、AB/BA配对。记录新context启动与同context重载、可信键盘输入至两次rAF、弹窗开关/Tooltip/Toast/10与100行日志批量、4/10/500项Select导航工作量、独立CDP GC与监听器/脱离节点/堆保留检查。工作量包装不进入延迟样本。`--phase details|work|leaks` 可独立补测；`leaks`额外保存四批检查点及10秒静置后的回收结果。原始样本、错误、源commit、逐文件SHA、环境与实际harness副本都在输出目录。两次rAF只代表绘制机会，不代表屏幕实际呈现或亚帧CPU时间；fixture不测真实语言切换事务。无固定的跨机器毫秒预算。

macOS真实App对照必须从同一最新后端源码、同一工具链/资源构建两份测试App，只用显式`frontendDist`覆盖前后Git renderer，加入完全相同的就绪探针。不得把renderer导出目录当成完整构建源码；正式App和用户状态不覆盖。测试专用identifier、CSP localhost遥测例外仅存在输出配置中。输入目录保存`inputs.json`来源、两份`before|after/Cavalry SDK Benchmark.app`和一致探针：探针在语言trigger可用后等待两次rAF及fonts.ready，POST到`http://127.0.0.1:18763/ready`，包括readyMs、readyPaintMs、width/height、visibility等字段。

```bash
node tools/ui-parity/native-benchmark.js --inputs /tmp/cavalry-sdk-native --samples 16
```

原生入口预热每份两次，按AB/BA重新启动进程，显式隔离状态，只读取真实Tauri状态。记录进程创建至遥测收到的耗时（含本机HTTP开销）、400×504与可见状态，并用系统`footprint`采样host PID。该内存指标**不包含WebContent/Networking子进程**，不能声称整App内存下降。输出保留可执行文件摘要、包体积、原始样本及探针/脚本身份。浏览器诊断、真实WKWebView和既有功能/像素验收分别记账。
