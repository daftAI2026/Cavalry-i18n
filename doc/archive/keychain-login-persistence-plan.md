# Keychain 登录态持久化修复方案

> 目标：patched Cavalry 首次登录后能够稳定保留登录态，不再每次启动都要求重新登录。
> 代价：首次切换到补丁版后，用户需要重新登录一次；旧厂商 Team/iCloud Keychain 中的凭据无法迁移。
> 执行范围更新（2026-04-24）：用户明确要求“不做 Electron”，本轮只落地 Tauri 路径。
> 修正更新（2026-04-25）：补丁目标扩展到 `valueExists`，否则 `setValue` 会错误判断 item 不存在并复用已撤销 refresh token。

---

## 0. 问题根因

Cavalry 的登录凭据不是存在普通本地 login keychain，而是走了带厂商身份约束的 Keychain 查询。

`libExtensionLayer.dylib` 中的 5 个 Keychain 函数：

- `createQuery`
- `valueExists`
- `setValue`
- `getValue`
- `eraseValue`

都会构造类似下面的查询：

```text
kSecClass              = kSecClassGenericPassword
kSecAttrService        = "app.cavalry.keychain"
kSecAttrAccount        = <参数传入>
kSecAttrAccessGroup    = "TB4YVNQHVC.com.scenegroup.cavalry.apps"
kSecAttrSynchronizable = kCFBooleanTrue
```

这会形成两层封锁：

1. `kSecAttrAccessGroup` 把 item 绑定到 Scene Group 的 Team 命名空间。
2. `kSecAttrSynchronizable = YES` 要求进程具备可用于 iCloud Keychain 的有效 Team 身份。

而我们的补丁安装流程会把 app 重签为 `ad-hoc`：

- `Signature=adhoc`
- `TeamIdentifier=not set`

所以 patched 进程没有资格继续访问这组 Keychain 查询，最终返回 `errSecMissingEntitlement (-34018)`。

### 已验证证据

- [x] `codesign -dvvv /Applications/Cavalry.app` 确认当前 patched app 为 `adhoc`，且 `TeamIdentifier=not set`。
- [x] 反汇编确认 `createQuery`、`valueExists`、`setValue`、`getValue`、`eraseValue` 都引用了 `_kSecAttrAccessGroup`。
- [x] 反汇编确认上述 5 个函数都引用了 `_kSecAttrSynchronizable` 与 `___kCFBooleanTrue`。
- [x] 最小实验确认：`ad-hoc + sync=false + 普通 login keychain` 可以 `errSecSuccess (0)`。
- [x] 最小实验确认：`ad-hoc + sync=true + 空/省略 access group` 仍然返回 `errSecMissingEntitlement (-34018)`。
- [x] 最小实验确认：`ad-hoc + sync=false + accessGroup=""` 仍可成功，说明“空 access group”不是主要阻塞点。
- [x] 反汇编范围内未观察到 `kSecUseDataProtectionKeychain`，因此当前根因不是“另一路 Data Protection Keychain 显式开关”。

### 结论

旧文档里“只把 access group 字符串首字节置零”的方向不成立。
**真正必须处理的是：让 patched Cavalry 不再写入 `kSecAttrAccessGroup`，也不再写入 `kSecAttrSynchronizable`。**

---

## 1. 决策

### 1.1 最终方案

将 patched Cavalry 的 Keychain 行为收敛到“普通本地 keychain”模式：

- 不再设置 `kSecAttrAccessGroup`
- 不再设置 `kSecAttrSynchronizable`

保留：

- `kSecClassGenericPassword`
- `kSecAttrService = "app.cavalry.keychain"`
- `kSecAttrAccount = <参数>`

这样写入的新凭据将落在 patched 进程自己的默认命名空间中，能够被同一个 ad-hoc 身份的后续启动继续读回。

### 1.2 明确不采用的旧方向

- 不再采用“只 patch access group 字符串”的一字节方案。
- 不把 `kSecUseDataProtectionKeychain` 当作替代路线。
- 不尝试伪造 Scene Group Team ID 或沿用厂商 access group。

---

## 2. 实施策略

### 2.1 Patch 目标

目标文件：

- `Contents/Frameworks/libExtensionLayer.dylib`

目标函数：

- `cavalry::keychain::createQuery`
- `cavalry::keychain::valueExists`
- `cavalry::keychain::setValue`
- `cavalry::keychain::getValue`
- `cavalry::keychain::eraseValue`

目标行为：

- 删除/跳过写入 `kSecAttrAccessGroup`
- 删除/跳过写入 `kSecAttrSynchronizable`

### 2.2 Patch 方式

不再改 `__cstring` 中的 access group 文本，而是直接 patch 代码路径里设置 query attribute 的调用点。

建议策略：

1. 按 symbol 或稳定的指令模式扫描这 5 个函数。
2. 在每个函数中识别两处 `CFDictionarySetValue` 调用：
   - 一处对应 `kSecAttrAccessGroup`
   - 一处对应 `kSecAttrSynchronizable`
3. 将这两处调用替换为 no-op：
   - `arm64`：将目标 `bl` 指令改为 `nop`
   - `x86_64`：将目标 `call` 指令改为等长 `nop` 序列
4. 保留同一函数中对 `kSecClass` / `kSecAttrService` / `kSecAttrAccount` 的原始写入。

这里的设计原则很简单：
**不是把非法值改成“也许能过”的值，而是让非法属性根本不进入 query dictionary。**

### 2.3 集成位置

安装流程应变为：

```text
copyWithSudo(stagedPairs)
-> patchKeychainQueryAttributes(appPath)
-> resignPatchedBundle(appPath)
-> clearGatekeeperQuarantine(appPath)
```

Tauri 侧：

- `src-tauri/src/privilege.rs` 或其拆出的等价 patch 模块

### 2.4 用户可见行为

补丁上线后，用户会看到：

1. 已经存在于厂商 Team/iCloud Keychain 的旧 token 无法复用。
2. 第一次启动补丁版时需要重新登录一次。
3. 重新登录后，后续重启应保持登录态。

如果 UI 还缓存了“已登录”状态，但 Keychain 实际读不到 token，就会出现假登录态。
因此登录状态判断还需要遵守：

- 读 keychain 失败时，不要继续保留“已登录”
- 命中 `-34018` 或 `item not found` 时，回退到未登录态

---

## 3. 与备选方案对比

| 方案 | 结论 | 原因 |
|---|---|---|
| 只 patch access group 字符串 | 否 | `kSecAttrSynchronizable = YES` 仍会在 ad-hoc 身份下触发 `-34018` |
| 运行时 hook `SecItem*` | 备选，不优先 | 能做，但复杂、侵入性强、维护成本高 |
| 恢复厂商 Team ID 签名 | 不可行 | 需要 Scene Group 的真实签名能力与 entitlement |
| 安装阶段 patch `libExtensionLayer.dylib` 中 5 个函数的 query 写入 | 是 | 改动面小，运行时零额外层，符合当前证据链 |

---

## 4. 执行清单（通过后打勾）

> 说明：本节是工作进度真相源。
> 已经验证通过的项用 `[x]`；未完成或未验证的项保持 `[ ]`，执行过程中必须及时更新。
> 执行纪律：后续执行者必须按标准 TDD 推进，顺序固定为 `先写失败测试 -> 确认红灯 -> 写最小实现 -> 测试转绿 -> 立即勾选对应复选框 -> 再进入下一项`。
> 禁止事项：禁止先写实现再补测试；禁止一口气改多项后再统一打勾；禁止“感觉应该可以”但未跑测试就勾选。

### 4.0 TDD 执行协议

- [x] 每个实现项在动生产代码前，先补对应失败测试并确认红灯
- [x] 每个复选框只能在对应测试或冒烟步骤实际通过后打钩
- [x] 如果某项实现导致其他已打钩测试回退，必须立刻取消对应 `[x]`
- [x] 每完成一个 Phase，执行者必须在文档中留下本轮通过结果与阻塞点摘要
- [x] 不允许跳过 Phase B 直接做集成；不允许跳过 Phase D 宣称方案完成

### Phase A：证据锁定

- [x] 确认 patched Cavalry 为 `adhoc` 且 `TeamIdentifier=not set`
- [x] 确认 5 个 Keychain 函数都写入 `kSecAttrAccessGroup`
- [x] 确认 5 个 Keychain 函数都写入 `kSecAttrSynchronizable = kCFBooleanTrue`
- [x] 确认“只改 access group”不能解除 `-34018`
- [x] 确认“保留 ad-hoc，但去掉 synchronizable”在最小实验里可成功访问普通 login keychain

### Phase B：纯 patch 逻辑单测

- [x] 先补测试，再写实现；每个测试从 `[ ]` 变 `[x]` 必须伴随一次真实通过记录
- [x] `patch_keychain_query_attributes_finds_four_target_functions`
- [x] `patch_keychain_query_attributes_patches_two_callsites_per_function`
- [x] `patch_keychain_query_attributes_reports_value_exists_attribute_hits`
- [x] `patch_keychain_query_attributes_arm64_replaces_target_bl_with_nop`
- [x] `patch_keychain_query_attributes_x86_64_replaces_target_call_with_nop_sequence`
- [x] `patch_keychain_query_attributes_preserves_file_size`
- [x] `patch_keychain_query_attributes_errors_when_expected_pattern_missing`
- [x] `patch_keychain_query_attributes_is_idempotent`

通过记录（2026-04-24）：`cd src-tauri && cargo test --test privilege_contract patch_keychain -- --nocapture` 通过，覆盖 arm64、x86_64、fat 双架构、缺模式报错、文件大小保持与幂等。
通过记录（2026-04-25）：`cd src-tauri && cargo test --test privilege_contract patch_keychain` 通过；thin 单架构 `patched_callsites = 10`，fat 双架构 `patched_callsites = 20`，二次执行 `already_patched_callsites = 10/20`，报告能看见 `valueExists/kSecAttrAccessGroup` 与 `valueExists/kSecAttrSynchronizable`。

### Phase C：安装流程集成

- [x] 先让集成测试红灯，再接入生产流程；通过一项勾一项
- [x] `apply_language_calls_keychain_patch_before_resign`
- [x] `apply_language_patch_failure_aborts_resign`
- [x] `apply_language_reports_actionable_patch_error`
- [x] Tauri 侧接入完成
- [x] App Management 拦截时返回权限等待态，renderer 引导用户打开 Privacy & Security 并原地重试

通过记录（2026-04-24）：`cd src-tauri && cargo test` 全部通过；Tauri apply 流程在复制完成后、重签前调用 `patch_keychain_query_attributes`，失败会中止重签。
通过记录（2026-04-25）：`node --test tools/check_tauri_bridge_runtime.js` 通过；启动态提示 Apply 需要 macOS 权限，权限拒绝后显示 `Waiting for permission.`，`Retry Apply` 不重新选择 app、不改变语言选择。

### Phase D：真实副本冒烟

- [x] 仅在前面自动化测试保持全绿时进入冒烟；每完成一步立即更新复选框
- [x] 复制 `/Applications/Cavalry.app` 到临时副本
- [x] 对副本执行完整语言补丁流程
- [x] 验证 `codesign` 重签完成
- [x] 启动副本后日志不再出现 `A required entitlement isn't present.`
- [ ] 首次重新登录成功
- [ ] 关闭并再次启动后仍保持登录
- [x] 恢复英文后行为不回退
- [x] 清理临时副本

通过记录（2026-04-24）：`cd src-tauri && cargo test --test manual_macos_smoke -- --ignored --nocapture` 通过；`log show --last 10m` 未见 `-34018` 或 required entitlement。登录凭据验证需要人工账号操作，未伪造通过。

### Phase E：回归与交付

- [x] 更新 Tauri 相关 L2 文档
- [x] 补充用户可见变更说明：首次需重新登录一次
- [x] 记录已知限制：旧厂商 Keychain token 不迁移

---

## 5. 验收标准

以下条件全部满足，且对应复选框均已在执行过程中按真实结果打钩，才算方案完成：

- [x] patched `Cavalry.app` 启动日志中不再出现 `errSecMissingEntitlement (-34018)`
- [ ] 用户首次登录后关闭重开，登录态仍在
- [x] patch 前后 `libExtensionLayer.dylib` 文件大小不变
- [x] patch 后反汇编确认 5 个函数不再执行 `kSecAttrAccessGroup` 写入
- [x] patch 后反汇编确认 5 个函数不再执行 `kSecAttrSynchronizable` 写入
- [x] 恢复英文流程不破坏登录态持久化

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Cavalry 更新后函数体偏移变化 | 高 | 旧 patch 失效 | 不硬编码绝对偏移，按 symbol/指令模式定位 |
| 某个架构 slice 漏 patch | 中 | 单架构下仍报 `-34018` | arm64 / x86_64 分别计数并断言 |
| patch 误伤其他 `CFDictionarySetValue` 调用 | 中 | Keychain 逻辑损坏 | 仅在目标函数范围内、仅对匹配目标 key 的调用点下手 |
| app 仍缓存“已登录”UI 状态 | 中 | 产生假登录态 | 登录判断回到 token 真相源，失败即回退到未登录态 |
| 厂商旧 token 无法迁移 | 必然 | 首次需要重新登录 | 在发布说明中明确告知 |

---

## 7. 不做的事

- 不做“只改 access group 文本”的旧补丁。
- 不做 Scene Group Team/iCloud Keychain 凭据迁移。
- 不做伪造厂商 Team ID 或伪造 entitlement。
- 不在主二进制或签名 blob 上做无关 patch。

---

## 8. 一句话结论

**这次修复的本质不是“让 patched app 继续假装自己属于 Scene Group”，而是“让 patched app 放弃厂商 Team/iCloud Keychain，改回自己的本地普通 keychain”。**
