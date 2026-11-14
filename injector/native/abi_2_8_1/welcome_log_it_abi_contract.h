/**
 * [INPUT]: 依赖Cavalry 2.8.1 arm64 Extension与spdlog映像事实。
 * [OUTPUT]: 锁定一个async Welcome producer、log_it_导出与log_msg payload布局。
 * [POS]: 只声明机器相；veneer、运行适配和文本策略各守单一边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <atomic>
#include <array>
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
inline constexpr std::uintptr_t kExtensionCallOffset = 0x684f80;
inline constexpr std::uintptr_t kExtensionReturnOffset = 0x684f84;
inline constexpr std::uintptr_t kExtensionStubOffset = 0xd21520;
inline constexpr std::uintptr_t kExtensionGotOffset = 0x01029488;

inline constexpr char kExtensionAsyncWelcomeSymbol[] =
    "__ZN9QtPrivate15QCallableObjectIZZ14wrapInvokeMainIRKZ28refreshCanvaAuthInBackgroundP10DesktopAppNSt3__18optionalIN7cavalry17LicenceStatusInfoEEENS4_8functionIFvbEEEE3$_1EDcOT_ENKUlDpOT_E_clIJNS6_18RevalidationResultEEEEDaSK_EUlvE_NS_4ListIJEEEvE4implEiPNS_15QSlotObjectBaseEP7QObjectPPvPb";
inline constexpr std::uintptr_t kExtensionAsyncWelcomeSymbolOffset = 0x6846c4;
inline constexpr std::uintptr_t kExtensionAsyncWelcomeSourceRefOffset = 0x684d40;
inline constexpr std::array<std::uint8_t, 8> kExtensionAsyncWelcomeSourceRefBytes{
    0xa9, 0x45, 0x00, 0xd0, 0x29, 0x7d, 0x1f, 0x91};
inline constexpr std::uintptr_t kExtensionAsyncWelcomeCallSetupOffset = 0x684f74;
inline constexpr std::array<std::uint8_t, 16> kExtensionAsyncWelcomeCallSetupBytes{
    0xe1, 0x23, 0x04, 0x91, 0xe0, 0x03, 0x14, 0xaa,
    0xe3, 0x03, 0x15, 0xaa, 0x68, 0x71, 0x1a, 0x94};
inline constexpr std::uintptr_t kExtensionWelcomeSourceOffset = 0xf3a7df;
inline constexpr std::array<std::uint8_t, 20> kExtensionWelcomeSourceBytes{
    0x57, 0x65, 0x6c, 0x63, 0x6f, 0x6d, 0x65, 0x20, 0x74, 0x6f,
    0x20, 0x43, 0x61, 0x76, 0x61, 0x6c, 0x72, 0x79, 0x2e, 0x00};

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
