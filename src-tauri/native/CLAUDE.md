# native/
> L2 | 父级: ../CLAUDE.md

成员清单
macos_permission_handoff.m: AppKit 权限交接 owner；以 WebView CSS source rect 与 viewport 为唯一几何输入，为每块屏幕建立覆盖其完整 `screenFrame` 的非激活 panel 并在本地坐标裁切 shared-element 运动内容，在真实 System Settings 窗口间复刻 blur、锁定阴影与独立非激活 Arrow child-panel 的 `1/200/11` 提示过渡；四语 532×112 helper 复刻“箭头 + 单行 Drag 指令 / Back + 单行 App row”层级，外层 popover 材质由 Switcher accessory 自己持有，`mouseDown:` 只快照独立 `appRowView`，使图标与名称整行拖动但排除兄弟 `NSBox` 的边框和底色，并把 app-bundle file URL 交给系统 drag session；will-begin 只隐藏 live row 内容，Back 触发 reverse/cleanup；只有 NSDragOperationCopy 且 endedAtPoint 落在实时 System Settings 主窗口完整 settingsFrame 内才回报 RetryRequested，其他 Copy 目标仅恢复 helper 与提示，不判断 TCC 是否已授权。

法则: 固定权限·非激活窗口·真实拖拽·业务结果裁决

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
