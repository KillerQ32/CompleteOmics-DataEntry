# CompleteOmics-DataEntry

Next.js frontend prototype plus Supabase database scaffold for a Complete Omics customer portal. The UI follows the tone and visual direction of `https://www.completeomics.com/`, and the database structure is based on the provided system requirements document.

- customer login
- patient and sample intake
- FedEx package tracking
- document upload
- searchable sample table
- admin review and restricted actions
- Supabase schema migrations and local Docker workflow

## Run locally

```bash
npm install
npm run dev
```

## Database

```bash
npm run db:start
npm run db:status
```

Docker Desktop needs to be running before you start the local Supabase stack.

Schema files live in `supabase/migrations` and local seed data lives in `supabase/seed.sql`.

Server deployment notes are in `docs/supabase-self-hosting.md`.

## Database Design

### Core tables

- `companies`: clinic or customer organization records
- `user_profiles`: maps Supabase auth users to a company and app role
- `patients`: patient demographic and profile data
- `fedex_packages`: shipment records used to tie mailed samples to packages
- `samples`: clinical sample intake records
- `patient_documents`: uploaded file metadata for patient/sample attachments

### Main relationships

- one company has many users
- one company has many patients
- one company has many FedEx packages
- one company has many samples
- one patient can have many samples
- one FedEx package can contain many samples
- one patient or sample can have many uploaded documents

### Security model

- Supabase Auth handles sign-up and sign-in
- `user_profiles.role` is either `admin` or `customer`
- row-level security limits customers to their own company data
- only admins can manage rejection fields on samples
- storage access is scoped by company folder under the `patient-documents` bucket

### Search layer

- `sample_search` is a view that joins samples, patients, companies, and packages for dashboard search

### Current seed data

- `Harbor Precision Clinic`
- `Complete Omics Test Clinic`

## Data Transfer

Windows-friendly transfer scripts live in `scripts/data-transfer`.

Use these to move local operational data to another Postgres server after the schema already exists there.

Export local company/sample bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\export-company-sample-data.ps1
```

Import into a target database:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\import-company-sample-data.ps1 -TargetDbUrl "postgresql://postgres:password@server-host:5432/postgres"
```

## Data Engineering

A separate starter workspace for manual data collection and processing lives in `data-engineering/`.

Main folders:

- `data-engineering/raw`
- `data-engineering/staging`
- `data-engineering/processed`
- `data-engineering/exports`
- `data-engineering/reference`
- `data-engineering/workflows/sql`
- `data-engineering/workflows/python`
- `data-engineering/workflows/notebooks`
