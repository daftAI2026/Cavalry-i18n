"""
[INPUT]: 依赖candidate checker与合成反汇编；UUID用例读取只读Frameworks。
[OUTPUT]: 验证目标符号边界、完整指令比较与arm64 UUID归属。
[POS]: 后置门反例测试；不加载App或候选，不修改Frameworks。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

import check_candidate_contract as checker


class CompiledFunctionBoundaryContract(unittest.TestCase):
    target = "_getPathFontVeneer"
    expected = ["mov x5, x30", "mov x6, x29", "b _getPathFontDispatch"]

    def disassembly(self, target_body: list[str]) -> str:
        rows = [f"{self.target}:"]
        rows.extend(f"10000000{index:02x} {instruction}"
                    for index, instruction in enumerate(target_body))
        rows.extend((
            "_fastSearchUnicodeConstructorInterpose.cold.1:",
            "1000000010 bl _unrelatedColdPath",
        ))
        return "\n".join(rows)

    def test_following_cold_symbol_is_outside_target_body(self) -> None:
        actual = checker.compiled_function_instructions(
            self.disassembly(self.expected), self.target)
        self.assertEqual(actual, self.expected)

    def test_fourth_target_instruction_is_kept_and_rejected(self) -> None:
        actual = checker.compiled_function_instructions(
            self.disassembly(self.expected + ["nop"]), self.target)
        self.assertEqual(actual, self.expected + ["nop"])
        with self.assertRaisesRegex(SystemExit, "compiled veneer"):
            checker.require(actual == self.expected,
                            f"compiled veneer must match exactly: {actual}")

    def test_missing_or_wrong_symbol_is_rejected(self) -> None:
        wrong_symbol_dump = self.disassembly(self.expected).replace(
            self.target, "_differentFunction", 1)
        with self.assertRaisesRegex(SystemExit, "缺少指定函数"):
            checker.compiled_function_instructions(
                wrong_symbol_dump, self.target)
        with self.assertRaisesRegex(SystemExit, "缺少指定函数"):
            checker.compiled_function_instructions(
                self.disassembly(self.expected), "_missingFunction")


class UuidArchitectureContract(unittest.TestCase):
    def test_uuid_from_other_slice_cannot_admit_arm64(self) -> None:
        real_run = checker.run

        def mixed_slice_report(*command: str) -> str:
            report = real_run(*command)
            if command[:3] != ("xcrun", "dwarfdump", "--uuid"):
                return report
            lines = []
            for line in report.splitlines():
                if "(arm64)" in line:
                    uuid = line.split()[1]
                    lines.extend((
                        f"UUID: {uuid} (x86_64) {command[-1]}",
                        f"UUID: 00000000-0000-0000-0000-000000000000 (arm64) {command[-1]}",
                    ))
            return "\n".join(lines) + "\n"

        with tempfile.TemporaryDirectory(prefix="native-static-negative.") as folder:
            (pathlib.Path(folder) / "title-format-fmt10-abi.s").write_text("")
            arguments = ["check_candidate_contract.py", str(ROOT), folder,
                         str(FRAMEWORKS), str(CANDIDATE)]
            with patch.object(checker, "run", mixed_slice_report), \
                    patch.object(sys, "argv", arguments):
                with self.assertRaisesRegex(SystemExit, "arm64 UUID"):
                    checker.main()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("用法: candidate_static_contract_test.py ROOT FRAMEWORKS CANDIDATE")
    ROOT, FRAMEWORKS, CANDIDATE = map(pathlib.Path, sys.argv[1:])
    unittest.main(argv=[sys.argv[0]])
