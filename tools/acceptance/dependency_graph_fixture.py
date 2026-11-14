#!/usr/bin/env python3
"""
[INPUT]: 依赖项目skill中的timeline-six-names.cv与固定Dependency Graph case数据。
[OUTPUT]: 生成自有六节点CV、读回预期和run_flow.py未绑定步骤模板。
[POS]: 双平台共享的离线fixture producer；不运行Cavalry、不写模型脚本、不授PASS。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / '.agents/skills/cavalry-native-display-check/assets'
SOURCE_SCENE = ASSET_ROOT / 'timeline-six-names.cv'
SOURCE_EXPECTED = ASSET_ROOT / 'timeline-six-names.expected.json'
SOURCE_SCENE_SHA256 = 'b649106c8c61aa7f5895f5955f7bec5381ff84e3371ac1071905434e216395a7'
SOURCE_EXPECTED_SHA256 = 'ffd03ccfd985e0c2a52d4d316086e5ae53d7c29f7677507db7d1b4ae178fc748'

LOCALES = ('zh-Hans', 'zh-Hant', 'ja_JP')
TYPE_LABELS = {
    'zh-Hans': 'JavaScript 形状',
    'zh-Hant': 'JavaScript 形狀',
    'ja_JP': 'JavaScriptシェイプ',
}
MACHINE_TYPE = 'javaScriptShape'
COMPOSITION_NAME = 'Dependency Graph Fixture 281'
RENAMED_NAME = '重命名节点_日本語Mixed42'
ROWS = (
    {'row': 0, 'nodeId': 'javaScriptShape#6',
     'name': '長い名前简繁日本語' * 8},
    {'row': 1, 'nodeId': 'javaScriptShape#5', 'name': 'Mixed 混排 281'},
    {'row': 2, 'nodeId': 'javaScriptShape#4', 'name': '日本語ノード 281'},
    {'row': 3, 'nodeId': 'javaScriptShape#3', 'name': '繁體節點測試 281'},
    {'row': 4, 'nodeId': 'javaScriptShape#2', 'name': '简体节点测试 281'},
    {'row': 5, 'nodeId': 'javaScriptShape#1', 'name': 'ASCII Control 281'},
)
POST_RENAME_ROWS = tuple(
    {**row, 'name': RENAMED_NAME} if row['nodeId'] == 'javaScriptShape#2' else dict(row)
    for row in ROWS
)

CASES = (
    {
        'id': 'DG-01',
        'title': 'Dependency Graph初始两行文字',
        'imageFilename': 'DG-01-initial-two-line-{locale}.png',
        'expectedNames': [row['name'] for row in ROWS],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'expected': '六个节点名称逐字保留；名称行和JavaScript Shape类型行无缺字方框。',
        'captureTarget': 'Dependency Graph中六个节点的两行标题。',
        'actionSteps': [
            '通过LaunchServices正常打开本轮生成的CV副本。',
            '用已绑定的平台原生菜单或Qt动作打开Dependency Graph。',
            '确认六个fixture节点可见后立即采集一张图。',
        ],
        'readbackRows': [row['row'] for row in ROWS],
    },
    {
        'id': 'DG-02',
        'title': 'ASCII节点对照',
        'imageFilename': 'DG-02-ascii-control-{locale}.png',
        'expectedNames': [ROWS[5]['name']],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'expected': 'ASCII Control 281名称保持原文；类型机器值与局部化类型显示各自可核。',
        'captureTarget': 'Dependency Graph中的ASCII Control 281节点标题。',
        'actionSteps': ['保持Dependency Graph打开并定位固定ASCII节点，再采集一张图。'],
        'readbackRows': [5],
    },
    {
        'id': 'DG-03',
        'title': '长中日混合名称省略',
        'imageFilename': 'DG-03-long-name-elision-{locale}.png',
        'expectedNames': [ROWS[0]['name']],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'expected': '完整长名称由外部F2只读路径逐字读回；节点宽度不足时省略干净，像素无方框。',
        'captureTarget': 'Dependency Graph中的长名称节点；截图时保持该节点未选中。',
        'actionSteps': [
            '通过外部F2只读host核对第0行完整名称，不读取DisplayRole代替像素。',
            '选择短名称行以保持长名称节点未选中，再采集Dependency Graph图像。',
        ],
        'readbackRows': [0],
    },
    {
        'id': 'DG-04',
        'title': '同一节点原生重命名',
        'imageFilename': 'DG-04-renamed-node-{locale}.png',
        'expectedNames': [RENAMED_NAME],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'rename': {'row': 4, 'nodeId': 'javaScriptShape#2',
                   'from': ROWS[4]['name'], 'to': RENAMED_NAME},
        'expected': '通过标准界面重命名同一图层；固定nodeId、名称读回与机器type保持一致。',
        'captureTarget': 'Dependency Graph中已重命名节点的两行标题。',
        'actionSteps': [
            '在SceneTree对第4行执行标准UI重命名，不调用模型setter或脚本API。',
            '外部F2只读回读新名称，确认该行nodeId仍为javaScriptShape#2。',
            '在Dependency Graph对同一节点采集一张图。',
        ],
        'readbackRows': [4],
    },
    {
        'id': 'DG-05',
        'title': '保存重开后名称持久',
        'imageFilename': 'DG-05-reopened-fixture-{locale}.png',
        'expectedNames': [row['name'] for row in POST_RENAME_ROWS],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'expected': '标准Save保存重命名后的自有场景并正常重开；六个名称和nodeId读回一致。',
        'captureTarget': '重新打开的自有场景中Dependency Graph六个节点的标题。',
        'actionSteps': [
            '用Cavalry标准Save保存当前自有CV副本，不覆盖skill原件。',
            '正常关闭并重新打开刚保存的副本。',
            '外部F2只读回读六行名称与固定nodeId，再采集一张图。',
        ],
        'readbackRows': [row['row'] for row in POST_RENAME_ROWS],
    },
    {
        'id': 'DG-06',
        'title': 'Timeline与Viewport同名回归',
        'imageFilename': 'DG-06-timeline-viewport-name-{locale}.png',
        'expectedNames': [RENAMED_NAME],
        'expectedMachineType': MACHINE_TYPE,
        'expectedDisplayTypeByLocale': TYPE_LABELS,
        'expected': '同一重命名图层在Dependency Graph以外仍保留原始niceName；类型机器值不变。',
        'captureTarget': '同一重命名节点在Timeline或Viewport可见的名称；图像注明实际表面。',
        'actionSteps': [
            '选择同一renamed nodeId并切到Timeline或Viewport，不改图层名称。',
            '外部F2只读回读名称，记录画面所处表面并采集一张图。',
        ],
        'readbackRows': [4],
    },
)

URL_PATTERN = re.compile(r'\b[a-z][a-z0-9+.-]*://', re.IGNORECASE)
ABSOLUTE_PATH_PATTERN = re.compile(r'(?<![\w:])/(?:[^/\s"\'<>]+(?:/[^\s"\'<>]*)*)?')
WINDOW_PATH_PATTERN = re.compile(r'(?<!\w)[A-Za-z]:\\|\\\\')


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from strings(key)
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def _load_source() -> tuple[dict[str, Any], dict[str, Any], bytes]:
    scene_bytes = SOURCE_SCENE.read_bytes()
    expected_bytes = SOURCE_EXPECTED.read_bytes()
    if sha256(scene_bytes) != SOURCE_SCENE_SHA256 or sha256(expected_bytes) != SOURCE_EXPECTED_SHA256:
        raise ValueError('project skill six-name source fixture changed; review and update the binding')
    scene = json.loads(scene_bytes.decode('utf-8'))
    source_expected = json.loads(expected_bytes.decode('utf-8'))
    if source_expected.get('scene') != SOURCE_SCENE.name or source_expected.get('sceneFileVersion') != scene.get('version'):
        raise ValueError('project skill fixture manifest does not match its CV asset')
    if source_expected.get('topLevelLayerCount') != 6 or len(source_expected.get('rows', [])) != 6:
        raise ValueError('project skill fixture must have six fixed rows')
    if source_expected.get('externalAssets') != [] or scene.get('referenceData') != {}:
        raise ValueError('project skill fixture gained an external asset or reference')
    expected_source_rows = [
        (0, 'javaScriptShape#6', '文字名称の長いテスト' * 8),
        (1, 'javaScriptShape#5', 'Text Box 自定义33'),
        (2, 'javaScriptShape#4', '変形テスト 2'),
        (3, 'javaScriptShape#3', '圖層測試999'),
        (4, 'javaScriptShape#2', 'ASCII Control33'),
        (5, 'javaScriptShape#1', '控制测试33'),
    ]
    actual_source_rows = [
        (row.get('row'), row.get('nodeId'), row.get('name'))
        for row in source_expected['rows']
    ]
    if actual_source_rows != expected_source_rows:
        raise ValueError('project skill source row map changed')
    return scene, source_expected, scene_bytes


def build_scene() -> tuple[dict[str, Any], dict[str, Any], bytes]:
    scene, source_expected, source_bytes = _load_source()
    nodes = {node.get('nodeId'): node for node in scene.get('nodes', [])}
    rows = [dict(row) for row in ROWS]
    composition_id = source_expected['activeComposition']
    composition = nodes.get(composition_id)
    if not composition or composition.get('nodeType') != 'compNode':
        raise ValueError('active composition node is missing from the approved source fixture')
    for row in rows:
        node = nodes.get(row['nodeId'])
        if not node or node.get('nodeType') != MACHINE_TYPE:
            raise ValueError(f"fixed JavaScript Shape is missing: {row['nodeId']}")
        attribute = node.get('attributes', {}).get('niceName', {})
        if attribute.get('varType') != 'string':
            raise ValueError(f"niceName is not a string attribute: {row['nodeId']}")
        attribute['value'] = row['name']
        row['nodeType'] = node['nodeType']
    composition_name = composition.get('attributes', {}).get('niceName', {})
    if composition_name.get('varType') != 'string':
        raise ValueError('active composition niceName is not a string attribute')
    composition_name['value'] = COMPOSITION_NAME

    metadata = {item.get('nodeId'): item for item in scene.get('nodeMeta', [])}
    child_ids = metadata.get(composition_id, {}).get('children', [])
    if child_ids != [row['nodeId'] for row in rows]:
        raise ValueError('fixture root child order differs from the fixed six-row map')
    if scene.get('externalAssets') not in (None, []) or scene.get('referenceData') != {}:
        raise ValueError('derived fixture must have no external assets or reference data')
    for value in strings(scene):
        if URL_PATTERN.search(value) or ABSOLUTE_PATH_PATTERN.search(value) or WINDOW_PATH_PATTERN.search(value):
            raise ValueError('derived fixture contains an external path or URL')

    post_rename_rows = [
        {**row, 'name': RENAMED_NAME} if row['nodeId'] == 'javaScriptShape#2' else dict(row)
        for row in rows
    ]
    return scene, {
        'sourceExpected': source_expected,
        'rows': rows,
        'postRenameRows': post_rename_rows,
        'sourceBytes': source_bytes,
    }, source_bytes


def case_data(locale: str, rows: list[dict[str, Any]], post_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if locale not in LOCALES:
        raise ValueError(f'unsupported locale: {locale}')
    source_cases = [dict(item) for item in CASES]
    for item in source_cases:
        item['locales'] = list(LOCALES)
        item['imageFilename'] = item['imageFilename'].replace('{locale}', locale)
        item['expectedDisplayType'] = TYPE_LABELS[locale]
        item['fixtureNodeType'] = MACHINE_TYPE
        item['namePolicy'] = 'niceName preserves the exact fixture or explicitly renamed source text in every locale.'
    post_by_id = {row['nodeId']: row for row in post_rows}
    row_by_id = {row['nodeId']: row for row in rows}
    expected_rows = {
        'DG-01': list(rows),
        'DG-02': [row_by_id['javaScriptShape#1']],
        'DG-03': [row_by_id['javaScriptShape#6']],
        'DG-04': [post_by_id['javaScriptShape#2']],
        'DG-05': list(post_rows),
        'DG-06': [post_by_id['javaScriptShape#2']],
    }
    for item in source_cases:
        item['expectedRows'] = [dict(row) for row in expected_rows[item['id']]]
    return source_cases


def plan_template(locale: str, cases: list[dict[str, Any]]) -> dict[str, Any]:
    steps = []
    for item in cases:
        row_readback = ', '.join(
            f"{row['nodeId']}={row['name']}" for row in item['expectedRows']
        )
        steps.append({
            'id': item['id'],
            'reads': [
                f"预期: {item['expected']}",
                f'读回: {row_readback}',
                f"采集目标: {item['captureTarget']}",
                f"图像: {item['imageFilename']}",
            ],
            'procedure': list(item['actionSteps']),
            'expectedNames': list(item['expectedNames']),
            'expectedMachineType': item['expectedMachineType'],
            'expectedDisplayType': item['expectedDisplayType'],
            'readbackRows': list(item['readbackRows']),
            'captureTarget': item['captureTarget'],
            'cases': [item['id']],
            # Empty commands intentionally make this a template, not an executable plan.
            'action': {'macos': [], 'windows': []},
            'capture': {'macos': [], 'windows': []},
            'imageFilename': item['imageFilename'],
            'driverBinding': 'unbound',
        })
    return {
        'locale': locale,
        'profileHandback': 'dependency-graph-owned-session',
        'driverStatus': {
            'macos': 'unbound; attach the external owned-app and Qt host lifecycle driver',
            'windows': 'unbound; shared fixture and cases only, no Windows driver supplied',
        },
        'steps': steps,
    }


def prepare(out: Path, locale: str) -> dict[str, Any]:
    out = Path(out).expanduser()
    if not out.is_absolute():
        raise ValueError('--out must be an absolute path to a new run directory')
    if out.exists() or out.is_symlink():
        raise FileExistsError(f'refuse to reuse an existing output directory: {out}')
    scene, info, original_bytes = build_scene()
    cases = case_data(locale, info['rows'], info['postRenameRows'])
    scene_bytes = (json.dumps(scene, ensure_ascii=False, indent=1) + '\n').encode('utf-8')
    scene_hash = sha256(scene_bytes)
    expected = {
        'schemaVersion': 1,
        'suite': 'dependency-graph-node-font',
        'locale': locale,
        'locales': list(LOCALES),
        'cavalryTarget': '2.8.1',
        'scene': 'dependency-graph-six-names.cv',
        'sceneFileVersion': scene.get('version'),
        'activeComposition': info['sourceExpected']['activeComposition'],
        'compositionName': COMPOSITION_NAME,
        'topLevelLayerCount': 6,
        'sourceSkillAsset': '.agents/skills/cavalry-native-display-check/assets/timeline-six-names.cv',
        'sourceFixtureSha256': sha256(original_bytes),
        'generatedFixtureSha256': scene_hash,
        'rows': info['rows'],
        'postRenameRows': info['postRenameRows'],
        'machineType': MACHINE_TYPE,
        'displayTypeByLocale': TYPE_LABELS,
        'externalAssets': [],
        'referenceData': {},
        'cases': cases,
        'acceptanceStatus': 'fixture and expected input only; actual UI must be loaded, read back and visually reviewed',
    }
    plan = plan_template(locale, cases)
    out.mkdir(parents=True, exist_ok=False)
    fixture_dir = out / 'fixture'
    fixture_dir.mkdir()
    artifacts = {
        fixture_dir / 'dependency-graph-six-names.cv': scene_bytes,
        out / 'expected.json': (json.dumps(expected, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
        out / 'plan.template.json': (json.dumps(plan, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
    for path, payload in artifacts.items():
        with path.open('xb') as stream:
            stream.write(payload)
            stream.flush()
    return {
        'out': str(out),
        'fixture': str(fixture_dir / 'dependency-graph-six-names.cv'),
        'expected': str(out / 'expected.json'),
        'planTemplate': str(out / 'plan.template.json'),
        'locale': locale,
        'caseCount': len(cases),
        'fixtureSha256': scene_hash,
        'runFlowExecutable': False,
        'productPass': False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='derive an owned Dependency Graph fixture and unbound run_flow plan')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--locale', choices=LOCALES, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.out, args.locale), ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'dependency_graph_fixture: {error}')
        raise SystemExit(2)
