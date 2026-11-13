/**
 * [INPUT]: 依赖welcome_log_it_veneer.S、dyld导入符号与合成arm64 caller标签。
 * [OUTPUT]: 验证未知LR直跳旧导入、精确LR进入dispatcher且单次转发。
 * [POS]: 无vendor依赖的寄存器合同；早期构造另由真实dyld fixture验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "welcome_log_it_abi_contract.h"

#include <atomic>
#include <cstdint>
#include <cstdio>
#include <cstdlib>

extern "C" {
void welcomeProbeUnknown(void *logger, const void *message,
                         bool logEnabled, bool tracebackEnabled);
void welcomeProbeExact(void *logger, const void *message,
                       bool logEnabled, bool tracebackEnabled);
extern char welcomeProbeUnknownReturn;
extern char welcomeProbeExactReturn;
std::atomic<std::uintptr_t> nativeWelcomeLogItExpectedReturnPc{0};
}

namespace {
using Original = void (*)(void *, const void *, bool, bool);
unsigned gOriginalCalls = 0;
unsigned gDispatcherCalls = 0;
void *gLogger = nullptr;
const void *gMessage = nullptr;
bool gLogEnabled = false;
bool gTracebackEnabled = false;
std::uintptr_t gOriginalReturnPc = 0;
std::uintptr_t gDispatcherCallerPc = 0;

void reset()
{
    gOriginalCalls = 0;
    gDispatcherCalls = 0;
    gLogger = nullptr;
    gMessage = nullptr;
    gLogEnabled = false;
    gTracebackEnabled = false;
    gOriginalReturnPc = 0;
    gDispatcherCallerPc = 0;
}

void expect(bool condition, const char *message)
{
    if (condition) return;
    std::fprintf(stderr, "FAIL: %s\n", message);
    std::exit(1);
}
}  // namespace

extern "C" void welcomeVeneerTestOriginal(
    void *logger, const void *message, bool logEnabled, bool tracebackEnabled)
    __asm__("__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb");
extern "C" __attribute__((noinline))
void welcomeVeneerTestOriginal(void *logger, const void *message,
                               bool logEnabled, bool tracebackEnabled)
{
    ++gOriginalCalls;
    gLogger = logger;
    gMessage = message;
    gLogEnabled = logEnabled;
    gTracebackEnabled = tracebackEnabled;
    gOriginalReturnPc = reinterpret_cast<std::uintptr_t>(
        __builtin_return_address(0));
}

extern "C" __attribute__((noinline))
void nativeWelcomeLogItDispatcher(void *logger, const void *message,
                                  bool logEnabled, bool tracebackEnabled,
                                  std::uintptr_t callerPc)
{
    ++gDispatcherCalls;
    gDispatcherCallerPc = callerPc;
    const Original original = &welcomeVeneerTestOriginal;
    original(logger, message, logEnabled, tracebackEnabled);
}

int main()
{
    using welcome_log_it::contract::LogMessageAbi;
    const void *unreadableMessage = reinterpret_cast<const void *>(std::uintptr_t{1});
    void *logger = reinterpret_cast<void *>(std::uintptr_t{0x1234});

    reset();
    nativeWelcomeLogItExpectedReturnPc.store(0x18f118, std::memory_order_release);
    welcomeProbeUnknown(logger, unreadableMessage, true, false);
    expect(gDispatcherCalls == 0, "unknown LR bypasses dispatcher");
    expect(gOriginalCalls == 1, "unknown LR tail-jumps original exactly once");
    expect(gOriginalReturnPc == reinterpret_cast<std::uintptr_t>(
               &welcomeProbeUnknownReturn),
           "unknown LR reaches original with original return address");
    expect(gLogger == logger && gMessage == unreadableMessage,
           "unknown LR preserves logger and unreadable message pointer");
    expect(gLogEnabled && !gTracebackEnabled,
           "unknown LR preserves both bool arguments");

    LogMessageAbi userMessage{};
    constexpr char samePrefix[] = "Welcome to Cavalry. user output";
    userMessage.payload = samePrefix;
    userMessage.payloadSize = sizeof(samePrefix) - 1;
    reset();
    welcomeProbeUnknown(logger, &userMessage, false, true);
    expect(gDispatcherCalls == 0 && gOriginalCalls == 1,
           "same-prefix user output from unknown LR bypasses policy once");
    expect(gMessage == &userMessage && !gLogEnabled && gTracebackEnabled,
           "same-prefix unknown output keeps original message and flags");

    reset();
    nativeWelcomeLogItExpectedReturnPc.store(
        reinterpret_cast<std::uintptr_t>(&welcomeProbeExactReturn),
        std::memory_order_release);
    welcomeProbeExact(logger, &userMessage, true, true);
    expect(gDispatcherCalls == 1, "exact LR enters dispatcher once");
    expect(gOriginalCalls == 1, "exact dispatcher forwards original once");
    expect(gDispatcherCallerPc == reinterpret_cast<std::uintptr_t>(
               &welcomeProbeExactReturn),
           "exact caller PC reaches dispatcher unchanged");

    std::puts("PASS: arm64 unknown callers tail-jump without payload access; exact caller dispatches once.");
    return 0;
}
