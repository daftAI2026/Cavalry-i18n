#!/usr/bin/env node
/**
 * [INPUT]: 依赖 process.env.npm_execpath、当前 Node 可执行文件与宿主平台的命令启动语义
 * [OUTPUT]: 对外提供 resolveNpmVersionCommand，为固定 `npm --version` 生成优先无 shell、Windows 可回退的调用描述
 * [POS]: tools 的 npm 工具链身份命令边界，被漏洞门与 toolchain evidence recorder 复用，隔离 Windows `.cmd` shim 与 POSIX 可执行文件差异
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

'use strict';

function resolveNpmVersionCommand({
  env = process.env,
  platform = process.platform,
  nodePath = process.execPath,
} = {}) {
  const npmExecPath = String(env.npm_execpath || '').trim();
  if (npmExecPath) {
    return {
      command: nodePath,
      args: [npmExecPath, '--version'],
      shell: false,
    };
  }

  return {
    command: 'npm',
    args: ['--version'],
    shell: platform === 'win32',
  };
}

module.exports = {
  resolveNpmVersionCommand,
};
