/**
 * [INPUT]: 依赖 cavalry_i18n_runtime.cpp 的 acceptance-only 编译分区与 Onboarding 验收类契约
 * [OUTPUT]: 对外生成只属于 cavalryi18n_acceptance target、以真实标题/正文确认每次转场的 firstLaunch driver 实现
 * [POS]: injector/windows 的编译隔离适配层；宏只选择测试分区，产品 cavalryi18n target 直接编译 runtime.cpp 的发布分区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define CAVALRY_I18N_ONBOARDING_ACCEPTANCE_ONLY 1
#include "cavalry_i18n_runtime.cpp"
