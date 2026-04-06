param(
  [string]$OutputFile = ".\\backups\\company-sample-data.sql"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outputPath = Join-Path $repoRoot $OutputFile
$outputDir = Split-Path -Parent $outputPath

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$containerName = "supabase_db_CompleteOmics-DataEntry"

Write-Host "Exporting companies, patients, FedEx packages, and samples from local Supabase..."

$dump = docker exec $containerName pg_dump `
  -U postgres `
  -d postgres `
  --data-only `
  --inserts `
  --column-inserts `
  --table public.companies `
  --table public.patients `
  --table public.fedex_packages `
  --table public.samples

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump export failed."
}

Set-Content -Path $outputPath -Value $dump

Write-Host "Export complete: $outputPath"
