/**
 * [INPUT]: CoreGraphics 屏幕可见窗口列表与 driver 从目标 QWidget 取得的原生 window number。
 * [OUTPUT]: 对外提供同时匹配 exact PID、window id 与 owner 的唯一窗口 JSON，并在拒绝时输出同 PID/ID 的有限诊断。
 * [POS]: acceptance-v2 的 OS 截图守门人；直接消费原生身份，不用 bounds 猜窗口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import CoreGraphics
import Foundation

func fail(_ text: String, _ code: Int32 = 64) -> Never {
  fputs(text + "\n", stderr)
  exit(code)
}

guard CommandLine.arguments.count == 5,
      let pid = Int32(CommandLine.arguments[1]), pid > 0,
      let windowID = UInt32(CommandLine.arguments[4]), windowID > 0 else {
  fail("usage: cgwindow_exact <pid> <owner> <surface> <window-id>")
}

let ownerExpected = CommandLine.arguments[2]
let surface = CommandLine.arguments[3]
guard let rows = CGWindowListCopyWindowInfo(
  [.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID
) as? [[String: Any]] else {
  fail("CGWindowListCopyWindowInfo failed", 1)
}

let hits = rows.compactMap { row -> [String: Any]? in
  guard let number = row[kCGWindowNumber as String] as? NSNumber,
        number.uint32Value == windowID,
        let ownerPID = row[kCGWindowOwnerPID as String] as? NSNumber,
        ownerPID.int32Value == pid,
        (row[kCGWindowOwnerName as String] as? String) == ownerExpected,
        let rawBounds = row[kCGWindowBounds as String],
        let bounds = CGRect(dictionaryRepresentation: rawBounds as! CFDictionary),
        let layerNumber = row[kCGWindowLayer as String] as? NSNumber else {
    return nil
  }
  let layer = layerNumber.intValue
  return [
    "window": windowID,
    "pid": Int(pid),
    "owner": ownerExpected,
    "title": (row[kCGWindowName as String] as? String) ?? "",
    "layer": layer,
    "surface": surface,
    "bounds": [
      "x": Int(bounds.origin.x), "y": Int(bounds.origin.y),
      "width": Int(bounds.width), "height": Int(bounds.height),
    ],
  ]
}

guard hits.count == 1 else {
  let diagnostics = rows.compactMap { row -> [String: Any]? in
    guard let number = row[kCGWindowNumber as String] as? NSNumber,
          let ownerPID = row[kCGWindowOwnerPID as String] as? NSNumber,
          number.uint32Value == windowID || ownerPID.int32Value == pid else {
      return nil
    }
    var boundsValue: [String: Int] = [:]
    if let rawBounds = row[kCGWindowBounds as String],
       let bounds = CGRect(dictionaryRepresentation: rawBounds as! CFDictionary) {
      boundsValue = [
        "x": Int(bounds.origin.x), "y": Int(bounds.origin.y),
        "width": Int(bounds.width), "height": Int(bounds.height),
      ]
    }
    return [
      "window": number.uint32Value,
      "pid": ownerPID.int32Value,
      "owner": (row[kCGWindowOwnerName as String] as? String) ?? "",
      "title": (row[kCGWindowName as String] as? String) ?? "",
      "layer": (row[kCGWindowLayer as String] as? NSNumber)?.intValue ?? -1,
      "onScreen": (row[kCGWindowIsOnscreen as String] as? NSNumber)?.boolValue ?? false,
      "bounds": boundsValue,
    ]
  }
  if let data = try? JSONSerialization.data(
    withJSONObject: diagnostics,
    options: [.sortedKeys]
  ), let text = String(data: data, encoding: .utf8) {
    fputs("exact native window candidates=\(text)\n", stderr)
  }
  fail("exact native window mapping failed; surface=\(surface) hits=\(hits.count)", 2)
}
let data = try! JSONSerialization.data(withJSONObject: hits[0], options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
