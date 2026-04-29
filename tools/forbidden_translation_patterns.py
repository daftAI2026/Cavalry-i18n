#!/usr/bin/env python3
"""Shared forbidden translation pattern detector for full-ui gates."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


PATTERN_CONFIG = json.loads(
    (Path(__file__).with_name("forbidden_translation_patterns.json")).read_text(
        encoding="utf-8"
    )
)
REGEX_PATTERNS = [
    {
        **pattern,
        "expression": re.compile(pattern["regex"]),
    }
    for pattern in PATTERN_CONFIG["regexPatterns"]
]


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def strip_recursive_suffixes(value: str) -> str:
    normalized = normalize_text(value)
    for suffix in PATTERN_CONFIG.get("recursiveSuffixes", []):
        if normalized.endswith(suffix):
            normalized = normalize_text(normalized[: -len(suffix)])
    return normalized


def detect_forbidden_translation_patterns(
    language: str = "", value: str = "", source_text: str = ""
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    normalized_value = normalize_text(value)
    if not normalized_value:
        return hits

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

    normalized_source = normalize_text(source_text)
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
