#!/usr/bin/env python3
"""
[INPUT]: 依赖仓库中的x86 native编译源、语言表与完整tools构建期producer依赖。
[OUTPUT]: 在候选输出目录生成逐文件SHA、字节数和模式清单。
[POS]: x86 builder的源码快照producer；不读取私档或Cavalry安装。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import stat
import sys


RECURSIVE_INPUTS = (
    "injector",
    "tools",
    "languages/native",
    "languages/en/MetaData",
    "languages/zh-Hans/MetaData",
    "languages/zh-Hant/MetaData",
    "languages/ja_JP/MetaData",
)
EXPLICIT_INPUTS = (
    "CLAUDE.md",
    "tools/build_native_help_description_table.js",
    "tools/build_native_easing_display_table.js",
    "tools/generate_demo_reader_tables.js",
    "tools/native_easing_display_data.js",
    "tools/native_help_popup_rows.js",
    "tools/native_metadata_help.js",
    "tools/native_metadata_reuse.js",
)


class SourceManifestError(RuntimeError):
    """Raised when the selected native source closure is incomplete."""


def collect_source_files(repository: pathlib.Path) -> dict[str, pathlib.Path]:
    """Collect only source consumed by the native candidate producer."""
    files: dict[str, pathlib.Path] = {}
    for relative_root in RECURSIVE_INPUTS:
        source_root = repository / relative_root
        if not source_root.is_dir():
            raise SourceManifestError(f"缺少源码目录: {relative_root}")
        for path in sorted(source_root.rglob("*")):
            if "__pycache__" in path.parts or path.suffix == ".pyc":
                continue
            if path.is_symlink():
                raise SourceManifestError(
                    f"源码闭包不得包含符号链接: {path.relative_to(repository)}")
            if path.is_file():
                files[path.relative_to(repository).as_posix()] = path

    for relative_file in EXPLICIT_INPUTS:
        path = repository / relative_file
        if not path.is_file() or path.is_symlink():
            raise SourceManifestError(f"缺少构建输入: {relative_file}")
        files[path.relative_to(repository).as_posix()] = path
    return dict(sorted(files.items()))


def write_source_manifest(repository: pathlib.Path, output: pathlib.Path) -> dict[str, object]:
    repository = repository.resolve()
    output = output.resolve()
    for relative_root in RECURSIVE_INPUTS:
        try:
            output.relative_to(repository / relative_root)
        except ValueError:
            continue
        raise SourceManifestError("源码manifest不能写入受跟踪的源码目录")
    if output == repository / "CLAUDE.md" or output in {
        repository / relative for relative in EXPLICIT_INPUTS
    }:
        raise SourceManifestError("源码manifest不能覆盖构建输入")

    files: dict[str, dict[str, object]] = {}
    for relative, path in collect_source_files(repository).items():
        data = path.read_bytes()
        files[relative] = {
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "mode": f"{stat.S_IMODE(path.stat().st_mode):04o}",
        }
    manifest: dict[str, object] = {
        "title": "Cavalry 2.8 x86_64 native source closure",
        "current": {
            "root": "repository/",
            "fileCount": len(files),
            "files": files,
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"生成源码manifest: {len(files)}个文件 -> {output}")
    return manifest


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("用法: native_source_manifest_x86_64.py <repository-root> <external-output.json>", file=sys.stderr)
        return 2
    try:
        write_source_manifest(pathlib.Path(argv[1]), pathlib.Path(argv[2]))
    except (OSError, SourceManifestError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
