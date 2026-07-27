/**
 * [INPUT]: 依赖固定数量的 source/translation 值对象与 C++ shared_ptr 原子发布语义
 * [OUTPUT]: 对外提供支持精确 source 与已验证索引读取的 immutable translation table，以及不参与 DLL detach 析构的 process-lifetime shared_ptr 发布槽
 * [POS]: injector/windows 的无 raw-owner 回调原语；发布槽有意存活到进程结束，由 hook 在普通线程换成不持外部对象的墓碑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <array>
#include <cstddef>
#include <memory>
#include <utility>

namespace cavalry_i18n {

template <typename Text, std::size_t Count>
class ExactTranslationSnapshot final
{
public:
    using Entry = std::pair<Text, Text>;

    explicit ExactTranslationSnapshot(std::array<Entry, Count> entries)
        : entries_(std::move(entries))
    {
    }

    const Text *find(const Text &source) const
    {
        for (const auto &entry : entries_) {
            if (entry.first == source) {
                return &entry.second;
            }
        }
        return nullptr;
    }

    const Text *translationAt(std::size_t index) const
    {
        return index < entries_.size()
            ? &entries_[index].second
            : nullptr;
    }

private:
    const std::array<Entry, Count> entries_;
};

template <typename State>
std::shared_ptr<const State> &processLifetimeCallbackSlot()
{
    // raw pointer 本身无析构；最终槽值须由 hook 在普通线程换成纯值墓碑。
    static auto *slot = new std::shared_ptr<const State>();
    return *slot;
}

} // namespace cavalry_i18n
