<!--
[INPUT]: 依赖 Cavalry 运行时英文 source、translation-guidelines.md 的翻译边界与各平台产品名事实
[OUTPUT]: 对外提供 en/zh-Hans/zh-Hant/ja_JP 四语术语、品牌保留与显示层例外的规范表
[POS]: docs 的术语真相源，被三语 TS/JSON 翻译、质量检查与人工审校共同消费
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

| en | zh-Hans | zh-Hant | ja_JP | note |
|---|---|---|---|---|
| Language Switcher | 语言切换器 | 語言切換器 | 言語切り替え | UI name |
| Position | 位置 | 位置 | 位置 | Align with After Effects / Blender terminology |
| Rotation | 旋转 | 旋轉 | 回転 | Do not use "转动" |
| Scale | 缩放 | 縮放 | スケール | Do not use "比例" |
| Opacity | 不透明度 | 不透明度 | 不透明度 | Do not simplify to "透明度" |
| Transform | 变换 | 變換 | トランスフォーム | UI / animation context |
| Anchor Point | 锚点 | 錨點 | アンカーポイント | |
| Pivot | 锚点 | 錨點 | ピボット | Use same term as Anchor Point unless context requires distinction |
| Keyframe | 关键帧 | 關鍵幀 | キーフレーム | Do not use "关键格" |
| Direct Layer Selection | 直接选择图层 | 直接選取圖層 | レイヤーを直接選択 | Transform Tool action; “Direct” describes the selection mode, never “项目 / 項目” |
| Snapping | 吸附 | 吸附 | スナップ | Graphics alignment behavior; do not translate as “抓取” |
| Easing | 缓动 | 緩動 | イージング | |
| Ease In | 缓入 | 緩入 | イーズイン | |
| Ease Out | 缓出 | 緩出 | イーズアウト | |
| Composition | 合成 | 合成 | コンポジション | Do not use "组合" |
| Pre-compose | 预合成 | 預合成 | プリコンポーズ | |
| Layer | 图层 | 圖層 | レイヤー | Do not use "层" |
| Parent | 父级 | 父級 | 親 | Hierarchy context |
| Child | 子级 | 子級 | 子 | Hierarchy context |
| Mask | 蒙版 | 遮罩 | マスク | zh-Hans: Prefer AE terminology over "遮罩" |
| Stroke | 描边 | 描邊 | ストローク | |
| Pen Tool | 钢笔工具 | 鋼筆工具 | ペンツール | Vector path editing tool |
| Pencil Tool | 铅笔工具 | 鉛筆工具 | 鉛筆ツール | Freehand drawing tool |
| Fill | 填充 | 填充 | 塗り | |
| Bezier | 贝塞尔 | 貝茲 | ベジェ | Use standard Chinese graphics term |
| Path | 路径 | 路徑 | パス | |
| Curve | 曲线 | 曲線 | カーブ | |
| Viewport | 视口 | 檢視區 | ビューポート | Do not use "视窗" |
| Deformer | 变形器 | 變形器 | デフォーマ | Cinema 4D terminology |
| Shader | 着色器 | 著色器 | シェーダー | |
| Render | 渲染 | 算繪 | レンダリング | |
| Blending Mode | 混合模式 | 混合模式 | 描画モード | Do not use "融合模式" |
| Expression | 表达式 | 運算式 | エクスプレッション | Do not use "公式" |
| Null | 空对象 | 空物件 | ヌル | Do not shorten to "空" |
| Duplicator | 复制器 | 複製器 | デュプリケーター | Cinema 4D terminology |
| Node | 节点 | 節點 | ノード | |
| Bone | 骨骼 | 骨骼 | ボーン | Rigging/Bone Tool display term; do not use “骨头 / 骨頭” or bare Japanese “骨” |
| Smoothing Steps | 平滑步数 | 平滑步數 | スムージングステップ数 | Cavalry 2.7.2 cross-platform `smoother` attribute; align with existing Smooth / smoothing terminology |
| Pitch Radius | 节圆半径 | 節圓半徑 | ピッチ半径 | Cog/gear geometry; JSON attribute and runtime CogTool prefix must stay aligned |
| Basic Shape | 基本形状 | 基本形狀 | 基本シェイプ | |
| Property | 属性 | 屬性 | プロパティ | |
| Tooltip | 工具提示 | 工具提示 | ツールチップ | Microsoft UI terminology |
| Tip | 提示 | 提示 | ヒント | |
| Onboarding | 新手引导 | 新手導覽 | オンボーディング | Product education context |
| Plugin | 插件 | 外掛程式 | プラグイン | |
| Preset | 预设 | 預設 | プリセット | |
| Timeline | 时间线 | 時間軸 | タイムライン | |
| Graph Editor | 图形编辑器 | 圖形編輯器 | グラフエディター | After Effects terminology |
| Motion Blur | 运动模糊 | 動態模糊 | モーションブラー | |
| Gradient | 渐变 | 漸層 | グラデーション | |
| Scene | 场景 | 場景 | シーン | |
| Preview | 预览 | 預覽 | プレビュー | |
| Playback | 播放 | 播放 | 再生 | |
| Loop | 循环 | 循環 | ループ | |
| Resolution | 分辨率 | 解析度 | 解像度 | |
| Frame Rate | 帧率 | 幀率 | フレームレート | |
| Workspace | 工作区 | 工作區 | ワークスペース | |
| Preferences | 首选项 | 偏好設定 | 環境設定 | macOS-style UI wording |
| Apply | 应用 | 套用 | 適用 | |
| Restart | 重新启动 | 重新啟動 | 再起動 | |
| Switch | 切换 | 切換 | 切り替える | Switcher primary button; starts the language transaction directly |
| Save | 保存 | 儲存 | 保存 | |
| Save As | 另存为 | 另存新檔 | 名前を付けて保存 | |
| Open | 打开 | 開啟 | 開く | |
| Close | 关闭 | 關閉 | 閉じる | |
| File | 文件 | 檔案 | ファイル | Microsoft UI terminology |
| Edit | 编辑 | 編輯 | 編集 | Microsoft UI terminology |
| View | 视图 | 檢視 | 表示 | Microsoft UI terminology |
| Window | 窗口 | 視窗 | ウィンドウ | Microsoft UI terminology |
| Scripts | 脚本 | 腳本 | スクリプト | |
| Alpha | Alpha | Alpha | Alpha | In channel context, allow "Alpha 通道" |
| RGB | RGB | RGB | RGB | Keep English acronym |
| CMYK | CMYK | CMYK | CMYK | Keep English acronym |
| SVG | SVG | SVG | SVG | Keep English acronym |
| JSON | JSON | JSON | JSON | Keep English acronym |
| CSV | CSV | CSV | CSV | Keep English acronym |
| FPS | FPS | FPS | FPS | Keep English acronym |
| BPM | BPM | BPM | BPM | Keep English acronym |
| GPU | GPU | GPU | GPU | Keep English acronym |
| Lottie | Lottie | Lottie | Lottie | Product / format name |
| Cavalry | Cavalry | Cavalry | Cavalry | Product name |
| Canva | Canva | Canva | Canva | Brand name |
| Finder | 访达 | Finder | Finder | macOS product name; use Apple’s localized Simplified Chinese name and preserve the product name in Traditional Chinese/Japanese |
| QuickTime | QuickTime | QuickTime | QuickTime | Apple media format brand; preserve in render-format lists |
| Excel | Excel | Excel | Excel | Product name; allow labels like "Excel 工作表" / "Excel シート" |
| Forge Dynamics | Forge 动力学 | Forge 動力學 | フォージダイナミクス | UI display term; keep model niceName English |
| Undo | 撤销 | 復原 | 元に戻す | |
| Redo | 重做 | 重做 | やり直し | |
| Copy | 复制 | 複製 | コピー | |
| Paste | 粘贴 | 貼上 | ペースト | |
| Delete | 删除 | 刪除 | 削除 | |
| Group | 编组 | 群組 | グループ | |
| Export | 导出 | 匯出 | エクスポート | |
| Import | 导入 | 匯入 | インポート | |
| Color | 颜色 | 顏色 | カラー | |
| Animation | 动画 | 動畫 | アニメーション | |
| Offset | 偏移 | 偏移 | オフセット | |
| Select All | 全选 | 全選 | すべて選択 | |
| Default | 默认 | 預設 | デフォルト | |
| Video | 视频 | 影片 | ビデオ | |
| Program | 程序 | 程式 | プログラム | |
| Information | 信息 | 資訊 | 情報 | |
| Software | 软件 | 軟體 | ソフトウェア | |
| Print | 打印 | 列印 | 印刷 | |
