#!/usr/bin/env python3
"""[INPUT]: The target composer and small source fixtures.
[OUTPUT]: Checks selected ABI inputs, executable C-string suffix guards and unchanged shared sources.
[POS]: Offline build regression; does not build or launch Cavalry.
[PROTOCOL]: Update with build_candidate_2_8_1.py and CLAUDE.md.
"""
from pathlib import Path
import subprocess
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
                "title_format_adapter.inc": 'appFrameworkPath("libfmt.10.dylib", path);\nif (values[2].cstring.unused != 0 || suffix == nullptr) return false;',
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
            self.assertNotIn('cstring.unused', (staged / 'title_format_adapter.inc').read_text())
            self.assertIn('target281()', (staged / 'viewport_font_adapter.inc').read_text())
            for name, text in originals.items():
                self.assertEqual((native / name).read_text(), text)

    def test_vendor_title_cstring_padding_is_only_required_by_280(self):
        native = Path(__file__).resolve().parent
        adapter = (native / 'title_format_adapter.inc').read_text()
        start = adapter.index('bool titleSuffixMatches(')
        end = adapter.index('bool readTitleSourceStringSnapshots(', start)
        function = adapter[start:end]
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root, output = base / 'source', base / 'build'
            fixture = root / 'injector/native'
            profile = fixture / 'abi_2_8_1'
            profile.mkdir(parents=True)
            for name in ('languages', 'tools'):
                (root / name).mkdir()
            (fixture / 'title_format_adapter.inc').write_text(adapter)
            (fixture / 'viewport_font_adapter.inc').write_text(
                'bool verifyViewportProbe() {}\nviewport_owner::StackRange currentThreadStack() {}')
            (fixture / 'skia_original_bindings.inc').write_text('imageAddress(gSkiaImage, 0x1b40d8)')
            (profile / 'viewport_probe.inc').write_text('bool verifyViewportProbe() {}\n')
            (profile / 'build_candidate.sh').write_text('clang++ source.mm\n')
            prepare_tree(root, output)
            selected = (output / 'injector/native/title_format_adapter.inc').read_text()
            target_function = selected[selected.index('bool titleSuffixMatches('):
                                       selected.index('bool readTitleSourceStringSnapshots(')]
            for target, implementation in [('280', function), ('281', target_function)]:
                header = native / ('abi_2_8_1/title_format_abi_contract.h' if target == '281'
                                   else 'title_format_abi_contract.h')
                cpp = base / (target + '.cpp')
                cpp.write_text('#include <cassert>\n#include "' + str(header) + '"\n' + '''
namespace title_abi = native_title_format_abi;
namespace title_contract = title_abi::contract;
int gTitleExtensionImage = 0;
const void *imageAddress(int, std::uintptr_t offset) { return reinterpret_cast<void *>(0x100000000ULL + offset); }
''' + implementation + '''
int main() {
    title_abi::FormatValue values[3]{};
    for (auto offset : {title_contract::kEmptySuffixOffset, title_contract::kRestrictedSuffixOffset}) {
        values[2].cstring.data = static_cast<const char *>(imageAddress(0, offset));
        values[2].cstring.unused = 0;
        assert(titleSuffixMatches(values));
        values[2].cstring.unused = 0x12345678;
        assert(titleSuffixMatches(values) == ''' + ('true' if target == '281' else 'false') + ''');
    }
    values[2].cstring.data = nullptr;
    assert(!titleSuffixMatches(values));
    values[2].cstring.data = "unknown suffix";
    assert(!titleSuffixMatches(values));
}
''')
                executable = base / target
                # The profile is an ARM data contract; this test uses no ARM instructions.
                target_flags = ['-D__aarch64__=1'] if target == '281' else []
                subprocess.run(['clang++', '-std=c++17', *target_flags,
                                str(cpp), '-o', str(executable)], check=True)
                subprocess.run([str(executable)], check=True, capture_output=True)
            self.assertEqual((native / 'title_format_adapter.inc').read_text(), adapter)


if __name__ == '__main__':
    unittest.main()
