#!/usr/bin/env node
/**
 * [INPUT]: 依赖 Windows PATH 中可用的 pwsh.exe 或 powershell.exe、待执行的仓库 PowerShell 脚本与 node:child_process 无 shell 启动能力
 * [OUTPUT]: 对外提供 runPowerShellScript；优先复用 PowerShell 7，仅在宿主不存在时回退 Windows PowerShell，并原样透传脚本退出状态
 * [POS]: tools 的 Windows 开发脚本宿主边界，隔离跨 PowerShell edition 继承的 PSModulePath，供 injector 构建与 NSIS 安装态守门复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const { spawnSync } = require('node:child_process');

const POWERSHELL_ARGUMENTS = [
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
];

function withoutPowerShellModulePath(environment) {
  const cleanEnvironment = { ...environment };
  for (const key of Object.keys(cleanEnvironment)) {
    if (key.toLowerCase() === 'psmodulepath') {
      delete cleanEnvironment[key];
    }
  }
  return cleanEnvironment;
}

function runPowerShellScript(
  scriptPath,
  scriptArguments = [],
  {
    env = process.env,
    spawn = spawnSync,
  } = {}
) {
  if (!scriptPath) {
    throw new Error('PowerShell script path is required.');
  }

  const hosts = ['pwsh.exe', 'powershell.exe'];
  for (const command of hosts) {
    const childEnvironment =
      command === 'powershell.exe' ? withoutPowerShellModulePath(env) : { ...env };
    const result = spawn(
      command,
      [...POWERSHELL_ARGUMENTS, scriptPath, ...scriptArguments],
      {
        env: childEnvironment,
        shell: false,
        stdio: 'inherit',
        windowsHide: true,
      }
    );

    if (result.error?.code === 'ENOENT') {
      continue;
    }
    if (result.error) {
      throw result.error;
    }
    return {
      command,
      signal: result.signal ?? null,
      status: result.status,
    };
  }

  throw new Error(
    'PowerShell 5.1 or newer was not found.'
  );
}

function main(arguments_) {
  const [scriptPath, ...scriptArguments] = arguments_;
  const result = runPowerShellScript(scriptPath, scriptArguments);
  if (Number.isInteger(result.status)) {
    return result.status;
  }
  if (result.signal) {
    process.stderr.write(`PowerShell exited after signal ${result.signal}.\n`);
  }
  return 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`PowerShell launcher failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  runPowerShellScript,
  withoutPowerShellModulePath,
};
