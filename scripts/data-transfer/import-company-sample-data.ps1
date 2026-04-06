param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDbUrl,

  [string]$InputFile = ".\\backups\\company-sample-data.sql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$inputPath = Join-Path $repoRoot $InputFile

if (-not (Test-Path $inputPath)) {
  throw "Input file not found: $inputPath"
}

Write-Host "Importing companies, patients, FedEx packages, and samples into target database..."

Get-Content -Raw $inputPath | docker run --rm -i postgres:17 `
  psql $TargetDbUrl

if ($LASTEXITCODE -ne 0) {
  throw "psql import failed."
}

Write-Host "Import complete."
