/**
 * [INPUT]: 依赖 CopyPair、sha2、serde 与用户临时目录；生成 hash-locked UAC manifest、短 loader 和事务 PowerShell。
 * [OUTPUT]: 提供 manifest/script 写入、SHA-256 验证、UTF-16 Base64 编码及 0/42/43/44 子进程合同。
 * [POS]: Windows UAC 的受限载荷投影；提升进程只执行已验证 manifest/script，绝不写用户 TEMP 报告。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::patch::CopyPair;

#[cfg(target_os = "windows")]
pub(crate) fn windows_admin_copy_script_loader(script_path: &Path, script_hash: &str) -> String {
    let encoded_script_path = encode_powershell_command(&script_path.to_string_lossy());
    format!(
        "$ErrorActionPreference='Stop'\n\
         $p=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('{encoded_script_path}'))\n\
         $b=[IO.File]::ReadAllBytes($p)\n\
         $h=[Security.Cryptography.SHA256]::Create()\n\
         try{{$a=([BitConverter]::ToString($h.ComputeHash($b))).Replace('-','').ToLowerInvariant()}}finally{{$h.Dispose()}}\n\
         if(-not [String]::Equals($a,'{script_hash}',[StringComparison]::Ordinal)){{throw 'Administrator copy script hash did not match its UAC command.'}}\n\
         & ([ScriptBlock]::Create([Text.Encoding]::UTF8.GetString($b)))"
    )
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_admin_copy_script(manifest_path: &Path, manifest_hash: &str) -> String {
    let encoded_manifest_path = encode_powershell_command(&manifest_path.to_string_lossy());
    let mut script = String::from(
        r#"Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$manifestPath = [System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('@@CAVALRY_I18N_MANIFEST_PATH@@'))
$expectedManifestHash = '@@CAVALRY_I18N_MANIFEST_HASH@@'

function Get-Sha256Hex {
  param([byte[]]$Bytes)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
  }
}

function Get-OpenStreamSha256Hex {
  param([System.IO.FileStream]$Stream)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $Stream.Position = 0
    $hash = $algorithm.ComputeHash($Stream)
    $Stream.Position = 0
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
  }
}

function Assert-ManifestString {
  param([object]$Value, [string]$Name)
  if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace($Value)) {
    throw "Manifest $Name must be a non-empty string."
  }
  if ($Value.IndexOfAny([char[]]@("`r", "`n", "`0", "`t")) -ge 0) {
    throw "Manifest $Name contains a forbidden control character."
  }
}

function Assert-Sha256Hex {
  param([object]$Value, [string]$Name)
  if ($Value -isnot [string] -or $Value -notmatch '^[0-9a-f]{64}$') {
    throw "Manifest $Name must be a lowercase SHA-256 hex digest."
  }
}

function Test-PathWithin {
  param([string]$Candidate, [string]$Root)
  $candidateFull = [System.IO.Path]::GetFullPath($Candidate).TrimEnd([char[]]@('\', '/'))
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\', '/'))
  if ([System.String]::Equals($candidateFull, $rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  return $candidateFull.StartsWith(
    $rootFull + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-NotReparsePoint {
  param([string]$Path)
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Refusing administrator copy through reparse point: $Path"
  }
}

function Assert-SafeDestination {
  param([string]$Destination, [string[]]$TrustedRoots)
  $destinationFull = [System.IO.Path]::GetFullPath($Destination)
  $matchingRoot = $null
  foreach ($root in $TrustedRoots) {
    if (Test-PathWithin -Candidate $destinationFull -Root $root) {
      $matchingRoot = $root
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($matchingRoot)) {
    throw "Refusing administrator copy outside Windows known Program Files roots: $Destination"
  }

  Assert-NotReparsePoint -Path $matchingRoot
  $relative = $destinationFull.Substring($matchingRoot.Length).TrimStart([char[]]@('\', '/'))
  $current = $matchingRoot
  foreach ($segment in ($relative -split '[\\/]')) {
    if ([string]::IsNullOrWhiteSpace($segment)) {
      continue
    }
    $current = Join-Path -Path $current -ChildPath $segment
    try {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
    } catch [System.Management.Automation.ItemNotFoundException] {
      break
    }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing administrator copy through reparse point: $current"
    }
  }
}

$manifestBytes = [System.IO.File]::ReadAllBytes($manifestPath)
$actualManifestHash = Get-Sha256Hex -Bytes $manifestBytes
if (-not [System.String]::Equals($actualManifestHash, $expectedManifestHash, [System.StringComparison]::Ordinal)) {
  throw "Administrator copy manifest hash did not match its UAC command."
}
$manifest = [System.Text.Encoding]::UTF8.GetString($manifestBytes) | ConvertFrom-Json
if ($null -eq $manifest -or $manifest.version -ne 1 -or $null -eq $manifest.pairs) {
  throw "Administrator copy manifest schema is invalid."
}
$pairs = @($manifest.pairs)
if ($pairs.Count -eq 0) {
  throw "Administrator copy manifest contains no copy pairs."
}

$trustedRoots = @(
  @(
    [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)
    [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
  ) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd([char[]]@('\', '/')) } |
    Sort-Object -Unique
)
if ($trustedRoots.Count -eq 0) {
  throw "Windows did not return a trusted Program Files known folder."
}

"#,
    );
    script = script
        .replace("@@CAVALRY_I18N_MANIFEST_PATH@@", &encoded_manifest_path)
        .replace("@@CAVALRY_I18N_MANIFEST_HASH@@", manifest_hash);
    script.push_str(
        r#"
function Copy-StreamToFile {
  param([System.IO.FileStream]$sourceStream, [string]$Destination)
  $destinationStream = [System.IO.File]::Open(
    $Destination,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $sourceStream.CopyTo($destinationStream)
    $destinationStream.Flush($true)
  } finally {
    $destinationStream.Dispose()
  }
}

function Restore-TransactionEntry {
  param([object]$Entry, [string[]]$TrustedRoots)
  Assert-SafeDestination -Destination $Entry.destination -TrustedRoots $TrustedRoots
  if ($Entry.originalExists) {
    if (-not [System.IO.File]::Exists($Entry.backup)) {
      throw "Missing administrator copy backup for $($Entry.destination): $($Entry.backup)"
    }
    $parent = [System.IO.Path]::GetDirectoryName($Entry.destination)
    if ([string]::IsNullOrWhiteSpace($parent)) {
      throw "Rollback destination has no parent directory: $($Entry.destination)"
    }
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    Assert-SafeDestination -Destination $Entry.destination -TrustedRoots $TrustedRoots
    $backupStream = [System.IO.File]::Open(
      $Entry.backup,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::None
    )
    try {
      Copy-StreamToFile -SourceStream $backupStream -Destination $Entry.destination
    } finally {
      $backupStream.Dispose()
    }
    [System.IO.File]::SetAttributes(
      $Entry.destination,
      [System.IO.FileAttributes]$Entry.originalAttributes
    )
    return
  }

  if ([System.IO.File]::Exists($Entry.destination)) {
    [System.IO.File]::Delete($Entry.destination)
    return
  }
  if ([System.IO.Directory]::Exists($Entry.destination)) {
    throw "Rollback expected a file but found a directory: $($Entry.destination)"
  }
}

# 鍏堜负鎵€鏈夌洰鏍囧缓绔嬪浠斤紱姝ら樁娈靛け璐ユ椂灏氭湭鍐欏叆浠讳綍 Cavalry 璧勬簮銆?$applied = New-Object 'System.Collections.Generic.List[object]'
$createdDirectories = New-Object 'System.Collections.Generic.List[string]'
$cleanupWarnings = New-Object 'System.Collections.Generic.List[string]'
$copyIndex = 0
$committed = $false
$rolledBack = $false
try {
foreach ($pair in $pairs) {
  # FileMode::Create 鍙兘宸叉埅鏂綋鍓嶉」鍚庢墠澶辫触锛屽洜姝ゅ啓鍓嶅嵆鍔犲叆鍥炴粴闆嗗悎銆?  Assert-ManifestString -Value $pair.source -Name 'source'
  Assert-ManifestString -Value $pair.destination -Name 'destination'
  Assert-Sha256Hex -Value $pair.sourceSha256 -Name 'sourceSha256'

  $source = [System.IO.Path]::GetFullPath([string]$pair.source)
  $destination = [System.IO.Path]::GetFullPath([string]$pair.destination)
  Assert-SafeDestination -Destination $destination -TrustedRoots $trustedRoots

  $sourceStream = [System.IO.File]::Open(
    $source,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::None
  )
  try {
    $actualSourceHash = Get-OpenStreamSha256Hex -Stream $sourceStream
    if (-not [System.String]::Equals($actualSourceHash, [string]$pair.sourceSha256, [System.StringComparison]::Ordinal)) {
      throw "Staged source hash changed before administrator copy: $source"
    }

    $parent = [System.IO.Path]::GetDirectoryName($destination)
    if ([string]::IsNullOrWhiteSpace($parent)) {
      throw "Manifest destination has no parent directory: $destination"
    }
    $missingParent = $parent
    while (-not [System.IO.Directory]::Exists($missingParent)) {
      if ([System.IO.File]::Exists($missingParent)) {
        throw "Administrator copy parent is a file: $missingParent"
      }
      if (-not $createdDirectories.Contains($missingParent)) {
        [void]$createdDirectories.Add($missingParent)
      }
      $nextParent = [System.IO.Path]::GetDirectoryName($missingParent)
      if ([string]::IsNullOrWhiteSpace($nextParent)) {
        throw "Administrator copy could not find an existing parent for: $parent"
      }
      $missingParent = $nextParent
    }
    # 鍦ㄥ垱寤虹埗鐩綍涓庢墦寮€鐩爣鍓嶉兘澶嶆煡锛岀缉灏?junction/symlink 绔炴€佺獥鍙ｃ€?    Assert-SafeDestination -Destination $destination -TrustedRoots $trustedRoots
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    Assert-SafeDestination -Destination $destination -TrustedRoots $trustedRoots

    $originalExists = [System.IO.File]::Exists($destination)
    if (-not $originalExists -and [System.IO.Directory]::Exists($destination)) {
      throw "Administrator copy destination is a directory: $destination"
    }
    $backup = $null
    $originalAttributes = $null
    if ($originalExists) {
      $originalAttributes = [int][System.IO.File]::GetAttributes($destination)
      $backup = Join-Path $parent ".cavalry-i18n-backup-$([System.Guid]::NewGuid().ToString('N'))-$copyIndex"
      Assert-SafeDestination -Destination $backup -TrustedRoots $trustedRoots
      try {
        $originalStream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
        try {
          $backupStream = [System.IO.File]::Open($backup, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
          try {
            $originalStream.CopyTo($backupStream)
            $backupStream.Flush($true)
          } finally {
            $backupStream.Dispose()
          }
        } finally {
          $originalStream.Dispose()
        }
      } catch {
        if ([System.IO.File]::Exists($backup)) {
          try {
            Remove-Item -LiteralPath $backup -Force -ErrorAction Stop
          } catch {
            [void]$cleanupWarnings.Add("$backup`: $($_.Exception.Message)")
          }
        }
        throw
      }
    }
    [void]$applied.Add([pscustomobject]@{
      destination = $destination
      originalExists = $originalExists
      backup = $backup
      originalAttributes = $originalAttributes
    })

    Copy-StreamToFile -SourceStream $sourceStream -Destination $destination
  } finally {
    $sourceStream.Dispose()
  }
  $copyIndex++
}
  $committed = $true
} catch {
  $rollbackErrors = New-Object 'System.Collections.Generic.List[string]'
  for ($rollbackIndex = $applied.Count - 1; $rollbackIndex -ge 0; $rollbackIndex--) {
    try {
      Restore-TransactionEntry -Entry $applied[$rollbackIndex] -TrustedRoots $trustedRoots
    } catch {
      [void]$rollbackErrors.Add($_.Exception.Message)
    }
  }
  $rolledBack = $rollbackErrors.Count -eq 0
} finally {
  if ($committed -or $rolledBack) {
    foreach ($entry in $applied) {
      if ($entry.backup -and [System.IO.File]::Exists($entry.backup)) {
        try {
          Remove-Item -LiteralPath $entry.backup -Force -ErrorAction Stop
        } catch {
          [void]$cleanupWarnings.Add("$($entry.backup)`: $($_.Exception.Message)")
        }
      }
    }
  }
  if ($rolledBack) {
    foreach ($directory in ($createdDirectories | Sort-Object { $_.Length } -Descending)) {
      try {
        Assert-SafeDestination -Destination $directory -TrustedRoots $trustedRoots
        [System.IO.Directory]::Delete($directory, $false)
      } catch [System.IO.DirectoryNotFoundException] {
        continue
      } catch {
        [void]$cleanupWarnings.Add("$directory`: $($_.Exception.Message)")
      }
    }
  }
  if ($committed) {
    if ($cleanupWarnings.Count -gt 0) {
      exit 42
    }
    exit 0
  }
  if ($rolledBack -and $cleanupWarnings.Count -eq 0) {
    exit 43
  }
  exit 44
}
"#,
    );
    compact_powershell_script(&script)
}

#[cfg(target_os = "windows")]
fn compact_powershell_script(script: &str) -> String {
    script
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(target_os = "windows")]
const WINDOWS_COPY_MANIFEST_VERSION: u32 = 1;

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct WindowsCopyManifest {
    version: u32,
    pairs: Vec<WindowsCopyManifestPair>,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct WindowsCopyManifestPair {
    source: String,
    destination: String,
    source_sha256: String,
}

#[cfg(target_os = "windows")]
fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(target_os = "windows")]
fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Could not open staged source {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash staged source {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let digest = hasher.finalize();
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(target_os = "windows")]
fn validate_windows_manifest_path(value: &str, field: &str) -> Result<(), String> {
    if value
        .chars()
        .any(|character| matches!(character, '\r' | '\n' | '\0' | '\t'))
    {
        return Err(format!("Unsafe control character in {field}: {value:?}"));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn manifest_from_windows_copy_pairs(pairs: &[CopyPair]) -> Result<WindowsCopyManifest, String> {
    let mut manifest_pairs = Vec::with_capacity(pairs.len());
    for pair in pairs {
        let source = pair.src.to_string_lossy().to_string();
        let destination = pair.dst.to_string_lossy().to_string();
        validate_windows_manifest_path(&source, "manifest source")?;
        validate_windows_manifest_path(&destination, "manifest destination")?;
        manifest_pairs.push(WindowsCopyManifestPair {
            source,
            destination,
            source_sha256: sha256_file(&pair.src)?,
        });
    }
    if manifest_pairs.is_empty() {
        return Err("Administrator copy manifest cannot be empty.".to_string());
    }
    Ok(WindowsCopyManifest {
        version: WINDOWS_COPY_MANIFEST_VERSION,
        pairs: manifest_pairs,
    })
}

#[cfg(target_os = "windows")]
fn parse_verified_windows_copy_manifest(
    bytes: &[u8],
    expected_sha256: &str,
) -> Result<WindowsCopyManifest, String> {
    if sha256_hex(bytes) != expected_sha256 {
        return Err("Administrator copy manifest hash did not match its UAC command.".to_string());
    }
    let manifest: WindowsCopyManifest = serde_json::from_slice(bytes)
        .map_err(|error| format!("Administrator copy manifest JSON is invalid: {error}"))?;
    if manifest.version != WINDOWS_COPY_MANIFEST_VERSION || manifest.pairs.is_empty() {
        return Err("Administrator copy manifest schema is invalid.".to_string());
    }
    for pair in &manifest.pairs {
        validate_windows_manifest_path(&pair.source, "manifest source")?;
        validate_windows_manifest_path(&pair.destination, "manifest destination")?;
        if pair.source_sha256.len() != 64
            || !pair
                .source_sha256
                .chars()
                .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase())
        {
            return Err("Administrator copy manifest source hash is invalid.".to_string());
        }
    }
    Ok(manifest)
}

#[cfg(target_os = "windows")]
fn create_windows_copy_manifest_file() -> Result<(PathBuf, fs::File), String> {
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    for _ in 0..128 {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "cavalry-i18n-admin-copy-{}-{timestamp}-{sequence}.json",
            std::process::id()
        ));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "Could not create administrator copy manifest {}: {error}",
                    path.display()
                ));
            }
        }
    }
    Err("Could not allocate a unique administrator copy manifest path.".to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn write_windows_admin_copy_script(script: &str) -> Result<(PathBuf, String), String> {
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let bytes = script.as_bytes();
    let hash = sha256_hex(bytes);
    for _ in 0..128 {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "cavalry-i18n-admin-copy-{}-{timestamp}-{sequence}.ps1",
            std::process::id()
        ));
        let mut file = match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "Could not create administrator copy script {}: {error}",
                    path.display()
                ));
            }
        };
        if let Err(error) = file
            .write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| {
                format!(
                    "Could not write administrator copy script {}: {error}",
                    path.display()
                )
            })
        {
            drop(file);
            return match fs::remove_file(&path) {
                Ok(()) => Err(error),
                Err(cleanup_error) => Err(format!(
                    "{error} Cleanup residual remains at {}: {cleanup_error}",
                    path.display()
                )),
            };
        }
        return Ok((path, hash));
    }
    Err("Could not allocate a unique administrator copy script path.".to_string())
}

#[cfg(target_os = "windows")]
pub(crate) fn write_windows_copy_manifest(pairs: &[CopyPair]) -> Result<(PathBuf, String), String> {
    let manifest = manifest_from_windows_copy_pairs(pairs)?;
    let bytes = serde_json::to_vec(&manifest)
        .map_err(|error| format!("Could not serialize administrator copy manifest: {error}"))?;
    let hash = sha256_hex(&bytes);
    parse_verified_windows_copy_manifest(&bytes, &hash)?;

    let (path, mut file) = create_windows_copy_manifest_file()?;
    let write_result = (|| {
        file.write_all(&bytes).map_err(|error| {
            format!(
                "Could not write administrator copy manifest {}: {error}",
                path.display()
            )
        })?;
        file.sync_all().map_err(|error| {
            format!(
                "Could not flush administrator copy manifest {}: {error}",
                path.display()
            )
        })
    })();
    drop(file);
    if let Err(error) = write_result {
        return match fs::remove_file(&path) {
            Ok(()) => Err(error),
            Err(cleanup_error) => Err(format!(
                "{error} Cleanup residual remains at {}: {cleanup_error}",
                path.display()
            )),
        };
    }
    Ok((path, hash))
}

#[cfg(target_os = "windows")]
pub(crate) fn encode_powershell_command(script: &str) -> String {
    let bytes = script
        .encode_utf16()
        .flat_map(u16::to_le_bytes)
        .collect::<Vec<_>>();
    base64_encode(&bytes)
}

#[cfg(target_os = "windows")]
fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);
        output.push(TABLE[(first >> 2) as usize] as char);
        output.push(TABLE[(((first & 0x03) << 4) | (second >> 4)) as usize] as char);
        output.push(if chunk.len() > 1 {
            TABLE[(((second & 0x0f) << 2) | (third >> 6)) as usize] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            TABLE[(third & 0x3f) as usize] as char
        } else {
            '='
        });
    }
    output
}
