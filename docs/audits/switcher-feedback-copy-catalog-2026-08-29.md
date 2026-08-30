<!--
[INPUT]: 依赖 renderer 的四语文案、Activity/Updater/Toast 状态机、Tauri Channel 合同与已批准 UX Writing/反馈分层裁决
[OUTPUT]: 对外提供 Event/AlertDialog/Toast 的生产归属与四语审阅快照，冻结“持久事实不叠 Toast、外围失败只用 Toast、更新可用只用标题栏入口”的裁决
[POS]: docs/audits 的反馈语义审阅面；供产品逐条裁决文案与承载组件，不替代 renderer/ui-text.js 运行时真相、后端 DTO 合同或 packaged 验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Switcher 反馈语义与四语文案审阅目录（2026-08-29）

状态: Review Draft

## 1. 阅读口径

- **Current**：当前生产代码已经存在，文字来自 `renderer/ui-text.js`。
- **Approved proposal**：交互方向已确认，但尚未接入生产。
- **Blocked**：视觉方向成立，但后端尚无足够真实事件，禁止前端伪造。
- Event 记录持续任务、持久阻塞和可恢复结果；AlertDialog 只承载必须立即作出的选择；Toast 只承载短暂摘要和安全即时动作。
- 只有任务引言与整体结果 Message 按 text delta 增长，不使用逐字符打字机，也不为每个 delta 添加入场动画；Marker 标题与次行只按真实阶段原位更新。滚动只在读者仍处于 live edge 时跟随，用户滚离后停止抢位置。参照 [shadcn Message Scroller](https://ui.shadcn.com/docs/components/base/message-scroller)。

## 2. 组件归属总表

| 场景 | 承载 | 状态 | 裁决 |
| --- | --- | --- | --- |
| 健康且尚未开始任务 | Event 空闲态 | Current | 框内水平/垂直居中，只显示一句任务邀请 |
| Switch 直接开始；Restore / Update 已确认 | Event 任务引言 | Current | 深色正文按上游语义 chunk 增长；不延迟后端事务 |
| Switch / Restore 四阶段 | Event Marker | Current | 稳定 phase 原位更新 running → terminal；只对已到达的快事件串行投影，错误立即抢占 |
| 阶段内文件/对象进度 | Marker 次行 description | Blocked | 当前 Apply Channel 只有 phase/state；必须增加受控 detail code 后才能上线 |
| Updater 下载百分比 | Marker 次行 description | Current | 使用后端 downloaded/contentLength，不伪造进度 |
| Switch / Restore 整体成功 | Event 结果 Message | Current | 位于 scroll-fade 外；四阶段全部完成且没有 warning 后出现，失败路径不得显示 |
| Update 整体成功 | Event 结果 Message | Blocked | 安装后当前进程退出；没有跨重启确认前不伪造不可见的成功结果 |
| 启动阻塞、事务警告、失败与恢复路径 | Event Marker | Current | 必须可回看，不允许只用会消失的 Toast |
| Restore / Update / 权限确认 | AlertDialog | Current | 用户必须继续或取消；打开时不叠 Toast；Switch 因运行中 fail-before-mutation 而直接执行 |
| 更新可用 | 标题栏绿色入口 + Tooltip + `aria-live` | Current | 持久状态已有稳定入口；点击后由 AlertDialog 承担版本、影响与操作，不重复 Toast |
| 独立 About/外链失败 | Toast | Current | 没有主任务承载位置的瞬时外围失败；标题 + 说明 + Close，右下向上，不增加重复 Retry Action |
| 长任务 loading/success | 不使用 Toast | Approved proposal | Event 已拥有事实，避免重复反馈 |

## 3. 空闲态、任务引言与结语（Current）

| ID | English | 简体中文 | 繁體中文 | 日本語 |
| --- | --- | --- | --- | --- |
| `idlePrompt` | What would you like to do? | 这次你想做什么？ | 這次你想做什麼？ | 今回は何をしますか？ |
| `applyIntro` | Preparing to switch to {language}… | 正在准备切换为{language}…… | 正在準備切換為{language}…… | {language}への切り替えを準備しています… |
| `restoreIntro` | Preparing to restore Cavalry… | 正在准备恢复 Cavalry…… | 正在準備還原 Cavalry…… | Cavalry の復元を準備しています… |
| `updateIntro` | Preparing the update… | 正在准备更新…… | 正在準備更新…… | 更新を準備しています… |
| `applyOutcome` | Switched to {language}. Cavalry is now open. | 已切换为{language}，Cavalry 已打开。 | 已切換為{language}，Cavalry 已開啟。 | {language}に切り替えました。Cavalry は起動済みです。 |
| `restoreOutcome` | Restored official English. Cavalry is now open. | 已恢复官方英文状态，Cavalry 已打开。 | 已還原官方英文狀態，Cavalry 已開啟。 | 公式の英語状態に戻しました。Cavalry は起動済みです。 |
| `updateOutcome` | — | — | — | — |

任务引言是一条 Message-like 行，下面才出现 Marker；整体结果复用同一 Message 结构。预览按 shadcn helper 的 `word + trailing whitespace` delta 模型持续更新同一文本节点，不给每个 delta 添加 opacity/transform 动画。由于文字是确定性的本地文案，生产不得把该视觉模拟描述成后端文本流。

Marker 不预铺未来阶段，也不把机器速度误当成人类可读速度。后端 Channel 仍实时执行，表现队列只消费已经到达的真实事件：首个阶段立即出现，过快的 `running → terminal` 至少保留 `360ms` 可读时间，相邻新阶段以 `120ms` 分隔；若后端本身更慢则不增加等待。任何 error 立即取消等待，先同步已经到达的前序事实，再投影错误；尚未到达的阶段和成功结果句都不出现。`prefers-reduced-motion` 下上述表现等待与入场动画归零，但业务顺序不变。

任务容器保留一层外边框，并显式区分两个布局状态：idle 使用覆盖完整内容区的单轨，任务邀请以整个外框为参照水平/垂直居中；running 才拆为顶部任务引言 Message、中部无边框 Marker scroll-fade、底部整体结果 Message 三轨。引言与结果不参与滚动、不受 fade 遮罩；只有中间阶段记录在内容溢出时滚动。引言说明“要做什么”，阶段说明“做到哪里”，结果说明“最终发生了什么”。结果是完整 Body Message 句子，因此 English 用 `.`、简繁中文与日本語用 `。` 收尾；标题、按钮和 Marker 短标签继续不加句号。结果只能由完整成功路径追加，任何 warning/error 都必须终止成功结语。Updater 会在安装后结束当前进程，现有合同无法证明用户看到了重启后的新版本，因此 `updateOutcome` 保持 Blocked；未来只能由新进程读取一次性、版本绑定的更新完成凭据后补写。

## 4. 任务阶段 Event（Current）

| 事件 ID | English | 简体中文 | 繁體中文 | 日本語 |
| --- | --- | --- | --- | --- |
| `bootstrap` | Loading Cavalry | 正在载入 Cavalry | 正在載入 Cavalry | Cavalry を読み込み中 |
| `apply.verify.running` | Checking the Cavalry installation | 正在检查 Cavalry 安装 | 正在檢查 Cavalry 安裝 | Cavalry のインストールを確認中 |
| `apply.verify.completed` | Cavalry installation verified | 已验证 Cavalry 安装 | 已驗證 Cavalry 安裝 | Cavalry のインストールを確認しました |
| `apply.verify.error` | Couldn’t verify the Cavalry installation | 无法验证 Cavalry 安装 | 無法驗證 Cavalry 安裝 | Cavalry のインストールを確認できません |
| `apply.baseline.running` | Preparing recovery files | 正在准备恢复文件 | 正在準備還原檔案 | 復元ファイルを準備中 |
| `apply.baseline.completed` | Recovery files ready | 恢复文件已就绪 | 還原檔案已就緒 | 復元ファイルの準備ができました |
| `apply.baseline.error` | Couldn’t prepare recovery files | 无法准备恢复文件 | 無法準備還原檔案 | 復元ファイルを準備できません |
| `apply.transaction.running` | Switching Cavalry to {language} | 正在将 Cavalry 切换为{language} | 正在將 Cavalry 切換為{language} | Cavalry を{language}に切り替え中 |
| `apply.transaction.completed` | Switched to {language} | 已切换为{language} | 已切換為{language} | {language}に切り替えました |
| `apply.transaction.error` | Couldn’t switch to {language} | 无法切换为{language} | 無法切換為{language} | {language}に切り替えられません |
| `restore.transaction.running` | Restoring Cavalry | 正在恢复 Cavalry | 正在還原 Cavalry | Cavalry を復元中 |
| `restore.transaction.completed` | Cavalry restored | 已恢复 Cavalry | 已還原 Cavalry | Cavalry を復元しました |
| `restore.transaction.error` | Couldn’t restore Cavalry | 无法恢复 Cavalry | 無法還原 Cavalry | Cavalry を復元できません |
| `restart.running` | Opening Cavalry | 正在打开 Cavalry | 正在開啟 Cavalry | Cavalry を起動中 |
| `restart.completed` | Cavalry opened | Cavalry 已打开 | Cavalry 已開啟 | Cavalry を起動しました |
| `restart.warning` | Cavalry did not open | Cavalry 未打开 | Cavalry 未開啟 | Cavalry を起動できませんでした |
| `restart.error` | Cavalry did not open | Cavalry 未打开 | Cavalry 未開啟 | Cavalry を起動できませんでした |
| `update.download.running` | Downloading version {version} | 正在下载版本 {version} | 正在下載版本 {version} | バージョン {version} をダウンロード中 |
| `update.download.detail` | {percent}% downloaded | 已下载 {percent}% | 已下載 {percent}% | {percent}% ダウンロード済み |
| `update.download.completed` | Update downloaded | 更新已下载 | 更新已下載 | 更新をダウンロードしました |
| `update.install.running` | Verifying and installing the update | 正在验证并安装更新 | 正在驗證並安裝更新 | 更新を検証してインストール中 |
| `update.install.completed` | Update installed | 更新已安装 | 更新已安裝 | 更新をインストールしました |
| `update.restart.running` | Restarting the Switcher | 正在重启语言切换器 | 正在重新啟動語言切換器 | 言語スイッチャーを再起動中 |

### 4.1 阶段内次行

- Updater 下载百分比已经有真实字节计数，可直接在当前 Marker 次行原位更新。
- Switch/Restore 当前 `OperationEvent` 只有 `phase` 与 `state`，没有文件名、索引或总数。预览里的 `appStrings.json` 等仅用于评审信息层级，不是生产证据。
- 正确扩展应发送稳定、受控的 detail code 或已验证 manifest item id；renderer 再本地化为可读叶名称。禁止发送任意绝对路径、临时目录、签名内容或底层错误原文。

## 5. 持久 Event 状态（Current）

| 触发/代码 | English | 简体中文 | 繁體中文 | 日本語 |
| --- | --- | --- | --- | --- |
| `transportFailure` | <strong>Desktop service unavailable</strong><br>Could not contact the desktop service. Try again. | <strong>桌面服务不可用</strong><br>无法连接桌面服务，请重试。 | <strong>桌面服務無法使用</strong><br>無法連線至桌面服務，請重試。 | <strong>デスクトップサービスを利用できません</strong><br>デスクトップサービスに接続できませんでした。もう一度お試しください。 |
| `stateDurabilityPending` | <strong>Restart the Switcher</strong><br>Restart the Switcher before applying a language or restoring Cavalry. | <strong>重启语言切换器</strong><br>重启语言切换器，然后再应用语言或恢复 Cavalry。 | <strong>重新啟動語言切換器</strong><br>重新啟動語言切換器，然後再套用語言或還原 Cavalry。 | <strong>言語スイッチャーを再起動</strong><br>言語の適用または Cavalry の復元前に、言語スイッチャーを再起動してください。 |
| `recoveryCleanupPending` | <strong>Recovery cleanup is pending</strong><br>Recovery cleanup is still pending. Keep the recovery files until the Switcher completes cleanup. | <strong>恢复清理尚未完成</strong><br>恢复清理仍未完成。请保留恢复文件，等待切换器完成清理。 | <strong>復原清理尚未完成</strong><br>復原清理仍未完成。請保留復原檔案，等待切換器完成清理。 | <strong>復旧処理が完了していません</strong><br>復旧用ファイルのクリーンアップがまだ完了していません。Switcher が完了するまで復旧用ファイルを残してください。 |
| `protectedRecoveryEvidenceRetained` | <strong>Keep the recovery files</strong><br>Recovery files are still needed. Do not delete them manually. | <strong>请保留恢复文件</strong><br>恢复文件仍然需要保留，请勿手动删除。 | <strong>請保留復原檔案</strong><br>復原檔案仍需保留，請勿手動刪除。 | <strong>復旧ファイルを残してください</strong><br>復旧ファイルはまだ必要です。手動で削除しないでください。 |
| `temporaryCleanupPending` | <strong>Temporary cleanup is pending</strong><br>Temporary cleanup is still pending. Close the Switcher before removing temporary files. | <strong>临时清理尚未完成</strong><br>临时清理仍未完成。请先关闭切换器，再移除临时文件。 | <strong>暫存清理尚未完成</strong><br>暫存清理仍未完成。請先關閉切換器，再移除暫存檔案。 | <strong>一時ファイルの処理が完了していません</strong><br>一時ファイルのクリーンアップがまだ完了していません。Switcher を終了してから一時ファイルを削除してください。 |
| `finderFallbackUsed` | <strong>Finder replacement was used</strong><br>macOS used Finder-style replacement because direct copy was blocked. | <strong>已使用 Finder 替换文件</strong><br>macOS 阻止直接复制后，已改用 Finder 方式替换文件。 | <strong>已使用 Finder 替換檔案</strong><br>macOS 阻止直接複製後，已改用 Finder 方式替換檔案。 | <strong>Finder 方式で置き換えました</strong><br>macOS が直接コピーを拒否したため、Finder 方式でファイルを置き換えました。 |
| `nonFatalCleanup` | <strong>Cleanup needs attention</strong><br>A non-fatal cleanup step still needs attention. | <strong>清理仍需处理</strong><br>仍有一项非致命清理需要处理。 | <strong>清理仍需處理</strong><br>仍有一項非致命清理需要處理。 | <strong>クリーンアップを確認してください</strong><br>致命的ではないクリーンアップ処理が残っています。 |
| `updaterNotConfigured` | <strong>Automatic updates unavailable</strong><br>Automatic updates are not configured for this build. | <strong>自动更新不可用</strong><br>此构建尚未配置自动更新。 | <strong>自動更新無法使用</strong><br>此建置尚未設定自動更新。 | <strong>自動更新を利用できません</strong><br>このビルドには自動更新が設定されていません。 |
| `updaterUnsupportedPlatform` | <strong>Automatic updates unavailable</strong><br>Automatic updates are not supported on this platform. | <strong>自动更新不可用</strong><br>此平台不支持自动更新。 | <strong>自動更新無法使用</strong><br>此平台不支援自動更新。 | <strong>自動更新を利用できません</strong><br>このプラットフォームでは自動更新を利用できません。 |
| `updateCheckFailed` | <strong>Couldn’t check for updates</strong><br>Could not check for updates. | <strong>无法检查更新</strong><br>无法检查更新。 | <strong>無法檢查更新</strong><br>無法檢查更新。 | <strong>更新を確認できません</strong><br>更新を確認できませんでした。 |
| `updateInstallFailed` | <strong>Couldn’t install the update</strong><br>The update could not be installed. The current version remains available. | <strong>无法安装更新</strong><br>无法安装更新，当前版本仍可继续使用。 | <strong>無法安裝更新</strong><br>無法安裝更新，目前版本仍可繼續使用。 | <strong>更新をインストールできません</strong><br>更新をインストールできませんでした。現在のバージョンは引き続き使用できます。 |
| `updateNotChecked` | <strong>Check for updates again</strong><br>Check for an update again before installing. | <strong>重新检查更新</strong><br>请重新检查更新后再安装。 | <strong>重新檢查更新</strong><br>請重新檢查更新後再安裝。 | <strong>更新をもう一度確認</strong><br>インストールする前に更新をもう一度確認してください。 |
| `updateBusy` | <strong>Another operation is running</strong><br>Another Switcher operation is already running. | <strong>正在执行其他操作</strong><br>语言切换器正在执行其他操作。 | <strong>正在執行其他操作</strong><br>語言切換器正在執行其他操作。 | <strong>別の操作を実行中です</strong><br>言語スイッチャーで別の操作を実行中です。 |
| `updateStateUnavailable` | <strong>Check for updates again</strong><br>The checked update state is unavailable. Restart the Switcher and check again. | <strong>重新检查更新</strong><br>已检查的更新状态不可用，请重启语言切换器后重新检查。 | <strong>重新檢查更新</strong><br>已檢查的更新狀態無法使用，請重新啟動語言切換器後再檢查。 | <strong>更新をもう一度確認</strong><br>確認済みの更新状態を利用できません。言語スイッチャーを再起動して、もう一度確認してください。 |
| `permissionRequired` | <strong>System permission required</strong><br>Approve the system request, then retry. | <strong>需要系统权限</strong><br>批准系统权限请求，然后重试。 | <strong>需要系統權限</strong><br>允許系統權限要求，然後重試。 | <strong>システム権限が必要です</strong><br>システムの権限要求を許可してから再試行してください。 |
| `startupRecoveryFailed` | <strong>Couldn’t recover the interrupted operation</strong><br>Couldn’t recover an interrupted update. Close Cavalry and restart the Switcher. Don’t modify the installation manually. | <strong>无法恢复中断的操作</strong><br>无法恢复中断的更新。请关闭 Cavalry 并重启语言切换器，不要手动修改安装目录。 | <strong>無法復原中斷的操作</strong><br>無法復原中斷的更新。請關閉 Cavalry 並重新啟動語言切換器，不要手動修改安裝目錄。 | <strong>中断した操作を復旧できません</strong><br>中断した更新を復旧できません。Cavalry を終了して言語スイッチャーを再起動し、インストール先を手動で変更しないでください。 |
| `noInstallation.startup` | <strong>Choose Cavalry</strong><br>Choose a Cavalry installation to continue. | <strong>选择 Cavalry 安装位置</strong><br>请选择 Cavalry 安装位置后继续。 | <strong>選擇 Cavalry 安裝位置</strong><br>請先選擇 Cavalry 安裝位置再繼續。 | <strong>Cavalry のインストール先を選択</strong><br>続行するには Cavalry のインストール先を選択してください。 |
| `noInstallation.action` | <strong>Choose Cavalry</strong><br>Choose a Cavalry installation first. | <strong>选择 Cavalry 安装位置</strong><br>请先选择 Cavalry 安装位置。 | <strong>選擇 Cavalry 安裝位置</strong><br>請先選擇 Cavalry 安裝位置。 | <strong>Cavalry のインストール先を選択</strong><br>先に Cavalry のインストール先を選択してください。 |
| `reinstallRequired` | <strong>Reinstall Cavalry</strong><br>The original English files cannot be verified. Reinstall Cavalry from the official installer, then reopen the Switcher. | <strong>重新安装 Cavalry</strong><br>无法验证原始英文文件。使用官方安装包重新安装 Cavalry，然后重新打开语言切换器。 | <strong>重新安裝 Cavalry</strong><br>無法驗證原始英文檔案。使用官方安裝程式重新安裝 Cavalry，然後重新開啟語言切換器。 | <strong>Cavalry を再インストール</strong><br>元の英語ファイルを確認できません。公式インストーラーで Cavalry を再インストールしてから、言語スイッチャーを開き直してください。 |
| `windowsRuntimeResidue` | <strong>Restore Cavalry to finish cleanup</strong><br>Files from a previous Windows language setup are still active. Choose Restore English to finish cleanup. | <strong>恢复 Cavalry 以完成清理</strong><br>之前的 Windows 语言设置仍有文件在生效。选择“恢复英文”以完成清理。 | <strong>還原 Cavalry 以完成清理</strong><br>之前的 Windows 語言設定仍有檔案在生效。選擇「還原英文」以完成清理。 | <strong>Cavalry を復元してクリーンアップを完了</strong><br>以前の Windows 言語設定のファイルがまだ有効です。「英語に戻す」を選んでクリーンアップを完了してください。 |
| `customRootNotWritable` | <strong>Cavalry folder isn’t writable</strong><br>Cavalry’s folder isn’t writable. Administrator retry only supports Program Files. Choose a writable copy or change the folder permissions. | <strong>Cavalry 文件夹不可写</strong><br>Cavalry 文件夹不可写。仅“Program Files”中的安装可以管理员身份重试。请选择可写副本或修改文件夹权限。 | <strong>Cavalry 資料夾無法寫入</strong><br>Cavalry 資料夾無法寫入。只有「Program Files」中的安裝可用系統管理員身分重試。請選擇可寫入的副本或修改資料夾權限。 | <strong>Cavalry フォルダーに書き込めません</strong><br>Cavalry フォルダーに書き込めません。管理者として再試行できるのは Program Files 内だけです。書き込み可能なコピーを選ぶか、アクセス権を変更してください。 |
| `permissionMayBeRequired` | <strong>System permission may be required</strong><br>System permission may be required to modify the Cavalry installation. | <strong>可能需要系统权限</strong><br>修改 Cavalry 安装目录可能需要系统授权。 | <strong>可能需要系統權限</strong><br>修改 Cavalry 安裝目錄可能需要系統授權。 | <strong>システム権限が必要な場合があります</strong><br>Cavalry のインストール先を変更するにはシステム権限が必要な場合があります。 |
| `noLanguage` | <strong>Choose a language</strong><br>Choose a language before switching. | <strong>选择语言</strong><br>选择语言后再切换。 | <strong>選擇語言</strong><br>選擇語言後再切換。 | <strong>言語を選択</strong><br>言語を選択してから切り替えてください。 |
| `cavalryStillRunning` | <strong>Close Cavalry before retrying</strong><br>Cavalry is still running. Save your work, close Cavalry, and try again. The Cavalry installation was not changed. | <strong>关闭 Cavalry 后重试</strong><br>Cavalry 仍在运行。请先保存工作并关闭 Cavalry，然后重试；Cavalry 安装内容未被修改。 | <strong>關閉 Cavalry 後重試</strong><br>Cavalry 仍在執行。請先儲存工作並關閉 Cavalry，然後重試；Cavalry 安裝內容未被修改。 | <strong>Cavalry を終了して再試行</strong><br>Cavalry がまだ起動しています。作業を保存して Cavalry を終了してから再試行してください。Cavalry のインストール内容は変更されていません。 |
| `openPrivacyFailed` | <strong>Couldn’t open permission settings</strong><br>Open Privacy & Security in System Settings, then allow the Switcher to modify Cavalry. | <strong>无法打开权限设置</strong><br>请在系统设置中打开“隐私与安全性”，允许语言切换器修改 Cavalry。 | <strong>無法打開權限設定</strong><br>請在系統設定中打開「隱私權與安全性」，允許語言切換器修改 Cavalry。 | <strong>権限設定を開けません</strong><br>システム設定で「プライバシーとセキュリティ」を開き、Switcher に Cavalry の変更を許可してください。 |

## 6. AlertDialog（Current）

| 场景 | English | 简体中文 | 繁體中文 | 日本語 |
| --- | --- | --- | --- | --- |
| `switch.confirm` | —（直接进入任务流） | —（直接进入任务流） | —（直接進入任務流程） | —（直接タスクを開始） |
| `restore.confirm` | <strong>Restore Cavalry?</strong><br>Cavalry will return to its official English state. Switcher translation files will be removed, then Cavalry will open.<br><code>Cancel · Restore English</code> | <strong>恢复 Cavalry？</strong><br>Cavalry 将恢复为官方英文状态。语言切换器添加的翻译文件会被移除，随后 Cavalry 将打开。<br><code>取消 · 恢复英文</code> | <strong>還原 Cavalry？</strong><br>Cavalry 將還原為官方英文狀態。語言切換器加入的翻譯檔案會被移除，隨後 Cavalry 將開啟。<br><code>取消 · 還原英文</code> | <strong>Cavalry を復元しますか？</strong><br>Cavalry を公式の英語状態に戻します。言語スイッチャーが追加した翻訳ファイルを削除してから、Cavalry を起動します。<br><code>キャンセル · 英語に戻す</code> |
| `update.confirm` | <strong>Update the Switcher?</strong><br>Version {version} is ready. The Switcher will download, verify, replace itself, and restart.<br><em>macOS:</em> This update installs a new macOS app bundle. If the release is not Developer ID notarized, complete the documented local ad-hoc and Gatekeeper step again for the new bundle.<br><code>Cancel · Update & Restart</code> | <strong>更新语言切换器？</strong><br>版本 {version} 已准备好。语言切换器将下载并验证更新，替换自身后重新启动。<br><em>macOS:</em> 此次更新会安装一个新的 macOS 应用包。若发布版本没有 Developer ID 公证，新包仍需重新执行发布说明中的本地 ad-hoc 与 Gatekeeper 步骤。<br><code>取消 · 更新并重启</code> | <strong>更新語言切換器？</strong><br>版本 {version} 已準備好。語言切換器將下載並驗證更新，替換自身後重新啟動。<br><em>macOS:</em> 此次更新會安裝一個新的 macOS 應用程式套件。若發布版本沒有 Developer ID 公證，新套件仍需重新執行發布說明中的本機 ad-hoc 與 Gatekeeper 步驟。<br><code>取消 · 更新並重新啟動</code> | <strong>言語スイッチャーを更新しますか？</strong><br>バージョン {version} を利用できます。更新をダウンロードして検証し、アプリを置き換えて再起動します。<br><em>macOS:</em> この更新では新しい macOS アプリバンドルがインストールされます。Developer ID で公証されていないリリースでは、新しいバンドルに対してリリース案内のローカル ad-hoc と Gatekeeper の手順をもう一度実行してください。<br><code>キャンセル · 更新して再起動</code> |
| `permission.confirm` | <strong>System permission required</strong><br>Approve the operating system permission request for Cavalry Language Switcher, then retry.<br><code>Cancel · Open Settings / Retry as administrator</code> | <strong>需要系统授权</strong><br>请批准操作系统为 Cavalry 语言切换器显示的权限请求，然后重试。<br><code>取消 · 打开设置 / 以管理员身份重试</code> | <strong>需要系統授權</strong><br>請允許作業系統為 Cavalry 語言切換器顯示的權限請求，然後重試。<br><code>取消 · 打開設定 / 以系統管理員身分重試</code> | <strong>システム権限が必要です</strong><br>Cavalry 言語スイッチャーに対するオペレーティングシステムの権限要求を許可してから再試行してください。<br><code>キャンセル · 設定を開く / 管理者として再試行</code> |

## 7. Toast（Current）

| ID / type | English | 简体中文 | 繁體中文 | 日本語 |
| --- | --- | --- | --- | --- |
| `about.openFailed`<br>`error` | <strong>Couldn’t open About</strong><br>Could not open About. Try again.<br><code>Close</code> | <strong>无法打开关于窗口</strong><br>无法打开“关于”窗口，请重试。<br><code>关闭</code> | <strong>無法開啟關於視窗</strong><br>無法開啟「關於」視窗，請重試。<br><code>關閉</code> | <strong>「このアプリについて」を開けませんでした</strong><br>「このアプリについて」を開けませんでした。もう一度お試しください。<br><code>閉じる</code> |
| `projectLink.openFailed`<br>`error` | <strong>Couldn’t open the project link</strong><br>Check your default browser, then try again.<br><code>Close</code> | <strong>无法打开项目链接</strong><br>检查默认浏览器后重试。<br><code>关闭</code> | <strong>無法打開專案連結</strong><br>檢查預設瀏覽器後重試。<br><code>關閉</code> | <strong>プロジェクトリンクを開けませんでした</strong><br>既定のブラウザを確認して、再試行してください。<br><code>閉じる</code> |

更新可用不进入 Toast：绿色标题栏入口已经同时承担持久状态和操作入口，Tooltip 解释含义，现有 `role="status"` / `aria-live` 文案负责非视觉公告，点击后的 AlertDialog 再承担版本、影响与明确动作。应用内 Toast 既不能覆盖用户不在查看窗口的情况，也只会重复同一事实；若未来需要跨应用提醒，应另行评估系统通知，而不是借 Toast 假装完成。

Toast 的 `success` 与 `loading` 虽是 Base Toast 内置类型，但当前产品没有独立使用理由：持续任务与最终结果已经由 Event 持有。除非未来出现不属于任务流且没有持久入口的瞬时成功，否则不接入。

生产 Toast 对齐 shadcn 固定源码与其 `@base-ui/react 1.6.0` primitive：普通通知默认停留 `5000ms`，最多 `3` 条，`loading` 不自动关闭；鼠标悬停、键盘焦点进入或窗口失焦时暂停，并按剩余时间恢复。Viewport 保留上游 `16px` inset，与主内容 `20px` 网格有意错层；内容继续消费项目的 14px/500、颜色、圆角和阴影 token。

## 8. 当前阻塞与下一步

1. 先由产品审阅本目录中的承载组件与四语语感。
2. 任务引言、空闲态、Switch/Restore 成功结语和 live-edge 跟随已接入；成功结语必须继续绑定完整 terminal success。
3. 文件级轮换必须先扩展 Rust `OperationReporter` 与 bridge allowlist，并证明每条 detail 对应真实处理边界。
4. Toast 已完成静态与 Node VM 合同；原生窗口视觉仍需和其他 UI 一起审核，不能把合同冒充 packaged/native PASS。
