# Runs `npm run test:db` on the isolated database clicksy_test, emails off, for a clean screenshot.
# Hides connection details (user, host) and the printed test emails. The real database is not touched.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Split-Path $PSScriptRoot -Parent)
$Host.UI.RawUI.WindowTitle = 'Clicksy - npm run test:db'
Clear-Host

# Isolated test database + emails printed instead of sent (process-only settings).
$env:DB_NAME = 'clicksy_test'
$env:MAIL_PROVIDER = 'console'
$env:MAIL_DISABLED = 'true'   # the test itself also forces this; triple safety, no email can leave
node scripts/isolated-db.mjs prep
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not prepare the isolated test database.' -ForegroundColor Red; return }

Write-Host 'Clicksy - database test (isolated test database "clicksy_test", emails disabled)' -ForegroundColor Cyan
Write-Host ''
Write-Host 'PS> npm run test:db' -ForegroundColor Yellow

$skipping = $false
cmd /c "npm run test:db 2>&1" | ForEach-Object {
  $line = "$_"
  if ($line -match 'email not configured') { $skipping = $true; Write-Host '   (email printed only - not sent)' -ForegroundColor DarkGray; return }
  if ($skipping) { if ($line -match '^\s{3}' -or $line -eq '') { return } else { $skipping = $false } }
  if ($line -match '^(TiDB|MySQL) .*:\s') { $line = ($line -replace ':\s.*', ': isolated test database clicksy_test (TLS)') }
  $line = $line -replace '\b[\w.+-]+@(?!test\.clicksy\.local)[\w-]+(\.[\w-]+)*\.[A-Za-z]{2,}\b', '<hidden>'
  if ($line -match 'All checks passed') { Write-Host $line -ForegroundColor Green }
  elseif ($line -match '^\s+✓') { Write-Host $line -ForegroundColor Green }
  elseif ($line -match '✗') { Write-Host $line -ForegroundColor Red }
  else { Write-Host $line }
}
$code = $LASTEXITCODE
node scripts/isolated-db.mjs drop
Write-Host ''
Write-Host "Exit code: $code   ·   isolated test database removed   ·   real database untouched" -ForegroundColor Cyan
