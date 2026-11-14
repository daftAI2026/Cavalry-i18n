/**
 * [INPUT]: 依赖Welcome producer adapter、ABI字节视图和批准三语固定源文。
 * [OUTPUT]: 验证精确payload、未知caller、单次原调用与异常传播。
 * [POS]: 无vendor依赖的纯策略合同；不加载App或触发日志系统。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "welcome_log_it_adapter.inc"

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <string_view>

namespace {

enum class TestLocale : std::uint8_t { Unknown, Hans, Hant, Japanese };
struct OriginalFailure {};

struct CallRecord {
    unsigned calls = 0;
    void *logger = nullptr;
    const void *message = nullptr;
    bool logEnabled = false;
    bool tracebackEnabled = false;
    bool inspectMessage = false;
    bool throwAfterCapture = false;
    std::array<std::byte, welcome_log_it::contract::kLogMessagePayloadOffset> prefix{};
    std::string payload;
};

CallRecord gCall{};
unsigned gFailures = 0;

void expect(bool condition, const char *message)
{
    if (condition) return;
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++gFailures;
}

void originalSpy(void *logger, const void *message,
                 bool logEnabled, bool tracebackEnabled)
{
    ++gCall.calls;
    gCall.logger = logger;
    gCall.message = message;
    gCall.logEnabled = logEnabled;
    gCall.tracebackEnabled = tracebackEnabled;
    if (gCall.inspectMessage) {
        welcome_log_it::contract::LogMessageAbi view{};
        std::memcpy(&view, message, sizeof(view));
        std::memcpy(gCall.prefix.data(), view.prefix, gCall.prefix.size());
        gCall.payload.assign(view.payload, view.payloadSize);
    }
    if (gCall.throwAfterCapture) throw OriginalFailure{};
}

void resetCall(bool inspectMessage)
{
    gCall = {};
    gCall.inspectMessage = inspectMessage;
}

welcome_log_it::contract::LogMessageAbi messageFor(std::string_view payload)
{
    welcome_log_it::contract::LogMessageAbi message{};
    for (std::size_t index = 0; index < sizeof(message.prefix); ++index)
        message.prefix[index] = static_cast<std::byte>((index * 13U) & 0xffU);
    message.payload = payload.data();
    message.payloadSize = payload.size();
    return message;
}

void checkProjection(std::string_view input,
                     welcome_log_it::policy::Locale locale,
                     std::string_view expected)
{
    const auto source = messageFor(input);
    resetCall(true);
    welcome_log_it::forward(originalSpy, reinterpret_cast<void *>(0x1234),
        &source, true, false, 0x6a4e20, 0x6a4e20, locale);
    expect(gCall.calls == 1, "recognized Welcome calls original exactly once");
    expect(gCall.payload == expected, "approved locale projects source and keeps suffix");
    expect(gCall.message != &source, "translated Welcome uses a local shadow message");
    expect(gCall.logger == reinterpret_cast<void *>(0x1234), "logger pointer is preserved");
    expect(gCall.logEnabled && !gCall.tracebackEnabled, "both bool arguments are preserved");
    expect(std::memcmp(gCall.prefix.data(), source.prefix, gCall.prefix.size()) == 0,
           "all bytes before payload remain unchanged");
}

void checkUnchanged(std::string_view input, std::uintptr_t callerPc,
                    std::uintptr_t expectedPc, TestLocale locale,
                    const char *caseName)
{
    const auto source = messageFor(input);
    resetCall(true);
    welcome_log_it::forward(originalSpy, nullptr, &source, false, true,
                            callerPc, expectedPc, locale);
    expect(gCall.calls == 1, caseName);
    expect(gCall.message == &source, "unprojected message pointer remains original");
    expect(gCall.payload == input, "unprojected payload bytes remain unchanged");
    expect(!gCall.logEnabled && gCall.tracebackEnabled,
           "unprojected path preserves both bool arguments");
}

}  // namespace

int main()
{
    using welcome_log_it::policy::Locale;
    constexpr std::string_view bare = "Welcome to Cavalry.";
    constexpr std::string_view newYear = "Welcome to Cavalry. Happy New Year!";
    constexpr std::string_view holidays = "Welcome to Cavalry. Happy Holidays!";

    expect(welcome_log_it::policy::classify(bare.data(), bare.size()) ==
               welcome_log_it::policy::PayloadKind::Bare,
           "bare Welcome source is exact");
    expect(welcome_log_it::policy::classify(newYear.data(), newYear.size()) ==
               welcome_log_it::policy::PayloadKind::NewYear,
           "New Year suffix is exact");
    expect(welcome_log_it::policy::classify(holidays.data(), holidays.size()) ==
               welcome_log_it::policy::PayloadKind::Holidays,
           "Holidays suffix is exact");

    checkProjection(bare, Locale::Hans, "欢迎使用 Cavalry。");
    checkProjection(newYear, Locale::Hans, "欢迎使用 Cavalry。 Happy New Year!");
    checkProjection(holidays, Locale::Hans, "欢迎使用 Cavalry。 Happy Holidays!");
    checkProjection(bare, Locale::Hant, "歡迎使用 Cavalry。");
    checkProjection(newYear, Locale::Hant, "歡迎使用 Cavalry。 Happy New Year!");
    checkProjection(holidays, Locale::Hant, "歡迎使用 Cavalry。 Happy Holidays!");
    checkProjection(bare, Locale::Japanese, "Cavalry へようこそ。");
    checkProjection(newYear, Locale::Japanese, "Cavalry へようこそ。 Happy New Year!");
    checkProjection(holidays, Locale::Japanese, "Cavalry へようこそ。 Happy Holidays!");

    constexpr std::string_view userOutput =
        "Welcome to Cavalry. account migration complete";
    checkUnchanged(userOutput, 0x1234, 0x6a4e20, TestLocale::Hans,
                   "same-prefix user text from another caller forwards once");
    checkUnchanged(userOutput, 0x6a4e20, 0x6a4e20, TestLocale::Hans,
                   "unapproved suffix at Welcome caller forwards once");
    checkUnchanged(bare, 0x6a4e20, 0x6a4e20, TestLocale::Unknown,
                   "unsupported locale leaves source unchanged");

    const void *unreadableMessage = reinterpret_cast<const void *>(std::uintptr_t{1});
    resetCall(false);
    welcome_log_it::forward(originalSpy, nullptr, unreadableMessage, true, true,
                            0x1234, 0x6a4e20, Locale::Hans);
    expect(gCall.calls == 1 && gCall.message == unreadableMessage,
           "unknown caller forwards unreadable message without dereference");

    const auto throwingSource = messageFor(bare);
    resetCall(true);
    gCall.throwAfterCapture = true;
    bool propagated = false;
    try {
        welcome_log_it::forward(originalSpy, nullptr, &throwingSource, true, false,
                                0x6a4e20, 0x6a4e20, Locale::Hans);
    } catch (const OriginalFailure &) {
        propagated = true;
    }
    expect(propagated, "original exception propagates without swallowing");
    expect(gCall.calls == 1, "throwing original is not retried");

    if (gFailures != 0) {
        std::fprintf(stderr, "FAIL: %u assertion(s)\n", gFailures);
        return 1;
    }
    std::puts("PASS: exact Welcome payloads, three locales, caller short-circuit, single forward, and exception propagation.");
    return 0;
}
