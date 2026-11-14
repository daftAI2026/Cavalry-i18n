"""
[INPUT]: 依赖默认2.8合同包装头与abi_2_8_1 profile合同。
[OUTPUT]: 锁定950e713默认快照和281 profile快照，拒绝意外漂移。
[POS]: 无vendor的编译期配置合同；不启动或读取Cavalry进程。
[PROTOCOL]: ABI快照有意更新时同时审阅默认/profile摘要与CLAUDE.md
"""
from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PROFILE = Path(__file__).resolve().parent

DEFAULT_SNAPSHOTS = {
    "demo_reader_abi_contract.h": "9057cb28cd1f2efbe71838a962ff2af3099d79c09da71983fc7d355394074891",
    "easing_menu_abi_contract.h": "5f7c401281baca345bac76efb7b3a5542383a6b7de9236d46ba706de9cb54381",
    "fast_search_unicode_abi_contract.h": "5de8a2e6316f9f6220a5d21afd637f82ab8bafe6b09bc791c1094bcc54ddcbb7",
    "getpath_font_abi_contract.h": "532932690a341e93b7d2d3b734ca65bf929983a39992f7027e496712b9cfe5b6",
    "guide_body_abi_contract.h": "2ff38bb5ba35e470c437c364ef7821154ce21c6fd980f5eb0c7ff193491520d3",
    "help_description_abi_contract.h": "8f3e196401e20bfd2416c2dacc0ef8da2e0213e38df34f2520c7987332a65404",
    "help_popup_layout_abi_contract.h": "a0115692f3063db48f6bb690bd5ca4e91192c35dd45738dd7326a69f94335e01",
    "native_locale_abi_contract.h": "fefb9d0dcd8c25a7e1f727dc61faa758c3bb47c575cf1e0cc534e8b824afe7f8",
    "save_scene_caption_abi_contract.h": "80019b7f5526fcdc849bb80617240b0f419ba32b69840d2bc3a90a61e52cfcf4",
    "timeline_owner_observer_contract.h": "0313de15555ba9dd74f20610e8d0ebcd474ce4a13d9ce29d1596c28b350c7993",
    "timeline_system_fallback_contract.h": "0cab762a02dd6e7465a4f4757e3bf9a97a98dcfdc167a1b4e91f0b4e07c2129c",
    "title_format_abi_contract.h": "a4702facd1d0a319c5a003fbab8865030c59ed22059906fd47bf8875c764f4c0",
    "viewport_owner_snapshot.h": "2ca5e89cb465f5bd5f9b98b69199f22a485cd06fabce1eaa76e4827856ca4ebe",
    "welcome_log_it_abi_contract.h": "68744cd33fd1d746770a0d49ee04fdf0eed09913a5217d04619788da221d47a6",
}

PROFILE_SNAPSHOTS = {
    "demo_reader_abi_contract.h": "d511a94c96fdc35e18a1b5b21fdac53e77235f959b21f2da12bf779a34ac29ef",
    "easing_menu_abi_contract.h": "a54e1093c82af11765c542ad565f0bc0538c88b863e0e71c325a63fc48038fcd",
    "fast_search_unicode_abi_contract.h": "ffef0b0c05878d0ea32286470e40a76a463365d9e2464736447360320774b8e6",
    "getpath_font_abi_contract.h": "751771a8446941dc6835999f16d64412243a9284c5710ed986c791a1fa72217c",
    "guide_body_abi_contract.h": "1492f9e845837a7651ba8624ac6d112097b1434e9e235ced647315247e237a86",
    "help_description_abi_contract.h": "d46a09a73f393652ce0661f2d8659705bc76725c2cb7c91ac233e163a13d92eb",
    "help_popup_layout_abi_contract.h": "1ba670629385e3740a3e493a0506c000ea73a14baba22988790db8969f941111",
    "native_locale_abi_contract.h": "5619e9940fceab4d53f416117df5627ae673a86eb61dc94d64c4ee39b89a7e1d",
    "save_scene_caption_abi_contract.h": "b9d326188dae460d3e2b4f49b443f4455389008f8269d4fd402f3bbe83b47ffd",
    "timeline_owner_observer_contract.h": "9c063e0999e56659c8b524760c6817d1478077ea188c333984a1130bafa20da3",
    "timeline_system_fallback_contract.h": "a3860b5331f4c289f1614eb2b3e70f34fd895a1bace7eb4eea788b3176a88d3f",
    "title_format_abi_contract.h": "d252e610a826e68af538e55da14c756ead5d3e1264f1702688fac142d5c229fc",
    "viewport_owner_snapshot.h": "660b47463017fa4bddae681f0d5cef3ff3cef7b35378c693b0e2fa8e0a8c8726",
    "welcome_log_it_abi_contract.h": "fd690475f4cbce805ad956c09769948b976180dada7bb283218025be0ad9f46c",
    "dependency_node_font_abi_contract.h": "72d05fac9494848779a4401c47d9db5e96f7b0ea7790874ce6ba8cacc03d9203",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_default_branch(filename: str, expected_digest: str) -> None:
    wrapper = (ROOT / filename).read_bytes()
    prefix = (
        f'#if defined(CAVALRY_NATIVE_TARGET_281)\n'
        f'#include "abi_2_8_1/{filename}"\n'
        '#else\n'
    ).encode()
    suffix = b"\n#endif  // CAVALRY_NATIVE_TARGET_281\n"
    if not wrapper.startswith(prefix) or not wrapper.endswith(suffix):
        raise SystemExit(f"FAIL: malformed 280/281 selector: {filename}")
    default_body = wrapper[len(prefix):-len(suffix)]
    if sha256(default_body) != expected_digest:
        raise SystemExit(f"FAIL: 2.8.0 default header drift: {filename}")


def check_profile_header(filename: str, expected_digest: str) -> None:
    content = (PROFILE / filename).read_bytes()
    if sha256(content) != expected_digest:
        raise SystemExit(f"FAIL: 2.8.1 profile header drift: {filename}")


def main() -> None:
    if set(DEFAULT_SNAPSHOTS) - set(PROFILE_SNAPSHOTS):
        raise SystemExit("FAIL: profile misses an existing ABI contract")
    for filename, expected in DEFAULT_SNAPSHOTS.items():
        check_default_branch(filename, expected)
    for filename, expected in PROFILE_SNAPSHOTS.items():
        check_profile_header(filename, expected)

    title = (PROFILE / "title_format_abi_contract.h").read_text()
    if "#error \"Cavalry 2.8.1 title ABI is arm64-only\"" not in title or \
            "title_format_x86_64_abi_contract.inc" in title:
        raise SystemExit("FAIL: 2.8.1 title contract must be arm64-only")
    font = (PROFILE / "timeline_system_fallback_contract.h").read_text()
    if "0x01, 0xe4, 0x00, 0x6f" not in font:
        raise SystemExit("FAIL: 2.8.1 SkFont::setSize window is not the reviewed value")

    print(f"PASS: {len(DEFAULT_SNAPSHOTS)} byte-identical 2.8.0 default headers")
    print(f"PASS: {len(PROFILE_SNAPSHOTS)} pinned 2.8.1 ABI profile headers")
    print("PASS: arm64-only fmt11 title and reviewed setSize window")


if __name__ == "__main__":
    main()
