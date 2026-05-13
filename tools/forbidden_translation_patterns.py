#!/usr/bin/env python3
"""
[INPUT]: 依赖 forbidden_translation_patterns.json 与 runtime_ui_allowlist.json 的 §P5 规则配置
[OUTPUT]: 对外提供 detect_forbidden_translation_patterns，检测 FP-1/2/3/4/5/7/8/9/10/11/13/14 单条翻译反模式
[POS]: tools 的 Python 共享 forbidden-pattern detector，被 validate_translations.py 复用；FP-12 由 validator 聚合检测
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable


PATTERN_CONFIG = json.loads(
    (Path(__file__).with_name("forbidden_translation_patterns.json")).read_text(
        encoding="utf-8"
    )
)


def _compile_patterns(raw: Iterable[dict]) -> list[dict]:
    return [
        {
            **pattern,
            "expression": re.compile(pattern["regex"]),
        }
        for pattern in raw
    ]


REGEX_PATTERNS = _compile_patterns(PATTERN_CONFIG.get("regexPatterns", []))
SOURCE_PATTERNS = _compile_patterns(PATTERN_CONFIG.get("sourcePatterns", []))
CONTEXT_PATTERNS = _compile_patterns(PATTERN_CONFIG.get("contextPatterns", []))


def _load_allowlist_tokens(rel_path: str | None) -> list[str]:
    if not rel_path:
        return []
    p = Path(__file__).resolve().parent.parent / rel_path
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []
    tokens: list[str] = []
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                tokens.extend(str(x) for x in v if isinstance(x, str))
    elif isinstance(data, list):
        tokens.extend(str(x) for x in data if isinstance(x, str))
    return tokens


_LATIN_RESIDUE_CFG = PATTERN_CONFIG.get("latinResidue", {})
_LATIN_RESERVED: set[str] = set(_LATIN_RESIDUE_CFG.get("reservedTokens", []))
_LATIN_RESERVED |= set(
    _load_allowlist_tokens(_LATIN_RESIDUE_CFG.get("extraReservedFromAllowlist"))
)
_LATIN_RESERVED_LOWER = {t.lower() for t in _LATIN_RESERVED}
_LATIN_TOKEN_RE = re.compile(r"[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]+")
_CJK_OR_KANA_RE = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff]")
_TRANSLITERATION_CFG = PATTERN_CONFIG.get("transliterationBan", {})
_TRANSLITERATION_SOURCE_DENYLIST = set(
    _TRANSLITERATION_CFG.get("sourceDenylist", [])
)
_PANGRAM_CFG = PATTERN_CONFIG.get("pangramNoise", {})
_PANGRAM_PATTERNS = _compile_patterns(_PANGRAM_CFG.get("sourcePatterns", []))
_TARGET_FILLER_CFG = PATTERN_CONFIG.get("targetFiller", {})
_TARGET_FILLER_RULES = {
    language: {
        **rule,
        "allowed_source_expression": re.compile(
            rule.get("allowedSourceRegex", r"$^"), re.IGNORECASE
        ),
    }
    for language, rule in _TARGET_FILLER_CFG.get("rules", {}).items()
}
_SCRIPT_CONTAMINATION_CFG = PATTERN_CONFIG.get("scriptContamination", {})
_SCRIPT_CONTAMINATION_RULES = {
    language: {
        **rule,
        "expression": re.compile(rule.get("regex", r"$^")),
        "allowed_expression": re.compile(rule["allowedRegex"])
        if rule.get("allowedRegex")
        else None,
    }
    for language, rule in _SCRIPT_CONTAMINATION_CFG.get("rules", {}).items()
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _find_frankenstein_residue(language: str, value: str) -> str | None:
    """Return the offending Latin token if the value mixes ordinary English with CJK."""
    cfg = _LATIN_RESIDUE_CFG
    if not cfg:
        return None
    if language not in cfg.get("appliesToLanguages", []):
        return None
    if not re.search(r"[\u4e00-\u9fff\u3040-\u30ff]", value):
        # No CJK present → not a Frankenstein scenario, just an English passthrough
        return None
    min_len = int(cfg.get("minTokenLength", 2))
    ignore_acronyms = bool(cfg.get("ignoreAllUppercaseAcronyms", True))
    ignore_single = bool(cfg.get("ignoreSingleLetters", True))
    for match in _LATIN_TOKEN_RE.finditer(value):
        token = match.group(0)
        if ignore_single and len(token) <= 1:
            continue
        if len(token) < min_len:
            continue
        if token in _LATIN_RESERVED or token.lower() in _LATIN_RESERVED_LOWER:
            continue
        if ignore_acronyms and token.isupper() and len(token) >= 2:
            continue
        return token
    return None


def _is_transliteration_fabrication(source: str, value: str) -> bool:
    if not source or not value or source == value:
        return False
    if not _CJK_OR_KANA_RE.search(value):
        return False
    return source in _TRANSLITERATION_SOURCE_DENYLIST


def _is_pangram_noise_fabrication(source: str, value: str) -> bool:
    if not source or not value or source == value:
        return False
    return any(pattern["expression"].search(source) for pattern in _PANGRAM_PATTERNS)


def _find_target_filler(language: str, source: str, value: str) -> str | None:
    rule = _TARGET_FILLER_RULES.get(language)
    if not rule:
        return None
    term = rule.get("term")
    if not term or term not in value:
        return None
    if rule["allowed_source_expression"].search(source):
        return None
    return term


def _find_script_contamination(language: str, value: str) -> str | None:
    rule = _SCRIPT_CONTAMINATION_RULES.get(language)
    if not rule or not rule["expression"].search(value):
        return None
    for term in rule.get("forbiddenTerms", []):
        if term in value:
            return term
    return None


def detect_forbidden_translation_patterns(
    language: str = "",
    value: str = "",
    source_text: str = "",
    context: str = "",
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    normalized_value = normalize_text(value)
    normalized_source = normalize_text(source_text)
    normalized_context = normalize_text(context)

    # FP-1/2/3: translation regex
    if normalized_value:
        for pattern in REGEX_PATTERNS:
            if not pattern["expression"].search(normalized_value):
                continue
            hits.append(
                {
                    "id": pattern["id"],
                    "detail": pattern["description"],
                    "value": normalized_value,
                }
            )

        language_pattern = PATTERN_CONFIG.get("languageTermPatterns", {}).get(language)
        if language_pattern:
            for term, hint in language_pattern.get("terms", {}).items():
                if term not in normalized_value:
                    continue
                hits.append(
                    {
                        "id": language_pattern["id"],
                        "detail": f"{language_pattern['description']}: {term} -> {hint}",
                        "value": normalized_value,
                    }
                )
                break

    # FP-7: synthetic source id (fabricated denominator filler)
    if normalized_source:
        for pattern in SOURCE_PATTERNS:
            if not pattern["expression"].search(normalized_source):
                continue
            hits.append(
                {
                    "id": pattern["id"],
                    "detail": pattern["description"],
                    "value": normalized_source,
                }
            )

    # FP-8: fake Qt context
    if normalized_context:
        for pattern in CONTEXT_PATTERNS:
            if not pattern["expression"].search(normalized_context):
                continue
            hits.append(
                {
                    "id": pattern["id"],
                    "detail": pattern["description"],
                    "value": normalized_context,
                }
            )

    # FP-10: transliteration of meaningless/font/glyph source strings
    if _is_transliteration_fabrication(normalized_source, normalized_value):
        hits.append(
            {
                "id": _TRANSLITERATION_CFG.get("id", "FP-10"),
                "detail": _TRANSLITERATION_CFG.get(
                    "description",
                    "transliteration of no-translate source string",
                ),
                "value": normalized_source,
            }
        )

    # FP-11: font sample/pangram noise translated as UI copy
    if _is_pangram_noise_fabrication(normalized_source, normalized_value):
        hits.append(
            {
                "id": _PANGRAM_CFG.get("id", "FP-11"),
                "detail": _PANGRAM_CFG.get(
                    "description",
                    "font sample pangram translated as UI copy",
                ),
                "value": normalized_source,
            }
        )

    # FP-13: generic target-language filler token used to satisfy coverage.
    if normalized_value:
        filler = _find_target_filler(language, normalized_source, normalized_value)
        if filler is not None:
            hits.append(
                {
                    "id": _TARGET_FILLER_CFG.get("id", "FP-13"),
                    "detail": (
                        f"{_TARGET_FILLER_CFG.get('description', 'generic target-language filler')}: "
                        f"{filler}"
                    ),
                    "value": normalized_value,
                }
            )

    # FP-14: target script contamination that purity checks did not catch.
    if normalized_value:
        contamination = _find_script_contamination(language, normalized_value)
        if contamination is not None:
            hits.append(
                {
                    "id": _SCRIPT_CONTAMINATION_CFG.get("id", "FP-14"),
                    "detail": (
                        f"{_SCRIPT_CONTAMINATION_CFG.get('description', 'wrong target script contamination')}: "
                        f"{contamination}"
                    ),
                    "value": normalized_value,
                }
            )

    # FP-9: Frankenstein Latin residue (whitelist + heuristic)
    if normalized_value:
        residue = _find_frankenstein_residue(language, normalized_value)
        if residue is not None:
            hits.append(
                {
                    "id": _LATIN_RESIDUE_CFG.get("id", "FP-9"),
                    "detail": (
                        f"{_LATIN_RESIDUE_CFG.get('description', 'Frankenstein residue')}: "
                        f"unreserved Latin token '{residue}'"
                    ),
                    "value": normalized_value,
                }
            )

    return hits
