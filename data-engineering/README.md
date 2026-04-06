# Data Engineering Workspace

This folder is a separate workspace for collecting, cleaning, transforming, and exporting data outside the main app flow.

## Suggested flow

- place untouched source files in `raw/`
- put lightly standardized files in `staging/`
- build cleaned or modeled outputs in `processed/`
- keep one-off notebooks, SQL, or scripts in `workflows/`
- store reusable reference files in `reference/`

## Starter structure

- `raw/`: original files from clinics, vendors, exports, spreadsheets, or APIs
- `staging/`: intermediate cleaned files
- `processed/`: final curated outputs ready for reporting or import
- `workflows/sql/`: SQL scripts for analysis or transforms
- `workflows/python/`: Python scripts for ETL or cleanup
- `workflows/notebooks/`: notebooks for exploration
- `reference/`: dictionaries, mapping tables, templates, and notes
- `exports/`: files generated for handoff to other systems

## Company collection starter

If you want to gather company records manually first, use:

- `reference/company-intake-template.csv`
- `workflows/python/company_upsert.py`
- `workflows/python/requirements.txt`

This is the recommended path if you prefer collecting data yourself and pushing rows through the Supabase API from Python.

Suggested workflow:

1. Copy and fill in `reference/company-intake-template.csv`
2. Install the Python dependencies in `workflows/python/requirements.txt`
3. Run `workflows/python/company_upsert.py`
4. The script will upsert rows into `public.companies`

## SQL option

If you ever want a database-side staging workflow instead, these are still available:

- `workflows/sql/create_company_import_staging.sql`
- `workflows/sql/load_company_csv_example.sql`
- `workflows/sql/upsert_companies_from_staging.sql`

## Notes

- Keep raw files immutable when possible.
- Prefer dated filenames for incoming drops.
- Add project-specific scripts or subfolders as needed.
