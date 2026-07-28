<#
[INPUT]: 依赖 PowerShell 5.1+ 的 UTF-8 BOM 宿主边界、显式 x64 NSIS/current provenance、package 版本、仓库 generic/QPA 双 DLL、外部 Cavalry QPA 哨兵与当前用户安装命名空间
[OUTPUT]: 对外提供随机 TEMP 安装/同根更新冒烟；复算输入后验证主程序与双 DLL x64/资源/hash/无第二 Qt runtime/注册表、外部 QPA 字节不变，再卸载且拒绝残留
[POS]: tools 的 Windows packaged-install 守门器，只消费当前输入自证的 release NSIS；固定冲突即中止，更新/卸载不得触碰外部 Cavalry，也不以递归删除掩盖失败
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$InstallerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$productName = 'Cavalry Language Switcher'
$publisher = 'daftai'
$mainBinaryName = 'cavalry-i18n-tauri.exe'
$pluginRelativePath = 'injector\windows\generic\cavalryi18n.dll'
$qpaProxyRelativePath = 'injector\windows\qpa\qwindows.dll'
$expectedLocales = @('en', 'ja_JP', 'zh-Hans', 'zh-Hant')
$expectedJsonCountPerLocale = 38
$processTimeoutMilliseconds = 300000
$cleanupObservationTimeoutMilliseconds = 30000
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$windowsTargetTriple = 'x86_64-pc-windows-msvc'
$bundleRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $repoRoot "src-tauri\target\$windowsTargetTriple\release\bundle\nsis")
)
$sourcePlugin = Join-Path $repoRoot 'injector\windows\generic\cavalryi18n.dll'
$sourceQpaProxy = Join-Path $repoRoot 'injector\windows\qpa\qwindows.dll'
$packageJson = Join-Path $repoRoot 'package.json'
$provenanceTool = Join-Path $repoRoot 'tools\windows_nsis_provenance.js'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Cavalry Language Switcher'
$vendorProductKey = 'HKCU:\Software\daftai\Cavalry Language Switcher'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$externalSentinelRelativeFiles = @(
    'qwindows.dll',
    'cavalry-i18n-qpa\vendor-qwindows.dll',
    'cavalry-i18n-qpa\manifest.json'
)

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Normalize-ComparablePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Test-StrictChildPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $candidate = Normalize-ComparablePath -Path $Path
    $parent = Normalize-ComparablePath -Path $Root
    $prefix = $parent + [System.IO.Path]::DirectorySeparatorChar
    return $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparsePathChain {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Role
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $Path) `
        -Message "$Role path does not exist: $Path"
    $cursor = Normalize-ComparablePath -Path $Path
    while (-not [string]::IsNullOrWhiteSpace($cursor)) {
        $item = Get-Item -LiteralPath $cursor -Force
        Assert-Condition `
            -Condition (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) `
            -Message "$Role path chain contains a reparse point: $($item.FullName)"
        $parent = Split-Path -Parent $item.FullName
        if (
            [string]::IsNullOrWhiteSpace($parent) -or
            [System.String]::Equals(
                $parent,
                $item.FullName,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            break
        }
        $cursor = $parent
    }
}

function Resolve-Installer {
    param(
        [Parameter(Mandatory = $false)]
        [string]$RequestedPath
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $bundleRoot -PathType Container) `
        -Message "Windows NSIS bundle directory does not exist: $bundleRoot"
    Assert-NoReparsePathChain -Path $bundleRoot -Role 'Windows NSIS bundle'

    if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        $installers = @(
            Get-ChildItem -LiteralPath $bundleRoot -Filter '*.exe' -File
        )
        Assert-Condition -Condition ($installers.Count -eq 1) `
            -Message "Expected exactly one Windows NSIS installer below $bundleRoot, found $($installers.Count)."
        $item = $installers[0]
    } else {
        $candidate = if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
            $RequestedPath
        } else {
            Join-Path $repoRoot $RequestedPath
        }
        Assert-Condition -Condition (Test-Path -LiteralPath $candidate -PathType Leaf) `
            -Message "Windows NSIS installer does not exist: $candidate"
        $item = Get-Item -LiteralPath $candidate -Force
    }

    $resolved = Normalize-ComparablePath -Path $item.FullName
    $resolvedParent = Normalize-ComparablePath -Path $item.DirectoryName
    Assert-Condition `
        -Condition ([System.String]::Equals(
            $resolvedParent,
            (Normalize-ComparablePath -Path $bundleRoot),
            [System.StringComparison]::OrdinalIgnoreCase
        )) `
        -Message "Refusing installer outside the generated Windows NSIS bundle directory: $resolved"
    Assert-Condition -Condition ($item.Extension -ieq '.exe') `
        -Message "Windows package smoke requires an EXE installer: $resolved"
    Assert-Condition `
        -Condition (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) `
        -Message "Refusing a Windows NSIS installer reached through a reparse point: $resolved"
    Assert-NoReparsePathChain -Path $resolved -Role 'Windows NSIS installer'
    return $resolved
}

function Assert-CurrentInstallerProvenance {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Installer
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $provenanceTool -PathType Leaf) `
        -Message "Windows NSIS provenance verifier does not exist: $provenanceTool"
    $node = Get-Command node.exe -ErrorAction Stop
    & $node.Source $provenanceTool '--verify' $Installer
    $exitCode = $LASTEXITCODE
    Assert-Condition -Condition ($exitCode -eq 0) `
        -Message "Windows NSIS provenance verification failed with exit code $exitCode."
}

function Get-RequiredSpecialFolder {
    param(
        [Parameter(Mandatory = $true)]
        [System.Environment+SpecialFolder]$Folder
    )

    $resolved = [System.Environment]::GetFolderPath($Folder)
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($resolved)) `
        -Message "Windows did not resolve the current-user $Folder folder."
    return Normalize-ComparablePath -Path $resolved
}

function Get-RegistryValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    $key = Get-Item -LiteralPath $Path
    try {
        return $key.GetValue(
            $Name,
            $null,
            [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
        )
    } finally {
        $key.Close()
    }
}

function Test-RegistryValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    return $null -ne (Get-RegistryValue -Path $Path -Name $Name)
}

function Assert-NoPreexistingState {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ShortcutPaths
    )

    $collisions = New-Object 'System.Collections.Generic.List[string]'
    foreach ($path in @($uninstallKey, $vendorProductKey)) {
        if (Test-Path -LiteralPath $path) {
            [void]$collisions.Add($path)
        }
    }
    foreach ($path in $ShortcutPaths) {
        if (Test-Path -LiteralPath $path) {
            [void]$collisions.Add($path)
        }
    }
    if (Test-RegistryValue -Path $runKey -Name $productName) {
        [void]$collisions.Add("$runKey::$productName")
    }

    Assert-Condition -Condition ($collisions.Count -eq 0) -Message (
        "Refusing to overwrite pre-existing Cavalry Language Switcher state: " +
        ($collisions -join ', ')
    )
}

function Invoke-CheckedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Role
    )

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru
    try {
        if (-not $process.WaitForExit($processTimeoutMilliseconds)) {
            try {
                $process.Kill()
                $process.WaitForExit()
            } catch {
                throw "$Role timed out and its spawned process could not be stopped: $($_.Exception.Message)"
            }
            throw "$Role timed out after $processTimeoutMilliseconds ms."
        }
        $exitCode = $process.ExitCode
    } finally {
        $process.Dispose()
    }

    Assert-Condition -Condition ($exitCode -eq 0) `
        -Message "$Role exited with code $exitCode."
}

function Assert-NoReparsePoints {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $Root -PathType Container) `
        -Message "Installed package root does not exist: $Root"
    $items = @(
        Get-Item -LiteralPath $Root -Force
        Get-ChildItem -LiteralPath $Root -Force -Recurse
    )
    $reparsePoints = @(
        $items | Where-Object {
            ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        }
    )
    Assert-Condition -Condition ($reparsePoints.Count -eq 0) -Message (
        "Installed package contains a reparse point: " +
        (($reparsePoints | Select-Object -ExpandProperty FullName) -join ', ')
    )
}

function New-ExternalCavalryQpaSentinel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Assert-Condition -Condition (-not (Test-Path -LiteralPath $Root)) `
        -Message "External Cavalry QPA sentinel root already exists: $Root"
    foreach ($relativePath in $externalSentinelRelativeFiles) {
        $target = Join-Path $Root $relativePath
        [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $target))
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(
            "cavalry-i18n external NSIS QPA sentinel`n$relativePath`n"
        )
        [System.IO.File]::WriteAllBytes($target, $bytes)
    }
    Assert-NoReparsePoints -Root $Root
}

function Get-ExternalCavalryQpaFingerprint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Assert-NoReparsePoints -Root $Root
    $normalizedRoot = Normalize-ComparablePath -Path $Root
    $entries = @(
        Get-ChildItem -LiteralPath $normalizedRoot -Recurse -File |
            ForEach-Object {
                $relativePath = $_.FullName.Substring($normalizedRoot.Length + 1).Replace('\', '/')
                $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
                "$relativePath|$($_.Length)|$hash"
            } |
            Sort-Object
    )
    Assert-Condition -Condition ($entries.Count -eq $externalSentinelRelativeFiles.Count) `
        -Message "External Cavalry QPA sentinel file count changed below $Root."
    return ($entries -join "`n")
}

function Assert-ExternalCavalryQpaUnchanged {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedFingerprint,
        [Parameter(Mandatory = $true)]
        [string]$Phase
    )

    $actualFingerprint = Get-ExternalCavalryQpaFingerprint -Root $Root
    Assert-Condition -Condition ($actualFingerprint -ceq $ExpectedFingerprint) `
        -Message "Windows NSIS $Phase changed the external Cavalry QPA sentinel at $Root."
}

function Remove-ExternalCavalryQpaSentinel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    if (-not (Test-Path -LiteralPath $Root)) {
        return
    }
    Assert-NoReparsePoints -Root $Root
    foreach ($relativePath in $externalSentinelRelativeFiles) {
        [System.IO.File]::Delete((Join-Path $Root $relativePath))
    }
    [System.IO.Directory]::Delete((Join-Path $Root 'cavalry-i18n-qpa'), $false)
    [System.IO.Directory]::Delete($Root, $false)
    Assert-Condition -Condition (-not (Test-Path -LiteralPath $Root)) `
        -Message "External Cavalry QPA sentinel cleanup left residual state: $Root"
}

function Get-PeMachine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $Path -PathType Leaf) `
        -Message "PE file does not exist: $Path"
    $stream = [System.IO.File]::Open(
        $Path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::Read
    )
    $reader = New-Object System.IO.BinaryReader($stream)
    try {
        Assert-Condition -Condition ($reader.ReadUInt16() -eq 0x5A4D) `
            -Message "PE file is missing the MZ signature: $Path"
        $stream.Position = 0x3C
        $peOffset = $reader.ReadInt32()
        Assert-Condition `
            -Condition ($peOffset -ge 0x40 -and ($peOffset + 6) -le $stream.Length) `
            -Message "PE header offset is invalid: $Path"
        $stream.Position = $peOffset
        Assert-Condition -Condition ($reader.ReadUInt32() -eq 0x00004550) `
            -Message "PE file is missing the PE signature: $Path"
        return $reader.ReadUInt16()
    } finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Assert-PeX64 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $machine = Get-PeMachine -Path $Path
    Assert-Condition -Condition ($machine -eq 0x8664) `
        -Message ("Expected x64 PE machine 0x8664 for {0}, got 0x{1:X4}." -f $Path, $machine)
}

function Assert-InstalledLanguages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot
    )

    $languagesRoot = Join-Path $InstallRoot 'languages'
    Assert-Condition -Condition (Test-Path -LiteralPath $languagesRoot -PathType Container) `
        -Message "Installed package is missing its languages directory: $languagesRoot"
    $actualLocales = @(
        Get-ChildItem -LiteralPath $languagesRoot -Directory |
            Select-Object -ExpandProperty Name |
            Sort-Object
    )
    $differences = @(
        Compare-Object -ReferenceObject $expectedLocales -DifferenceObject $actualLocales
    )
    Assert-Condition -Condition ($differences.Count -eq 0) -Message (
        "Installed locale directories differ from the four-language contract: " +
        (($differences | ForEach-Object { "$($_.InputObject)$($_.SideIndicator)" }) -join ', ')
    )

    $totalJsonCount = 0
    foreach ($locale in $expectedLocales) {
        $localeRoot = Join-Path $languagesRoot $locale
        $jsonFiles = @(
            Get-ChildItem -LiteralPath $localeRoot -Recurse -File -Filter '*.json'
        )
        Assert-Condition -Condition ($jsonFiles.Count -eq $expectedJsonCountPerLocale) `
            -Message "Expected $expectedJsonCountPerLocale JSON files for $locale, found $($jsonFiles.Count)."
        $totalJsonCount += $jsonFiles.Count
    }
    Assert-Condition `
        -Condition ($totalJsonCount -eq ($expectedLocales.Count * $expectedJsonCountPerLocale)) `
        -Message "Installed language JSON total is incomplete: $totalJsonCount."
}

function Assert-NoForeignRuntime {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot
    )

    $forbidden = @(
        Get-ChildItem -LiteralPath $InstallRoot -Recurse -File |
            Where-Object {
                $_.Extension -ieq '.dylib' -or $_.Name -like 'Qt6*.dll'
            }
    )
    Assert-Condition -Condition ($forbidden.Count -eq 0) -Message (
        "Windows package contains a macOS injector or a second Qt runtime: " +
        (($forbidden | Select-Object -ExpandProperty FullName) -join ', ')
    )
}

function Get-RequiredRegistryProperty {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Item,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $property = $Item.PSObject.Properties[$Name]
    Assert-Condition -Condition ($null -ne $property) `
        -Message "Windows uninstall registry entry is missing $Name."
    return [string]$property.Value
}

function Assert-RegistryPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Actual,
        [Parameter(Mandatory = $true)]
        [string]$Expected,
        [Parameter(Mandatory = $true)]
        [string]$Role
    )

    $actualPath = Normalize-ComparablePath -Path $Actual.Trim().Trim('"')
    $expectedPath = Normalize-ComparablePath -Path $Expected
    Assert-Condition `
        -Condition ([System.String]::Equals(
            $actualPath,
            $expectedPath,
            [System.StringComparison]::OrdinalIgnoreCase
        )) `
        -Message "$Role registry path mismatch: expected $expectedPath, got $actualPath."
}

function Assert-InstalledRegistry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    Assert-Condition -Condition (Test-Path -LiteralPath $uninstallKey) `
        -Message "Windows installer did not create its HKCU uninstall key."
    Assert-Condition -Condition (Test-Path -LiteralPath $vendorProductKey) `
        -Message "Windows installer did not create its HKCU vendor product key."

    $entry = Get-ItemProperty -LiteralPath $uninstallKey
    Assert-Condition `
        -Condition ((Get-RequiredRegistryProperty -Item $entry -Name 'DisplayName') -ceq $productName) `
        -Message "Windows uninstall DisplayName does not match $productName."
    Assert-Condition `
        -Condition ((Get-RequiredRegistryProperty -Item $entry -Name 'DisplayVersion') -ceq $ExpectedVersion) `
        -Message "Windows uninstall DisplayVersion does not match package.json $ExpectedVersion."
    Assert-Condition `
        -Condition ((Get-RequiredRegistryProperty -Item $entry -Name 'Publisher') -ceq $publisher) `
        -Message "Windows uninstall Publisher does not match $publisher."
    Assert-Condition `
        -Condition ((Get-RequiredRegistryProperty -Item $entry -Name 'MainBinaryName') -ceq $mainBinaryName) `
        -Message "Windows uninstall MainBinaryName does not match $mainBinaryName."
    Assert-RegistryPath `
        -Actual (Get-RequiredRegistryProperty -Item $entry -Name 'InstallLocation') `
        -Expected $InstallRoot `
        -Role 'InstallLocation'
    Assert-RegistryPath `
        -Actual (Get-RequiredRegistryProperty -Item $entry -Name 'UninstallString') `
        -Expected (Join-Path $InstallRoot 'uninstall.exe') `
        -Role 'UninstallString'

    $vendorLocation = [string](Get-RegistryValue -Path $vendorProductKey -Name '')
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($vendorLocation)) `
        -Message "Windows vendor product key is missing its default install path."
    Assert-RegistryPath -Actual $vendorLocation -Expected $InstallRoot -Role 'Vendor product'
}

function Assert-InstalledPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot,
        [Parameter(Mandatory = $true)]
        [string[]]$ShortcutPaths,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    $mainBinary = Join-Path $InstallRoot $mainBinaryName
    $installedPlugin = Join-Path $InstallRoot $pluginRelativePath
    $installedQpaProxy = Join-Path $InstallRoot $qpaProxyRelativePath
    $uninstaller = Join-Path $InstallRoot 'uninstall.exe'
    foreach ($required in @($mainBinary, $installedPlugin, $installedQpaProxy, $uninstaller)) {
        Assert-Condition -Condition (Test-Path -LiteralPath $required -PathType Leaf) `
            -Message "Installed Windows package is missing $required."
    }

    Assert-NoReparsePoints -Root $InstallRoot
    Assert-PeX64 -Path $mainBinary
    Assert-PeX64 -Path $installedPlugin
    Assert-PeX64 -Path $installedQpaProxy
    Assert-InstalledLanguages -InstallRoot $InstallRoot
    Assert-NoForeignRuntime -InstallRoot $InstallRoot

    Assert-Condition -Condition (Test-Path -LiteralPath $sourcePlugin -PathType Leaf) `
        -Message "Trusted repository Windows plugin is missing: $sourcePlugin"
    $sourceHash = (Get-FileHash -LiteralPath $sourcePlugin -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath $installedPlugin -Algorithm SHA256).Hash
    Assert-Condition -Condition ($sourceHash -ceq $installedHash) `
        -Message "Installed Windows plugin hash differs from the repository package source."
    Assert-Condition -Condition (Test-Path -LiteralPath $sourceQpaProxy -PathType Leaf) `
        -Message "Trusted repository Windows QPA proxy is missing: $sourceQpaProxy"
    $sourceQpaHash = (Get-FileHash -LiteralPath $sourceQpaProxy -Algorithm SHA256).Hash
    $installedQpaHash = (Get-FileHash -LiteralPath $installedQpaProxy -Algorithm SHA256).Hash
    Assert-Condition -Condition ($sourceQpaHash -ceq $installedQpaHash) `
        -Message "Installed Windows QPA proxy hash differs from the repository package source."

    foreach ($shortcut in $ShortcutPaths) {
        Assert-Condition -Condition (-not (Test-Path -LiteralPath $shortcut)) `
            -Message "The /NS package smoke unexpectedly created a shortcut: $shortcut"
    }
    Assert-InstalledRegistry -InstallRoot $InstallRoot -ExpectedVersion $ExpectedVersion
}

function Get-ResidualState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot,
        [Parameter(Mandatory = $true)]
        [string[]]$ShortcutPaths
    )

    $residual = New-Object 'System.Collections.Generic.List[string]'
    if (Test-Path -LiteralPath $InstallRoot) {
        [void]$residual.Add($InstallRoot)
    }
    foreach ($path in @($uninstallKey, $vendorProductKey)) {
        if (Test-Path -LiteralPath $path) {
            [void]$residual.Add($path)
        }
    }
    foreach ($path in $ShortcutPaths) {
        if (Test-Path -LiteralPath $path) {
            [void]$residual.Add($path)
        }
    }
    if (Test-RegistryValue -Path $runKey -Name $productName) {
        [void]$residual.Add("$runKey::$productName")
    }
    return @($residual)
}

function Wait-ForNoResidualState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InstallRoot,
        [Parameter(Mandatory = $true)]
        [string[]]$ShortcutPaths
    )

    $deadline = [System.DateTime]::UtcNow.AddMilliseconds($cleanupObservationTimeoutMilliseconds)
    do {
        $residual = @(
            Get-ResidualState -InstallRoot $InstallRoot -ShortcutPaths $ShortcutPaths
        )
        if ($residual.Count -eq 0) {
            return @()
        }
        if ([System.DateTime]::UtcNow -ge $deadline) {
            return $residual
        }
        Start-Sleep -Milliseconds 100
    } while ($true)
}

Assert-Condition -Condition ($env:OS -eq 'Windows_NT') `
    -Message 'Windows NSIS installed-surface smoke can run only on Windows.'
Assert-Condition -Condition ([System.Environment]::Is64BitProcess) `
    -Message 'Windows NSIS installed-surface smoke requires a 64-bit PowerShell host.'
Assert-Condition -Condition (Test-Path -LiteralPath $packageJson -PathType Leaf) `
    -Message "package.json does not exist: $packageJson"
Assert-Condition -Condition (Test-Path -LiteralPath $sourcePlugin -PathType Leaf) `
    -Message "Windows plugin source does not exist: $sourcePlugin"
Assert-NoReparsePathChain -Path $sourcePlugin -Role 'Windows plugin source'
Assert-Condition -Condition (Test-Path -LiteralPath $sourceQpaProxy -PathType Leaf) `
    -Message "Windows QPA proxy source does not exist: $sourceQpaProxy"
Assert-NoReparsePathChain -Path $sourceQpaProxy -Role 'Windows QPA proxy source'

$resolvedInstaller = Resolve-Installer -RequestedPath $InstallerPath
$package = Get-Content -LiteralPath $packageJson -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedVersion = [string]$package.version
Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($expectedVersion)) `
    -Message 'package.json is missing its version.'
Assert-CurrentInstallerProvenance -Installer $resolvedInstaller

$tempRoot = Normalize-ComparablePath -Path ([System.IO.Path]::GetTempPath())
Assert-NoReparsePathChain -Path $tempRoot -Role 'Windows package smoke TEMP root'
$installRoot = Join-Path $tempRoot (
    'cavalry-i18n-nsis-' + [System.Guid]::NewGuid().ToString('N')
)
Assert-Condition -Condition (Test-StrictChildPath -Path $installRoot -Root $tempRoot) `
    -Message "Generated NSIS smoke root escaped TEMP: $installRoot"
Assert-Condition -Condition (-not (Test-Path -LiteralPath $installRoot)) `
    -Message "Generated NSIS smoke root already exists: $installRoot"
$externalSentinelRoot = Join-Path $tempRoot (
    'cavalry-i18n-external-qpa-' + [System.Guid]::NewGuid().ToString('N')
)
Assert-Condition -Condition (Test-StrictChildPath -Path $externalSentinelRoot -Root $tempRoot) `
    -Message "Generated external Cavalry QPA sentinel escaped TEMP: $externalSentinelRoot"

$desktopRoot = Get-RequiredSpecialFolder -Folder DesktopDirectory
$programsRoot = Get-RequiredSpecialFolder -Folder Programs
$shortcutPaths = @(
    (Join-Path $desktopRoot "$productName.lnk"),
    (Join-Path $programsRoot "$productName.lnk")
)
Assert-NoPreexistingState -ShortcutPaths $shortcutPaths

$installSucceeded = $false
$sentinelCreated = $false
$sentinelVerifiedForCleanup = $false
$externalSentinelFingerprint = ''
$primaryFailure = $null
$cleanupFailures = New-Object 'System.Collections.Generic.List[string]'
try {
    New-ExternalCavalryQpaSentinel -Root $externalSentinelRoot
    $sentinelCreated = $true
    $externalSentinelFingerprint = Get-ExternalCavalryQpaFingerprint -Root $externalSentinelRoot

    # /D= 必须保持最后一个参数；安装根由本脚本生成，不接受用户路径。
    Invoke-CheckedProcess `
        -FilePath $resolvedInstaller `
        -ArgumentList @('/S', '/NS', "/D=$installRoot") `
        -WorkingDirectory $tempRoot `
        -Role 'Windows NSIS installer'
    $installSucceeded = $true
    Assert-InstalledPackage `
        -InstallRoot $installRoot `
        -ShortcutPaths $shortcutPaths `
        -ExpectedVersion $expectedVersion
    Assert-ExternalCavalryQpaUnchanged `
        -Root $externalSentinelRoot `
        -ExpectedFingerprint $externalSentinelFingerprint `
        -Phase 'install'

    # 同一安装器再次执行即真实 update 路径；它仍不得读取或改写外部 Cavalry。
    Invoke-CheckedProcess `
        -FilePath $resolvedInstaller `
        -ArgumentList @('/S', '/NS', '/UPDATE', "/D=$installRoot") `
        -WorkingDirectory $tempRoot `
        -Role 'Windows NSIS update'
    Assert-InstalledPackage `
        -InstallRoot $installRoot `
        -ShortcutPaths $shortcutPaths `
        -ExpectedVersion $expectedVersion
    Assert-ExternalCavalryQpaUnchanged `
        -Root $externalSentinelRoot `
        -ExpectedFingerprint $externalSentinelFingerprint `
        -Phase 'update'
} catch {
    if (Test-Path -LiteralPath $externalSentinelRoot) {
        $sentinelCreated = $true
    }
    $primaryFailure = $_.Exception.Message
} finally {
    $uninstaller = Join-Path $installRoot 'uninstall.exe'
    if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
        try {
            # 不执行不可信 reparse tree 中的卸载器，也不以递归删除掩盖失败。
            Assert-NoReparsePoints -Root $installRoot
            Invoke-CheckedProcess `
                -FilePath $uninstaller `
                -ArgumentList @('/S') `
                -WorkingDirectory $tempRoot `
                -Role 'Windows NSIS uninstaller'
        } catch {
            [void]$cleanupFailures.Add($_.Exception.Message)
        }
    } elseif ($installSucceeded) {
        [void]$cleanupFailures.Add("Installed package did not provide its uninstaller: $uninstaller")
    }

    foreach ($residual in @(
        Wait-ForNoResidualState -InstallRoot $installRoot -ShortcutPaths $shortcutPaths
    )) {
        [void]$cleanupFailures.Add("Windows NSIS smoke left residual state: $residual")
    }
    if ($sentinelCreated) {
        if ([string]::IsNullOrWhiteSpace($externalSentinelFingerprint)) {
            [void]$cleanupFailures.Add(
                "External Cavalry QPA sentinel has no baseline; preserving evidence at $externalSentinelRoot"
            )
        } else {
            try {
                Assert-ExternalCavalryQpaUnchanged `
                    -Root $externalSentinelRoot `
                    -ExpectedFingerprint $externalSentinelFingerprint `
                    -Phase 'uninstall'
                $sentinelVerifiedForCleanup = $true
            } catch {
                [void]$cleanupFailures.Add($_.Exception.Message)
            }
        }
    }
    if ($sentinelVerifiedForCleanup) {
        try {
            Remove-ExternalCavalryQpaSentinel -Root $externalSentinelRoot
        } catch {
            [void]$cleanupFailures.Add($_.Exception.Message)
        }
    }
}

if ($null -ne $primaryFailure -or $cleanupFailures.Count -gt 0) {
    $failures = New-Object 'System.Collections.Generic.List[string]'
    if ($null -ne $primaryFailure) {
        [void]$failures.Add("package validation failed: $primaryFailure")
    }
    foreach ($failure in $cleanupFailures) {
        [void]$failures.Add("cleanup verification failed: $failure")
    }
    throw ($failures -join ' ')
}

Write-Host "Windows x64 NSIS install/update/uninstall smoke passed for $expectedVersion."
