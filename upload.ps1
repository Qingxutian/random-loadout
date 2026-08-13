# One-click upload for random-loadout (run with PowerShell)
# Usage:  powershell -ExecutionPolicy Bypass -File upload.ps1
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

git config user.name "qingxutian"
git config user.email "qingxutian@users.noreply.github.com"

git branch -M main
git add -A
git commit -m "新增联机房间：GoEasy 实时同步 + 装备价值锁 + 单项锁定"

if (-not (git remote get-url origin 2>$null)) {
    git remote add origin https://github.com/Qingxutian/random-loadout.git
}

git push -u origin main

Write-Host ""
Write-Host "Upload OK: https://github.com/qingxutian/random-loadout"
Write-Host "Page: https://qingxutian.github.io/random-loadout/"
