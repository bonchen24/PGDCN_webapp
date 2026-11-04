<#
.SYNOPSIS
  Helper script for Codex CLI Orchestrator to reliably invoke Antigravity CLI (AGY).
.DESCRIPTION
  Handles AGY CLI invocation with proper model, effort, permissions, mode flags,
  timeout handling, and retry with backoff.
#>
[CmdletBinding()]
param(
  [string]$Prompt,
  [string]$PromptFile,
  [Parameter(Mandatory=$false)]
  [string]$Workspace = (Get-Location).Path,
  [string]$Model = "gemini-3.8-flash",
  [string]$Effort = "medium",
  [int]$MaxRetries = 0,
  [int]$TimeoutSeconds = 0
)

$ErrorActionPreference = 'Stop'

if ($TimeoutSeconds -le 0) {
  $timeoutMinutes = 90
  if (-not [string]::IsNullOrWhiteSpace($env:C2C_AGY_TIMEOUT_MINUTES)) {
    $parsedTimeoutMinutes = 0
    if (-not [int]::TryParse($env:C2C_AGY_TIMEOUT_MINUTES, [ref]$parsedTimeoutMinutes) -or $parsedTimeoutMinutes -le 0) {
      throw 'C2C_AGY_TIMEOUT_MINUTES must be a positive integer.'
    }
    $timeoutMinutes = $parsedTimeoutMinutes
  }
  $TimeoutSeconds = $timeoutMinutes * 60
}

if ($PSBoundParameters.ContainsKey('PromptFile')) {
  $promptPath = if ([System.IO.Path]::IsPathRooted($PromptFile)) {
    $PromptFile
  } else {
    Join-Path $Workspace $PromptFile
  }
  if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) {
    throw "Prompt file not found: $promptPath"
  }
  $Prompt = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $promptPath).Path, [System.Text.Encoding]::UTF8)
} elseif (-not $PSBoundParameters.ContainsKey('Prompt')) {
  throw 'Provide either -PromptFile or -Prompt.'
}

# Ensure Git is in PATH
if ($env:Path -notmatch "Git\\cmd") {
  $env:Path = "$env:Path;C:\Program Files\Git\cmd"
}

# Locate agy.exe
$agy = Get-Command agy.exe -ErrorAction SilentlyContinue
if (-not $agy) {
  $candidate = "$env:LOCALAPPDATA\agy\bin\agy.exe"
  if (Test-Path $candidate) {
    $agyCmd = $candidate
  } else {
    Write-Error "[c2c-invoke-agy] AGY CLI executable not found in PATH or $candidate"
    exit 127
  }
} else {
  $agyCmd = $agy.Source
}

$attempt = 0
$succeeded = $false
$lastOutput = ""

while ($attempt -le $MaxRetries -and -not $succeeded) {
  $attempt++
  Write-Host "[c2c-invoke-agy] Invoking AGY CLI (attempt $attempt/$($MaxRetries + 1))..."

  $processArgs = @(
    "--model", $Model,
    "--effort", $Effort,
    "--mode", "accept-edits",
    "--dangerously-skip-permissions",
    "--input-format", "stream-json",
    "--output-format", "stream-json"
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $agyCmd
  $argumentListProperty = $psi.GetType().GetProperty('ArgumentList')
  if ($argumentListProperty) {
    $argumentList = $argumentListProperty.GetValue($psi)
    foreach ($argument in $processArgs) { $argumentList.Add($argument) }
  } else {
    $psi.Arguments = ($processArgs | ForEach-Object { '"' + ($_ -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"' }) -join ' '
  }
  $psi.WorkingDirectory = $Workspace
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

  $proc = [System.Diagnostics.Process]::Start($psi)
  $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
  $stderrTask = $proc.StandardError.ReadToEndAsync()
  $userEvent = [ordered]@{ event = 'user'; message = [ordered]@{ content = $Prompt } } | ConvertTo-Json -Compress -Depth 4
  $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($userEvent + "`n")
  $proc.StandardInput.BaseStream.Write($utf8Bytes, 0, $utf8Bytes.Length)
  $proc.StandardInput.BaseStream.Flush()
  $proc.StandardInput.Close()

  $finished = $proc.WaitForExit($TimeoutSeconds * 1000)
  if (-not $finished) {
    try { $proc.Kill() } catch {}
    Write-Warning "[c2c-invoke-agy] Attempt $attempt timed out after $TimeoutSeconds seconds."
    continue
  }

  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  $exitCode = $proc.ExitCode
  $resultEvent = $null
  foreach ($line in ($stdout -split "`r?`n")) {
    if (-not $line) { continue }
    try {
      $event = $line | ConvertFrom-Json
      if ($event.event -eq 'result') { $resultEvent = $event.result }
    } catch { }
  }
  $response = if ($resultEvent -and $resultEvent.response) { [string]$resultEvent.response } else { '' }
  $errorText = if ($resultEvent -and $resultEvent.error) { [string]$resultEvent.error } else { '' }
  if ($resultEvent -and $resultEvent.status -ne 'SUCCESS' -and $exitCode -eq 0) { $exitCode = 1 }
  $combined = if ($exitCode -eq 0) { $response } else { (@($errorText, $stderr.Trim(), $stdout.Trim()) | Where-Object { $_ }) -join "`n" }
  $lastOutput = $combined

  if ($exitCode -eq 0) {
    $succeeded = $true
    Write-Host "[c2c-invoke-agy] AGY CLI completed successfully (attempt $attempt)."
    Write-Output $combined
    exit 0
  } else {
    Write-Warning "[c2c-invoke-agy] Attempt $attempt failed with exit code ${exitCode}: $combined"
    if ($attempt -le $MaxRetries) {
      Start-Sleep -Seconds 2
    }
  }
}

Write-Error "[c2c-invoke-agy] AGY CLI failed after $($MaxRetries + 1) attempts: $lastOutput"
exit 1
