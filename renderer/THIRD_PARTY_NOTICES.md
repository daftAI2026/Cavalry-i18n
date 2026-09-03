<!--
[INPUT]: 依赖 renderer 实际适配的 shadcn/ui、Base UI 与 Phosphor 固定源码及其 MIT 许可证。
[OUTPUT]: 对外提供 renderer 内组件行为与 SVG path 的来源、锁定版本和版权通知。
[POS]: renderer 的第三方归因边界；只记录进入本地源码的材料，不引入运行时依赖。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Renderer third-party notices

The renderer contains adapted component behavior and selected SVG path data from the following MIT-licensed projects.

## shadcn/ui

Copyright (c) 2023 shadcn

Source: https://github.com/shadcn-ui/ui

Adapted renderer behavior is reviewed against upstream commit
`683a5a9b370acdb7785a0529434e6a3b8c7e0441` and the `shadcn` 4.19.0
`tailwind.css` Button, Marker, shimmer, and scroll-fade sources/utilities.

Licensed under the MIT License. The full license text is available at:
https://github.com/shadcn-ui/ui/blob/main/LICENSE.md

## Base UI

Copyright (c) 2019 Material-UI SAS

Source: https://github.com/mui/base-ui

Toast timing, limit, pause/resume, focus, and live-region behavior is adapted
from `@base-ui/react` 1.6.0.

Licensed under the MIT License. The full license text is available at:
https://github.com/mui/base-ui/blob/v1.6.0/LICENSE

## Phosphor Icons

Copyright (c) 2023 Phosphor Icons

Source: https://github.com/phosphor-icons/core

Selected Regular SVG paths are adapted into the local semantic icon registry,
including ArrowCircleUp for updates, the Cavalry launch Play glyph, and the
Windows caption Info, Minus, Square, Copy, and X glyphs.

Licensed under the MIT License. The full license text is available at:
https://github.com/phosphor-icons/core/blob/main/LICENSE
