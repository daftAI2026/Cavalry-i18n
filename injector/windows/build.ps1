<#
[INPUT]: 依赖 PowerShell 5.1+ 的 UTF-8 BOM 宿主边界、Node.js 翻译表生成器与 Windows CMake resolver、官方 CMake 4.4.3 archive 摘要、Visual Studio 2022+ 的 MSVC v143 x64 工具集、Qt 6.6.3 SDK 及版本化 QPA 头、共享翻译源与可选 vendor root
[OUTPUT]: 对外先重生成共享翻译表，再使用 pin manifest 解包并验证官方 CMake/CTest，由 CMake 选择当前可用 Visual Studio 生成器并锁定 x64/v143，从经过边界验证的干净目录执行 Release configure/build/ctest，经无重解析点父链发布两个无 Qt runtime 产物
[POS]: injector/windows 的可重复构建入口，以源码生成表和经过摘要证明的 CMake 为唯一编译输入，拒绝 runner PATH、陈旧增量产物与未经证明的工具链，并连接同一翻译 runtime/QPA 代理/只读 vendor 合同与受工作区约束的资源路径
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
$cmakeResolver = Join-Path $repositoryRoot 'tools\resolve_windows_cmake.js'

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

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    throw 'Node.js was not found. Install the package.json toolchain before building the Windows injector.'
}
if (-not (Test-Path -LiteralPath $translationGenerator -PathType Leaf)) {
    throw "Translation generator not found at '$translationGenerator'."
}
if (-not (Test-Path -LiteralPath $cmakeResolver -PathType Leaf)) {
    throw "Pinned Windows CMake resolver not found at '$cmakeResolver'."
}

# 由仓库 pin manifest 安装并验证官方 CMake archive；绝不消费 runner PATH 中的偶然版本。
$cmakeIdentityOutput = & $nodeCommand.Source $cmakeResolver '--platform' 'windows' '--ensure' '--print-json'
if ($LASTEXITCODE -ne 0) {
    throw "Pinned Windows CMake resolver failed with exit code $LASTEXITCODE."
}
try {
    $cmakeIdentity = ($cmakeIdentityOutput -join [Environment]::NewLine) | ConvertFrom-Json
} catch {
    throw "Pinned Windows CMake resolver returned invalid identity JSON: $($_.Exception.Message)"
}
if ($null -eq $cmakeIdentity -or
    $cmakeIdentity.kind -ne 'WindowsCMakeToolchainIdentity' -or
    $cmakeIdentity.platform -ne 'windows-x86_64' -or
    $cmakeIdentity.architecture -ne 'x86_64' -or
    $cmakeIdentity.version -ne '4.4.3' -or
    $cmakeIdentity.minimumVersion -ne '4.4.3') {
    throw 'Pinned Windows CMake resolver did not return the required Windows x64 CMake 4.4.3 identity.'
}
$cmake = [System.IO.Path]::GetFullPath([string]$cmakeIdentity.executable)
$ctest = [System.IO.Path]::GetFullPath([string]$cmakeIdentity.ctest)
if (-not (Test-Path -LiteralPath $cmake -PathType Leaf)) {
    throw "Verified CMake executable was not found at '$cmake'."
}
if (-not (Test-Path -LiteralPath $ctest -PathType Leaf)) {
    throw "Verified CTest executable was not found at '$ctest'."
}

$cmakeConfigureArguments = @(
    '-S', $scriptDirectory,
    '-B', $buildDirectory,
    '-A', 'x64',
    '-T', 'v143',
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
