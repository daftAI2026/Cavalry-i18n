/**
 * [INPUT]: 依赖 Qt 6.6.3 QObject 父链/类型识别与 QComboBox 的公开 editable 状态
 * [OUTPUT]: 对外提供选择值与交互补全输入值保护判定，覆盖可编辑 Combo、字体 Combo 及其编辑器/弹出列表，以及尚未建立 owner 父链的交互补全编辑器
 * [POS]: injector 双平台共享的输入边界；按控件数据语义保护原值，不按字体名称或译文字典猜测身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtWidgets/QComboBox>

namespace cavalry_i18n {

// ---- 输入值与展示文案分离 -----------------------------------------------
// Cavalry 的字体族/样式使用 editable Combo；DisplayRole 可能同时是提交值。
// 沿父链覆盖 Qt popup container，不调用 view()，避免在 Paint 中创建控件。
inline bool preservesSelectionValue(const QObject *object)
{
    for (const QObject *current = object; current; current = current->parent()) {
        const auto *combo = qobject_cast<const QComboBox *>(current);
        if (combo && (combo->isEditable() || combo->inherits("QFontComboBox"))) {
            return true;
        }
    }
    return false;
}

// ---- 补全编辑器的值不因构建时序改变语义 -------------------------------
// 父链只决定搜索索引能否挂接，不能决定用户输入能否被翻译。
// 提示文案使用 placeholder；保留 parentless/重挂接期间已有的输入。
inline bool preservesCompleterInputValue(const QObject *object)
{
    return object && object->inherits("CompleterLineEdit");
}

} // namespace cavalry_i18n
