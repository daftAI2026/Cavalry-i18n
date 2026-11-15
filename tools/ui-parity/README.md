# Renderer main / SDK 对照验收

目标是让当前 SDK 实现通过 main 的同一套黑盒合同。使用固定 commit 的真实 renderer 和审查夹具作为参考；测试不读取 SDK 内部状态，也不根据候选实现生成预期。

先使用项目固定的 Node/npm，安装开发依赖和浏览器：

```bash
npm ci
npx playwright install chromium
git fetch origin main
ui_parity_reference="$(git rev-parse origin/main)"
ui_parity_output="$(mktemp -d "${TMPDIR:-/tmp}/cavalry-ui-parity.XXXXXX")"
npm run build:ui-sdk
npm run test:ui:parity -- --reference "$ui_parity_reference" --output "$ui_parity_output"
```

`report.json` 保存参考 commit、候选 commit/文件摘要（含实际fixture、构建脚本、依赖锁与CSP配置）、环境、每步状态、几何、像素比较和 SDK 实例覆盖。截图、逐例 trace 与差分图都在输出目录。像素比较要求 截图 RGB 通道零差异；位置、尺寸、排印、颜色、间距和圆角也逐项比较。失败返回非零。

完整矩阵默认覆盖四语。控件包含多字符搜索/循环/跳过禁用项、空值、已选、悬停、按下、焦点、键盘提交、Escape、Tab、禁用与忙碌；弹窗包含确认/取消、原生焦点循环与权限 native ACK；Toast 包含堆叠、超限丢弃、完整进入/退出/首次挂载前同步关闭、计时/暂停/F6/焦点/原生Tab顺序/拖选/三种关闭输入；还覆盖任务错误/成功、4px跟随边界、阅读位置、内容不溢出后恢复跟随、浏览器原生Tab路线、弹层间焦点/点击/遮挡、真实下载百分比、链接、宽度边界、Reduce Motion 和三种手势目标。`ui_sdk_components.json` 的15种基础组件、6种业务组合必须全部实际实例化。

状态机比较包含 bridge 调用和事件顺序、原生 Select 值、选中/高亮/禁用项、活动项、焦点、提示、通知与手势状态。布局仍由 main 的 token/CSS 定义。Button/Link、ScrollArea、Progress 使用 Web 组件；ScrollArea绑定时尊重作者tabindex，SDK同步升级完成后归还浏览器原生Tab策略，避免WebKit额外Tab停点；Toast使用原有Core primitive及公开render hook保留main追加顺序/F6，原生beforetoggle取消额外top-layer提升；Select、Tooltip、AlertDialog 使用公开 Core 扩展，保持 main 的虚拟焦点、布局上下文和原生 dialog；纯展示组件使用 Core parts。不会导入 SDK 私有模块。

先复测基线本身，再诊断候选：

```bash
npm run test:ui:parity -- --reference "$ui_parity_reference" --self-reference --cases selection,restore,toast-timer --locales en --output /tmp/cavalry-main-control
```

动画稳定态和中间帧分开采样。稳定态等待/结束有限动画；中间帧按相同相对进度采样。在首次导航前显式pauseAt暂停时钟，只有runFor推进；每次截图前清空当前时刻到期回调，并断言截图期间Date.now不变。Reduce Motion包含已选文字完整像素对照。每张截图要求连续两帧完全相同（至多五帧，不推进输入或时钟），否则失败；不使用像素容差。稳定态先让两个绘制帧完成，再结束有限动画；暂停时钟下显式取消已完成CSS transition的合成效果，使目标CSS重新栅格化，避免缩放文字沿用中间帧的缓存；不修改产品样式；中间帧保持指定进度。背景通知使用同一 `document.hasFocus` 和 blur/focus fixture 输入，因为 Playwright 默认对所有页面强制焦点；该用例不冒充真实操作系统窗口切换验收。

验证测试能拒绝回归：以下命令只在候选响应中注入错误字号，应返回非零，且报告出现像素/几何差异。

```bash
npm run test:ui:parity -- --reference "$ui_parity_reference" --self-reference --probe visual --cases controls --locales en --output /tmp/cavalry-visual-red
npm run test:ui:parity -- --reference "$ui_parity_reference" --self-reference --probe state --cases business --locales en --output /tmp/cavalry-state-red
```

用 `--cases <逗号分隔名称>`、`--locales en` 缩小复验范围；未知用例会报错。基线导出目录只供测试，禁止从它构建 App。浏览器夹具使用真实 Tauri CSP 和 fake bridge；真实 Mac App 的构建、签名/资源校验与 WKWebView 验收另行执行。
