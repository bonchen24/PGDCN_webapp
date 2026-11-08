<#
.SYNOPSIS
  Helper script for Codex CLI Orchestrator to reliably invoke Antigravity CLI (AGY).
.DESCRIPTION
  Streams bounded progress while reading both AGY pipes, runs once, and preserves
  the final stream-json result and process exit status.
#>
[CmdletBinding()]
param(
  [string]$Prompt,
  [string]$PromptFile,
  [Parameter(Mandatory=$false)]
  [string]$Workspace = (Get-Location).Path,
  [string]$Model = "",
  [string]$Effort = "",
  [int]$MaxRetries = 0,
  [string]$AgyPath = "",
  [ValidateRange(0, 86400)]
  [int]$TimeoutSeconds = 0
)

$ErrorActionPreference = 'Stop'

if ($MaxRetries -ne 0) {
  [Console]::Error.WriteLine('[c2c-invoke-agy] Automatic retries are disabled; use -MaxRetries 0 and fall back to Codex after failure.')
  exit 1
}

if (-not $PSBoundParameters.ContainsKey('Model')) {
  if (-not [string]::IsNullOrWhiteSpace($env:C2C_AGY_MODEL)) {
    $Model = $env:C2C_AGY_MODEL
  } elseif ([string]::IsNullOrWhiteSpace($AgyPath)) {
    $Model = 'gemini-3.8-flash-medium'
  }
}

if (-not $PSBoundParameters.ContainsKey('Effort') -and -not [string]::IsNullOrWhiteSpace($env:C2C_AGY_EFFORT)) {
  $Effort = $env:C2C_AGY_EFFORT
}

if ($TimeoutSeconds -le 0) {
  $timeoutMinutes = 90
  $configuredMinutes = $env:C2C_AGY_TIMEOUT_MINUTES
  if ([string]::IsNullOrWhiteSpace($configuredMinutes)) { $configuredMinutes = $env:C2C_GEMINI_TIMEOUT_MINUTES }
  $parsedMinutes = 0
  if ([int]::TryParse($configuredMinutes, [ref]$parsedMinutes) -and $parsedMinutes -gt 0 -and $parsedMinutes -le 1440) {
    $timeoutMinutes = $parsedMinutes
  }
  $TimeoutSeconds = $timeoutMinutes * 60
} elseif ([string]::IsNullOrWhiteSpace($AgyPath) -and $TimeoutSeconds -lt 600) {
  [Console]::Error.WriteLine("[c2c-invoke-agy] Requested TimeoutSeconds ($TimeoutSeconds) is below 600s floor; clamping to 600s.")
  $TimeoutSeconds = 600
}

if ($PSBoundParameters.ContainsKey('PromptFile')) {
  $promptPath = if ([System.IO.Path]::IsPathRooted($PromptFile)) { $PromptFile } else { Join-Path $Workspace $PromptFile }
  if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) { throw "Prompt file not found: $promptPath" }
  $Prompt = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $promptPath).Path, [System.Text.Encoding]::UTF8)
} elseif (-not $PSBoundParameters.ContainsKey('Prompt')) {
  throw 'Provide either -PromptFile or -Prompt.'
}

$resolvedWorkspace = try { (Resolve-Path -LiteralPath $Workspace).Path } catch { $Workspace }

if ([string]::IsNullOrWhiteSpace($AgyPath)) {
  $fastHeader = @"
[AGY 2.0 FAST EXECUTION CONTRACT — WORKSPACE: $resolvedWorkspace]
1. CRITICAL TOOL SCHEMAS (Relative paths & wrong parameter names ALWAYS fail validation):
   - read_file:   {"Path": "$resolvedWorkspace\<file>", "StartLine": 1, "EndLine": 400}  (Path MUST be ABSOLUTE; never use AbsolutePath or filePath)
   - edit_file:   {"Path": "$resolvedWorkspace\<file>", "Target": "<exact text>", "Replacement": "<new text>"}  (Path MUST be ABSOLUTE)
   - write_file:  {"Path": "$resolvedWorkspace\<file>", "Content": "<text>", "Overwrite": true}  (Path MUST be ABSOLUTE)
   - run_command: {"CommandLine": "<cmd>", "WaitMsBeforeAsync": 30000, "toolSummary": "<short label>"}  (All 3 fields are REQUIRED)
2. SPEED RULES:
   - Do NOT read AGENTS.md, design.md, or SKILL.md files (context is already supplied below).
   - Do NOT call MCP/Obsidian tools.
   - Read target file(s) using absolute Path, apply surgical edit, run the single focused test, and reply concisely.

"@
  $Prompt = $fastHeader + $Prompt
}

if ($env:Path -notmatch "Git\\cmd") { $env:Path = "$env:Path;C:\Program Files\Git\cmd" }

$agyPrefixArgs = @()
if ([string]::IsNullOrWhiteSpace($AgyPath)) {
  $agy = Get-Command agy.exe -ErrorAction SilentlyContinue
  if (-not $agy) {
    $candidate = "$env:LOCALAPPDATA\agy\bin\agy.exe"
    if (Test-Path $candidate) { $agyCmd = $candidate }
    else { [Console]::Error.WriteLine("[c2c-invoke-agy] AGY CLI executable not found in PATH or $candidate"); exit 127 }
  } else {
    $agyCmd = $agy.Source
  }
} else {
  if (-not (Test-Path -LiteralPath $AgyPath -PathType Leaf)) { throw "AGY executable not found: $AgyPath" }
  $agyCmd = (Resolve-Path -LiteralPath $AgyPath).Path
}

if ([System.IO.Path]::GetExtension($agyCmd) -ieq '.ps1') {
  $powershell = Get-Command powershell.exe -ErrorAction SilentlyContinue
  if (-not $powershell) { throw 'powershell.exe is required to launch a PowerShell AGY wrapper.' }
  $agyPrefixArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $agyCmd)
  $agyCmd = $powershell.Source
}

function Write-AgyProgress {
  param([string]$Message)
  if ($script:progressMessages -ge 100) {
    if ($script:progressMessages -eq 100) { [Console]::Error.WriteLine('[c2c-invoke-agy] AGY progress: further details suppressed; process remains monitored.') }
    $script:progressMessages++
    return
  }
  $clean = ($Message -replace '[\r\n\t]+', ' ').Trim()
  if ($clean.Length -gt 240) { $clean = $clean.Substring(0, 237) + '...' }
  [Console]::Error.WriteLine("[c2c-invoke-agy] AGY progress: $clean")
  $script:progressMessages++
}

function Add-AgyStdoutLine {
  param([string]$Line)
  [void]$script:stdoutBuilder.AppendLine($Line)
  $script:stdoutLines++
  try {
    $record = $Line | ConvertFrom-Json -ErrorAction Stop
    if ($record.event -eq 'result') {
      $script:resultEvent = $record.result
      $status = if ($record.result.status) { [string]$record.result.status } else { 'missing status' }
      Write-AgyProgress "result event received ($status)"
    } elseif ($record.event -eq 'step_update') {
      $update = $record.step_update
      if ($update.step_type -eq 'tool') {
        Write-AgyProgress "tool $($update.state): $($update.tool_name)"
      } elseif ($update.step_type -eq 'agent_response' -and $update.text_delta) {
        Write-AgyProgress "agent response updated ($(([string]$update.text_delta).Length) characters)"
      }
    }
  } catch {
    if ($script:stdoutLines -eq 1) { Write-AgyProgress 'stdout received' }
  }
}

function Drain-AgyReadTasks {
  while ($script:stdoutReadTask -and $script:stdoutReadTask.IsCompleted) {
    $line = $script:stdoutReadTask.GetAwaiter().GetResult()
    if ($null -eq $line) {
      $script:stdoutReadTask = $null
    } else {
      Add-AgyStdoutLine $line
      $script:stdoutReadTask = $script:proc.StandardOutput.ReadLineAsync()
    }
  }
  while ($script:stderrReadTask -and $script:stderrReadTask.IsCompleted) {
    $line = $script:stderrReadTask.GetAwaiter().GetResult()
    if ($null -eq $line) {
      $script:stderrReadTask = $null
    } else {
      [void]$script:stderrBuilder.AppendLine($line)
      $script:stderrLines++
      [Console]::Error.WriteLine("[c2c-invoke-agy][stderr] $line")
      $script:stderrReadTask = $script:proc.StandardError.ReadLineAsync()
    }
  }
}

function Stop-OwnedAgyProcessTree {
  param([System.Diagnostics.Process]$Process, [datetime]$ExpectedStartTime)
  try {
    if ($Process.HasExited) { return $true }
    try {
      $Process.Kill($true)
    } catch {
      if ($env:OS -ne 'Windows_NT') { throw 'Process tree termination is unavailable on this runtime.' }
      $current = Get-Process -Id $Process.Id -ErrorAction SilentlyContinue
      if (-not $current) { return $Process.HasExited }
      $deltaMs = [Math]::Abs(($current.StartTime.ToUniversalTime() - $ExpectedStartTime).TotalMilliseconds)
      if ([double]::IsNaN($deltaMs) -or [double]::IsInfinity($deltaMs) -or $deltaMs -gt 1000) {
        [Console]::Error.WriteLine("[c2c-invoke-agy] Refusing to terminate PID $($Process.Id): process identity changed.")
        return $false
      }
      $taskkillInfo = New-Object System.Diagnostics.ProcessStartInfo
      $taskkillInfo.FileName = Join-Path $env:SystemRoot 'System32\taskkill.exe'
      $taskkillInfo.Arguments = "/PID $($Process.Id) /T /F"
      $taskkillInfo.UseShellExecute = $false
      $taskkillInfo.CreateNoWindow = $true
      $taskkill = [System.Diagnostics.Process]::Start($taskkillInfo)
      try { [void]$taskkill.WaitForExit(5000) } finally { $taskkill.Dispose() }
      if (-not $Process.HasExited) { return $false }
    }
    [void]$Process.WaitForExit(5000)
    return $Process.HasExited
  } catch {
    [Console]::Error.WriteLine("[c2c-invoke-agy] Could not confirm owned process-tree termination: $($_.Exception.Message)")
    return $false
  }
}

$processArgs = @('--mode', 'accept-edits', '--dangerously-skip-permissions', '--disable-slash-commands', '--input-format', 'stream-json', '--output-format', 'stream-json')
if (-not [string]::IsNullOrWhiteSpace($Model)) { $processArgs = @('--model', $Model) + $processArgs }
if (-not [string]::IsNullOrWhiteSpace($Effort)) { $processArgs += @('--effort', $Effort) }
$launchArgs = @($agyPrefixArgs) + @($processArgs)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $agyCmd
$argumentListProperty = $psi.GetType().GetProperty('ArgumentList')
if ($argumentListProperty) {
  $argumentList = $argumentListProperty.GetValue($psi)
  foreach ($argument in $launchArgs) { $argumentList.Add($argument) }
} else {
  $psi.Arguments = ($launchArgs | ForEach-Object { '"' + ($_ -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"' }) -join ' '
}
$psi.WorkingDirectory = $Workspace
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

$proc = $null
$processStartTime = [datetime]::MinValue
$processExited = $false
$timedOut = $false
$exitCode = 1
$combined = ''
$lastOutput = ''
$script:stdoutBuilder = New-Object System.Text.StringBuilder
$script:stderrBuilder = New-Object System.Text.StringBuilder
$script:resultEvent = $null
$script:stdoutLines = 0
$script:stderrLines = 0
$script:progressMessages = 0
$startedAt = [datetime]::UtcNow
$script:stdoutReadTask = $null
$script:stderrReadTask = $null
$script:proc = $null

try {
  Write-Host "[c2c-invoke-agy] Invoking AGY CLI (timeout: $TimeoutSeconds seconds; single attempt)..."
  $proc = [System.Diagnostics.Process]::Start($psi)
  $script:proc = $proc
  $processStartTime = $proc.StartTime.ToUniversalTime()
  $script:stdoutReadTask = $proc.StandardOutput.ReadLineAsync()
  $script:stderrReadTask = $proc.StandardError.ReadLineAsync()

  $userEvent = [ordered]@{ event = 'user'; message = [ordered]@{ content = $Prompt } } | ConvertTo-Json -Compress -Depth 4
  $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($userEvent + "`n")
  $proc.StandardInput.BaseStream.Write($utf8Bytes, 0, $utf8Bytes.Length)
  $proc.StandardInput.BaseStream.Flush()
  $proc.StandardInput.Close()

  $deadline = [datetime]::UtcNow.AddSeconds($TimeoutSeconds)
  $nextHeartbeat = [datetime]::UtcNow.AddSeconds(15)
  while (-not $processExited -and -not $timedOut) {
    Drain-AgyReadTasks
    if ($proc.HasExited -and -not $script:stdoutReadTask -and -not $script:stderrReadTask) {
      $processExited = $true
      break
    }
    if ([datetime]::UtcNow -ge $deadline) {
      $timedOut = $true
      if (-not (Stop-OwnedAgyProcessTree $proc $processStartTime)) {
        [Console]::Error.WriteLine('[c2c-invoke-agy] Timeout cleanup could not confirm process-tree exit.')
      }
      if ($proc.WaitForExit(5000)) { $processExited = $true }
      $drainDeadline = [datetime]::UtcNow.AddSeconds(5)
      while ((($script:stdoutReadTask) -or ($script:stderrReadTask)) -and [datetime]::UtcNow -lt $drainDeadline) {
        Drain-AgyReadTasks
        Start-Sleep -Milliseconds 20
      }
      break
    }
    if ([datetime]::UtcNow -ge $nextHeartbeat) {
      $elapsed = [int]([datetime]::UtcNow - $startedAt).TotalSeconds
      [Console]::Error.WriteLine("[c2c-invoke-agy] AGY still running (${elapsed}s; stdout=$($script:stdoutLines) lines, stderr=$($script:stderrLines) lines; pid=$($proc.Id)).")
      $nextHeartbeat = [datetime]::UtcNow.AddSeconds(15)
    }
    [void]$proc.WaitForExit(100)
  }
  Drain-AgyReadTasks

  $stdout = $script:stdoutBuilder.ToString()
  $stderr = $script:stderrBuilder.ToString()
  if ($timedOut) {
    $exitCode = 124
    $lastOutput = (@($stderr.Trim(), $stdout.Trim()) | Where-Object { $_ }) -join "`n"
  } else {
    $exitCode = $proc.ExitCode
    $resultEvent = $script:resultEvent
    $response = if ($resultEvent -and ($resultEvent.PSObject.Properties.Name -contains 'response')) { [string]$resultEvent.response } else { '' }
    $errorText = if ($resultEvent -and $resultEvent.error) { [string]$resultEvent.error } else { '' }
    if (-not $resultEvent) {
      $errorText = 'AGY CLI exited without a final result event.'
      if ($exitCode -eq 0) { $exitCode = 1 }
    } elseif ($resultEvent.status -ne 'SUCCESS' -and $exitCode -eq 0) {
      $exitCode = 1
    }
    if ($exitCode -eq 0) { $combined = $response }
    else { $combined = (@($errorText, $stderr.Trim(), $stdout.Trim()) | Where-Object { $_ }) -join "`n" }
    $lastOutput = $combined
  }
} catch {
  $lastOutput = $_.Exception.Message
  [Console]::Error.WriteLine("[c2c-invoke-agy] AGY process failed: $lastOutput")
} finally {
  if ($proc) {
    if (-not $proc.HasExited) { [void](Stop-OwnedAgyProcessTree $proc $processStartTime) }
    try { $proc.StandardInput.Close() } catch {}
    if (-not $proc.HasExited) { [void]$proc.WaitForExit(5000) }
    $drainDeadline = [datetime]::UtcNow.AddSeconds(5)
    while ((($script:stdoutReadTask) -or ($script:stderrReadTask)) -and [datetime]::UtcNow -lt $drainDeadline) {
      try { Drain-AgyReadTasks } catch { break }
      Start-Sleep -Milliseconds 20
    }
    $proc.Dispose()
  }
}

if ($timedOut) {
  [Console]::Error.WriteLine("[c2c-invoke-agy] AGY CLI timed out after $TimeoutSeconds seconds. No automatic retry was made. Inspect git status and git diff before retrying. $lastOutput")
  exit 124
}
if ($exitCode -eq 0) {
  Write-Host '[c2c-invoke-agy] AGY CLI completed successfully.'
  Write-Output $combined
  exit 0
}

[Console]::Error.WriteLine("[c2c-invoke-agy] AGY CLI failed with exit code ${exitCode}; no automatic retry was made. Inspect git status and git diff before retrying. $lastOutput")
exit 1
