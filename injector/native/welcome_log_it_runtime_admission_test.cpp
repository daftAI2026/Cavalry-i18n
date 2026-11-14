/**
 * [INPUT]: 依赖281 Welcome runtime、精确Extension/spdlog stub映像与受拒主程序loader。
 * [OUTPUT]: 验证只加载两dylib且唯一async返回PC在完整准入后发布。
 * [POS]: runtime admission fixture；不加载Cavalry或vendor映像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <limits.h>
#include <string>
#include <vector>
#include <unistd.h>
#include <mach-o/dyld.h>

#include <welcome_log_it_abi_contract.h>
#include <welcome_log_it_adapter.inc>

struct LoadedImage {
    std::uintptr_t base = 0;
    const char *path = nullptr;
    const char *uuid = nullptr;
};

namespace {
namespace Contract = welcome_log_it::contract;
constexpr std::uintptr_t kExtensionBase = 0x100000000ULL;
constexpr std::uintptr_t kSpdlogBase = 0x200000000ULL;
std::string gExecutablePath;
std::vector<std::string> gImageLoadRequests;
bool gMainImageRejected = false;
unsigned gFailures = 0;

enum class FixtureLocale { Unknown, Hans, Hant, Japanese };
struct LocaleState {
    FixtureLocale value() const noexcept { return FixtureLocale::Hans; }
};
LocaleState gLocale;

void expect(bool condition, const char *message)
{
    if (condition) return;
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++gFailures;
}
}  // namespace

extern "C" {
std::atomic<std::uintptr_t> nativeWelcomeLogItExpectedReturnPc{0};
void nativeWelcomeLogItVeneer(void *, const void *, bool, bool);
void welcomeLogItTarget(void *, const void *, bool, bool)
    __asm__("__ZN6spdlog6logger7log_it_ERKNS_7details7log_msgEbb");
}

bool appFrameworkPath(const char *leaf, char *output,
                      std::size_t capacity) noexcept
{
    const std::size_t slash = gExecutablePath.find_last_of('/');
    if (leaf == nullptr || output == nullptr || capacity == 0 ||
        slash == std::string::npos) return false;
    const std::string path = gExecutablePath.substr(0, slash) +
        "/Frameworks/" + leaf;
    if (path.size() + 1 > capacity) return false;
    std::memcpy(output, path.c_str(), path.size() + 1);
    return true;
}

bool findLoadedImageExactPath(const char *expectedPath,
                              LoadedImage *output) noexcept
{
    if (expectedPath == nullptr || output == nullptr) return false;
    gImageLoadRequests.emplace_back(expectedPath);
    if (gExecutablePath == expectedPath) {
        gMainImageRejected = true;
        return false;
    }
    const char *leaf = std::strrchr(expectedPath, '/');
    leaf = leaf == nullptr ? expectedPath : leaf + 1;
    if (std::strcmp(leaf, Contract::kExtensionImageName) == 0) {
        *output = {kExtensionBase, expectedPath, Contract::kExtensionUuid};
        return true;
    }
    if (std::strcmp(leaf, Contract::kSpdlogImageName) == 0) {
        *output = {kSpdlogBase, expectedPath, Contract::kSpdlogUuid};
        return true;
    }
    return false;
}

bool imageUuidEquals(const LoadedImage &image, const char *expected) noexcept
{
    return image.uuid != nullptr && expected != nullptr &&
        std::strcmp(image.uuid, expected) == 0;
}

const void *imageAddress(const LoadedImage &image,
                         std::uintptr_t offset) noexcept
{
    return reinterpret_cast<const void *>(image.base + offset);
}

const void *findMachOSymbol(const LoadedImage &image,
                            const char *symbol) noexcept
{
    if (symbol == nullptr) return nullptr;
    if (std::strcmp(symbol, Contract::kLogItSymbol) == 0 &&
        image.base == kSpdlogBase)
        return imageAddress(image, Contract::kLogItOffset);
    if (std::strcmp(symbol, Contract::kExtensionAsyncWelcomeSymbol) == 0 &&
        image.base == kExtensionBase)
        return imageAddress(image, Contract::kExtensionAsyncWelcomeSymbolOffset);
    return nullptr;
}

template <std::size_t Size>
bool matchesCode(const LoadedImage &image, std::uintptr_t offset,
                 const std::array<std::uint8_t, Size> &bytes) noexcept
{
    if (image.base != kExtensionBase) return false;
    const auto sameBytes = [&bytes](const auto &expected) {
        return bytes.size() == expected.size() &&
            std::memcmp(bytes.data(), expected.data(), bytes.size()) == 0;
    };
    if (offset == Contract::kExtensionAsyncWelcomeSourceRefOffset)
        return sameBytes(Contract::kExtensionAsyncWelcomeSourceRefBytes);
    if (offset == Contract::kExtensionAsyncWelcomeCallSetupOffset)
        return sameBytes(Contract::kExtensionAsyncWelcomeCallSetupBytes);
    if (offset == Contract::kExtensionWelcomeSourceOffset)
        return sameBytes(Contract::kExtensionWelcomeSourceBytes);
    return false;
}

bool readSelf(const void *source, std::size_t size,
              void *destination) noexcept
{
    if (source != imageAddress(
            LoadedImage{kExtensionBase, nullptr, nullptr},
            Contract::kExtensionGotOffset) ||
        size != sizeof(const void *) || destination == nullptr) return false;
    const void *target = reinterpret_cast<const void *>(nativeWelcomeLogItVeneer);
    std::memcpy(destination, &target, sizeof(target));
    return true;
}

extern "C" int _NSGetExecutablePath(char *buffer, std::uint32_t *size)
{
    if (buffer == nullptr || size == nullptr) return -1;
    const std::size_t required = gExecutablePath.size() + 1;
    if (*size < required) {
        *size = static_cast<std::uint32_t>(required);
        return -1;
    }
    std::memcpy(buffer, gExecutablePath.c_str(), required);
    *size = static_cast<std::uint32_t>(required);
    return 0;
}

#include <welcome_log_it_runtime.inc>

extern "C" void nativeWelcomeLogItVeneer(
    void *, const void *, bool, bool) {}

extern "C" void welcomeLogItTarget(
    void *, const void *, bool, bool) {}

int main()
{
    char temporaryDirectory[] = "/tmp/welcome-log-it-runtime.XXXXXX";
    char *directory = mkdtemp(temporaryDirectory);
    if (directory == nullptr) {
        std::perror("mkdtemp");
        return 2;
    }
    gExecutablePath = std::string(directory) + "/Cavalry";
    std::ofstream executable(gExecutablePath);
    executable << "fixture";
    executable.close();

    const bool admitted = verifyWelcomeLogItContract();
    const std::uintptr_t expectedReturnPc = kExtensionBase +
        Contract::kExtensionReturnOffset;
    expect(admitted, "Extension and spdlog stubs admit the Welcome producer");
    expect(nativeWelcomeLogItExpectedReturnPc.load(std::memory_order_acquire) ==
               expectedReturnPc,
           "the exact async BL return PC is published after admission");
    expect(!gMainImageRejected,
           "the admission path never asks the loader for the main executable");
    expect(gImageLoadRequests.size() == 2,
           "only Extension and spdlog images are requested");

    ::unlink(gExecutablePath.c_str());
    ::rmdir(directory);
    if (gFailures != 0) {
        std::fprintf(stderr, "FAIL: %u assertion(s)\n", gFailures);
        return 1;
    }
    std::puts("PASS: two-dylib Welcome admission publishes only the async return PC.");
    return 0;
}
