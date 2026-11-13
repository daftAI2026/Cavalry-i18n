# native/
> L2 | 父级: ../CLAUDE.md

成员清单
native_candidate_build_contract.rs: 纯BuildMode裁决；显式development-2.8.1只准Mac ARM候选；production接受Mac双架构及Windows x64 release，preview/候选规则独立。
macos_permission_handoff.m: AppKit 权限交接 owner；以 WebView CSS forward/return rect 与 viewport 为唯一几何输入，为每块屏幕建立覆盖其完整 `screenFrame` 的非激活 panel 并在本地坐标裁切 shared-element 运动内容；单一 `motionSurfaceView` 同时持有 source/target surface、三层 shadow 与 stroke，运动 frame 只有一个几何 owner，避免表层和阴影错位。真实 System Settings 窗口间复刻 blur、锁定阴影与独立非激活 Arrow child-panel 的 `1/200/11` 提示过渡；箭头 child-panel 使用按最大 `1.6` stretch 与 `7/4` shadow 推导的透明 overscan canvas 和底部 anchor。四语 532×112 helper 非拖拽时贴 Settings 右下内侧，右/下各留 10pt；helper 受选中屏幕 visibleFrame 四边约束，Settings 移动时重定位，helper 移动同步刷新 live flight endpoint。helper 复刻“箭头 + 单行 Drag 指令 / Back + 单行 App row”层级，外层 popover 材质由 Switcher accessory 自己持有，`mouseDown:` 只快照独立 `appRowView`，使图标与名称整行拖动但排除兄弟 `NSBox` 的边框和底色，并把 app-bundle file URL 交给系统 drag session；will-begin 只隐藏 live row 内容，显式 Back 重新捕获持久 Activity 动作并 reverse，业务 settled 直接 cleanup；只有 NSDragOperationCopy 且 endedAtPoint 落在实时 System Settings 主窗口完整 settingsFrame 内才回报 RetryRequested，其他 Copy 目标仅恢复 helper 与提示，不判断 TCC 是否已授权。
native_preview_injector_contract.rs: build.rs 与 native_runtime_source 共用纯 Mach-O 边界校验；只接受与编译目标相同的thin arm64/x86_64 MH_DYLIB，并验证load-command表范围，不证明ABI或签名。

法则: 固定权限·非激活窗口·真实拖拽·业务结果裁决·预览二进制边界

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
