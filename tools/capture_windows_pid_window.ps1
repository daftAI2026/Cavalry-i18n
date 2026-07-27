<#
[INPUT]: 依赖 Windows PowerShell 5.1 的 UTF-8 BOM 解码约束、显式 PID、位于带 sentinel 的 disposable `%TEMP%` clone 根内的 Cavalry.exe、runtime marker、带 sentinel 的 evidence `%TEMP%` 根与输出 PNG 路径
[OUTPUT]: 对外提供 Inventory/Capture/Close 三个 live-smoke 动作：验证 sentinel TEMP clone、精确 PID、marker、DWM 与 evidence 写入链；自动捕获三类场景，并以显式开关从零位图基线等待人工 Cogwheel 拖拽及严格诊断增量
[POS]: tools 的 Windows GUI 取证边界；Edit Shape 与人工 CogPitch 通过有界 exact-HWND 前台门，拒绝预置 bit 22 并保存前后诊断，不创建场景、不依赖 Qt UIA、不运行脚本，禁止坐标/鼠标回退、强杀、固定 sleep 或覆盖证据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Inventory', 'Capture', 'Close')]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [int]$TargetProcessId = 0,

    [Parameter(Mandatory = $false)]
    [string]$ExecutablePath,

    [Parameter(Mandatory = $false)]
    [string]$MarkerPath,

    [Parameter(Mandatory = $false)]
    [string]$Language,

    [Parameter(Mandatory = $false)]
    [string]$EvidenceRoot,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [ValidateSet('ViewportQuality', 'TransformHelper', 'EditShapeHelper', 'CogPitch')]
    [string]$CaptureScenario = 'ViewportQuality',

    [Parameter(Mandatory = $false)]
    [switch]$AllowManualCogPitch,

    [Parameter(Mandatory = $false)]
    [int]$TimeoutMilliseconds = 45000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$disposableSentinel = '.cavalry-i18n-disposable-smoke'

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class CavalryLiveWindow {
    public const uint WM_CLOSE = 0x0010;

    public delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [StructLayout(LayoutKind.Sequential)]
    public struct Rect {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr window, uint command);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr window, out Rect rectangle);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr window, IntPtr deviceContext, uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessage(
        IntPtr window,
        uint message,
        IntPtr wordParameter,
        IntPtr longParameter
    );

    [DllImport("user32.dll")]
    private static extern uint MapVirtualKey(uint code, uint mapType);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern void keybd_event(
        byte virtualKey,
        byte scanCode,
        uint flags,
        UIntPtr extraInfo
    );

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(
        IntPtr window,
        uint attribute,
        out int value,
        int valueSize
    );

    [DllImport("dwmapi.dll")]
    public static extern int DwmFlush();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    public static IntPtr[] FindVisibleWindows(uint targetProcessId) {
        var windows = new System.Collections.Generic.List<IntPtr>();
        EnumWindows(delegate(IntPtr window, IntPtr parameter) {
            uint processId;
            GetWindowThreadProcessId(window, out processId);
            if (processId != targetProcessId || !IsWindowVisible(window)) {
                return true;
            }
            int cloaked = 0;
            if (
                DwmGetWindowAttribute(window, 14, out cloaked, sizeof(int)) == 0 &&
                cloaked != 0
            ) {
                return true;
            }
            windows.Add(window);
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }

    public static IntPtr[] FindTopLevelWindows(uint targetProcessId) {
        var windows = new System.Collections.Generic.List<IntPtr>();
        foreach (IntPtr window in FindVisibleWindows(targetProcessId)) {
            if (GetWindow(window, 4) == IntPtr.Zero) {
                windows.Add(window);
            }
        }
        return windows.ToArray();
    }

    public static IntPtr FindMainWindow(uint targetProcessId) {
        IntPtr bestWindow = IntPtr.Zero;
        long bestArea = 0;
        foreach (IntPtr window in FindTopLevelWindows(targetProcessId)) {
            Rect rectangle;
            if (!GetWindowRect(window, out rectangle)) {
                continue;
            }
            long width = Math.Max(0, rectangle.Right - rectangle.Left);
            long height = Math.Max(0, rectangle.Bottom - rectangle.Top);
            long area = width * height;
            if (area > bestArea) {
                bestArea = area;
                bestWindow = window;
            }
        }
        return bestWindow;
    }

    public static bool RequestForegroundWindow(IntPtr window) {
        return SetForegroundWindow(window);
    }

    public static bool ExactForegroundWindow(IntPtr window, uint targetProcessId) {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || foreground != window) {
            return false;
        }
        uint foregroundProcessId;
        GetWindowThreadProcessId(foreground, out foregroundProcessId);
        return foregroundProcessId == targetProcessId;
    }

    public static bool PostVirtualKey(IntPtr window, uint virtualKey) {
        const uint WM_KEYDOWN = 0x0100;
        const uint WM_KEYUP = 0x0101;
        uint scanCode = MapVirtualKey(virtualKey, 0);
        long downState = 1L | ((long)scanCode << 16);
        long upState = downState | (1L << 30) | (1L << 31);
        return
            PostMessage(
                window,
                WM_KEYDOWN,
                new IntPtr((long)virtualKey),
                new IntPtr(downState)
            ) &&
            PostMessage(
                window,
                WM_KEYUP,
                new IntPtr((long)virtualKey),
                new IntPtr(upState)
            );
    }

    public static void ConfirmDiscardOfDisposableScene() {
        const uint KEYEVENTF_KEYUP = 0x0002;
        const byte VK_LEFT = 0x25;
        const byte VK_RETURN = 0x0D;
        keybd_event(VK_LEFT, 0, 0, UIntPtr.Zero);
        keybd_event(VK_LEFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

}
'@ | Out-Null

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

function Normalize-Path {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $normalized = [System.IO.Path]::GetFullPath($Path)
    if ($normalized.StartsWith(
        '\\?\UNC\',
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        $normalized = '\\' + $normalized.Substring(8)
    } elseif ($normalized.StartsWith(
        '\\?\',
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        $normalized = $normalized.Substring(4)
    }

    return [System.IO.Path]::GetFullPath($normalized).TrimEnd(
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

    $candidate = Normalize-Path -Path $Path
    $parent = Normalize-Path -Path $Root
    return $candidate.StartsWith(
        $parent + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Assert-NoReparseTargetChain {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$Target,
        [Parameter(Mandatory = $true)]
        [string]$Role
    )

    $rootPath = Normalize-Path -Path $Root
    $targetPath = Normalize-Path -Path $Target
    Assert-Condition -Condition (Test-Path -LiteralPath $rootPath -PathType Container) `
        -Message "$Role root does not exist: $rootPath"
    Assert-Condition -Condition (Test-StrictChildPath -Path $targetPath -Root $rootPath) `
        -Message "$Role target escaped its guarded root: $targetPath"

    $rootItem = Get-Item -LiteralPath $rootPath -Force
    Assert-Condition `
        -Condition (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) `
        -Message "$Role root is a reparse point: $rootPath"

    $relative = $targetPath.Substring(
        $rootPath.Length + [System.IO.Path]::DirectorySeparatorChar.ToString().Length
    )
    $cursor = $rootPath
    foreach ($segment in $relative -split '[\\/]') {
        if ([string]::IsNullOrWhiteSpace($segment)) {
            continue
        }
        $cursor = Join-Path $cursor $segment
        if (-not (Test-Path -LiteralPath $cursor)) {
            break
        }
        $item = Get-Item -LiteralPath $cursor -Force
        Assert-Condition `
            -Condition (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) `
            -Message "$Role target chain contains a reparse point: $($item.FullName)"
    }
}

function Assert-DisposableCavalryExecutable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Assert-Condition -Condition ([System.IO.Path]::IsPathRooted($Path)) `
        -Message 'ExecutablePath must be absolute.'
    $executable = Normalize-Path -Path $Path
    Assert-Condition `
        -Condition ([System.IO.Path]::GetFileName($executable) -ieq 'Cavalry.exe') `
        -Message "ExecutablePath must name Cavalry.exe: $executable"

    $tempRoot = Normalize-Path -Path ([System.IO.Path]::GetTempPath())
    $cloneRoot = Normalize-Path -Path (Split-Path -Parent $executable)
    Assert-Condition -Condition (Test-StrictChildPath -Path $cloneRoot -Root $tempRoot) `
        -Message "Disposable Cavalry clone root must be strictly below %TEMP%: $cloneRoot"
    Assert-Condition -Condition (Test-Path -LiteralPath $cloneRoot -PathType Container) `
        -Message "Disposable Cavalry clone root does not exist: $cloneRoot"
    Assert-Condition -Condition (Test-Path -LiteralPath $executable -PathType Leaf) `
        -Message "Disposable Cavalry executable does not exist: $executable"

    $sentinel = Join-Path $cloneRoot $disposableSentinel
    Assert-Condition -Condition (Test-Path -LiteralPath $sentinel -PathType Leaf) `
        -Message "Disposable Cavalry clone is missing $disposableSentinel."
    Assert-NoReparseTargetChain `
        -Root $tempRoot `
        -Target $executable `
        -Role 'disposable Cavalry executable'
    Assert-NoReparseTargetChain `
        -Root $cloneRoot `
        -Target $sentinel `
        -Role 'disposable Cavalry sentinel'
    return $executable
}

function Get-CavalryInventory {
    $entries = @(
        Get-CimInstance Win32_Process -Filter "Name='Cavalry.exe'" -ErrorAction Stop |
            ForEach-Object {
                [PSCustomObject]@{
                    processId = [int]$_.ProcessId
                    executablePath = if ($_.ExecutablePath) {
                        [string]$_.ExecutablePath
                    } else {
                        ''
                    }
                }
            }
    )
    return $entries
}

function Get-ExactProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Id,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedExecutable,
        [Parameter(Mandatory = $false)]
        [switch]$AllowMissing
    )

    Assert-Condition -Condition ($Id -gt 0) -Message 'Target process id must be positive.'
    Assert-Condition -Condition ([System.IO.Path]::IsPathRooted($ExpectedExecutable)) `
        -Message 'Expected executable path must be absolute.'
    $expected = Normalize-Path -Path $ExpectedExecutable
    $entry = Get-CimInstance Win32_Process -Filter "ProcessId=$Id" -ErrorAction Stop
    if ($null -eq $entry) {
        if ($AllowMissing) {
            return $null
        }
        throw "Cavalry process $Id no longer exists."
    }
    Assert-Condition -Condition ([string]$entry.Name -ieq 'Cavalry.exe') `
        -Message "Process $Id is not Cavalry.exe."
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace([string]$entry.ExecutablePath)) `
        -Message "Windows did not expose the executable path for Cavalry process $Id."
    $actual = Normalize-Path -Path ([string]$entry.ExecutablePath)
    Assert-Condition `
        -Condition ([System.String]::Equals(
            $actual,
            $expected,
            [System.StringComparison]::OrdinalIgnoreCase
        )) `
        -Message "Refusing Cavalry process $Id at unexpected executable path $actual."

    try {
        $process = Get-Process -Id $Id -ErrorAction Stop
    } catch {
        if ($AllowMissing) {
            return $null
        }
        throw "Could not obtain Cavalry process $Id after path verification: $($_.Exception.Message)"
    }
    return [PSCustomObject]@{
        process = $process
        executablePath = $actual
    }
}

function Wait-ForExactForegroundWindow {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [IntPtr]$Window,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline,
        [Parameter(Mandatory = $true)]
        [string]$Operation
    )

    [void][CavalryLiveWindow]::RequestForegroundWindow($Window)
    while ([System.DateTime]::UtcNow -lt $Deadline) {
        $Process.Refresh()
        Assert-Condition -Condition (-not $Process.HasExited) `
            -Message "Cavalry process $ExpectedProcessId exited before $Operation."
        if (
            [CavalryLiveWindow]::ExactForegroundWindow(
                $Window,
                [uint32]$ExpectedProcessId
            )
        ) {
            return
        }
        [void][CavalryLiveWindow]::WaitForSingleObject($Process.Handle, 100)
    }
    throw (
        "Timed out waiting for the exact Cavalry window before $Operation. " +
        'Bring the disposable Cavalry window to the foreground and retry.'
    )
}

function Prepare-ToolHelperEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [IntPtr]$Window,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline,
        [Parameter(Mandatory = $true)]
        [ValidateSet('Transform', 'EditShape')]
        [string]$Tool
    )

    if ($Tool -ceq 'Transform') {
        return 'transform-helper=initial-empty-scene;path-pixels=manual-review-required'
    }
    Wait-ForExactForegroundWindow `
        -Process $Process `
        -Window $Window `
        -ExpectedProcessId $ExpectedProcessId `
        -Deadline $Deadline `
        -Operation "$Tool Tool preparation"
    Assert-Condition `
        -Condition ([CavalryLiveWindow]::PostVirtualKey($Window, 0x41)) `
        -Message 'PostMessage failed while sending the default Edit Shape Tool key A.'
    Assert-Condition `
        -Condition ([CavalryLiveWindow]::ExactForegroundWindow(
            $Window,
            [uint32]$ExpectedProcessId
        )) `
        -Message 'Refusing Edit Shape Tool evidence because focus changed during exact-HWND key delivery.'
    return 'edit-shape-helper-trigger=exact-hwnd-postmessage-vk-a;path-pixels=manual-review-required'
}

function Wait-ForExtensionLayerMarker {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedLanguage,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline
    )

    $directory = Split-Path -Parent $Path
    $fileName = Split-Path -Leaf $Path
    Assert-Condition -Condition (Test-Path -LiteralPath $directory -PathType Container) `
        -Message "Runtime marker directory does not exist: $directory"
    $watcher = New-Object System.IO.FileSystemWatcher($directory, $fileName)
    $watcher.NotifyFilter = (
        [System.IO.NotifyFilters]::FileName -bor
        [System.IO.NotifyFilters]::LastWrite -bor
        [System.IO.NotifyFilters]::Size
    )
    $watcher.EnableRaisingEvents = $true
    try {
        while ([System.DateTime]::UtcNow -lt $Deadline) {
            $Process.Refresh()
            Assert-Condition -Condition (-not $Process.HasExited) `
                -Message "Cavalry process $ExpectedProcessId exited before ExtensionLayer installed."
            if (Test-Path -LiteralPath $Path -PathType Leaf) {
                $marker = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
                if ([string]$marker.status -eq 'error') {
                    throw "Windows runtime marker reported an error: $([string]$marker.message)"
                }
                if ([string]$marker.status -eq 'ready') {
                    Assert-Condition -Condition ([string]$marker.plugin -ceq 'cavalryi18n') `
                        -Message 'Runtime marker plugin mismatch.'
                    Assert-Condition -Condition ([string]$marker.language -ceq $ExpectedLanguage) `
                        -Message 'Runtime marker language mismatch.'
                    Assert-Condition -Condition ([int]$marker.processId -eq $ExpectedProcessId) `
                        -Message 'Runtime marker PID mismatch.'
                    Assert-Condition -Condition ([string]$marker.qtVersion -ceq '6.6.3') `
                        -Message 'Runtime marker Qt version mismatch.'
                    Assert-Condition `
                        -Condition ([string]$marker.translationSource -ceq 'embedded-generated-table') `
                        -Message 'Runtime marker translation table source mismatch.'
                    Assert-Condition -Condition ([bool]$marker.translatorInstalled) `
                        -Message 'Runtime marker did not install its translator.'
                    Assert-Condition `
                        -Condition (
                            [int]$marker.embeddedEntryCount -gt 0 -and
                            [int]$marker.exactKeyCount -gt 0 -and
                            [int]$marker.sourceFallbackCount -gt 0
                        ) `
                        -Message 'Runtime marker reported an incomplete embedded translation table.'
                    if ([string]$marker.extensionLayerHookStatus -ceq 'installed') {
                        return $marker
                    }
                    Assert-Condition `
                        -Condition (
                            [string]$marker.extensionLayerHookStatus -ceq
                            'waiting-for-extension-layer'
                        ) `
                        -Message (
                            'ExtensionLayer hook did not install: ' +
                            [string]$marker.extensionLayerHookStatus + ' ' +
                            [string]$marker.extensionLayerHookDetail
                        )
                }
            }

            $remaining = [int][Math]::Max(
                1,
                [Math]::Min(500, ($Deadline - [System.DateTime]::UtcNow).TotalMilliseconds)
            )
            [void]$watcher.WaitForChanged(
                [System.IO.WatcherChangeTypes]::All,
                $remaining
            )
        }
    } finally {
        $watcher.Dispose()
    }
    throw "Timed out waiting for extensionLayerHookStatus=installed in $Path."
}

function Wait-ForTextPathDiagnostics {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [int]$RequiredSourceMask,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline,
        [object]$BaselineDiagnostics = $null
    )

    while ([System.DateTime]::UtcNow -lt $Deadline) {
        $Process.Refresh()
        Assert-Condition -Condition (-not $Process.HasExited) `
            -Message "Cavalry process $ExpectedProcessId exited before text-path diagnostics converged."
        if (Test-Path -LiteralPath $Path -PathType Leaf) {
            $current = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
            if (
                [int]$current.processId -eq $ExpectedProcessId -and
                [string]$current.extensionLayerHookStatus -ceq 'installed' -and
                $null -ne $current.extensionLayerTextPathDiagnostics
            ) {
                $diagnostics = $current.extensionLayerTextPathDiagnostics
                Assert-Condition -Condition ([uint64]$diagnostics.rendererFailure -eq 0) `
                    -Message 'CJK text-path renderer reported a failure.'
                Assert-Condition -Condition ([int]$diagnostics.fallbackSourceMask -eq 0) `
                    -Message 'A translated self-draw source fell back to the original Path.'
                $translatedMask = [int]$diagnostics.translatedSourceMask
                $advancedSinceBaseline = $true
                if ($null -ne $BaselineDiagnostics) {
                    $advancedSinceBaseline = (
                        [uint64]$diagnostics.revision -gt [uint64]$BaselineDiagnostics.revision -and
                        [uint64]$diagnostics.canonicalCalls -gt [uint64]$BaselineDiagnostics.canonicalCalls -and
                        [uint64]$diagnostics.whitelistCalls -gt [uint64]$BaselineDiagnostics.whitelistCalls -and
                        [uint64]$diagnostics.cjkPathSuccess -gt [uint64]$BaselineDiagnostics.cjkPathSuccess
                    )
                }
                if (
                    ($translatedMask -band $RequiredSourceMask) -eq $RequiredSourceMask -and
                    $advancedSinceBaseline -and
                    (
                        $RequiredSourceMask -eq 0 -or
                        [uint64]$diagnostics.cjkPathSuccess -gt 0
                    )
                ) {
                    return $current
                }
            }
        }
        [void][CavalryLiveWindow]::WaitForSingleObject($Process.Handle, 100)
    }
    throw (
        "Timed out waiting for translated self-draw source mask 0x" +
        $RequiredSourceMask.ToString('X4') +
        " in exact Cavalry PID $ExpectedProcessId."
    )
}

function Wait-ForMainWindow {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline
    )

    while ([System.DateTime]::UtcNow -lt $Deadline) {
        $Process.Refresh()
        Assert-Condition -Condition (-not $Process.HasExited) `
            -Message "Cavalry process $ExpectedProcessId exited before its main window appeared."
        $window = [CavalryLiveWindow]::FindMainWindow([uint32]$ExpectedProcessId)
        if ($window -ne [IntPtr]::Zero) {
            return $window
        }

        # WaitForInputIdle is only a latency hint. Cavalry's Qt/Skia process can own a
        # real top-level window while .NET reports that it has no graphical interface.
        # The exact-PID EnumWindows loop below remains the source of truth.
        $remainingForInput = [int][Math]::Max(
            1,
            [Math]::Min(
                1000,
                ($Deadline - [System.DateTime]::UtcNow).TotalMilliseconds
            )
        )
        try {
            [void]$Process.WaitForInputIdle($remainingForInput)
        } catch [System.InvalidOperationException] {
            # Unsupported by this process shape; continue with the PID window oracle.
        }

        $remaining = [uint32][Math]::Max(
            1,
            [Math]::Min(250, ($Deadline - [System.DateTime]::UtcNow).TotalMilliseconds)
        )
        $waitResult = [CavalryLiveWindow]::WaitForSingleObject(
            $Process.Handle,
            $remaining
        )
        Assert-Condition -Condition ($waitResult -ne 0) `
            -Message "Cavalry process $ExpectedProcessId exited before its main window appeared."
    }
    throw "Timed out waiting for Cavalry process $ExpectedProcessId main window."
}

function Capture-MainWindow {
    param(
        [Parameter(Mandatory = $true)]
        [IntPtr]$Window,
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    while ([System.DateTime]::UtcNow -lt $Deadline) {
        $Process.Refresh()
        Assert-Condition -Condition (-not $Process.HasExited) `
            -Message "Cavalry process $ExpectedProcessId exited before its window rendered."
        $currentWindow = [CavalryLiveWindow]::FindMainWindow([uint32]$ExpectedProcessId)
        if ($currentWindow -ne [IntPtr]::Zero) {
            $Window = $currentWindow
        }
        $rectangle = [CavalryLiveWindow+Rect]::new()
        if ([CavalryLiveWindow]::GetWindowRect($Window, [ref]$rectangle)) {
            $width = $rectangle.Right - $rectangle.Left
            $height = $rectangle.Bottom - $rectangle.Top
            if ($width -gt 0 -and $height -gt 0) {
                Assert-Condition -Condition ([CavalryLiveWindow]::DwmFlush() -eq 0) `
                    -Message 'DwmFlush failed before the Cavalry window capture.'
                $bitmap = [System.Drawing.Bitmap]::new(
                    $width,
                    $height,
                    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
                )
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                $deviceContext = [IntPtr]::Zero
                try {
                    $deviceContext = $graphics.GetHdc()
                    Assert-Condition `
                        -Condition ([CavalryLiveWindow]::PrintWindow($Window, $deviceContext, 2)) `
                        -Message 'PrintWindow failed for the exact Cavalry PID main window.'
                } finally {
                    if ($deviceContext -ne [IntPtr]::Zero) {
                        $graphics.ReleaseHdc($deviceContext)
                    }
                    $graphics.Dispose()
                }

                $sampleCount = 0
                $contentPixels = 0
                $buckets = [System.Collections.Generic.HashSet[int]]::new()
                $xStep = [int][Math]::Max(1, [Math]::Floor($width / 32))
                $yStep = [int][Math]::Max(1, [Math]::Floor($height / 18))
                for ($y = [int][Math]::Max(1, [Math]::Floor($height / 10));
                    $y -lt [int][Math]::Floor($height * 0.9);
                    $y += $yStep) {
                    for ($x = [int][Math]::Max(1, [Math]::Floor($width / 20));
                        $x -lt [int][Math]::Floor($width * 0.95);
                        $x += $xStep) {
                        $pixel = $bitmap.GetPixel($x, $y)
                        $sampleCount += 1
                        if ($pixel.R -lt 245 -or $pixel.G -lt 245 -or $pixel.B -lt 245) {
                            $contentPixels += 1
                        }
                        [void]$buckets.Add(
                            (($pixel.R -shr 5) -shl 6) -bor
                            (($pixel.G -shr 5) -shl 3) -bor
                            ($pixel.B -shr 5)
                        )
                    }
                }
                $hasRenderedContent = (
                    $sampleCount -gt 0 -and
                    ($contentPixels * 100) -ge ($sampleCount * 5) -and
                    $buckets.Count -ge 4
                )
                if ($hasRenderedContent) {
                    try {
                        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
                    } finally {
                        $bitmap.Dispose()
                    }
                    return [PSCustomObject]@{
                        width = $width
                        height = $height
                        windowHandle = $Window.ToInt64().ToString()
                    }
                }
                $bitmap.Dispose()
            }
        }

        $remaining = [uint32][Math]::Max(
            1,
            [Math]::Min(250, ($Deadline - [System.DateTime]::UtcNow).TotalMilliseconds)
        )
        $waitResult = [CavalryLiveWindow]::WaitForSingleObject($Process.Handle, $remaining)
        Assert-Condition -Condition ($waitResult -ne 0) `
            -Message "Cavalry process $ExpectedProcessId exited before its window rendered."
    }
    throw "Timed out waiting for Cavalry process $ExpectedProcessId to render a non-blank frame."
}

function Close-ExactProcessWindows {
    param(
        [Parameter(Mandatory = $true)]
        [System.Diagnostics.Process]$Process,
        [Parameter(Mandatory = $true)]
        [int]$ExpectedProcessId,
        [Parameter(Mandatory = $true)]
        [System.DateTime]$Deadline
    )

    $discardConfirmationSent = $false
    while ([System.DateTime]::UtcNow -lt $Deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            return $true
        }
        $windows = [CavalryLiveWindow]::FindTopLevelWindows([uint32]$ExpectedProcessId)
        foreach ($window in $windows) {
            Assert-Condition `
                -Condition ([CavalryLiveWindow]::PostMessage(
                    $window,
                    [CavalryLiveWindow]::WM_CLOSE,
                    [IntPtr]::Zero,
                    [IntPtr]::Zero
                )) `
                -Message (
                    "Cavalry process $ExpectedProcessId rejected WM_CLOSE on " +
                    "exact window $($window.ToInt64())."
                )
        }
        $remaining = [uint32][Math]::Max(
            1,
            [Math]::Min(500, ($Deadline - [System.DateTime]::UtcNow).TotalMilliseconds)
        )
        if ([CavalryLiveWindow]::WaitForSingleObject($Process.Handle, $remaining) -eq 0) {
            return $true
        }
        if (-not $discardConfirmationSent) {
            $focusWindow = [CavalryLiveWindow]::FindMainWindow(
                [uint32]$ExpectedProcessId
            )
            if (
                $focusWindow -ne [IntPtr]::Zero -and
                [CavalryLiveWindow]::RequestForegroundWindow($focusWindow) -and
                [CavalryLiveWindow]::ExactForegroundWindow(
                    $focusWindow,
                    [uint32]$ExpectedProcessId
                )
            ) {
                # disposable clone 启动后的默认场景天然未保存；仅在前台 PID 再验证后确认“是”。
                [CavalryLiveWindow]::ConfirmDiscardOfDisposableScene()
                $discardConfirmationSent = $true
            }
        }
    }
    return $false
}

if ($Action -eq 'Inventory') {
    ConvertTo-Json -InputObject @(Get-CavalryInventory) -Compress
    exit 0
}

Assert-Condition -Condition ($TimeoutMilliseconds -gt 0) `
    -Message 'TimeoutMilliseconds must be positive.'
Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($ExecutablePath)) `
    -Message 'ExecutablePath is required.'
$ExecutablePath = Assert-DisposableCavalryExecutable -Path $ExecutablePath

if ($Action -eq 'Close') {
    $exact = Get-ExactProcess `
        -Id $TargetProcessId `
        -ExpectedExecutable $ExecutablePath `
        -AllowMissing
    if ($null -eq $exact) {
        ConvertTo-Json -InputObject ([PSCustomObject]@{
            processId = $TargetProcessId
            status = 'already-exited'
        }) -Compress
        exit 0
    }
    $deadline = [System.DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    [void](Wait-ForMainWindow `
        -Process $exact.process `
        -ExpectedProcessId $TargetProcessId `
        -Deadline $deadline)
    Assert-Condition `
        -Condition (Close-ExactProcessWindows `
            -Process $exact.process `
            -ExpectedProcessId $TargetProcessId `
            -Deadline $deadline) `
        -Message "Cavalry process $TargetProcessId did not exit after its graceful close."
    ConvertTo-Json -InputObject ([PSCustomObject]@{
        processId = $TargetProcessId
        status = 'closed'
    }) -Compress
    exit 0
}

foreach ($required in @(
    $MarkerPath,
    $Language,
    $EvidenceRoot,
    $OutputPath
)) {
    Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($required)) `
        -Message 'Capture requires marker, language, evidence, and output paths.'
}
$evidence = Normalize-Path -Path $EvidenceRoot
$markerTarget = Normalize-Path -Path $MarkerPath
$outputTarget = Normalize-Path -Path $OutputPath
Assert-Condition -Condition (Test-Path -LiteralPath $evidence -PathType Container) `
    -Message "Evidence root does not exist: $evidence"
$tempRoot = Normalize-Path -Path ([System.IO.Path]::GetTempPath())
Assert-NoReparseTargetChain -Root $tempRoot -Target $evidence -Role 'evidence root'
$sentinel = Join-Path $evidence $disposableSentinel
Assert-Condition `
    -Condition (Test-Path -LiteralPath $sentinel -PathType Leaf) `
    -Message "Evidence root is missing $disposableSentinel."
Assert-NoReparseTargetChain -Root $evidence -Target $sentinel -Role 'evidence sentinel'
Assert-NoReparseTargetChain -Root $evidence -Target $markerTarget -Role 'runtime marker'
Assert-NoReparseTargetChain -Root $evidence -Target $outputTarget -Role 'screenshot'
Assert-Condition -Condition (-not (Test-Path -LiteralPath $outputTarget)) `
    -Message "Refusing to overwrite screenshot evidence: $outputTarget"

$exact = Get-ExactProcess -Id $TargetProcessId -ExpectedExecutable $ExecutablePath
$deadline = [System.DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
$marker = Wait-ForExtensionLayerMarker `
    -Process $exact.process `
    -Path $markerTarget `
    -ExpectedLanguage $Language `
    -ExpectedProcessId $TargetProcessId `
    -Deadline $deadline
$window = Wait-ForMainWindow `
    -Process $exact.process `
    -ExpectedProcessId $TargetProcessId `
    -Deadline $deadline
$cogPitchBaseline = $null
if ($CaptureScenario -ceq 'CogPitch') {
    Assert-Condition -Condition $AllowManualCogPitch.IsPresent `
        -Message 'CogPitch requires the explicit -AllowManualCogPitch opt-in.'
    $marker = Wait-ForExtensionLayerMarker `
        -Process $exact.process `
        -Path $markerTarget `
        -ExpectedLanguage $Language `
        -ExpectedProcessId $TargetProcessId `
        -Deadline $deadline
    $cogPitchBaseline = $marker.extensionLayerTextPathDiagnostics
    Assert-Condition -Condition ($null -ne $cogPitchBaseline) `
        -Message 'CogPitch baseline is missing text-path diagnostics.'
    Assert-Condition -Condition ([uint64]$cogPitchBaseline.rendererFailure -eq 0) `
        -Message 'CogPitch baseline already contains a renderer failure.'
    Assert-Condition -Condition ([int]$cogPitchBaseline.fallbackSourceMask -eq 0) `
        -Message 'CogPitch baseline already contains a translated-source fallback.'
    Assert-Condition `
        -Condition (([int]$cogPitchBaseline.translatedSourceMask -band 0x00400000) -eq 0) `
        -Message 'CogPitch baseline contains a pre-set Pitch bit 22; restart the owned clone before collecting evidence.'
}
$interactionEvidence = switch ($CaptureScenario) {
    'ViewportQuality' {
        'viewport-quality=initial-empty-scene;path-pixels=manual-review-required'
    }
    'TransformHelper' {
        Prepare-ToolHelperEvidence `
            -Process $exact.process `
            -Window $window `
            -ExpectedProcessId $TargetProcessId `
            -Deadline $deadline `
            -Tool 'Transform'
    }
    'EditShapeHelper' {
        Prepare-ToolHelperEvidence `
            -Process $exact.process `
            -Window $window `
            -ExpectedProcessId $TargetProcessId `
            -Deadline $deadline `
            -Tool 'EditShape'
    }
    'CogPitch' {
        Wait-ForExactForegroundWindow `
            -Process $exact.process `
            -Window $window `
            -ExpectedProcessId $TargetProcessId `
            -Deadline $deadline `
            -Operation 'manual Cogwheel Tool Pitch Radius evidence'
        'cog-pitch-trigger=manual-disposable-cogwheel-drag;path-pixels=manual-review-required'
    }
}
$requiredTextPathMask = switch ($CaptureScenario) {
    'ViewportQuality' { 0x0001 }
    'TransformHelper' { 0x7C00 }
    'EditShapeHelper' { 0x03F0 }
    'CogPitch' { 0x00400000 }
    default { 0 }
}
$diagnosticArguments = @{
    Process = $exact.process
    Path = $markerTarget
    ExpectedProcessId = $TargetProcessId
    RequiredSourceMask = $requiredTextPathMask
    Deadline = $deadline
}
if ($null -ne $cogPitchBaseline) {
    $diagnosticArguments['BaselineDiagnostics'] = $cogPitchBaseline
}
$marker = Wait-ForTextPathDiagnostics @diagnosticArguments
$capture = Capture-MainWindow `
    -Window $window `
    -Process $exact.process `
    -ExpectedProcessId $TargetProcessId `
    -Deadline $deadline `
    -Destination $outputTarget
Assert-NoReparseTargetChain -Root $evidence -Target $outputTarget -Role 'written screenshot'
Assert-Condition -Condition (Test-Path -LiteralPath $outputTarget -PathType Leaf) `
    -Message "Screenshot was not written: $outputTarget"

ConvertTo-Json -InputObject ([PSCustomObject]@{
    processId = $TargetProcessId
    executablePath = $exact.executablePath
    language = [string]$marker.language
    qtVersion = [string]$marker.qtVersion
    translationSource = [string]$marker.translationSource
    embeddedEntryCount = [int]$marker.embeddedEntryCount
    exactKeyCount = [int]$marker.exactKeyCount
    sourceFallbackCount = [int]$marker.sourceFallbackCount
    extensionLayerHookStatus = [string]$marker.extensionLayerHookStatus
    extensionLayerTextPathDiagnostics = $marker.extensionLayerTextPathDiagnostics
    textPathBaselineDiagnostics = $cogPitchBaseline
    windowHandle = [string]$capture.windowHandle
    width = [int]$capture.width
    height = [int]$capture.height
    outputPath = $outputTarget
    captureScenario = $CaptureScenario
    interactionEvidence = $interactionEvidence
}) -Compress
