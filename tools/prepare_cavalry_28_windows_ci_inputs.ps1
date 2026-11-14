<#
[INPUT]: 依赖CI锁定的Cavalry MSI、Windows target摘要和hash-locked aqt 3.3.0。
[OUTPUT]: 在RUNNER_TEMP提取官方assets并准备Qt 6.9.2 x64，再写入两个GitHub环境路径。
[POS]: Windows 2.8.1构建输入唯一准备器；不安装Cavalry，不改本机宿主或用户profile。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#>
$ErrorActionPreference = 'Stop'

function Stop-CiInputPreparation {
  param([Parameter(Mandatory = $true)][string]$Message)
  throw "[native-2.8.1-windows-ci-inputs] $Message"
}

try {
  if ($env:GITHUB_ACTIONS -ne 'true') {
    Stop-CiInputPreparation 'run only in GitHub Actions; local builds must pass verified assets and Qt paths explicitly.'
  }
  if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP) -or [string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
    Stop-CiInputPreparation 'RUNNER_TEMP and GITHUB_ENV are required.'
  }
  if ($env:RUNNER_TEMP -match '[\r\n]' -or $env:GITHUB_ENV -match '[\r\n]') {
    Stop-CiInputPreparation 'runner paths must not contain line breaks.'
  }

  $targetPath = Join-Path $PSScriptRoot 'cavalry_native_windows_target.json'
  if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
    Stop-CiInputPreparation 'the frozen Windows 2.8.1 target summary is missing.'
  }
  $target = Get-Content -LiteralPath $targetPath -Raw | ConvertFrom-Json
  if ($target.schemaVersion -ne 1 -or
      $target.cavalryVersion -ne '2.8.1' -or
      $target.qtVersion -ne '6.9.2' -or
      $target.architecture -ne 'x86_64' -or
      $target.msiSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    Stop-CiInputPreparation 'the frozen Windows 2.8.1 target identity is invalid.'
  }
  $targetFiles = @($target.files.PSObject.Properties)
  if ($targetFiles.Count -ne 5 -or -not ($targetFiles.Name -contains 'Cavalry.exe')) {
    Stop-CiInputPreparation 'the frozen Windows host file identity set is incomplete.'
  }
  foreach ($entry in $targetFiles) {
    if ([System.IO.Path]::GetFileName($entry.Name) -cne $entry.Name -or
        $entry.Value -notmatch '^[a-fA-F0-9]{64}$') {
      Stop-CiInputPreparation "invalid Windows host file identity: $($entry.Name)"
    }
  }

  $runnerTemp = [System.IO.Path]::GetFullPath($env:RUNNER_TEMP)
  $runId = if ([string]::IsNullOrWhiteSpace($env:GITHUB_RUN_ID)) { 'local-run' } else { $env:GITHUB_RUN_ID }
  $attempt = if ([string]::IsNullOrWhiteSpace($env:GITHUB_RUN_ATTEMPT)) { '1' } else { $env:GITHUB_RUN_ATTEMPT }
  if ($runId -notmatch '^[A-Za-z0-9._-]+$' -or $attempt -notmatch '^[A-Za-z0-9._-]+$') {
    Stop-CiInputPreparation 'GitHub run identity contains unsupported characters.'
  }
  $inputRoot = Join-Path $runnerTemp "cavalry-2.8.1-windows-inputs-$runId-$attempt"
  $msiPath = Join-Path $inputRoot 'Cavalry-2.8.1.msi'
  $msiLog = Join-Path $inputRoot 'Cavalry-2.8.1-admin-extract.log'
  $extractRoot = Join-Path $inputRoot 'Cavalry-2.8.1-admin-image'
  $qtOutput = Join-Path $inputRoot 'qt_sdk'
  $qtPrefix = Join-Path $qtOutput '6.9.2\msvc2022_64'
  if (Test-Path -LiteralPath $inputRoot) {
    Stop-CiInputPreparation 'this run-attempt input directory already exists; refusing stale or mixed inputs.'
  }
  New-Item -ItemType Directory -Path $inputRoot | Out-Null
  New-Item -ItemType Directory -Path $extractRoot | Out-Null

  $msiUrl = 'https://cavalry.studio/downloads/latest/Cavalry.msi'
  Write-Output '[native-2.8.1-windows-ci-inputs] Downloading the official Cavalry MSI under the frozen target SHA-256.'
  Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -TimeoutSec 600 -UseBasicParsing
  $actualMsiSha256 = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualMsiSha256 -cne $target.msiSha256.ToLowerInvariant()) {
    Stop-CiInputPreparation 'official Cavalry MSI SHA-256 drifted; keep the target pin unchanged and stop.'
  }

  Write-Output '[native-2.8.1-windows-ci-inputs] Extracting an administrative image into RUNNER_TEMP; no MSI install action runs.'
  $msiexec = Join-Path $env:SystemRoot 'System32\msiexec.exe'
  $msiArguments = '/a "{0}" /qn /norestart /l*v "{1}" TARGETDIR="{2}"' -f $msiPath, $msiLog, $extractRoot
  $msiProcess = Start-Process -FilePath $msiexec -ArgumentList $msiArguments -Wait -PassThru -NoNewWindow
  if ($msiProcess.ExitCode -ne 0) {
    Stop-CiInputPreparation "MSI administrative extraction failed with exit $($msiProcess.ExitCode)."
  }

  $matchingRoots = @()
  foreach ($executable in Get-ChildItem -LiteralPath $extractRoot -Filter 'Cavalry.exe' -File -Recurse) {
    $candidateRoot = $executable.DirectoryName
    $matchesTarget = $true
    foreach ($entry in $targetFiles) {
      $candidateFile = Join-Path $candidateRoot $entry.Name
      if (-not (Test-Path -LiteralPath $candidateFile -PathType Leaf)) {
        $matchesTarget = $false
        break
      }
      $actualFileSha256 = (Get-FileHash -LiteralPath $candidateFile -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actualFileSha256 -cne $entry.Value.ToLowerInvariant()) {
        $matchesTarget = $false
        break
      }
    }
    if ($matchesTarget) {
      $matchingRoots += $candidateRoot
    }
  }
  if ($matchingRoots.Count -ne 1) {
    Stop-CiInputPreparation "expected one extracted host matching every frozen Windows file digest; found $($matchingRoots.Count)."
  }
  $assetsRoot = Join-Path $matchingRoots[0] 'assets'
  foreach ($requiredDirectory in @($assetsRoot, (Join-Path $assetsRoot 'MetaData'), (Join-Path $assetsRoot 'Presets'))) {
    if (-not (Test-Path -LiteralPath $requiredDirectory -PathType Container)) {
      Stop-CiInputPreparation "verified Cavalry 2.8.1 assets are incomplete: $requiredDirectory"
    }
  }

  Write-Output '[native-2.8.1-windows-ci-inputs] Installing only the official Qt 6.9.2 qtbase archive with hash-locked aqtinstall 3.3.0.'
  & python -c "import aqt; from importlib.metadata import version; assert version('aqtinstall') == '3.3.0'"
  if ($LASTEXITCODE -ne 0) {
    Stop-CiInputPreparation 'the hash-locked CI Python environment must provide aqtinstall 3.3.0.'
  }
  $aqtArguments = @(
    '-m', 'aqt', 'install-qt', 'windows', 'desktop', '6.9.2', 'win64_msvc2022_64',
    '--outputdir', $qtOutput, '--archives', 'qtbase'
  )
  & python @aqtArguments
  if ($LASTEXITCODE -ne 0) {
    Stop-CiInputPreparation 'aqt failed to install the official Qt 6.9.2 win64_msvc2022_64 qtbase archive.'
  }
  $qconfigPath = Join-Path $qtPrefix 'mkspecs\qconfig.pri'
  $qtCoreConfig = Join-Path $qtPrefix 'lib\cmake\Qt6Core\Qt6CoreConfig.cmake'
  if (-not (Test-Path -LiteralPath $qconfigPath -PathType Leaf) -or
      -not (Test-Path -LiteralPath $qtCoreConfig -PathType Leaf)) {
    Stop-CiInputPreparation 'aqt output does not contain the expected Qt 6.9.2 MSVC SDK prefix.'
  }
  $qtVersionLines = @(Get-Content -LiteralPath $qconfigPath | Where-Object { $_ -match '^QT_VERSION\s*=' })
  if ($qtVersionLines.Count -ne 1 -or $qtVersionLines[0] -notmatch '^QT_VERSION\s*=\s*6\.9\.2\s*$') {
    Stop-CiInputPreparation 'aqt output qconfig.pri is not exactly Qt 6.9.2.'
  }

  Remove-Item -LiteralPath $msiPath -Force
  $githubEnvPath = [System.IO.Path]::GetFullPath($env:GITHUB_ENV)
  $environmentLines = "CAVALRY_NATIVE_ASSETS_ROOT=$assetsRoot`nCAVALRY_QT_PREFIX=$qtPrefix`n"
  [System.IO.File]::AppendAllText($githubEnvPath, $environmentLines, [System.Text.UTF8Encoding]::new($false))
  Write-Output "[native-2.8.1-windows-ci-inputs] Verified Cavalry assets: $assetsRoot"
  Write-Output "[native-2.8.1-windows-ci-inputs] Verified Qt SDK prefix: $qtPrefix"
} catch {
  Write-Error $_
  exit 1
}
