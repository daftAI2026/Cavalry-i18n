#!/usr/bin/env python3
"""
[INPUT]: 依赖项目skill原生CV fixture、Dependency Graph case producer与run_flow schema。
[OUTPUT]: 验证派生输入确定、结构完整、平台命令未绑定且源asset不变。
[POS]: 离线合同测试；不启动Cavalry、不保存实屏PASS。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import dependency_graph_fixture as fixture
import run_flow


class DependencyGraphFixtureTests(unittest.TestCase):
    def prepare(self, root: Path, locale: str) -> dict:
        out = root / locale
        return fixture.prepare(out, locale)

    def test_fixed_names_ids_and_localized_type_labels(self) -> None:
        with tempfile.TemporaryDirectory(prefix='dg-fixture-') as temp:
            result = self.prepare(Path(temp), 'zh-Hans')
            expected = json.loads(Path(result['expected']).read_text(encoding='utf-8'))
            self.assertEqual(expected['topLevelLayerCount'], 6)
            self.assertEqual(expected['machineType'], 'javaScriptShape')
            self.assertEqual(expected['displayTypeByLocale'], fixture.TYPE_LABELS)
            self.assertEqual(
                [(row['row'], row['nodeId'], row['nodeType'], row['name']) for row in expected['rows']],
                [(row['row'], row['nodeId'], 'javaScriptShape', row['name']) for row in fixture.ROWS],
            )
            self.assertEqual(expected['postRenameRows'][4]['name'], fixture.RENAMED_NAME)
            self.assertEqual(expected['postRenameRows'][4]['nodeId'], 'javaScriptShape#2')
            self.assertEqual(len(expected['cases']), 6)
            self.assertEqual([item['id'] for item in expected['cases']], [f'DG-0{i}' for i in range(1, 7)])
            self.assertTrue(all(item['expectedMachineType'] == 'javaScriptShape' for item in expected['cases']))
            self.assertTrue(all(item['expectedDisplayType'] == fixture.TYPE_LABELS['zh-Hans'] for item in expected['cases']))
            self.assertEqual(len({item['imageFilename'] for item in expected['cases']}), 6)
            self.assertFalse(result['productPass'])

    def test_generated_scene_changes_only_fixed_nice_names(self) -> None:
        source_bytes = fixture.SOURCE_SCENE.read_bytes()
        source_scene = json.loads(source_bytes.decode('utf-8'))
        expected_scene = copy.deepcopy(source_scene)
        by_id = {node['nodeId']: node for node in expected_scene['nodes']}
        for row in fixture.ROWS:
            by_id[row['nodeId']]['attributes']['niceName']['value'] = row['name']
        by_id['compNode#1']['attributes']['niceName']['value'] = fixture.COMPOSITION_NAME

        with tempfile.TemporaryDirectory(prefix='dg-fixture-') as temp:
            result = self.prepare(Path(temp), 'zh-Hant')
            scene_path = Path(result['fixture'])
            scene = json.loads(scene_path.read_text(encoding='utf-8'))
            expected = json.loads(Path(result['expected']).read_text(encoding='utf-8'))
            self.assertEqual(scene, expected_scene)
            self.assertEqual(hashlib.sha256(scene_path.read_bytes()).hexdigest(), expected['generatedFixtureSha256'])
            self.assertEqual(fixture.SOURCE_SCENE.read_bytes(), source_bytes)

    def test_no_external_assets_urls_or_paths(self) -> None:
        with tempfile.TemporaryDirectory(prefix='dg-fixture-') as temp:
            result = self.prepare(Path(temp), 'ja_JP')
            scene = json.loads(Path(result['fixture']).read_text(encoding='utf-8'))
            expected = json.loads(Path(result['expected']).read_text(encoding='utf-8'))
            self.assertIn(scene.get('externalAssets', []), ([], None))
            self.assertEqual(scene['referenceData'], {})
            self.assertEqual(expected['externalAssets'], [])
            self.assertEqual(expected['referenceData'], {})
            for value in fixture.strings(scene):
                self.assertIsNone(fixture.URL_PATTERN.search(value), value)
                self.assertIsNone(fixture.ABSOLUTE_PATH_PATTERN.search(value), value)
                self.assertIsNone(fixture.WINDOW_PATH_PATTERN.search(value), value)

    def test_runs_are_deterministic_and_reject_existing_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix='dg-fixture-') as temp:
            root = Path(temp)
            first, second_locale, third_locale = [
                self.prepare(root, locale) for locale in fixture.LOCALES
            ]
            self.assertEqual(Path(first['fixture']).read_bytes(), Path(second_locale['fixture']).read_bytes())
            self.assertEqual(Path(first['fixture']).read_bytes(), Path(third_locale['fixture']).read_bytes())
            first_artifacts = [Path(first['fixture']), Path(first['expected']), Path(first['planTemplate'])]
            bytes_before = [path.read_bytes() for path in first_artifacts]
            # A separate new run yields identical artifact bytes for the same locale.
            second_out = root / 'second'
            second_out.mkdir()
            second = fixture.prepare(second_out / 'zh-Hans', 'zh-Hans')
            second_artifacts = [Path(second['fixture']), Path(second['expected']), Path(second['planTemplate'])]
            self.assertEqual(bytes_before, [path.read_bytes() for path in second_artifacts])
            with self.assertRaises(FileExistsError):
                fixture.prepare(Path(first['out']), 'zh-Hans')

    def test_run_flow_template_keeps_both_platform_slots_unbound(self) -> None:
        with tempfile.TemporaryDirectory(prefix='dg-fixture-') as temp:
            result = self.prepare(Path(temp), 'zh-Hans')
            plan = json.loads(Path(result['planTemplate']).read_text(encoding='utf-8'))
            self.assertEqual(plan['profileHandback'], 'dependency-graph-owned-session')
            self.assertIn('no Windows driver supplied', plan['driverStatus']['windows'])
            self.assertEqual(len(plan['steps']), 6)
            by_case = {step['id']: step for step in plan['steps']}
            self.assertEqual(by_case['DG-04']['expectedNames'], [fixture.RENAMED_NAME])
            self.assertEqual(by_case['DG-04']['readbackRows'], [4])
            self.assertIn('javaScriptShape#2', '\n'.join(by_case['DG-04']['reads']))
            self.assertEqual(by_case['DG-05']['readbackRows'], [row['row'] for row in fixture.POST_RENAME_ROWS])
            self.assertEqual(by_case['DG-05']['expectedNames'][4], fixture.RENAMED_NAME)
            self.assertEqual(by_case['DG-06']['expectedNames'], [fixture.RENAMED_NAME])
            self.assertTrue(all(step['procedure'] for step in plan['steps']))
            self.assertTrue(all(step['action'] == {'macos': [], 'windows': []} for step in plan['steps']))
            self.assertTrue(all(step['capture'] == {'macos': [], 'windows': []} for step in plan['steps']))
            with self.assertRaisesRegex(ValueError, '缺少 macos 命令数组'):
                run_flow.validate(plan, 'macos')
            with self.assertRaisesRegex(ValueError, '缺少 windows 命令数组'):
                run_flow.validate(plan, 'windows')

            bound = copy.deepcopy(plan)
            for step in bound['steps']:
                step['action'] = {platform: ['python', '-c', 'pass'] for platform in ('macos', 'windows')}
                step['capture'] = {platform: ['python', '-c', 'pass'] for platform in ('macos', 'windows')}
            self.assertEqual(run_flow.validate(bound, 'macos'), 6)
            self.assertEqual(run_flow.validate(bound, 'windows'), 6)
            with self.assertRaisesRegex(ValueError, '拥有该回交职责的平台入口'):
                run_flow.run(bound, Path(temp) / 'not-created', 'macos')
            self.assertFalse((Path(temp) / 'not-created').exists())


if __name__ == '__main__':
    unittest.main()
