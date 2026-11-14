#!/usr/bin/env python3
"""
[INPUT]: 依赖281 ARM实际构建profile、Intel构建脚本、双slice dwarfdump行与系统awk。
[OUTPUT]: 验证UUID选择只读取第三字段并支持两种slice顺序。
[POS]: vendor-free构建门合同；路径含架构词时仍精确选择slice。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import pathlib
import subprocess
import unittest


NATIVE_DIR = pathlib.Path(__file__).resolve().parent
BUILDERS = {
    "arm64": (NATIVE_DIR / "abi_2_8_1/build_candidate.sh", "ARM-UUID", 3),
    "x86_64": (NATIVE_DIR / "build_x86_64_candidate.sh", "X86-UUID", 2),
}
FIXTURE_ROWS = (
    "UUID: ARM-UUID (arm64) /fixtures/arm64-inputs/x86_64-framework.dylib",
    "UUID: X86-UUID (x86_64) /fixtures/x86_64-inputs/arm64-framework.dylib",
)


def uuid_selectors(builder: pathlib.Path) -> list[str]:
    selectors = []
    for line in builder.read_text().splitlines():
        if "dwarfdump --uuid" in line:
            selectors.append(line.split("awk '", 1)[1].rsplit("'", 1)[0])
    return selectors


class NativeUuidSliceSelectorContractTest(unittest.TestCase):
    def test_builders_use_exact_architecture_field(self) -> None:
        for architecture, (builder, _uuid, count) in BUILDERS.items():
            with self.subTest(architecture=architecture):
                selectors = uuid_selectors(builder)
                self.assertEqual(len(selectors), count)
                self.assertTrue(all(
                    selector == f'$3 == "({architecture})" {{print $2; exit}}'
                    for selector in selectors
                ), selectors)

    def test_both_slice_orders_ignore_architecture_words_in_paths(self) -> None:
        for architecture, (builder, expected_uuid, _count) in BUILDERS.items():
            for rows in (FIXTURE_ROWS, tuple(reversed(FIXTURE_ROWS))):
                for selector in uuid_selectors(builder):
                    with self.subTest(architecture=architecture, rows=rows):
                        result = subprocess.run(
                            ["awk", selector],
                            input="\n".join(rows) + "\n",
                            check=True,
                            capture_output=True,
                            text=True,
                        )
                        self.assertEqual(result.stdout.strip(), expected_uuid)


if __name__ == "__main__":
    unittest.main(verbosity=2)
