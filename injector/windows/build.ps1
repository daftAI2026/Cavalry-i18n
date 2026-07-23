<#
[INPUT]: 依赖 CMake、MSVC、Qt 6.6.3 SDK、本目录 CMake 工程与父级 generated_translations.inc
[OUTPUT]: 对外执行 Release configure/build/ctest，并发布唯一 DLL 到 generic/cavalryi18n.dll
[POS]: injector/windows 的可重复 Windows 构建入口，连接本地 SDK、真实插件 smoke 与 Tauri resource 稳定路径
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $scriptDirectory '..\..')
)
$buildDirectory = Join-Path $repositoryRoot 'build\windows-injector'
$publishDirectory = Join-Path $scriptDirectory 'generic'
$publishedPlugin = Join-Path $publishDirectory 'cavalryi18n.dll'

$qtPrefix = [Environment]::GetEnvironmentVariable('CAVALRY_QT_PREFIX')
if ([string]::IsNullOrWhiteSpace($qtPrefix)) {
    $qtPrefix = Join-Path $repositoryRoot 'qt_sdk\6.6.3\msvc2019_64'
}
$qtPrefix = [System.IO.Path]::GetFullPath($qtPrefix)

$qtConfig = Join-Path $qtPrefix 'lib\cmake\Qt6\Qt6Config.cmake'
if (-not (Test-Path -LiteralPath $qtConfig -PathType Leaf)) {
    throw "Qt 6.6.3 SDK not found at '$qtPrefix'. Set CAVALRY_QT_PREFIX to the x64 MSVC SDK root."
}

$cmakeCommand = Get-Command cmake.exe -ErrorAction SilentlyContinue
if ($null -ne $cmakeCommand) {
    $cmake = $cmakeCommand.Source
} else {
    $cmakeCandidates = @(
        'C:\Program Files\CMake\bin\cmake.exe',
        'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
    )
    $cmake = $cmakeCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($cmake)) {
    throw 'CMake was not found. Install CMake 3.21 or newer.'
}

$ctest = Join-Path (Split-Path -Parent $cmake) 'ctest.exe'
if (-not (Test-Path -LiteralPath $ctest -PathType Leaf)) {
    throw "CTest was not found next to '$cmake'."
}

& $cmake `
    -S $scriptDirectory `
    -B $buildDirectory `
    -G 'Visual Studio 17 2022' `
    -A x64 `
    "-DCMAKE_PREFIX_PATH=$qtPrefix" `
    -DBUILD_TESTING=ON
if ($LASTEXITCODE -ne 0) {
    throw "CMake configure failed with exit code $LASTEXITCODE."
}

& $cmake --build $buildDirectory --config Release --parallel
if ($LASTEXITCODE -ne 0) {
    throw "CMake build failed with exit code $LASTEXITCODE."
}

& $ctest `
    --test-dir $buildDirectory `
    -C Release `
    --output-on-failure
if ($LASTEXITCODE -ne 0) {
    throw "CTest failed with exit code $LASTEXITCODE."
}

$builtPlugin = Join-Path $buildDirectory 'generic\cavalryi18n.dll'
if (-not (Test-Path -LiteralPath $builtPlugin -PathType Leaf)) {
    throw "Built plugin not found at '$builtPlugin'."
}

New-Item -ItemType Directory -Path $publishDirectory -Force | Out-Null

$bundledQtRuntimes = @(Get-ChildItem `
    -LiteralPath $publishDirectory `
    -Filter 'Qt6*.dll' `
    -File `
    -ErrorAction SilentlyContinue)
if ($bundledQtRuntimes.Count -gt 0) {
    $unexpectedNames = ($bundledQtRuntimes | Select-Object -ExpandProperty Name) -join ', '
    throw "Refusing publish directory with bundled Qt runtime: $unexpectedNames"
}

Copy-Item -LiteralPath $builtPlugin -Destination $publishedPlugin -Force

$publishedHash = Get-FileHash -LiteralPath $publishedPlugin -Algorithm SHA256
Write-Output "Built Windows Qt plugin: $publishedPlugin"
Write-Output "SHA256: $($publishedHash.Hash)"
