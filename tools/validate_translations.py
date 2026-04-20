#!/usr/bin/env python3
"""Validate translation quality gates for Cavalry i18n assets."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


REPORT_LANGUAGE_ALIASES = {
    "en": "en",
    "zh_Hans": "zh_CN",
    "zh_Hant": "zh_TW",
    "ja": "ja_JP",
}

VALIDATION_TARGETS = {
    alias: code for alias, code in REPORT_LANGUAGE_ALIASES.items() if alias != "en"
}

FILE_GROUPS = {
    "nodeStrings": ["nodeStrings.json"],
    "appStrings": ["appStrings.json"],
    "tips": ["tips.json"],
    "onboarding": ["onboarding.json"],
}

PLACEHOLDER_RE = re.compile(r"\{[0-9]+\}|%[0-9]+|\{\{[^{}]+\}\}")
HTML_TAG_RE = re.compile(r"<[^>]+>")
ENGLISH_TOKEN_RE = re.compile(
    r"(?<![A-Za-z0-9])[A-Za-z0-9.+/-]*[A-Za-z][A-Za-z0-9.+/-]*(?![A-Za-z0-9])"
)

ALLOWED_EMBEDDED_ENGLISH = {
    ".svg",
    "1920x1080x29.97",
    "2D",
    "2.5D",
    "3D",
    "AAC",
    "Adobe",
    "AE",
    "AI",
    "AIFF",
    "Alt/Option",
    "AND",
    "APNG",
    "Akhand",
    "Alpha",
    "ASCII",
    "Alt",
    "AV1",
    "Bezier",
    "BPM",
    "Buya",
    "CPU",
    "CRT",
    "CSS",
    "CJK",
    "Canva",
    "Canny",
    "Catmull-Rom",
    "Cavalry",
    "Cellular",
    "CMYK",
    "Control",
    "Cranal",
    "Ctrl",
    "DD",
    "Display",
    "Dynamics",
    "ERC-1155",
    "EXR",
    "FBM",
    "FF",
    "FK",
    "FPS",
    "Forge",
    "Gamma",
    "GIF",
    "GLSL",
    "GPU",
    "H.264",
    "H.265",
    "HDR",
    "HEVC",
    "HQ",
    "HSL",
    "HSV",
    "HVEC",
    "HTTP",
    "HTTPS",
    "Halant",
    "Hama",
    "Hermite",
    "Hypo",
    "Hz",
    "ID",
    "IK",
    "JIS",
    "JIS2004",
    "JIS78",
    "JIS83",
    "JIS90",
    "JSON",
    "JPG",
    "JPEG",
    "JavaScript",
    "Kitaoka",
    "LCH",
    "LT",
    "LUT",
    "Lab",
    "Lottie",
    "Luka",
    "MM",
    "MP4",
    "Math",
    "Math2",
    "Math3",
    "Mbps",
    "Mel",
    "MIDI",
    "Mipmap",
    "Mitchell",
    "Motion",
    "NFT",
    "NLC",
    "Naki",
    "Nukta",
    "Nutous",
    "OK",
    "OKLab",
    "OkLab",
    "OR",
    "Oklab",
    "OpenType",
    "P3",
    "PCM",
    "PDF",
    "PNG",
    "Perlin",
    "Pezo",
    "Poxo",
    "ProRes",
    "Proxy",
    "QuickTime",
    "RGBA",
    "RGB",
    "RTF",
    "Rakar",
    "Rec.2020",
    "Reph",
    "Ro",
    "SDR",
    "SLA",
    "SS",
    "Sema",
    "Shift",
    "Shift+Return",
    "Simplex",
    "SkSL",
    "Sobel",
    "Stapl",
    "Stupl",
    "Unicode",
    "VP8",
    "VP9",
    "Value",
    "Vattu",
    "Voronoi",
    "Wav",
    "XOR",
    "XQ",
    "YYYY",
    "base-16",
    "dB",
    "kbps",
    "lerp",
    "n1",
    "n2",
    "n3",
    "none",
    "solid",
    "terrain",
    "x/y",
    "ziers",
    "sRGB",
    "SVG",
    "UI",
    "URL",
    "UV",
    "Value2",
    "Value3",
    "WebM",
    "WebP",
    "XML",
    "XYZ",
    "YUV",
}

VALID_SINGLE_LETTER_TOKENS = {"x", "y", "z", "X", "Y", "Z", "W", "R", "G", "B", "A", "N", "V", "S", "a", "b"}

ZH_CN_TRADITIONAL_PATTERNS = {
    "檔案": "文件",
    "儲存": "保存",
    "預設": "默认",
    "影片": "视频",
    "程式": "程序",
    "資訊": "信息",
    "繪製": "绘制",
    "圖層": "图层",
    "視埠": "视口",
    "視口": "视口",
    "節點": "节点",
    "標籤": "标签",
    "設定": "设置",
    "腳本": "脚本",
    "顏色": "颜色",
    "邊距": "边距",
    "匯出": "导出",
    "開啟": "打开/开启",
    "關閉": "关闭",
}

ZH_TW_SIMPLIFIED_PATTERNS = {
    "开": "開/開啟",
    "关": "關/關閉",
    "图层": "圖層",
    "父级": "父級",
    "子级": "子級",
    "绘制": "繪製",
    "动态": "動態",
    "滤镜": "濾鏡",
    "压缩": "壓縮",
    "边距": "邊距",
    "名称": "名稱",
    "标签": "標籤",
    "导出": "匯出/輸出",
    "视口": "視埠/檢視區",
    "网格": "網格",
    "轨道": "軌道",
    "约束": "約束",
    "帧率": "幀率",
    "帧": "幀",
    "颜色": "顏色",
    "级别": "層級/級別",
    "活动": "活動/作用中",
    "编码器": "編碼器",
    "画板": "畫板",
    "设置": "設定",
    "脚本": "腳本",
    "运算": "運算",
    "节点": "節點",
}

JA_JP_CHINESE_PATTERNS = {
    "图层": "レイヤー",
    "圖層": "レイヤー",
    "节点": "ノード",
    "節點": "ノード",
    "动画": "アニメーション",
    "動畫": "アニメーション",
    "关键帧": "キーフレーム",
    "關鍵幀": "キーフレーム",
    "渲染": "レンダリング",
    "着色器": "シェーダー",
    "著色器": "シェーダー",
    "视口": "ビューポート",
    "視埠": "ビューポート",
}

LANGUAGE_PURITY_PATTERNS = {
    "zh_CN": ZH_CN_TRADITIONAL_PATTERNS,
    "zh_TW": ZH_TW_SIMPLIFIED_PATTERNS,
    "ja_JP": JA_JP_CHINESE_PATTERNS,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root. Defaults to current directory.",
    )
    parser.add_argument(
        "--json-report",
        required=True,
        help="Path to write the machine-readable validation report.",
    )
    parser.add_argument(
        "--markdown-summary",
        required=True,
        help="Path to write the markdown runlog/summary.",
    )
    return parser.parse_args()


def normalize_string(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def visible_text(value: str) -> str:
    return normalize_string(HTML_TAG_RE.sub(" ", value))


def placeholder_tokens(value: str) -> list[str]:
    return PLACEHOLDER_RE.findall(value)


def english_tokens(value: str) -> list[str]:
    return ENGLISH_TOKEN_RE.findall(value)


def token_is_allowed(token: str) -> bool:
    cleaned = token.strip("()[]{}<>")
    if not cleaned:
        return True
    if cleaned in ALLOWED_EMBEDDED_ENGLISH:
        return True
    if cleaned in VALID_SINGLE_LETTER_TOKENS:
        return True
    return False


def purity_matches(repo_code: str, value: str) -> list[str]:
    patterns = LANGUAGE_PURITY_PATTERNS.get(repo_code, {})
    hits = []
    for term in patterns:
        if term in value:
            hits.append(term)
    return hits


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def plugin_paths(root: Path, lang_code: str) -> list[Path]:
    return sorted((root / "languages" / lang_code / "plugins").glob("*.json"))


def file_paths(root: Path, lang_code: str) -> list[tuple[str, Path, Path]]:
    paths: list[tuple[str, Path, Path]] = []
    for group_name, filenames in FILE_GROUPS.items():
        for filename in filenames:
            paths.append(
                (
                    group_name,
                    root / "languages" / "en" / filename,
                    root / "languages" / lang_code / filename,
                )
            )
    for source_path in plugin_paths(root, "en"):
        relative = source_path.relative_to(root / "languages" / "en")
        paths.append(
            (
                "plugins",
                source_path,
                root / "languages" / lang_code / relative,
            )
        )
    return paths


def build_rule_sets(whitelist: dict[str, Any], group_name: str) -> dict[str, set[str]]:
    rules = whitelist[group_name]
    return {
        "translate": set(rules.get("translate", [])),
        "no_translate": set(rules.get("no_translate", [])),
        "locale_sync": set(rules.get("locale_sync", [])),
    }


def next_mode(key: str, current_mode: str | None, rules: dict[str, set[str]]) -> str | None:
    if key in rules["translate"]:
        return "translate"
    if key in rules["no_translate"]:
        return "no_translate"
    if key in rules["locale_sync"]:
        return "locale_sync"
    return current_mode


def collect_leaves(
    value: Any,
    rules: dict[str, set[str]],
    mode: str | None = None,
    path: str = "$",
) -> dict[str, dict[str, str]]:
    leaves: dict[str, dict[str, str]] = {}
    if isinstance(value, dict):
        for key, child in value.items():
            child_mode = next_mode(key, mode, rules)
            leaves.update(collect_leaves(child, rules, child_mode, f"{path}.{key}"))
        return leaves
    if isinstance(value, list):
        for index, child in enumerate(value):
            leaves.update(collect_leaves(child, rules, mode, f"{path}[{index}]"))
        return leaves
    if isinstance(value, str) and mode is not None:
        leaves[path] = {"mode": mode, "value": value}
    return leaves


def sample_issue(
    language_alias: str,
    repo_code: str,
    file_path: Path,
    json_path: str,
    source: str,
    target: str,
    detail: str,
) -> dict[str, str]:
    return {
        "language": language_alias,
        "repo_code": repo_code,
        "file": file_path.as_posix(),
        "path": json_path,
        "source": source,
        "target": target,
        "detail": detail,
    }


def limited_append(items: list[dict[str, str]], item: dict[str, str], limit: int = 50) -> None:
    if len(items) < limit:
        items.append(item)


def evaluate_language(
    root: Path,
    whitelist: dict[str, Any],
    language_alias: str,
    repo_code: str,
) -> dict[str, Any]:
    result = {
        "alias": language_alias,
        "repo_code": repo_code,
        "translate_leaves": 0,
        "changed_translate_leaves": 0,
        "exact_english_translate_leaves": 0,
        "english_residue_count": 0,
        "placeholder_issue_count": 0,
        "structure_issue_count": 0,
        "no_translate_issue_count": 0,
        "locale_sync_issue_count": 0,
        "purity_issue_count": 0,
        "ts_unfinished_count": 0,
        "issues": {
            "structure": [],
            "no_translate": [],
            "locale_sync": [],
            "placeholder": [],
            "english_residue": [],
            "purity": [],
            "ts_unfinished": [],
        },
    }

    for group_name, source_path, target_path in file_paths(root, repo_code):
        if not source_path.exists():
            result["structure_issue_count"] += 1
            limited_append(
                result["issues"]["structure"],
                {
                    "language": language_alias,
                    "repo_code": repo_code,
                    "file": source_path.as_posix(),
                    "detail": "Missing English source file.",
                },
            )
            continue

        if not target_path.exists():
            result["structure_issue_count"] += 1
            limited_append(
                result["issues"]["structure"],
                {
                    "language": language_alias,
                    "repo_code": repo_code,
                    "file": target_path.as_posix(),
                    "detail": "Missing translated target file.",
                },
            )
            continue

        rules = build_rule_sets(whitelist, group_name)
        source_data = load_json(source_path)
        target_data = load_json(target_path)

        source_leaves = collect_leaves(source_data, rules)
        target_leaves = collect_leaves(target_data, rules)

        source_paths = set(source_leaves)
        target_paths = set(target_leaves)
        missing_paths = sorted(source_paths - target_paths)
        extra_paths = sorted(target_paths - source_paths)

        for json_path in missing_paths:
            result["structure_issue_count"] += 1
            limited_append(
                result["issues"]["structure"],
                {
                    "language": language_alias,
                    "repo_code": repo_code,
                    "file": target_path.as_posix(),
                    "path": json_path,
                    "detail": "Missing leaf in target file.",
                },
            )
        for json_path in extra_paths:
            result["structure_issue_count"] += 1
            limited_append(
                result["issues"]["structure"],
                {
                    "language": language_alias,
                    "repo_code": repo_code,
                    "file": target_path.as_posix(),
                    "path": json_path,
                    "detail": "Unexpected extra leaf in target file.",
                },
            )

        for json_path in sorted(source_paths & target_paths):
            source_leaf = source_leaves[json_path]
            target_leaf = target_leaves[json_path]
            mode = source_leaf["mode"]
            source_value = source_leaf["value"]
            target_value = target_leaf["value"]

            if target_leaf["mode"] != mode:
                result["structure_issue_count"] += 1
                limited_append(
                    result["issues"]["structure"],
                    {
                        "language": language_alias,
                        "repo_code": repo_code,
                        "file": target_path.as_posix(),
                        "path": json_path,
                        "detail": f"Leaf mode changed from {mode} to {target_leaf['mode']}.",
                    },
                )
                continue

            if mode == "translate":
                result["translate_leaves"] += 1
                if normalize_string(source_value) != normalize_string(target_value):
                    result["changed_translate_leaves"] += 1
                else:
                    result["exact_english_translate_leaves"] += 1

                if Counter(placeholder_tokens(source_value)) != Counter(
                    placeholder_tokens(target_value)
                ):
                    result["placeholder_issue_count"] += 1
                    limited_append(
                        result["issues"]["placeholder"],
                        sample_issue(
                            language_alias,
                            repo_code,
                            target_path,
                            json_path,
                            source_value,
                            target_value,
                            "Placeholder set changed.",
                        ),
                    )

                visible_target_value = visible_text(target_value)
                disallowed_tokens = [
                    token
                    for token in english_tokens(visible_target_value)
                    if not token_is_allowed(token)
                ]
                if disallowed_tokens:
                    result["english_residue_count"] += 1
                    limited_append(
                        result["issues"]["english_residue"],
                        sample_issue(
                            language_alias,
                            repo_code,
                            target_path,
                            json_path,
                            source_value,
                            target_value,
                            "Disallowed English token(s): "
                            + ", ".join(sorted(set(disallowed_tokens))),
                        ),
                    )

                hits = purity_matches(repo_code, visible_target_value)
                if hits:
                    result["purity_issue_count"] += 1
                    patterns = LANGUAGE_PURITY_PATTERNS[repo_code]
                    hints = [f"{hit}->{patterns[hit]}" for hit in hits]
                    limited_append(
                        result["issues"]["purity"],
                        sample_issue(
                            language_alias,
                            repo_code,
                            target_path,
                            json_path,
                            source_value,
                            target_value,
                            "Purity issue(s): " + ", ".join(hints),
                        ),
                    )

            elif mode == "no_translate":
                if source_value != target_value:
                    result["no_translate_issue_count"] += 1
                    limited_append(
                        result["issues"]["no_translate"],
                        sample_issue(
                            language_alias,
                            repo_code,
                            target_path,
                            json_path,
                            source_value,
                            target_value,
                            "no_translate leaf diverged from English source.",
                        ),
                    )

            elif mode == "locale_sync":
                if target_value != repo_code:
                    result["locale_sync_issue_count"] += 1
                    limited_append(
                        result["issues"]["locale_sync"],
                        sample_issue(
                            language_alias,
                            repo_code,
                            target_path,
                            json_path,
                            source_value,
                            target_value,
                            f"locale_sync leaf must equal {repo_code}.",
                        ),
                    )

    extra_plugin_files = {
        path.relative_to(root / "languages" / repo_code / "plugins").as_posix()
        for path in plugin_paths(root, repo_code)
    } - {
        path.relative_to(root / "languages" / "en" / "plugins").as_posix()
        for path in plugin_paths(root, "en")
    }
    for relative_path in sorted(extra_plugin_files):
        result["structure_issue_count"] += 1
        limited_append(
            result["issues"]["structure"],
            {
                "language": language_alias,
                "repo_code": repo_code,
                "file": (root / "languages" / repo_code / "plugins" / relative_path).as_posix(),
                "detail": "Unexpected extra plugin file in target language.",
            },
        )

    ts_path = root / "tools" / f"{repo_code}.ts"
    unfinished_count = len(re.findall(r'type="unfinished"', ts_path.read_text(encoding="utf-8")))
    result["ts_unfinished_count"] = unfinished_count
    if unfinished_count:
        limited_append(
            result["issues"]["ts_unfinished"],
            {
                "language": language_alias,
                "repo_code": repo_code,
                "file": ts_path.as_posix(),
                "detail": f"Found {unfinished_count} Qt unfinished translation marker(s).",
            },
        )

    translate_leaves = result["translate_leaves"]
    result["coverage"] = (
        result["changed_translate_leaves"] / translate_leaves if translate_leaves else 1.0
    )
    return result


def gate_status(condition: bool) -> str:
    return "PASS" if condition else "FAIL"


def build_report(root: Path) -> dict[str, Any]:
    whitelist = load_json(root / "doc" / "translation-whitelist.json")

    languages: dict[str, Any] = {}
    for alias, repo_code in VALIDATION_TARGETS.items():
        languages[alias] = evaluate_language(root, whitelist, alias, repo_code)

    b2_ok = all(language["structure_issue_count"] == 0 for language in languages.values())
    b3_ok = all(language["no_translate_issue_count"] == 0 for language in languages.values())
    b4_ok = all(language["placeholder_issue_count"] == 0 for language in languages.values())
    b9_ok = all(language["english_residue_count"] == 0 for language in languages.values())
    b10_ok = all(language["coverage"] >= 0.90 for language in languages.values())
    b11_ok = all(language["locale_sync_issue_count"] == 0 for language in languages.values())
    b12_ok = all(language["purity_issue_count"] == 0 for language in languages.values())
    ts_ok = all(language["ts_unfinished_count"] == 0 for language in languages.values())

    gates = {
        "B2": {
            "name": "Structure parity",
            "status": gate_status(b2_ok),
            "detail": "Target translate/no_translate/locale_sync leaves must match English structure.",
        },
        "B3": {
            "name": "no_translate parity",
            "status": gate_status(b3_ok),
            "detail": "no_translate leaves must remain identical to English source.",
        },
        "B4": {
            "name": "Placeholder parity",
            "status": gate_status(b4_ok),
            "detail": "Placeholder tokens like {0}, %1, {{...}} must be preserved.",
        },
        "B9": {
            "name": "English residue",
            "status": gate_status(b9_ok),
            "detail": "Reject unapproved English residue and half-translated leaves.",
        },
        "B10": {
            "name": "Leaf coverage",
            "status": gate_status(b10_ok),
            "detail": "translate leaves must reach 90% non-English coverage.",
        },
        "B11": {
            "name": "locale_sync",
            "status": gate_status(b11_ok),
            "detail": "language fields must keep runtime repo codes, not workflow aliases.",
        },
        "B12": {
            "name": "Language purity",
            "status": gate_status(b12_ok),
            "detail": "Each target language must reject known off-script or off-locale UI terms.",
        },
        "TS": {
            "name": "Qt unfinished",
            "status": gate_status(ts_ok),
            "detail": '.ts sources must not contain type="unfinished".',
        },
    }

    overall_ok = all(gate["status"] == "PASS" for gate in gates.values())
    return {
        "overall_status": gate_status(overall_ok),
        "aliases": REPORT_LANGUAGE_ALIASES,
        "coverage_threshold": 0.90,
        "gates": gates,
        "languages": languages,
    }


def markdown_table(rows: list[list[str]]) -> str:
    header = "| " + " | ".join(rows[0]) + " |"
    separator = "| " + " | ".join(["---"] * len(rows[0])) + " |"
    body = ["| " + " | ".join(row) + " |" for row in rows[1:]]
    return "\n".join([header, separator, *body])


def render_summary(report: dict[str, Any]) -> str:
    alias_rows = [["Alias", "Repo code"], *[[alias, code] for alias, code in report["aliases"].items()]]
    gate_rows = [["Gate", "Status", "Detail"]]
    for gate_id, gate in report["gates"].items():
        gate_rows.append([gate_id, gate["status"], gate["name"]])

    language_rows = [[
        "Alias",
        "Repo code",
        "Translate leaves",
        "Exact English",
        "Coverage",
        "English residue",
        "Purity issues",
        "locale_sync",
    ]]
    for alias, language in report["languages"].items():
        language_rows.append(
            [
                alias,
                language["repo_code"],
                str(language["translate_leaves"]),
                str(language["exact_english_translate_leaves"]),
                f"{language['coverage'] * 100:.1f}%",
                str(language["english_residue_count"]),
                str(language["purity_issue_count"]),
                str(language["locale_sync_issue_count"]),
            ]
        )

    sections = [
        "# Translation quality runlog",
        "",
        f"**Result:** {report['overall_status']}",
        "",
        "## Alias mapping",
        markdown_table(alias_rows),
        "",
        "## Gate summary",
        markdown_table(gate_rows),
        "",
        "## Leaf metrics",
        markdown_table(language_rows),
    ]

    for alias, language in report["languages"].items():
        issue_lines = []
        for issue_type in [
            "structure",
            "no_translate",
            "placeholder",
            "english_residue",
            "purity",
            "locale_sync",
            "ts_unfinished",
        ]:
            for issue in language["issues"][issue_type][:3]:
                detail = issue["detail"]
                file_path = issue["file"]
                json_path = issue.get("path", "")
                target_value = issue.get("target")
                line = f"- `{file_path}`"
                if json_path:
                    line += f" `{json_path}`"
                line += f" — {detail}"
                if target_value:
                    line += f" → `{target_value}`"
                issue_lines.append(line)

        if issue_lines:
            sections.extend(["", f"## Sample issues: {alias}", *issue_lines[:10]])

    sections.append("")
    return "\n".join(sections)


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_outputs(report: dict[str, Any], json_path: Path, markdown_path: Path) -> None:
    ensure_parent(json_path)
    ensure_parent(markdown_path)
    json_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(render_summary(report), encoding="utf-8")


def crash_report(message: str) -> dict[str, Any]:
    return {
        "overall_status": "FAIL",
        "aliases": REPORT_LANGUAGE_ALIASES,
        "coverage_threshold": 0.90,
        "gates": {
            "CRASH": {
                "name": "Validator crash",
                "status": "FAIL",
                "detail": message,
            }
        },
        "languages": {},
    }


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    json_report = Path(args.json_report)
    markdown_summary = Path(args.markdown_summary)

    try:
        report = build_report(root)
    except Exception as exc:  # Surface crash details through workflow artifacts.
        report = crash_report(str(exc))
        write_outputs(report, json_report, markdown_summary)
        print(render_summary(report), file=sys.stderr)
        return 2

    write_outputs(report, json_report, markdown_summary)
    print(render_summary(report))
    return 0 if report["overall_status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
