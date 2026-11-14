/**
 * [INPUT]: 依赖精确Welcome caller、spdlog原函数、ABI字节视图与唯一locale快照。
 * [OUTPUT]: 未命中时原参单次转发；命中时仅替换payload并单次转发。
 * [POS]: producer dispatcher策略适配；未知caller在veneer内绕过本文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include "welcome_log_it_abi_contract.h"
#include "welcome_log_it_policy.h"

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace welcome_log_it {

using Original = void (*)(void *logger, const void *message,
                          bool logEnabled, bool tracebackEnabled);

template <typename LocaleValue>
void forward(Original original, void *logger, const void *message,
             bool logEnabled, bool tracebackEnabled,
             std::uintptr_t callerPc, std::uintptr_t expectedWelcomePc,
             LocaleValue localeValue)
{
    // -- caller必须先匹配；未知路径不读取message或payload -------------------
    if (callerPc == 0 || expectedWelcomePc == 0 ||
        callerPc != expectedWelcomePc) {
        original(logger, message, logEnabled, tracebackEnabled);
        return;
    }

    contract::LogMessageAbi source{};
    std::memcpy(&source, message, sizeof(source));
    policy::Locale locale = policy::Locale::Unknown;
    switch (localeValue) {
        case LocaleValue::Hans: locale = policy::Locale::Hans; break;
        case LocaleValue::Hant: locale = policy::Locale::Hant; break;
        case LocaleValue::Japanese: locale = policy::Locale::Japanese; break;
        default: break;
    }

    std::array<char, policy::kMaxProjectedBytes> projected{};
    std::size_t projectedSize = 0;
    if (!policy::projectPayload(source.payload, source.payloadSize, locale,
                                projected.data(), projected.size(),
                                &projectedSize)) {
        original(logger, message, logEnabled, tracebackEnabled);
        return;
    }

    contract::LogMessageAbi translated = source;
    translated.payload = projected.data();
    translated.payloadSize = projectedSize;
    // -- 原spdlog调用在本次调用内消费影子payload；不得跨调用保存 --------
    original(logger, &translated, logEnabled, tracebackEnabled);
}

}  // namespace welcome_log_it
