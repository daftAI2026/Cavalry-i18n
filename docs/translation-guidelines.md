# 翻译原则

## 1. 首要原则：跟行业内已有软件保持一致

Cavalry 是动效/动画软件，用户同时也用 **After Effects、Cinema 4D、Blender、DaVinci Resolve**。这些软件的官方多语言版本已经建立了约定俗成的术语，**必须对齐**，不要自己造词。

### 简体中文参考

| English | 简体中文（AE/C4D 标准） | ❌ 不要翻成 |
|---------|----------------------|------------|
| Position | 位置 | 定位 |
| Rotation | 旋转 | 转动 |
| Scale | 缩放 | 比例 |
| Opacity | 不透明度 | 透明度 |
| Keyframe | 关键帧 | 关键格 |
| Easing | 缓动 | 渐变 |
| Composition | 合成 | 组合 |
| Layer | 图层 | 层 |
| Mask | 蒙版 | 遮罩（AE 用蒙版） |
| Stroke | 描边 | 笔画 |
| Fill | 填充 | 填色 |
| Bezier | 贝塞尔 | 贝兹 |
| Viewport | 视口 | 视窗 |
| Deformer | 变形器 | 变形工具 |
| Shader | 着色器 | 渲染器 |
| Render | 渲染 | 绘制 |
| Blending Mode | 混合模式 | 融合模式 |
| Anchor Point / Pivot | 锚点 | 定点 |
| Expression | 表达式 | 公式 |
| Null | 空对象 | 空 |
| Pre-compose | 预合成 | 预组合 |
| Duplicator | 复制器（C4D 用法） | — |

### 日本語参考

| English | 日本語（AE/C4D 標準） | ❌ 使わない |
|---------|---------------------|------------|
| Layer | レイヤー | 層 |
| Keyframe | キーフレーム | — |
| Composition | コンポジション | 構成 |
| Mask | マスク | — |
| Easing | イージング | 緩和 |
| Blending Mode | 描画モード | ブレンドモード |
| Render | レンダリング | 描画 |
| Viewport | ビューポート | — |
| Deformer | デフォーマ | 変形ツール |
| Shader | シェーダー | — |
| Gradient | グラデーション | 傾斜 |
| Opacity | 不透明度 | 透明度 |

> **原则**：日文中外来语术语优先使用カタカナ表记（如 `"Screen Gain"` → `"スクリーンゲイン"`），不要用半翻半留的日英夹杂体（如 `"スクリーンGain"` ❌）。

## 2. 有些术语不翻译

保持英文原文或英文+中文注释的：
- **专有名词**：Lottie、Bezier、RGB、CMYK、SVG
- **品牌/产品名**：Cavalry、Canva、Excel
- **行业通用缩写**：FPS、BPM、GPU、JSON、CSV
- **约定俗成不翻的**：Alpha（Alpha 通道）、UV

`Forge Dynamics` 在 UI 显示层统一使用本地化术语：简中 `Forge 动力学`、繁中 `Forge 動力學`、日文 `フォージダイナミクス`；但模型数据里的 `niceName` 保持英文，避免 Time Editor 自绘层出现 CJK 渲染问题。

## 3. 参考资源

| 资源 | 用途 |
|------|------|
| [Microsoft Terminology Search](https://learn.microsoft.com/en-us/globalization/reference/microsoft-terminology) | 查标准 UI 术语翻译（File→文件、Edit→编辑、Undo→撤销） |
| [Microsoft 简体中文风格指南](https://aka.ms/chinese-simplified-styleguide) | 中文本地化的文风、标点、格式规范 |
| [Microsoft 繁体中文风格指南](https://aka.ms/chinese-traditional-styleguide) | 繁体差异（如"打印"vs"列印"） |
| [Microsoft 日语风格指南](https://aka.ms/japanese-styleguide) | 日语翻译规范 |
| **After Effects 中文版** | 动效术语的权威参考 |
| **Blender 翻译项目**（Weblate） | 开源 3D 软件翻译的标杆，有完整术语表 |
| **Cinema 4D 中文版** | 复制器(Duplicator)、变形器(Deformer)等术语来源 |

## 4. 简繁中文差异注意

| English | 简体中文 | 繁體中文 |
|---------|---------|---------|
| File | 文件 | 檔案 |
| Save | 保存 | 儲存 |
| Print | 打印 | 列印 |
| Software | 软件 | 軟體 |
| Default | 默认 | 預設 |
| Video | 视频 | 影片 |
| Program | 程序 | 程式 |
| Information | 信息 | 資訊 |

## 5. 我建议的工作流

```
第一步：建立术语表（glossary）
  ├── 从 AE/C4D/Blender 中文版提取标准术语
  ├── 用 Microsoft Terminology 查 UI 通用术语
  └── 形成 cavalry-glossary.csv（英/简中/繁中/日）

第二步：先翻术语表，再翻全文
  ├── 术语表确认后，作为翻译约束
  └── 全文翻译时严格引用术语表

第三步：AI 辅助 + 人工校对
  ├── 用 AI 批量翻译 JSON（带术语表约束）
  └── 人工校对专业术语和上下文
```

先建一个术语对照表（glossary），这是整个翻译质量的基础。

## 6. 零混合语言原则

翻译产物中，**同一个字符串值内禁止出现目标语言与英文的混合体**。

### 合法形态（仅三种）

| 形态 | 示例 | 说明 |
|---|---|---|
| 纯目标语言 | `"滤色增益"` / `"スクリーンゲイン"` | 完整翻译 |
| 纯英文术语 | `"Alpha"` / `"RGB"` / `"Lottie"` | 术语表中标记为不翻译的 |
| 英文术语 + 空格 + 目标语言 | `"Alpha 偏移"` / `"Alpha バイアス"` | 术语表术语与目标语言词之间必须有空格分隔 |

### 违规形态（绝对禁止）

| ❌ 错误 | ✅ 正确 | 语言 |
|---|---|---|
| `"滤色Gain"` | `"滤色增益"` | zh-Hans |
| `"Alpha偏移"` | `"Alpha 偏移"` | zh-Hans |
| `"Despill强度"` | `"去溢色强度"` | zh-Hans |
| `"スクリーンSoftness"` | `"スクリーン柔らかさ"` | ja_JP |
| `"シャドウGain"` | `"シャドウゲイン"` | ja_JP |
| `"Despill強度"` | `"デスピル強度"` | ja_JP |

### 遇到不确定的英文术语怎么办？

1. **先查术语表** (`cavalry-glossary.md`)——有对应翻译就用翻译
2. **术语表没有？查 AE/C4D/Blender 中文版**——用行业标准译法
3. **行业内也没有标准译法？完整保留英文**——宁可全英文也不要杂交体
4. **所有语言保持一致策略**——同一个术语，三种语言要么都翻，要么都保留英文；有显示层/模型层分流的术语，以术语表备注为准
