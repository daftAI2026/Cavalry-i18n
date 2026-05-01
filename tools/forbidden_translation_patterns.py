#!/usr/bin/env python3
"""Shared forbidden translation pattern detector for full-ui gates."""

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


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def strip_recursive_suffixes(value: str) -> str:
    normalized = normalize_text(value)
    for suffix in PATTERN_CONFIG.get("recursiveSuffixes", []):
        if normalized.endswith(suffix):
            normalized = normalize_text(normalized[: -len(suffix)])
    return normalized


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

    # FP-6: source-recursive pseudo translation
    stripped_recursive_value = strip_recursive_suffixes(normalized_value)
    if (
        normalized_source
        and stripped_recursive_value != normalized_value
        and stripped_recursive_value == normalized_source
    ):
        hits.append(
            {
                "id": "FP-6",
                "detail": "source-recursive pseudo translation",
                "value": normalized_value,
            }
        )

    return hits
