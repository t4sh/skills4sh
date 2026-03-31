# Install localhost-screenshots skill
# Works on Windows (PowerShell 5.1+).
#
# Usage:
#   .\install.ps1           # interactive prompt
#   .\install.ps1 -Global   # install to $HOME\.claude\skills\localhost-screenshots
#   .\install.ps1 -Project  # install to .\.claude\skills\localhost-screenshots

param(
    [switch]$Global,
    [switch]$Project,
    [switch]$Help
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillName = Split-Path -Leaf $ScriptDir

$GlobalDir = Join-Path $HOME ".claude\skills\$SkillName"
$ProjectDir = Join-Path (Get-Location) ".claude\skills\$SkillName"

if ($Help) {
    Write-Host "Usage: .\install.ps1 [-Global | -Project]"
    exit 0
}

function Install-Skill {
    param([string]$Dest)

    # Validate destination is under a .claude\skills\ path
    if ($Dest -notmatch '[\\/]\.claude[\\/]skills[\\/]') {
        Write-Host "Error: unexpected destination path: $Dest" -ForegroundColor Red
        exit 1
    }

    $item = Get-Item $Dest -ErrorAction SilentlyContinue
    if ($item -and $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "Found older symlink-based installation at $Dest - removing."
        $item.Delete()
    } elseif (Test-Path $Dest) {
        Write-Host "Found existing installation at $Dest"
        $confirm = Read-Host "Overwrite? [y/N]"
        if ($confirm -notmatch '^[yY]') { Write-Host "Aborted."; exit 0 }
        Remove-Item -Recurse -Force $Dest
    }

    New-Item -ItemType Directory -Force -Path $Dest | Out-Null

    # Copy only the files this skill needs
    Copy-Item (Join-Path $ScriptDir "SKILL.md") $Dest

    Write-Host ""
    Write-Host "Installation complete! The skill will now be loaded from $Dest"
    Write-Host "Refresh or restart your session for changes to take effect."
}

if ($Global) { $Dest = $GlobalDir }
elseif ($Project) { $Dest = $ProjectDir }
else {
    Write-Host "+------------------------------------------+"
    Write-Host "|  Install skill: $SkillName"
    Write-Host "+------------------------------------------+"
    Write-Host "|  1) Global  -> $GlobalDir"
    Write-Host "|  2) Project -> $ProjectDir"
    Write-Host "+------------------------------------------+"
    Write-Host ""
    $choice = Read-Host "Choose [1/2]"
    switch ($choice) {
        "1" { $Dest = $GlobalDir }
        "2" { $Dest = $ProjectDir }
        default { Write-Host "Invalid choice. Exiting."; exit 1 }
    }
}

Install-Skill -Dest $Dest
