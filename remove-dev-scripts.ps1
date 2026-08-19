# Run this from your project root: C:\Users\user\Desktop\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File remove-dev-scripts.ps1
#
# Removes four leftover one-off dev/seed scripts (insert-ticket.ts/.js,
# check-db.ts/.js) used early on to manually seed test data. Nothing in
# the app imports them. They were already listed in tsconfig.json's
# "exclude" for the .ts versions, but the .js versions weren't, and
# Next's build kept tripping on them (missing 'dotenv'/'postgres'
# packages). Safest fix: just remove all four.

$ErrorActionPreference = "Stop"

$files = @("insert-ticket.ts", "insert-ticket.js", "check-db.ts", "check-db.js")
foreach ($f in $files) {
    if (Test-Path -LiteralPath $f) {
        Remove-Item -LiteralPath $f -Force
        Write-Host "Removed: $f" -ForegroundColor Cyan
    } else {
        Write-Host "Not found (already removed?): $f" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add -A"
Write-Host "  git commit -m ""Remove leftover dev/seed scripts breaking the Vercel build"""
Write-Host "  git push --force"
