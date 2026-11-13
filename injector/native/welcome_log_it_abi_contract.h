/**
 * [INPUT]: 依赖Cavalry 2.8.1 arm64 Extension与spdlog映像事实。
 * [OUTPUT]: 锁定唯一Welcome调用点、log_it_导出与log_msg payload布局。
 * [POS]: 只声明机器相；veneer、运行适配和文本策略各守单一边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <type_traits>

namespace welcome_log_it::contract {

inline constexpr char kExtensionImageName[] = "libExtensionLayer.dylib";
inline constexpr char kExtensionUuid[] = "AF1367BD-2D7E-3EC0-A111-935E4881C655";
inline constexpr char kSpdlogImageName[] = "libspdlog.1.15.dylib";
inline constexpr char kSpdlogUuid[] = "43FC7DAB-6695-3EF6-B50B-B8189E170B09";
inline constexpr char kLogItSymbol[] =
    "__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb";

inline constexpr std::uintptr_t kLogItOffset = 0x6f10;
inline constexpr std::uintptr_t kExtensionCallOffset = 0x18f114;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x18f118;
inline constexpr std::uintptr_t kExtensionStubOffset = 0xd21520;
inline constexpr std::uintptr_t kExtensionGotOffset = 0x01029488;

inline constexpr std::size_t kLogMessagePayloadOffset = 0x50;
inline constexpr std::size_t kLogMessagePayloadSizeOffset = 0x58;
inline constexpr std::size_t kLogMessageBytes = 0x60;

// -- 机器视图只复制原对象字节，不构造vendor类型 ----------------------------
struct LogMessageAbi {
    std::byte prefix[kLogMessagePayloadOffset];
    const char *payload;
    std::size_t payloadSize;
};

static_assert(sizeof(void *) == 8);
static_assert(sizeof(std::uintptr_t) == 8);
static_assert(std::atomic<std::uintptr_t>::is_always_lock_free);
static_assert(std::is_trivially_copyable_v<LogMessageAbi>);
static_assert(offsetof(LogMessageAbi, payload) == kLogMessagePayloadOffset);
static_assert(offsetof(LogMessageAbi, payloadSize) == kLogMessagePayloadSizeOffset);
static_assert(sizeof(LogMessageAbi) == kLogMessageBytes);
static_assert(kExtensionReturnOffset == kExtensionCallOffset + sizeof(std::uint32_t));

}  // namespace welcome_log_it::contract
