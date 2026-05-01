# CompleteOmics-DataEntry

Clinical intake and operations portal for Complete Omics, built with `Next.js`, `React`, `Supabase`, and `Docker`.

This project supports:

- customer login and admin login
- admin approval for customer account creation
- clinic request intake with admin approval
- patient, sample, package, and document management
- searchable clinic-scoped and admin-wide record views
- sample review workflow: `submitted`, `mailed`, `accepted`, `rejected`
- local Supabase development on Docker with a path to server deployment
- database-backed tests for core sample and relational workflows

## Stack

- `Next.js 16`
- `React 19`
- `Supabase` for Auth, Postgres, Storage, and RLS
- `Docker Desktop` for the local Supabase stack
- `TypeScript`

## Roles

### Customer

- signs in through the customer login page
- is scoped to a single clinic
- can create and edit clinic-scoped patients, samples, packages, and documents
- can edit clinic details
- cannot accept or reject samples
- cannot delete clinics

### Admin

- signs in through the admin login page
- can manage all clinics and all records
- can approve or deny customer account requests
- can approve or deny clinic requests
- can mark samples received
- can accept or reject received samples and attach rejection reasons
- can delete records across the system

## Approval Workflow

### Customer account creation

1. User selects an approved clinic on the signup page.
2. Auth account is created.
3. `user_profiles.account_status` is set to `pending`.
4. Admin reviews the request in `Admin -> Accounts -> Account Requests`.
5. Admin approves or denies the request.

### Clinic request creation

1. User submits a clinic request with clinic information, email, and password.
2. A pending auth account is created immediately.
3. A row is added to `clinic_requests`.
4. Admin reviews the request in `Admin -> Clinics -> Clinic Requests`.
5. If approved, the clinic is created and the requester is attached as an approved customer account.

## Database Design

### Core operational tables

- `companies`
- `user_profiles`
- `patients`
- `fedex_packages`
- `samples`
- `patient_documents`

### Workflow and support tables

- `clinic_requests`
- `contact_messages`
- `pending_intake_documents`

### Key relationships

- one clinic has many users
- one clinic has many patients
- one clinic has many packages
- one clinic has many samples
- one patient has many samples
- one package can be linked to many samples
- one sample and one patient can have many documents

### Sample rules

- sample lifecycle is limited to `submitted`, `mailed`, `accepted`, `rejected`
- samples can store up to `5` ICD-10 codes
- admins cannot accept or reject a sample until it has a `received_at` date
- rejected samples can store a rejection reason visible to customers

### Document rules

- documents must be tied to both a patient and a sample
- the selected sample must belong to the selected patient
- the selected sample must belong to the selected clinic
- storage objects are scoped under the `patient-documents` bucket

### Security model

- Supabase Auth handles sign-in and sign-up
- row-level security limits customers to their own clinic data
- admins can manage all records
- customers can edit and remove their own clinic-scoped records except clinics
- only admins can perform sample review actions and clinic deletion

## Local Development

### Prerequisites

- Windows with `Docker Desktop` running
- Node.js and npm
- Supabase CLI available through the repo dependencies

### Environment

Create `.env.local` from `.env.example`.

Current example keys:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
```

If you start the local Supabase stack fresh, use `npm run db:status` or `supabase status` to confirm the current local credentials.

### Start the app

```bash
npm install
npm run db:start
npm run dev
```

Typical local URLs:

- frontend: `http://localhost:3000`
- Supabase Studio: `http://127.0.0.1:54323`

### Stop the local stack

```bash
npm run db:stop
```

## Available Scripts

### App

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Database

```bash
npm run db:start
npm run db:stop
npm run db:reset
npm run db:status
```

### Tests

```bash
npm run test:unit:customer
npm run test:unit:samples
npm run test:integration:samples
npm run test:integration:supabase
```

## Test Coverage

Current automated coverage includes:

- customer portal routing and intake progression rules
- sample status normalization and validation logic
- sample creation against local Supabase
- `sample_search` and `admin_sample_directory` view behavior
- ICD-10 limit enforcement
- document-to-patient/sample relational enforcement
- package deletion unlink behavior
- clinic deletion cascade behavior

## File Layout

- [app](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/app): Next.js app routes, pages, and server actions
- [lib](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/lib): shared workflow and Supabase helpers
- [supabase/migrations](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/supabase/migrations): schema and policy migrations
- [supabase/seed.sql](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/supabase/seed.sql): local seed data
- [tests](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/tests): unit and Supabase-backed integration tests
- [scripts/data-transfer](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/scripts/data-transfer): export/import scripts
- [data-engineering](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/data-engineering): manual ETL/data processing workspace

## Data Transfer

Windows-friendly data transfer scripts live in `scripts/data-transfer`.

Export local company/sample data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\export-company-sample-data.ps1
```

Import into another Postgres target:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\data-transfer\import-company-sample-data.ps1 -TargetDbUrl "postgresql://postgres:password@server-host:5432/postgres"
```

## Data Engineering Workspace

The `data-engineering/` folder is a starter area for manual collection, transformation, and loading work.

Main folders:

- `data-engineering/raw`
- `data-engineering/staging`
- `data-engineering/processed`
- `data-engineering/exports`
- `data-engineering/reference`
- `data-engineering/workflows/sql`
- `data-engineering/workflows/python`
- `data-engineering/workflows/notebooks`

## Deployment Notes

Self-hosting notes for moving the Supabase-backed stack to a company server live in:

- [docs/supabase-self-hosting.md](/c:/Users/qabal/OneDrive/Documents/CompleteOmics-DataEntry/docs/supabase-self-hosting.md)
