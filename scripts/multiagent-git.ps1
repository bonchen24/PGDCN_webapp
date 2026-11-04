<#
.SYNOPSIS
  Multi-Agent Git Integration Tool for Antigravity Desktop & Codex-AGY.
.DESCRIPTION
  Standardizes Git branching, worktrees, commit verification, Prisma migration checks,
  merge dry-runs, and safe cleanup for concurrent agent workflows without collisions.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet("Status", "New-Worktree", "Verify", "Check-Merge", "Integrate", "Remove-Worktree", "Check-Prisma")]
  [string]$Action,

  [Parameter(Mandatory=$false)]
  [string]$Workspace = (Get-Location).Path,

  [Parameter(Mandatory=$false)]
  [ValidateSet("antigravity", "c2c", "codex", "integration")]
  [string]$Agent = "c2c",

  [Parameter(Mandatory=$false)]
  [string]$TaskId = "",

  [Parameter(Mandatory=$false)]
  [string]$BaseBranch = "main",

  [Parameter(Mandatory=$false)]
  [string]$TargetBranch = "main",

  [Parameter(Mandatory=$false)]
  [string]$WorktreePath = "",

  [Parameter(Mandatory=$false)]
  [string]$TestCommand = "",

  [Parameter(Mandatory=$false)]
  [string]$CommitMessage = "",

  [Parameter(Mandatory=$false)]
  [string[]]$AllowedFiles = @(),

  [Parameter(Mandatory=$false)]
  [switch]$Force = $false
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  param([string]$Dir, [string[]]$GitArgs)
  $pinfo = New-Object System.Diagnostics.ProcessStartInfo
  $pinfo.FileName = "git"
  $pinfo.WorkingDirectory = $Dir
  $pinfo.RedirectStandardOutput = $true
  $pinfo.RedirectStandardError = $true
  $pinfo.UseShellExecute = $false
  $pinfo.CreateNoWindow = $true
  $pinfo.Arguments = ($GitArgs | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }) -join ' '

  $p = [System.Diagnostics.Process]::Start($pinfo)
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  return [PSCustomObject]@{
    ExitCode = $p.ExitCode
    Stdout   = $stdout.Trim()
    Stderr   = $stderr.Trim()
    Success  = ($p.ExitCode -eq 0)
  }
}

# Resolve repo root
$repoCheck = Invoke-Git -Dir $Workspace -GitArgs @("rev-parse", "--show-toplevel")
if (-not $repoCheck.Success) {
  Write-Error "Workspace is not inside a Git repository: $Workspace"
  exit 1
}
$RepoRoot = $repoCheck.Stdout

# Ensure .worktrees/ is ignored in .gitignore
function Ensure-WorktreeGitIgnore {
  param([string]$Root)
  $giPath = Join-Path $Root ".gitignore"
  $pattern = ".worktrees/"
  if (Test-Path $giPath) {
    $content = Get-Content -LiteralPath $giPath -Raw
    if ($content -notmatch "\.worktrees") {
      Add-Content -LiteralPath $giPath -Value "`n# Multi-agent isolated worktrees`n.worktrees/`n"
      Write-Host "[git-multiagent] Added .worktrees/ to .gitignore"
    }
  } else {
    Set-Content -LiteralPath $giPath -Value "# Multi-agent isolated worktrees`n.worktrees/`n"
    Write-Host "[git-multiagent] Created .gitignore with .worktrees/"
  }
}

# Standardized branch naming convention
function Get-BranchName {
  param([string]$Ag, [string]$Id)
  if ([string]::IsNullOrWhiteSpace($Id)) {
    throw "TaskId is required to generate branch name."
  }
  $cleanId = $Id -replace '[^a-zA-Z0-9_\-\.]', '-'
  switch ($Ag.ToLower()) {
    "antigravity" { return "task/antigravity/$cleanId" }
    "codex"       { return "task/c2c/$cleanId" }
    "c2c"         { return "task/c2c/$cleanId" }
    "integration" { return "integration/$cleanId" }
    default       { return "task/c2c/$cleanId" }
  }
}

switch ($Action) {
  "Status" {
    $branch = (Invoke-Git -Dir $Workspace -GitArgs @("branch", "--show-current")).Stdout
    $commit = (Invoke-Git -Dir $Workspace -GitArgs @("rev-parse", "--short", "HEAD")).Stdout
    $dirtyCheck = (Invoke-Git -Dir $Workspace -GitArgs @("status", "--porcelain")).Stdout
    $worktrees = (Invoke-Git -Dir $RepoRoot -GitArgs @("worktree", "list")).Stdout

    Write-Host "=== Git Multi-Agent Workspace Status ==="
    Write-Host "Repository Root: $RepoRoot"
    Write-Host "Current Directory: $Workspace"
    Write-Host "Current Branch: $(if ($branch) { $branch } else { '(detached HEAD)' })"
    Write-Host "Commit: $commit"
    Write-Host "Working Tree Clean: $(if (-not $dirtyCheck) { 'YES' } else { 'NO (Uncommitted changes present)' })"
    Write-Host ""
    Write-Host "Active Worktrees:"
    Write-Host $worktrees
    break
  }

  "New-Worktree" {
    if ([string]::IsNullOrWhiteSpace($TaskId)) {
      Write-Error "Param -TaskId is mandatory for New-Worktree."
      exit 1
    }

    Ensure-WorktreeGitIgnore -Root $RepoRoot
    $branchName = Get-BranchName -Ag $Agent -Id $TaskId

    $targetDir = if (-not [string]::IsNullOrWhiteSpace($WorktreePath)) {
      $WorktreePath
    } else {
      $sanitizedName = ($branchName -replace '/', '-')
      Join-Path (Join-Path $RepoRoot ".worktrees") $sanitizedName
    }

    if (Test-Path $targetDir) {
      Write-Error "Worktree directory already exists: $targetDir"
      exit 1
    }

    # Verify if branch already exists
    $branchExists = (Invoke-Git -Dir $RepoRoot -GitArgs @("rev-parse", "--verify", $branchName)).Success

    Write-Host "[git-multiagent] Creating worktree for $Agent on branch $branchName at $targetDir..."
    $addArgs = if ($branchExists) {
      @("worktree", "add", $targetDir, $branchName)
    } else {
      @("worktree", "add", "-b", $branchName, $targetDir, $BaseBranch)
    }

    $addResult = Invoke-Git -Dir $RepoRoot -GitArgs $addArgs
    if (-not $addResult.Success) {
      Write-Error "Failed to create worktree: $($addResult.Stderr)"
      exit 1
    }

    Write-Host "[git-multiagent] Worktree created successfully."
    [PSCustomObject]@{
      WorktreePath = $targetDir
      Branch       = $branchName
      BaseBranch   = $BaseBranch
      Agent        = $Agent
      TaskId       = $TaskId
    } | Format-List
    break
  }

  "Verify" {
    $targetDir = if ($WorktreePath) { $WorktreePath } else { $Workspace }
    $statusRes = Invoke-Git -Dir $targetDir -GitArgs @("status", "--porcelain")
    $changedLines = if ($statusRes.Stdout) { $statusRes.Stdout.Split("`n") } else { @() }

    # Diff against base branch
    $diffFilesRes = Invoke-Git -Dir $targetDir -GitArgs @("diff", "--name-only", "$BaseBranch...HEAD")
    $committedFiles = if ($diffFilesRes.Stdout) { $diffFilesRes.Stdout.Split("`n") } else { @() }

    $allFiles = ($changedLines | ForEach-Object { ($_ -replace '^..\s*', '').Trim() }) + $committedFiles | Select-Object -Unique | Where-Object { $_ }

    # Detect sensitive files
    $sensitivePattern = '(?i)(\.env|credentials|secret|id_rsa|service-account.*\.json|\.npmrc)'
    $sensitiveFiles = $allFiles | Where-Object { $_ -match $sensitivePattern }

    # Detect Prisma schema/migration files
    $prismaFiles = $allFiles | Where-Object { $_ -match '(?i)(prisma[\\/]schema\.prisma|prisma[\\/]migrations)' }

    # Check allowed files if provided
    $outOfScope = @()
    if ($AllowedFiles.Count -gt 0) {
      $outOfScope = $allFiles | Where-Object {
        $f = $_
        -not ($AllowedFiles | Where-Object { $f -like "*$_*" })
      }
    }

    $clean = (-not $statusRes.Stdout)
    Write-Host "=== Task Worktree Verification Report ==="
    Write-Host "Target Path: $targetDir"
    Write-Host "Working Tree Clean: $(if ($clean) { 'YES' } else { 'DIRTY (' + $changedLines.Count + ' modified files)' })"
    Write-Host "Total Changed Files: $($allFiles.Count)"
    if ($sensitiveFiles.Count -gt 0) {
      Write-Warning "CRITICAL: Sensitive files modified: $($sensitiveFiles -join ', ')"
    }
    if ($prismaFiles.Count -gt 0) {
      Write-Host "Database Changes Detected: $($prismaFiles -join ', ')" -ForegroundColor Yellow
    }
    if ($outOfScope.Count -gt 0) {
      Write-Warning "Out of Scope Files Modified: $($outOfScope -join ', ')"
    }

    [PSCustomObject]@{
      Clean           = $clean
      ChangedFiles    = $allFiles
      SensitiveFiles  = $sensitiveFiles
      PrismaFiles     = $prismaFiles
      OutOfScopeFiles = $outOfScope
      Status          = if ($sensitiveFiles.Count -gt 0 -or $outOfScope.Count -gt 0) { "FAIL" } else { "PASS" }
    }
    break
  }

  "Check-Prisma" {
    $targetDir = if ($WorktreePath) { $WorktreePath } else { $Workspace }
    $diffFiles = (Invoke-Git -Dir $targetDir -GitArgs @("diff", "--name-only", "$BaseBranch...HEAD")).Stdout
    $prismaChanged = $diffFiles -split "`n" | Where-Object { $_ -match '(?i)prisma[\\/]' }

    if (-not $prismaChanged) {
      Write-Host "[Check-Prisma] No Prisma schema or migration changes detected."
      return
    }

    Write-Host "[Check-Prisma] Changes detected in: $($prismaChanged -join ', ')" -ForegroundColor Yellow

    # Check for destructive SQL in migrations
    $migrationSql = (Invoke-Git -Dir $targetDir -GitArgs @("diff", "$BaseBranch...HEAD", "--", "prisma/migrations")).Stdout
    $hasDestructive = $migrationSql -match '(?i)(DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+TABLE.*DROP)'

    if ($hasDestructive) {
      Write-Warning "[Check-Prisma] CAUTION: Destructive SQL detected (DROP TABLE / DROP COLUMN)!"
      Write-Warning "Review migration thoroughly before proceeding."
    } else {
      Write-Host "[Check-Prisma] Migration changes appear non-destructive (no DROP TABLE/COLUMN)." -ForegroundColor Green
    }
    break
  }

  "Check-Merge" {
    $targetDir = if ($WorktreePath) { $WorktreePath } else { $Workspace }
    $currentBranch = (Invoke-Git -Dir $targetDir -GitArgs @("branch", "--show-current")).Stdout
    if (-not $currentBranch) {
      Write-Error "Cannot check merge from detached HEAD. Please checkout task branch."
      exit 1
    }

    # Find common merge base
    $baseRes = Invoke-Git -Dir $RepoRoot -GitArgs @("merge-base", $TargetBranch, $currentBranch)
    if (-not $baseRes.Success) {
      Write-Error "Could not find merge base between $TargetBranch and $currentBranch"
      exit 1
    }
    $baseCommit = $baseRes.Stdout

    # Perform dry-run merge-tree
    $treeRes = Invoke-Git -Dir $RepoRoot -GitArgs @("merge-tree", $baseCommit, $TargetBranch, $currentBranch)
    $hasConflict = ($treeRes.Stdout -match '(?m)^\+{7}\s' -or $treeRes.Stdout -match '(?m)^<{7}\s')

    if ($hasConflict) {
      Write-Warning "[Check-Merge] CONFLICT DETECTED between $currentBranch and $TargetBranch."
      Write-Warning "Automated merge will fail. Manual conflict resolution required."
      return [PSCustomObject]@{
        CanMergeCleanly = $false
        Conflict        = $true
        BaseCommit      = $baseCommit
      }
    } else {
      Write-Host "[Check-Merge] Clean merge possible between $currentBranch and $TargetBranch (no conflicts)." -ForegroundColor Green
      return [PSCustomObject]@{
        CanMergeCleanly = $true
        Conflict        = $false
        BaseCommit      = $baseCommit
      }
    }
    break
  }

  "Integrate" {
    $targetDir = if ($WorktreePath) { $WorktreePath } else { $Workspace }
    $currentBranch = (Invoke-Git -Dir $targetDir -GitArgs @("branch", "--show-current")).Stdout
    if (-not $currentBranch) {
      Write-Error "Cannot integrate from detached HEAD."
      exit 1
    }

    # 1. Verify working directory is clean
    $statusCheck = (Invoke-Git -Dir $targetDir -GitArgs @("status", "--porcelain")).Stdout
    if ($statusCheck) {
      Write-Error "Cannot integrate: Worktree has uncommitted changes. Please commit or stash first."
      exit 1
    }

    # 2. Run test command if specified
    if (-not [string]::IsNullOrWhiteSpace($TestCommand)) {
      Write-Host "[git-multiagent] Running test suite: $TestCommand ..."
      $testProc = Start-Process -FilePath "powershell.exe" -ArgumentList "-Command", $TestCommand -WorkingDirectory $targetDir -NoNewWindow -PassThru -Wait
      if ($testProc.ExitCode -ne 0) {
        Write-Error "Pre-integration test command failed with exit code $($testProc.ExitCode). Integration aborted."
        exit 1
      }
      Write-Host "[git-multiagent] Tests passed successfully." -ForegroundColor Green
    }

    # 3. Check for merge conflicts
    $baseCommit = (Invoke-Git -Dir $RepoRoot -GitArgs @("merge-base", $TargetBranch, $currentBranch)).Stdout
    $treeRes = Invoke-Git -Dir $RepoRoot -GitArgs @("merge-tree", $baseCommit, $TargetBranch, $currentBranch)
    if ($treeRes.Stdout -match '(?m)^\+{7}\s' -or $treeRes.Stdout -match '(?m)^<{7}\s') {
      Write-Error "Integration aborted: Merge conflict detected between $currentBranch and $TargetBranch."
      exit 1
    }

    # 4. Perform merge on target branch in repo root (or worktree)
    Write-Host "[git-multiagent] Merging $currentBranch into $TargetBranch..."
    $msg = if ($CommitMessage) { $CommitMessage } else { "merge: integrate $currentBranch into $TargetBranch" }

    # Checkout target branch in main repo root
    $coRes = Invoke-Git -Dir $RepoRoot -GitArgs @("checkout", $TargetBranch)
    if (-not $coRes.Success) {
      Write-Error "Failed to checkout $TargetBranch in ${RepoRoot}: $($coRes.Stderr)"
      exit 1
    }

    $mergeRes = Invoke-Git -Dir $RepoRoot -GitArgs @("merge", "--no-ff", "-m", $msg, $currentBranch)
    if (-not $mergeRes.Success) {
      Write-Error "Merge failed: $($mergeRes.Stderr)"
      exit 1
    }

    Write-Host "[git-multiagent] Successfully integrated $currentBranch into $TargetBranch." -ForegroundColor Green
    break
  }

  "Remove-Worktree" {
    $targetDir = if ($WorktreePath) { $WorktreePath } else { $Workspace }

    # CRITICAL SAFETY: Never delete worktree with uncommitted changes
    if (Test-Path $targetDir) {
      $statusCheck = (Invoke-Git -Dir $targetDir -GitArgs @("status", "--porcelain")).Stdout
      if ($statusCheck) {
        Write-Error "CRITICAL SAFETY GUARD: Cannot remove worktree at $targetDir because it contains uncommitted changes. Commit or discard changes before removing."
        exit 1
      }
    }

    Write-Host "[git-multiagent] Safely removing clean worktree at $targetDir..."
    $rmRes = Invoke-Git -Dir $RepoRoot -GitArgs @("worktree", "remove", $targetDir)
    if (-not $rmRes.Success) {
      Write-Error "Failed to remove worktree: $($rmRes.Stderr)"
      exit 1
    }

    Write-Host "[git-multiagent] Worktree removed cleanly." -ForegroundColor Green
    break
  }
}
