/**
 * [INPUT]: 依赖 AppKit/CoreGraphics 的当前显示器、前台应用与 WindowServer 可见窗口元数据，以及一个精确 Switcher PID。
 * [OUTPUT]: 输出单个 JSON snapshot：单调时间、宿主显示偏好、各屏 point/backing-scale 和 Switcher/System Settings 无标题窗口几何。
 * [POS]: macos-handoff-acceptance 的只读原生探针；不截图 System Settings、不读取权限行、不发送输入或修改系统偏好。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import AppKit
import CoreGraphics
import Foundation

private func fail(_ message: String, code: Int32 = 64) -> Never {
  fputs(message + "\n", stderr)
  exit(code)
}

guard CommandLine.arguments.count == 2,
      let switcherPID = Int32(CommandLine.arguments[1]),
      switcherPID > 0 else {
  fail("usage: window_probe.swift <switcher-pid>")
}

let settingsPIDs = Set(NSRunningApplication.runningApplications(
  withBundleIdentifier: "com.apple.systempreferences"
).map(\.processIdentifier))

guard let rows = CGWindowListCopyWindowInfo(
  [.optionOnScreenOnly, .excludeDesktopElements],
  kCGNullWindowID
) as? [[String: Any]] else {
  fail("CGWindowListCopyWindowInfo failed", code: 1)
}

func rectPayload(_ rect: CGRect) -> [String: Double] {
  [
    "x": rect.origin.x,
    "y": rect.origin.y,
    "width": rect.width,
    "height": rect.height,
  ]
}

let windows: [[String: Any]] = rows.compactMap { row in
  guard let pid = (row[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value,
        pid == switcherPID || settingsPIDs.contains(pid),
        let number = (row[kCGWindowNumber as String] as? NSNumber)?.uint32Value,
        number > 0,
        let rawBounds = row[kCGWindowBounds as String],
        let bounds = CGRect(dictionaryRepresentation: rawBounds as! CFDictionary) else {
    return nil
  }
  return [
    "window": number,
    "pid": pid,
    "ownerKind": pid == switcherPID ? "switcher" : "systemSettings",
    "layer": (row[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0,
    "alpha": (row[kCGWindowAlpha as String] as? NSNumber)?.doubleValue ?? 1,
    "bounds": rectPayload(bounds),
  ]
}

let displays: [[String: Any]] = NSScreen.screens.map { screen in
  let displayID = (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0
  return [
    "displayID": displayID,
    "frame": rectPayload(screen.frame),
    "visibleFrame": rectPayload(screen.visibleFrame),
    "backingScaleFactor": screen.backingScaleFactor,
  ]
}

let frontmost = NSWorkspace.shared.frontmostApplication
let payload: [String: Any] = [
  "schema": 1,
  "capturedAt": ISO8601DateFormatter().string(from: Date()),
  "monotonicNanoseconds": DispatchTime.now().uptimeNanoseconds,
  "switcherPID": switcherPID,
  "frontmostBundleIdentifier": frontmost?.bundleIdentifier ?? NSNull(),
  "reduceMotion": NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
  "reduceTransparency": NSWorkspace.shared.accessibilityDisplayShouldReduceTransparency,
  "displays": displays,
  "windows": windows,
]

let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
