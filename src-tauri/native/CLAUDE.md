# native/
> L2 | 父级: ../CLAUDE.md

成员清单
macos_permission_handoff.m: AppKit 权限交接 owner；以 WebView CSS source rect 与 viewport 为唯一几何输入，为每块屏幕建立覆盖其完整 `screenFrame` 的非激活 panel 并在本地坐标裁切 shared-element 运动内容，在真实 System Settings 窗口间复刻 blur、锁定阴影与 `1/200/11` 项目箭头过渡；四语 helper 保持 Arrow→Instruction→App Row→Action 非重叠层级，`mouseDown:` 直接把整条实时 App row snapshot 与 app-bundle file URL 交给系统 drag session，will-begin 隐藏 live row，Retry/Cancel 与结果驱动 reverse/cleanup；只有 NSDragOperationCopy 且 endedAtPoint 落在实时 System Settings 主窗口完整 settingsFrame 内才回报 RetryRequested，其他 Copy 目标仅恢复 helper 与提示，不判断 TCC 是否已授权。

法则: 固定权限·非激活窗口·真实拖拽·业务结果裁决

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
