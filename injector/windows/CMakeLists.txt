# [INPUT]: 依赖 CMake 4.2+、Visual Studio 2022+ 的 MSVC v143、Qt 6.6.3 x64 SDK及版本化 QPA 头、Windows Psapi、本目录源码、../generated_translations.inc 与可选 vendor 根
# [OUTPUT]: 对外构建发布态 generic/cavalryi18n.dll、qpa/qwindows.dll 与不发布的 acceptance/generic/cavalryi18n_acceptance.dll，并注册显示/hook/vendor、QPA manifest、测试态 vendor 主窗口缝及环境/显式入口合同测试
# [POS]: injector/windows 的唯一构建入口，以严格 ABI/架构/manifest 前置检查约束通用翻译 runtime 与原生入口 QPA 代理，并隔离验收 driver
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
cmake_minimum_required(VERSION 4.2)

project(cavalry_i18n_windows_plugin VERSION 0.1.0 LANGUAGES CXX)

if(NOT WIN32)
    message(FATAL_ERROR "The Cavalry i18n generic plugin is Windows-only.")
endif()

if(NOT MSVC)
    message(FATAL_ERROR "The Cavalry 2.7.2 plugin must be built with the MSVC toolchain.")
endif()

if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "The Cavalry 2.7.2 plugin must be built for x64.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
add_compile_options(/utf-8)

find_package(Qt6 6.6.3 EXACT REQUIRED COMPONENTS Core Gui Widgets)

foreach(qt_target Qt6::Core Qt6::Gui Qt6::Widgets)
    get_target_property(qt_target_type "${qt_target}" TYPE)
    if(NOT qt_target_type STREQUAL "SHARED_LIBRARY")
        message(FATAL_ERROR
            "${qt_target} must come from the shared Qt 6.6.3 SDK; static Qt would embed a second runtime into Cavalry."
        )
    endif()
endforeach()

set(
    CAVALRY_VENDOR_ROOT
    ""
    CACHE PATH
    "Optional Cavalry installation root used only by the read-only vendor ABI/import contract test"
)

if(NOT Qt6Core_VERSION VERSION_EQUAL "6.6.3")
    message(FATAL_ERROR "Qt 6.6.3 is required; found ${Qt6Core_VERSION}.")
endif()

qt_standard_project_setup()

get_filename_component(
    QT_INSTALL_PREFIX
    "${Qt6Gui_DIR}/../../.."
    ABSOLUTE
)
set(
    QT_QPA_INCLUDE_DIR
    "${QT_INSTALL_PREFIX}/include/QtGui/${Qt6Gui_VERSION}/QtGui"
)
if(NOT EXISTS
    "${QT_QPA_INCLUDE_DIR}/qpa/qplatformintegrationplugin.h")
    message(FATAL_ERROR
        "Qt 6.6.3 versioned QPA headers are required: ${QT_QPA_INCLUDE_DIR}"
    )
endif()

qt_add_plugin(cavalryi18n
    SHARED
    CLASS_NAME CavalryI18nPlugin
)

target_sources(cavalryi18n
    PRIVATE
        cavalry_i18n_display.cpp
        cavalry_i18n_display.h
        cavalry_i18n_callback_snapshot.h
        cavalry_i18n_extension_layer_hook.cpp
        cavalry_i18n_extension_layer_hook.h
        cavalry_i18n_extension_layer_qt_hooks.cpp
        cavalry_i18n_extension_layer_qt_hooks.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_extension_layer_text_path_dispatch.cpp
        cavalry_i18n_extension_layer_text_path_dispatch.h
        cavalry_i18n_extension_layer_text_path_hook.cpp
        cavalry_i18n_extension_layer_text_path_hook.h
        cavalry_i18n_iat_lifecycle.h
        cavalry_i18n_iat_patch.cpp
        cavalry_i18n_iat_patch.h
        cavalry_i18n_pe_iat.cpp
        cavalry_i18n_pe_iat.h
        cavalry_i18n_skia_runtime_abi.cpp
        cavalry_i18n_skia_runtime_abi.h
        cavalry_i18n_skia_text_path_renderer.cpp
        cavalry_i18n_skia_text_path_renderer.h
        cavalry_i18n_plugin.cpp
        cavalry_i18n_plugin.h
        cavalry_i18n_runtime.cpp
        cavalry_i18n_runtime.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
        cavalryi18n.json
)

qt_add_plugin(cavalryi18n_acceptance
    SHARED
    CLASS_NAME CavalryI18nAcceptancePlugin
)

target_sources(cavalryi18n_acceptance
    PRIVATE
        cavalry_i18n_acceptance_plugin.cpp
        cavalry_i18n_acceptance_plugin.h
        cavalry_i18n_adjacent_acceptance.cpp
        cavalry_i18n_adjacent_acceptance.h
        cavalry_i18n_adjacent_acceptance_lifecycle.inc
        cavalry_i18n_adjacent_acceptance_assets.inc
        cavalry_i18n_adjacent_acceptance_evidence.inc
        cavalry_i18n_onboarding_acceptance.cpp
        cavalry_i18n_onboarding_acceptance.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
        cavalryi18n_acceptance.json
)

target_link_libraries(cavalryi18n_acceptance
    PRIVATE
        Qt6::Core
        Qt6::CorePrivate
        Qt6::Gui
        Qt6::Widgets
)

target_include_directories(cavalryi18n_acceptance
    PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}"
)

target_compile_definitions(cavalryi18n_acceptance PRIVATE QT_NO_KEYWORDS)

set_target_properties(cavalryi18n_acceptance PROPERTIES
    OUTPUT_NAME "cavalryi18n_acceptance"
    PREFIX ""
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/acceptance/generic"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/acceptance/generic"
)

foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(cavalryi18n_acceptance PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/acceptance/generic"
        "LIBRARY_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/acceptance/generic"
    )
endforeach()

target_link_libraries(cavalryi18n
    PRIVATE
        Qt6::Core
        Qt6::Gui
        Qt6::Widgets
        Psapi
)

target_include_directories(cavalryi18n
    PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}"
)

target_compile_definitions(cavalryi18n PRIVATE QT_NO_KEYWORDS)

set_target_properties(cavalryi18n PROPERTIES
    OUTPUT_NAME "cavalryi18n"
    PREFIX ""
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/generic"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/generic"
)

foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(cavalryi18n PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/generic"
        "LIBRARY_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/generic"
    )
endforeach()

install(
    TARGETS cavalryi18n
    RUNTIME DESTINATION generic
    LIBRARY DESTINATION generic
)

qt_add_plugin(cavalryi18n_qpa
    SHARED
    CLASS_NAME CavalryWindowsQpaProxy
)

target_sources(cavalryi18n_qpa
    PRIVATE
        cavalry_i18n_qpa_contract.cpp
        cavalry_i18n_qpa_contract.h
        cavalry_i18n_qpa_proxy.cpp
        cavalry_i18n_qpa_proxy.h
        qwindows.json
)

target_link_libraries(cavalryi18n_qpa
    PRIVATE
        Qt6::Core
        Qt6::Gui
)

target_include_directories(cavalryi18n_qpa
    PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}"
        "${QT_QPA_INCLUDE_DIR}"
)

target_compile_definitions(cavalryi18n_qpa PRIVATE QT_NO_KEYWORDS)

set_target_properties(cavalryi18n_qpa PROPERTIES
    OUTPUT_NAME "qwindows"
    PREFIX ""
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qpa"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/qpa"
)

foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(cavalryi18n_qpa PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/qpa"
        "LIBRARY_OUTPUT_DIRECTORY_${config}" "${CMAKE_BINARY_DIR}/qpa"
    )
endforeach()

install(
    TARGETS cavalryi18n_qpa
    RUNTIME DESTINATION qpa
    LIBRARY DESTINATION qpa
)

include(CTest)

if(BUILD_TESTING)
    add_executable(cavalryi18n_qpa_contract_test
        cavalry_i18n_qpa_contract_test.cpp
        cavalry_i18n_qpa_contract.cpp
        cavalry_i18n_qpa_contract.h
    )

    target_link_libraries(cavalryi18n_qpa_contract_test
        PRIVATE
            Qt6::Core
    )

    target_include_directories(cavalryi18n_qpa_contract_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_qpa_contract_test
        PRIVATE
            CAVALRY_I18N_QPA_PROXY_SOURCE="${CMAKE_CURRENT_SOURCE_DIR}/cavalry_i18n_qpa_proxy.cpp"
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_qpa_contract
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_qpa_contract_test>"
    )

    add_executable(cavalryi18n_qpa_binary_smoke_test
        cavalry_i18n_qpa_binary_smoke_test.cpp
    )

    target_link_libraries(cavalryi18n_qpa_binary_smoke_test
        PRIVATE
            Qt6::Core
            Qt6::Gui
    )

    target_include_directories(cavalryi18n_qpa_binary_smoke_test
        PRIVATE
            "${QT_QPA_INCLUDE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_qpa_binary_smoke_test
        PRIVATE
            QT_NO_KEYWORDS
    )

    add_dependencies(
        cavalryi18n_qpa_binary_smoke_test
        cavalryi18n_qpa
    )

    add_test(
        NAME cavalryi18n_qpa_binary_smoke
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_qpa_binary_smoke_test>"
            "$<TARGET_FILE:cavalryi18n_qpa>"
    )

    add_executable(cavalryi18n_display_test
        cavalry_i18n_display_test.cpp
        cavalry_i18n_display.cpp
        cavalry_i18n_display.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
    )

    target_link_libraries(cavalryi18n_display_test
        PRIVATE
            Qt6::Core
            Qt6::Gui
            Qt6::Widgets
    )

    target_include_directories(cavalryi18n_display_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_display_test
        PRIVATE
            CAVALRY_I18N_TESTING
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_display
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "QT_QPA_PLATFORM=offscreen"
            "$<TARGET_FILE:cavalryi18n_display_test>"
    )

    add_executable(cavalryi18n_embedded_translator_test
        cavalry_i18n_translator_test.cpp
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
    )

    target_link_libraries(cavalryi18n_embedded_translator_test
        PRIVATE
            Qt6::Core
    )

    target_include_directories(cavalryi18n_embedded_translator_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_embedded_translator_test
        PRIVATE
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_embedded_translator
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_embedded_translator_test>"
    )

    add_executable(cavalryi18n_messagebar_qt_hook_test
        cavalry_i18n_messagebar_qt_hook_test.cpp
        cavalry_i18n_callback_snapshot.h
        cavalry_i18n_extension_layer_qt_hooks.cpp
        cavalry_i18n_extension_layer_qt_hooks.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
    )

    target_link_libraries(cavalryi18n_messagebar_qt_hook_test
        PRIVATE
            Qt6::Core
            Qt6::Gui
            Qt6::Widgets
    )

    target_include_directories(cavalryi18n_messagebar_qt_hook_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_messagebar_qt_hook_test
        PRIVATE
            CAVALRY_I18N_TESTING
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_messagebar_qt_hook
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_messagebar_qt_hook_test>"
    )

    add_executable(cavalryi18n_pe_iat_test
        cavalry_i18n_pe_iat_test.cpp
        cavalry_i18n_pe_iat.cpp
        cavalry_i18n_pe_iat.h
    )

    target_include_directories(cavalryi18n_pe_iat_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    add_test(
        NAME cavalryi18n_pe_iat
        COMMAND "$<TARGET_FILE:cavalryi18n_pe_iat_test>"
    )

    add_executable(cavalryi18n_text_path_dispatch_test
        cavalry_i18n_extension_layer_text_path_dispatch_test.cpp
        cavalry_i18n_extension_layer_text_path_dispatch.cpp
        cavalry_i18n_extension_layer_text_path_dispatch.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
    )

    target_link_libraries(cavalryi18n_text_path_dispatch_test
        PRIVATE
            Qt6::Core
    )

    target_include_directories(cavalryi18n_text_path_dispatch_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_text_path_dispatch_test
        PRIVATE
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_text_path_dispatch
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_text_path_dispatch_test>"
    )

    # 始终编译只读 text-path 合同；只有显式 vendor root 才把它链接进实际映像验证。
    add_library(cavalryi18n_vendor_text_path_contract OBJECT
        cavalry_i18n_vendor_text_path_contract.cpp
        cavalry_i18n_vendor_text_path_contract.h
        cavalry_i18n_vendor_skia_text_path_contract.cpp
        cavalry_i18n_vendor_skia_text_path_contract.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_pe_iat.cpp
        cavalry_i18n_pe_iat.h
    )

    target_include_directories(cavalryi18n_vendor_text_path_contract
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    add_library(cavalryi18n_vendor_messagebar_contract OBJECT
        cavalry_i18n_vendor_messagebar_contract.cpp
        cavalry_i18n_vendor_messagebar_contract.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_pe_iat.h
    )

    target_include_directories(cavalryi18n_vendor_messagebar_contract
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    if(NOT CAVALRY_VENDOR_ROOT STREQUAL "")
        get_filename_component(
            CAVALRY_VENDOR_ROOT_ABSOLUTE
            "${CAVALRY_VENDOR_ROOT}"
            ABSOLUTE
        )
        set(
            CAVALRY_VENDOR_EXTENSION_LAYER
            "${CAVALRY_VENDOR_ROOT_ABSOLUTE}/ExtensionLayer.dll"
        )
        set(
            CAVALRY_VENDOR_CAVALRY_UI
            "${CAVALRY_VENDOR_ROOT_ABSOLUTE}/CavalryUI.dll"
        )
        set(
            CAVALRY_VENDOR_CORE
            "${CAVALRY_VENDOR_ROOT_ABSOLUTE}/Core.dll"
        )
        set(
            CAVALRY_VENDOR_SKIA
            "${CAVALRY_VENDOR_ROOT_ABSOLUTE}/skia.dll"
        )
        if(NOT EXISTS "${CAVALRY_VENDOR_EXTENSION_LAYER}"
            OR NOT EXISTS "${CAVALRY_VENDOR_CAVALRY_UI}"
            OR NOT EXISTS "${CAVALRY_VENDOR_CORE}"
            OR NOT EXISTS "${CAVALRY_VENDOR_SKIA}")
            message(FATAL_ERROR
                "CAVALRY_VENDOR_ROOT must contain ExtensionLayer.dll, CavalryUI.dll, Core.dll, and skia.dll: ${CAVALRY_VENDOR_ROOT_ABSOLUTE}"
            )
        endif()

        add_executable(cavalryi18n_vendor_iat_contract_test
            cavalry_i18n_vendor_iat_contract_test.cpp
            $<TARGET_OBJECTS:cavalryi18n_vendor_text_path_contract>
            $<TARGET_OBJECTS:cavalryi18n_vendor_messagebar_contract>
            cavalry_i18n_extension_layer_sources.h
            cavalry_i18n_pe_iat.h
        )

        target_include_directories(cavalryi18n_vendor_iat_contract_test
            PRIVATE
                "${CMAKE_CURRENT_SOURCE_DIR}"
        )

        add_test(
            NAME cavalryi18n_vendor_iat_contract
            COMMAND
                "$<TARGET_FILE:cavalryi18n_vendor_iat_contract_test>"
                "${CAVALRY_VENDOR_EXTENSION_LAYER}"
                "${CAVALRY_VENDOR_CAVALRY_UI}"
                "${CAVALRY_VENDOR_CORE}"
                "${CAVALRY_VENDOR_SKIA}"
        )
    endif()

    add_executable(cavalryi18n_extension_layer_hook_test
        cavalry_i18n_aggregate_pin_contract_test.cpp
        cavalry_i18n_extension_layer_hook_test.cpp
        cavalry_i18n_messagebar_lifecycle_contract_test.cpp
        cavalry_i18n_callback_snapshot.h
        cavalry_i18n_extension_layer_hook.cpp
        cavalry_i18n_extension_layer_hook.h
        cavalry_i18n_extension_layer_qt_hooks.cpp
        cavalry_i18n_extension_layer_qt_hooks.h
        cavalry_i18n_extension_layer_sources.h
        cavalry_i18n_extension_layer_text_path_dispatch.cpp
        cavalry_i18n_extension_layer_text_path_dispatch.h
        cavalry_i18n_extension_layer_text_path_hook.cpp
        cavalry_i18n_extension_layer_text_path_hook.h
        cavalry_i18n_iat_lifecycle.h
        cavalry_i18n_iat_patch.cpp
        cavalry_i18n_iat_patch.h
        cavalry_i18n_pe_iat.cpp
        cavalry_i18n_pe_iat.h
        cavalry_i18n_skia_runtime_abi.cpp
        cavalry_i18n_skia_runtime_abi.h
        cavalry_i18n_skia_text_path_renderer.cpp
        cavalry_i18n_skia_text_path_renderer.h
        cavalry_i18n_translator.cpp
        cavalry_i18n_translator.h
    )

    target_link_libraries(cavalryi18n_extension_layer_hook_test
        PRIVATE
            Qt6::Core
            Qt6::Gui
            Psapi
    )

    target_include_directories(cavalryi18n_extension_layer_hook_test
        PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}"
    )

    target_compile_definitions(
        cavalryi18n_extension_layer_hook_test
        PRIVATE
            CAVALRY_I18N_TESTING
            CAVALRY_I18N_EXTENSION_LAYER_HOOK_SOURCE="${CMAKE_CURRENT_SOURCE_DIR}/cavalry_i18n_extension_layer_hook.cpp"
            QT_NO_KEYWORDS
    )

    add_test(
        NAME cavalryi18n_extension_layer_hook
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "$<TARGET_FILE:cavalryi18n_extension_layer_hook_test>"
    )

    add_executable(cavalryi18n_plugin_smoke_test
        cavalry_i18n_plugin_smoke_test.cpp
    )

    target_link_libraries(cavalryi18n_plugin_smoke_test
        PRIVATE
            Qt6::Core
            Qt6::Gui
            Qt6::Widgets
    )

    add_dependencies(cavalryi18n_plugin_smoke_test cavalryi18n)

    add_test(
        NAME cavalryi18n_plugin_explicit_specification
        COMMAND
            "${CMAKE_COMMAND}" -E env
            "--unset=QT_QPA_GENERIC_PLUGINS"
            "PATH=$<TARGET_FILE_DIR:Qt6::Core>$<SEMICOLON>$ENV{PATH}"
            "QT_QPA_PLATFORM=offscreen"
            "CAVALRY_I18N_LANG=must-not-enable-empty-specification"
            "CAVALRY_I18N_DIAGNOSTIC_MARKER=${CMAKE_BINARY_DIR}/plugin-explicit-marker.json"
            "$<TARGET_FILE:cavalryi18n_plugin_smoke_test>"
            "--explicit"
            "$<TARGET_FILE:cavalryi18n>"
    )
endif()
