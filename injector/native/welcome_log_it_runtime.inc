/**
 * [INPUT]: 依赖同bundle Extension/spdlog、固定UUID、async调用窗与interpose GOT。
 * [OUTPUT]: 核原导出与一个精确producer；完整ABI就绪后才发布唯一Welcome返回PC。
 * [POS]: 原函数走本interposer的dyld旧实现导入桩，构造前门值为零。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
namespace welcome_log_it_runtime {
namespace welcome_contract = welcome_log_it::contract;
LoadedImage gWelcomeExtensionImage{};
LoadedImage gWelcomeSpdlogImage{};

bool verifyWelcomeLogItContract() noexcept
{
    nativeWelcomeLogItExpectedReturnPc.store(0, std::memory_order_release);

    std::array<char, PATH_MAX> extensionPath{};
    std::array<char, PATH_MAX> spdlogPath{};
    if (!appFrameworkPath(welcome_contract::kExtensionImageName,
                          extensionPath.data(), extensionPath.size()) ||
        !appFrameworkPath(welcome_contract::kSpdlogImageName,
                          spdlogPath.data(), spdlogPath.size()) ||
        !findLoadedImageExactPath(spdlogPath.data(), &gWelcomeSpdlogImage) ||
        !imageUuidEquals(gWelcomeSpdlogImage, welcome_contract::kSpdlogUuid))
        return false;

    const void *original = findMachOSymbol(
        gWelcomeSpdlogImage, welcome_contract::kLogItSymbol);
    if (original == nullptr || original != imageAddress(
            gWelcomeSpdlogImage, welcome_contract::kLogItOffset)) return false;
    if (!findLoadedImageExactPath(extensionPath.data(), &gWelcomeExtensionImage) ||
        !imageUuidEquals(gWelcomeExtensionImage, welcome_contract::kExtensionUuid))
        return false;

#if defined(CAVALRY_NATIVE_TARGET_281) && defined(__aarch64__)
    if (findMachOSymbol(gWelcomeExtensionImage,
                        welcome_contract::kExtensionAsyncWelcomeSymbol) !=
            imageAddress(gWelcomeExtensionImage,
                         welcome_contract::kExtensionAsyncWelcomeSymbolOffset) ||
        !matchesCode(gWelcomeExtensionImage,
                     welcome_contract::kExtensionAsyncWelcomeSourceRefOffset,
                     welcome_contract::kExtensionAsyncWelcomeSourceRefBytes) ||
        !matchesCode(gWelcomeExtensionImage,
                     welcome_contract::kExtensionAsyncWelcomeCallSetupOffset,
                     welcome_contract::kExtensionAsyncWelcomeCallSetupBytes) ||
        !matchesCode(gWelcomeExtensionImage,
                     welcome_contract::kExtensionWelcomeSourceOffset,
                     welcome_contract::kExtensionWelcomeSourceBytes)) return false;
#endif

    const void *boundTarget = nullptr;
    if (!readSelf(imageAddress(gWelcomeExtensionImage,
                               welcome_contract::kExtensionGotOffset),
                  sizeof(boundTarget), &boundTarget) ||
        boundTarget != reinterpret_cast<const void *>(nativeWelcomeLogItVeneer))
        return false;

    nativeWelcomeLogItExpectedReturnPc.store(
        reinterpret_cast<std::uintptr_t>(imageAddress(
            gWelcomeExtensionImage, welcome_contract::kExtensionReturnOffset)),
        std::memory_order_release);
    return true;
}

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} welcomeLogItInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(nativeWelcomeLogItVeneer),
    reinterpret_cast<const void *>(welcomeLogItTarget)
};

}  // namespace welcome_log_it_runtime

bool verifyWelcomeLogItContract() noexcept
{
    return welcome_log_it_runtime::verifyWelcomeLogItContract();
}

extern "C" __attribute__((noinline, visibility("hidden")))
void nativeWelcomeLogItDispatcher(void *logger, const void *message,
                                  bool logEnabled, bool tracebackEnabled,
                                  std::uintptr_t callerPc)
{
    welcome_log_it::forward(
        &welcomeLogItTarget, logger, message, logEnabled, tracebackEnabled,
        callerPc,
        nativeWelcomeLogItExpectedReturnPc.load(std::memory_order_acquire),
        gLocale.value());
}
