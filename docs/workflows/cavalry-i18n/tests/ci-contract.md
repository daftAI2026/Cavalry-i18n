<!--
[INPUT]: 依赖 T3 .qm 编译流程、docs/plan-v3.md 的 CI 规格
[OUTPUT]: 对外提供 T8 GitHub CI 的验证契约
[POS]: tests 层的 T8 contract，服务 M3
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# CI Contract (T8)

## Goal

验证 `.github/workflows/build.yml` 存在、YAML 合法、包含 lrelease 编译步骤、push/PR 触发、artifact 或 release 上传。

## Behaviors

### B1: workflow 文件存在

RED：`.github/workflows/build.yml` 不存在。

```bash
if [ ! -f ".github/workflows/build.yml" ]; then
  echo "FAIL: .github/workflows/build.yml not found"; exit 1
fi
echo "PASS: B1"
```

GREEN：创建 `.github/workflows/build.yml`。

### B2: YAML 语法正确

RED：YAML 解析失败。

```bash
if command -v python3 &>/dev/null; then
  if python3 -c "import yaml" 2>/dev/null; then
    if ! python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))"; then
      echo "FAIL: build.yml is not valid YAML"; exit 1
    fi
  else
    echo "WARN: pyyaml not installed, skipping YAML validation"
  fi
fi
echo "PASS: B2"
```

GREEN：确保文件是合法 YAML。

### B3: 包含 lrelease 编译步骤

RED：workflow 中无 `lrelease` 关键词。

```bash
if ! grep -q "lrelease" ".github/workflows/build.yml"; then
  echo "FAIL: workflow missing lrelease step"; exit 1
fi
echo "PASS: B3"
```

GREEN：添加 lrelease 编译 .ts → .qm 的步骤。

### B4: 包含触发条件

RED：workflow 无 push 或 pull_request 触发。

```bash
if ! grep -qE "(push|pull_request)" ".github/workflows/build.yml"; then
  echo "FAIL: workflow missing trigger (push/pull_request)"; exit 1
fi
echo "PASS: B4"
```

GREEN：添加 on.push / on.pull_request 触发配置。

### B5: 包含 artifact 或 release 上传

RED：workflow 无 upload-artifact 或 release 步骤。

```bash
if ! grep -qiE "(upload-artifact|release)" ".github/workflows/build.yml"; then
  echo "FAIL: workflow missing artifact upload or release step"; exit 1
fi
echo "PASS: B5"
```

GREEN：添加 artifact 上传或 release 发布步骤。

## Full Verification

执行者应将上述 B1-B5 的 bash 片段按顺序组合执行。全部通过即为 T8 PASS。

## Pass/Fail

- **PASS**: 所有 B1-B5 通过。
- **FAIL**: 任一 behavior 失败。
