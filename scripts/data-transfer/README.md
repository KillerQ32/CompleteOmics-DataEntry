# Data Transfer Scripts

These PowerShell scripts help you move the seeded operational data from your local Supabase database to another Postgres server.

## Why more than two tables

`samples` depends on foreign keys in:

- `companies`
- `patients`
- `fedex_packages`

So the export/import bundle includes all four tables in dependency-safe order.

## Export local data

Run from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\export-company-sample-data.ps1
```

This creates:

- `.\backups\company-sample-data.sql`

## Import into a target server

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\import-company-sample-data.ps1 -TargetDbUrl "postgresql://postgres:password@server-host:5432/postgres"
```

## Notes

- The target database must already have the Complete Omics schema/migrations applied.
- These scripts move data only, not schema.
- If the target already has rows with the same IDs, resolve conflicts before import.
