#!/usr/bin/env python3
"""[INPUT]: The target composer and small source fixtures.
[OUTPUT]: Checks version-specific inputs and preservation of shared sources.
[POS]: Offline build regression; does not build or launch Cavalry.
[PROTOCOL]: Update with build_candidate_2_8_1.py and CLAUDE.md.
"""
from pathlib import Path
import tempfile
import unittest

from build_candidate_2_8_1 import prepare_tree


class TargetComposition(unittest.TestCase):
    def test_target_rebinds_blob_without_changing_280_source(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root, output = base / "source", base / "build"
            native = root / "injector/native"
            profile = native / "abi_2_8_1"
            profile.mkdir(parents=True)
            for name in ("languages", "tools"):
                (root / name).mkdir()
            originals = {
                "title_format_adapter.inc": 'appFrameworkPath("libfmt.10.dylib", path);',
                "viewport_font_adapter.inc": 'bool verifyViewportProbe() { return old(); }\nviewport_owner::StackRange currentThreadStack() {}',
                "skia_original_bindings.inc": 'imageAddress(gSkiaImage, 0x1b40d8);',
            }
            for name, text in originals.items():
                (native / name).write_text(text)
            (profile / "viewport_probe.inc").write_text('bool verifyViewportProbe() { return target281(); }\n')
            (profile / "build_candidate.sh").write_text('xcrun clang++ source.mm\n')
            prepare_tree(root, output)
            staged = output / "injector/native"
            self.assertIn('observer_contract::kTextBlobSymbolOffset',
                          (staged / 'skia_original_bindings.inc').read_text())
            self.assertNotIn('0x1b40d8', (staged / 'skia_original_bindings.inc').read_text())
            self.assertIn('libfmt.11.dylib', (staged / 'title_format_adapter.inc').read_text())
            self.assertIn('target281()', (staged / 'viewport_font_adapter.inc').read_text())
            for name, text in originals.items():
                self.assertEqual((native / name).read_text(), text)


if __name__ == '__main__':
    unittest.main()
