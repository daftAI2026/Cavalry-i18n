/**
 * [INPUT]: 依赖 Qt 6.6.3 QObject 父链/类型识别、QComboBox editable 状态与 QLineEdit 占位提示 API
 * [OUTPUT]: 对外提供选择值/补全输入保护判定及仅翻译 QLineEdit 占位提示的共享入口；普通输入与只读名称的实际值均不进入翻译查询
 * [POS]: injector 双平台共享的输入边界；按控件数据语义保护原值，不按字体名称或译文字典猜测身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtWidgets/QComboBox>
#include <QtWidgets/QLineEdit>

namespace cavalry_i18n {

// ---- 输入控件只翻译提示，不读取或写入实际值 -----------------------------
// 只读名称也可能随后进入编辑并提交；焦点、词典命中与信号阻断均非数据边界。
template <typename Lookup>
inline void translateLineEditPlaceholder(QLineEdit *editor, const Lookup &lookup)
{
    if (!editor) {
        return;
    }
    const QString source = editor->placeholderText();
    if (source.isEmpty()) {
        return;
    }
    const QString translated = lookup(source);
    if (!translated.isEmpty() && translated != source) {
        editor->setPlaceholderText(translated);
    }
}

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
