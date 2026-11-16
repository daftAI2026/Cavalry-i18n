/**
 * [INPUT]: 依赖Cavalry 2.8.1官方Frameworks各slice的Mach-O UUID记录。
 * [OUTPUT]: 按编译架构选择官方Core、Extension、Skia、API、Qt与辅助库身份。
 * [POS]: 只判定候选目标架构和映像身份；不授权任何函数ABI或运行时hook。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

namespace native_candidate_architecture {

enum class Architecture {
    Arm64,
    X86_64
};

enum class ImageRole {
    Core,
    Extension,
    Skia,
    Api,
    Fmt,
    Spdlog,
    CavalryUi,
    QtCore,
    QtGui,
    QtWidgets
};

#if defined(__arm64__)
inline constexpr Architecture kBuildArchitecture = Architecture::Arm64;
#elif defined(__x86_64__)
inline constexpr Architecture kBuildArchitecture = Architecture::X86_64;
#else
#error "Native candidate supports only arm64 and x86_64 build profiles."
#endif

struct ImageUuids {
    const char *arm64;
    const char *x86_64;
};

constexpr ImageUuids imageUuids(ImageRole role) noexcept
{
    switch (role) {
        case ImageRole::Core:
            return {"55C6FCB7-E0DA-3AC1-8C45-055CC6ECEAD9",
                    "23B9AC22-F909-3455-BD02-4E90796E35B5"};
        case ImageRole::Extension:
            return {"448DD50E-75F4-3F2D-A46B-2C9F00DF9408",
                    "AEAD00DA-F97D-3DD0-9602-D5668F1341A2"};
        case ImageRole::Skia:
            return {"E6258D2F-A1BB-3CEE-9DBA-6DB3BA0303D2",
                    "86ACD2F2-91F5-308C-BBAE-23183E8D218D"};
        case ImageRole::Api:
            return {"475E0957-00C1-325C-BC45-58D35DD5EB86",
                    "8A40A6FC-DE65-3845-8EA1-F1E80A2F0CCD"};
        case ImageRole::Fmt:
            return {"110C9692-B750-3974-85A5-49FCA0FBB0F4",
                    "0C65A571-5BBA-3F94-BC62-B9F37A629184"};
        case ImageRole::Spdlog:
            return {"F9429837-12E6-3A4A-8436-97E5257E75EA",
                    "B2A4829C-F4AE-30AE-A15A-DB00BB634B61"};
        case ImageRole::CavalryUi:
            return {"D579B833-98FF-3E13-B79E-624C9D9AA776",
                    "3CC166C8-F163-3F2D-8AEC-B19A8EBCDE71"};
        case ImageRole::QtCore:
            return {"4B36DF00-3C84-3C21-855A-1C9975493A3C",
                    "3A22E432-F63B-344F-8555-EFFC3A9E92AB"};
        case ImageRole::QtGui:
            return {"3786AFD4-5351-3B21-A2DF-06A901C3C6EE",
                    "C5244FEA-136F-3ED0-8F82-85A535F14F2B"};
        case ImageRole::QtWidgets:
            return {"01652E29-047E-3528-9DC2-1BD084292E50",
                    "0C194E6E-1E76-3FD4-83A3-9263616E2F3F"};
    }
    return {nullptr, nullptr};
}

constexpr const char *expectedUuid(ImageRole role, Architecture architecture) noexcept
{
    const ImageUuids pair = imageUuids(role);
    return architecture == Architecture::X86_64 ? pair.x86_64 : pair.arm64;
}

}  // namespace native_candidate_architecture
