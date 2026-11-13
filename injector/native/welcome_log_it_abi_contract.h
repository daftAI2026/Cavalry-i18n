#if defined(CAVALRY_NATIVE_TARGET_281)
#include "abi_2_8_1/welcome_log_it_abi_contract.h"
#else
/**
 * [INPUT]: 依赖已审Cavalry 2.8 arm64 Extension与spdlog映像事实。
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
inline constexpr char kExtensionUuid[] = "448DD50E-75F4-3F2D-A46B-2C9F00DF9408";
inline constexpr char kSpdlogImageName[] = "libspdlog.1.13.dylib";
inline constexpr char kSpdlogUuid[] = "F9429837-12E6-3A4A-8436-97E5257E75EA";
inline constexpr char kLogItSymbol[] =
    "__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb";

inline constexpr std::uintptr_t kLogItOffset = 0x992c;
inline constexpr std::uintptr_t kExtensionCallOffset = 0x6a4e1c;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x6a4e20;
inline constexpr std::uintptr_t kExtensionStubOffset = 0xdbee5c;
inline constexpr std::uintptr_t kExtensionGotOffset = 0x01054150;
inline constexpr std::uintptr_t kImportIndex = 0x082a;

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

#endif  // CAVALRY_NATIVE_TARGET_281
