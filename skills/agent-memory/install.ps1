# Install agent-memory skill
# Works on Windows (PowerShell 5.1+).
#
# Usage:
#   .\install.ps1           # interactive prompt
#   .\install.ps1 -Global   # install to $HOME\.claude\skills\agent-memory
#   .\install.ps1 -Project  # install to .\.claude\skills\agent-memory

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
    Write-Host "  -Global   Install to $GlobalDir"
    Write-Host "  -Project  Install to $ProjectDir"
    exit 0
}

function Setup-Credentials {
    param([string]$Dest)

    $exampleFile = Join-Path $ScriptDir "$SkillName.env.example"
    $envFile = Join-Path $Dest "$SkillName.env"

    if (-not (Test-Path $exampleFile)) { return }

    Copy-Item $exampleFile (Join-Path $Dest "$SkillName.env.example")

    Write-Host ""
    Write-Host "Credential setup:"
    Write-Host "  1) Import credentials from a .env file"
    Write-Host "  2) Enter credentials one by one"
    Write-Host "  3) Skip - I'll add credentials later"
    Write-Host ""
    $choice = Read-Host "Choose [1/2/3]"

    switch ($choice) {
        "1" {
            $path = Read-Host "Path to .env file"
            if (Test-Path $path) {
                Copy-Item $path $envFile
                Write-Host "Credentials imported."
            } else {
                Write-Host "File not found: $path - skipping."
            }
        }
        "2" {
            $content = @()
            foreach ($line in Get-Content $exampleFile) {
                if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
                    $content += $line
                    continue
                }
                $key = (($line -replace "^export ", "") -split "=", 2)[0].Trim()
                $value = Read-Host "  $key"
                $content += "export $key=$value"
            }
            $content | Set-Content $envFile
            Write-Host "Credentials saved."
        }
        default {
            Write-Host "Skipping credentials. Edit $SkillName.env.example -> $SkillName.env when ready."
        }
    }
}

function Install-Skill {
    param([string]$Dest)

    $item = Get-Item $Dest -ErrorAction SilentlyContinue
    if ($item -and $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "Found older symlink-based installation at $Dest - removing."
        $item.Delete()
    } elseif (Test-Path $Dest) {
        Write-Host "Found existing installation at $Dest"
        $confirm = Read-Host "Overwrite? [y/N]"
        if ($confirm -notmatch '^[yY]') {
            Write-Host "Aborted."
            exit 0
        }
        Remove-Item -Recurse -Force $Dest
    }

    New-Item -ItemType Directory -Force -Path $Dest | Out-Null

    Get-ChildItem -Path $ScriptDir -Exclude "install.sh","install.ps1","AGENTS.md","CLAUDE.md","*.env.example" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $Dest -Recurse -Force
    }

    Setup-Credentials -Dest $Dest

    Write-Host ""
    Write-Host "Installation complete! The skill will now be loaded from $Dest"
    Write-Host "Refresh or restart your session for changes to take effect."
}

if ($Global) {
    $Dest = $GlobalDir
} elseif ($Project) {
    $Dest = $ProjectDir
} else {
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
