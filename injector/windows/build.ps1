<#
[INPUT]: 依赖 Windows PowerShell 5.1 UTF-8 BOM、Node.js 翻译表生成器、CMake/MSVC、Qt 6.6.3 SDK 及版本化 QPA 头、共享翻译源与可选 vendor root
[OUTPUT]: 对外先重生成共享翻译表，再从经过边界验证的干净目录执行 Release configure/build/ctest，并经无重解析点父链发布两个无 Qt runtime 产物
[POS]: injector/windows 的可重复构建入口，以源码生成表为唯一编译输入，拒绝陈旧增量产物并连接同一翻译 runtime/QPA 代理/只读 vendor 合同与受工作区约束的资源路径
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
$genericPublishDirectory = Join-Path $scriptDirectory 'generic'
$qpaPublishDirectory = Join-Path $scriptDirectory 'qpa'
$publishedPlugin = Join-Path $genericPublishDirectory 'cavalryi18n.dll'
$publishedQpaProxy = Join-Path $qpaPublishDirectory 'qwindows.dll'
$translationGenerator = Join-Path $repositoryRoot 'tools\generate_embedded_translations.js'
$generatedTranslations = Join-Path $repositoryRoot 'injector\generated_translations.inc'

function Assert-NoReparsePathChain {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Role
    )

    $current = [System.IO.Path]::GetFullPath($Path)
    while (-not [string]::IsNullOrWhiteSpace($current)) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Refusing $Role through Windows reparse point '$current'."
            }
        }
        $parent = [System.IO.Directory]::GetParent($current)
        if ($null -eq $parent -or $parent.FullName -eq $current) {
            break
        }
        $current = $parent.FullName
    }
}

function Reset-GeneratedBuildDirectory {
    [CmdletBinding()]
    param()

    $expectedBuildRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $repositoryRoot 'build')
    )
    $actualParent = [System.IO.Path]::GetDirectoryName($buildDirectory)
    if (-not [System.String]::Equals(
        $actualParent,
        $expectedBuildRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing to reset unexpected Windows injector build directory '$buildDirectory'."
    }
    Assert-NoReparsePathChain -Path $expectedBuildRoot -Role 'Windows injector build root'
    Assert-NoReparsePathChain -Path $buildDirectory -Role 'Windows injector generated build directory'
    if (Test-Path -LiteralPath $buildDirectory) {
        $item = Get-Item -LiteralPath $buildDirectory -Force -ErrorAction Stop
        if (-not $item.PSIsContainer) {
            throw "Windows injector build target is not a directory: '$buildDirectory'."
        }
        Remove-Item -LiteralPath $buildDirectory -Recurse -Force -ErrorAction Stop
    }
    New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
    Assert-NoReparsePathChain -Path $buildDirectory -Role 'fresh Windows injector generated build directory'
}

$qtPrefix = [Environment]::GetEnvironmentVariable('CAVALRY_QT_PREFIX')
if ([string]::IsNullOrWhiteSpace($qtPrefix)) {
    $qtPrefix = Join-Path $repositoryRoot 'qt_sdk\6.6.3\msvc2019_64'
}
$qtPrefix = [System.IO.Path]::GetFullPath($qtPrefix)

$qtConfig = Join-Path $qtPrefix 'lib\cmake\Qt6\Qt6Config.cmake'
if (-not (Test-Path -LiteralPath $qtConfig -PathType Leaf)) {
    throw "Qt 6.6.3 SDK not found at '$qtPrefix'. Set CAVALRY_QT_PREFIX to the x64 MSVC SDK root."
}

$vendorRoot = [Environment]::GetEnvironmentVariable('CAVALRY_VENDOR_ROOT')

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

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    throw 'Node.js was not found. Install the package.json toolchain before building the Windows injector.'
}
if (-not (Test-Path -LiteralPath $translationGenerator -PathType Leaf)) {
    throw "Translation generator not found at '$translationGenerator'."
}

$cmakeConfigureArguments = @(
    '-S', $scriptDirectory,
    '-B', $buildDirectory,
    '-G', 'Visual Studio 17 2022',
    '-A', 'x64',
    "-DCMAKE_PREFIX_PATH=$qtPrefix",
    '-DBUILD_TESTING=ON'
)
if (-not [string]::IsNullOrWhiteSpace($vendorRoot)) {
    $vendorRoot = [System.IO.Path]::GetFullPath($vendorRoot)
    $cmakeConfigureArguments += "-DCAVALRY_VENDOR_ROOT=$vendorRoot"
} else {
    # 显式清空缓存，避免上一次本机构建的 vendor 路径泄漏到普通构建。
    $cmakeConfigureArguments += @('-U', 'CAVALRY_VENDOR_ROOT')
}

& $nodeCommand.Source $translationGenerator $generatedTranslations
if ($LASTEXITCODE -ne 0) {
    throw "Translation table generation failed with exit code $LASTEXITCODE."
}
if (-not (Test-Path -LiteralPath $generatedTranslations -PathType Leaf)) {
    throw "Generated translation table not found at '$generatedTranslations'."
}

Reset-GeneratedBuildDirectory

& $cmake @cmakeConfigureArguments
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
$builtQpaProxy = Join-Path $buildDirectory 'qpa\qwindows.dll'
if (-not (Test-Path -LiteralPath $builtQpaProxy -PathType Leaf)) {
    throw "Built QPA proxy not found at '$builtQpaProxy'."
}

Assert-NoReparsePathChain -Path $genericPublishDirectory -Role 'generic publish directory'
Assert-NoReparsePathChain -Path $qpaPublishDirectory -Role 'QPA publish directory'
New-Item -ItemType Directory -Path $genericPublishDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $qpaPublishDirectory -Force | Out-Null
Assert-NoReparsePathChain -Path $publishedPlugin -Role 'generic publish target'
Assert-NoReparsePathChain -Path $publishedQpaProxy -Role 'QPA publish target'

$bundledQtRuntimes = @(
    Get-ChildItem `
        -LiteralPath $genericPublishDirectory,$qpaPublishDirectory `
        -Filter 'Qt6*.dll' `
        -File `
        -ErrorAction SilentlyContinue
)
if ($bundledQtRuntimes.Count -gt 0) {
    $unexpectedNames = ($bundledQtRuntimes | Select-Object -ExpandProperty Name) -join ', '
    throw "Refusing publish directory with bundled Qt runtime: $unexpectedNames"
}

Copy-Item -LiteralPath $builtPlugin -Destination $publishedPlugin -Force
Copy-Item -LiteralPath $builtQpaProxy -Destination $publishedQpaProxy -Force

$publishedHash = Get-FileHash -LiteralPath $publishedPlugin -Algorithm SHA256
$publishedQpaHash = Get-FileHash -LiteralPath $publishedQpaProxy -Algorithm SHA256
Write-Output "Built Windows Qt plugin: $publishedPlugin"
Write-Output "SHA256: $($publishedHash.Hash)"
Write-Output "Built Windows QPA proxy: $publishedQpaProxy"
Write-Output "SHA256: $($publishedQpaHash.Hash)"
