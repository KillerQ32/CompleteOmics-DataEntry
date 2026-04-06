import {
  bootstrapAdminAction,
  createCompanyAction,
  createCustomerIntakeAction,
  createPackageAction,
  createPatientAction,
  createSampleAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateCompanyAction,
  updatePackageAction,
  updatePatientAction,
  updateSampleAction,
  updateUserProfileAction,
  uploadDocumentAction,
} from "./actions";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CustomerView = "home" | "samples" | "intake" | "operations";
type IntakeStep = "patient" | "sample" | "package";

type CompanyRow = {
  id: string;
  name: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "customer";
  company_id: string | null;
};

type SampleRow = {
  id: string;
  sample_number: string;
  status: string;
  rejected: boolean;
  collected_at: string | null;
  received_at: string | null;
  patient_full_name: string;
  company_name: string;
  package_id: string | null;
};

type AdminSampleRow = {
  id: string;
  sample_number: string;
  company_id: string;
  company_name: string;
  patient_id: string;
  patient_first_name: string;
  patient_last_name: string;
  fedex_package_id: string | null;
  package_id: string | null;
  status: string;
  rejected: boolean;
  rejection_reason: string | null;
  received_at: string | null;
  collected_at: string | null;
  collected_by: string | null;
  sex: string | null;
  missing_info: string | null;
  icd10_codes: string[];
  ordering_provider_name: string | null;
  npi_number: string | null;
  hart_cadhs: boolean;
  hart_cve: boolean;
};

type PatientRow = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  race_ethnicity: string | null;
  weight_lbs: number | null;
  height_inches: number | null;
  angioplasty_or_stent: boolean;
  cabg: boolean;
  created_at: string;
};

type PackageRow = {
  id: string;
  company_id: string;
  package_id: string;
  mailed_at: string | null;
  received_at: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  company_id: string;
  patient_id: string | null;
  sample_id: string | null;
  original_filename: string;
  storage_path: string;
};

type IntakePatientDraft = {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  postalCode: string;
  raceEthnicity: string;
  weightLbs: string;
  heightInches: string;
  angioplastyOrStent: boolean;
  cabg: boolean;
};

type IntakeSampleDraft = {
  sampleNumber: string;
  collectedAt: string;
  collectedBy: string;
  sex: string;
  orderingProviderName: string;
  npiNumber: string;
  missingInfo: string;
  icd10Codes: string[];
  hartCadhs: boolean;
  hartCve: boolean;
};

type IntakePackageDraft = {
  packageId: string;
  mailedAt: string;
};

type AdminUserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "customer";
  company_id: string | null;
  company_name: string | null;
  created_at: string;
};

function readParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value ?? "";
}

function readBooleanParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = readParam(searchParams, key);
  return value === "true" || value === "on";
}

function normalizeCustomerView(value: string): CustomerView {
  if (value === "samples" || value === "intake" || value === "operations") {
    return value;
  }

  return "home";
}

function normalizeIntakeStep(value: string): IntakeStep {
  if (value === "sample" || value === "package") {
    return value;
  }

  return "patient";
}

function Icd10CodeFields({
  values,
  compact = false,
}: {
  values: string[];
  compact?: boolean;
}) {
  return (
    <div className={`icd10-grid ${compact ? "icd10-grid--compact" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <div className={`field ${compact ? "field--compact" : ""}`} key={index}>
          <label>ICD10 Code {index + 1}</label>
          <input
            name={`icd10_code_${index + 1}`}
            defaultValue={values[index] ?? ""}
            placeholder="Enter here"
          />
        </div>
      ))}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function CompanyOptions({ companies }: { companies: CompanyRow[] }) {
  return (
    <>
      <option value="" disabled>
        Select a company
      </option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </>
  );
}

function CompanyLookupOptions({ companies }: { companies: CompanyRow[] }) {
  return (
    <>
      {companies.map((company) => (
        <option key={company.id} value={`${company.name} | ${company.id}`} />
      ))}
    </>
  );
}

function PatientOptions({ patients }: { patients: PatientRow[] }) {
  return (
    <>
      <option value="" disabled>
        Select a patient
      </option>
      {patients.map((patient) => (
        <option key={patient.id} value={patient.id}>
          {patient.first_name} {patient.last_name}
        </option>
      ))}
    </>
  );
}

function PatientLookupOptions({ patients }: { patients: PatientRow[] }) {
  return (
    <>
      {patients.map((patient) => (
        <option
          key={patient.id}
          value={`${patient.first_name} ${patient.last_name} | ${patient.id}`}
        />
      ))}
    </>
  );
}

function PackageOptions({ packages }: { packages: PackageRow[] }) {
  return (
    <>
      <option value="">No package yet</option>
      {packages.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.package_id}
        </option>
      ))}
    </>
  );
}

function PackageLookupOptions({ packages }: { packages: PackageRow[] }) {
  return (
    <>
      {packages.map((entry) => (
        <option key={entry.id} value={`${entry.package_id} | ${entry.id}`} />
      ))}
    </>
  );
}

function CustomerShellLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a className={`admin-nav-item ${active ? "admin-nav-item--active" : ""}`} href={href}>
      {label}
    </a>
  );
}

async function AuthLanding({ error, message }: { error: string; message: string }) {
  return (
    <main className="customer-login-page">
      <div className="customer-login-bg">
        <span className="customer-login-bg__cell customer-login-bg__cell--one" />
        <span className="customer-login-bg__cell customer-login-bg__cell--two" />
        <span className="customer-login-bg__cell customer-login-bg__cell--three" />
        <span className="customer-login-bg__cell customer-login-bg__cell--four" />
        <span className="customer-login-bg__cell customer-login-bg__cell--five" />
      </div>

      <section className="customer-login-shell">
        <aside className="customer-login-brand">
          <div className="customer-login-brand__logo">
            <div className="customer-login-brand__mark">CO</div>
            <p className="customer-login-brand__wordmark">
              Complete<span>Omics</span>
            </p>
          </div>

          <h1>CompleteOmics</h1>
          <p>
            Secure customer access to enter sample and patient information, upload documents, and
            track activity directly in the portal.
          </p>
        </aside>

        <section className="customer-login-panel">
          <div className="customer-login-panel__header">
            <h2>Customer Login</h2>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}

          <form action={signInAction} className="customer-login-form">
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" placeholder="Enter here" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                name="password"
                type="password"
                minLength={8}
                placeholder="Enter here"
                required
              />
            </div>
            <button className="button button--primary" type="submit">
              Login
            </button>
          </form>

          <div className="customer-login-panel__actions">
            <a className="customer-login-panel__link" href="/signup">
              Create customer account
            </a>
            <a className="customer-login-panel__link" href="/admin">
              Admin login
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

function CustomerWorkspace({
  userEmail,
  profile,
  company,
  samples,
  patients,
  packages,
  documents,
  message,
  error,
  q,
  customerView,
  intakeStep,
  patientDraft,
  sampleDraft,
  packageDraft,
}: {
  userEmail: string;
  profile: ProfileRow | null;
  company: CompanyRow | null;
  samples: SampleRow[];
  patients: PatientRow[];
  packages: PackageRow[];
  documents: DocumentRow[];
  message: string;
  error: string;
  q: string;
  customerView: CustomerView;
  intakeStep: IntakeStep;
  patientDraft: IntakePatientDraft;
  sampleDraft: IntakeSampleDraft;
  packageDraft: IntakePackageDraft;
}) {
  const patientChosen = Boolean(patientDraft.patientId);
  const canAdvanceToSample =
    patientChosen ||
    Boolean(patientDraft.firstName && patientDraft.lastName && patientDraft.dateOfBirth);
  const canAdvanceToPackage = canAdvanceToSample && Boolean(sampleDraft.sampleNumber);

  return (
    <main className="admin-shell customer-shell">
      <aside className="admin-sidebar customer-sidebar">
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__mark">CO</div>
          <div>
            <p className="eyebrow">Complete Omics</p>
            <p className="brand">Customer Portal</p>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          <CustomerShellLink href="/?customer_view=home" label="Home" active={customerView === "home"} />
          <CustomerShellLink
            href="/?customer_view=samples"
            label="Company Samples"
            active={customerView === "samples"}
          />
          <CustomerShellLink
            href="/?customer_view=intake&intake_step=patient"
            label="Add Sample"
            active={customerView === "intake"}
          />
          <CustomerShellLink
            href="/?customer_view=operations"
            label="Operations"
            active={customerView === "operations"}
          />
        </nav>

        <div className="admin-sidebar__meta">
          <p className="eyebrow">Signed In</p>
          <strong>{userEmail}</strong>
          <span>
            Customer access is limited to {company?.name ?? "your assigned company"} and cannot
            change admin-only records or global account settings.
          </span>
          <form action={signOutAction}>
            <button className="button button--ghost" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="admin-content">
        <section className="admin-header customer-header" id="customer-overview">
          <div className="admin-header__title">
            <div className="admin-header__badge">CO</div>
            <div>
              <p className="eyebrow">Customer Workspace</p>
              <h1>{profile?.first_name ? `${profile.first_name}'s Workspace` : "Portal Workspace"}</h1>
              <p>
                Use the customer home page to review company samples, start intake, and upload
                documents without exposing admin-only controls.
              </p>
            </div>
          </div>

          <div className="admin-kpis">
            <article>
              <span>{samples.length}</span>
              <p>Visible samples</p>
            </article>
            <article>
              <span>{patients.length}</span>
              <p>Patients in scope</p>
            </article>
            <article>
              <span>{packages.length}</span>
              <p>FedEx packages</p>
            </article>
            <article>
              <span>{documents.length}</span>
              <p>Tracked documents</p>
            </article>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}
        </section>

        {customerView === "home" && (
          <section className="admin-panel customer-panel customer-home">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">Start Here</p>
                <h2>Choose what you want to do in your company workspace.</h2>
              </div>
              <div className="admin-panel__caption">
                Customers stay limited to their own company records and intake actions.
              </div>
            </div>

            <div className="customer-home__actions">
              <a className="panel customer-action-card" href="/?customer_view=samples">
                <p className="eyebrow">Review</p>
                <h3>View company samples</h3>
                <p>Search sample numbers, patient names, and package IDs already in your scope.</p>
                <span>{samples.length} recent samples</span>
              </a>
              <a className="panel customer-action-card" href="/?customer_view=intake&intake_step=patient">
                <p className="eyebrow">Intake</p>
                <h3>Add a sample</h3>
                <p>Move through patient, sample, and optional FedEx entry in a guided sequence.</p>
                <span>3 guided steps</span>
              </a>
              <a className="panel customer-action-card" href="/?customer_view=operations">
                <p className="eyebrow">Operations</p>
                <h3>Upload documents</h3>
                <p>Attach clinical files and review recent company-side activity.</p>
                <span>{documents.length} tracked files</span>
              </a>
            </div>

            <div className="customer-home__summary">
              <article className="panel">
                <p className="eyebrow">Company Scope</p>
                <h3>{company?.name ?? "Assigned company"}</h3>
                <p>
                  {[company?.city, company?.state].filter(Boolean).join(", ") || "Location not set"}
                </p>
              </article>
              <article className="panel">
                <p className="eyebrow">Latest Samples</p>
                <h3>Recent activity</h3>
                <div className="list-grid">
                  {samples.slice(0, 3).map((sample) => (
                    <div className="list-row" key={sample.id}>
                      <strong>{sample.sample_number}</strong>
                      <span>{sample.patient_full_name}</span>
                    </div>
                  ))}
                  {samples.length === 0 && <div className="empty-state">No samples in your scope yet.</div>}
                </div>
              </article>
            </div>
          </section>
        )}

        {customerView === "samples" && <section className="admin-panel customer-panel" id="customer-samples">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Sample Search</p>
              <h2>Search your company data by patient, sample number, or package.</h2>
            </div>
            <div className="admin-panel__caption">
              Customer users can review only their own company records.
            </div>
          </div>

          <form className="admin-toolbar customer-toolbar" method="get">
            <input type="hidden" name="customer_view" value="samples" />
            <input defaultValue={q} name="q" placeholder="Search patient, sample, or package" />
            <button className="button button--secondary" type="submit">
              Search
            </button>
          </form>

          <div className="table">
            <div className="table__head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Status</span>
              <span>Collected</span>
              <span>Received</span>
              <span>Package</span>
            </div>
            {samples.map((sample) => (
              <div className="table__row" key={sample.id}>
                <span>{sample.sample_number}</span>
                <span>{sample.patient_full_name}</span>
                <span>{sample.rejected ? "Rejected" : sample.status}</span>
                <span>{formatDate(sample.collected_at)}</span>
                <span>{formatDate(sample.received_at)}</span>
                <span>{sample.package_id ?? "Unassigned"}</span>
              </div>
            ))}
            {samples.length === 0 && <div className="empty-state">No samples matched this query.</div>}
          </div>
        </section>}

        {customerView === "intake" && <section className="admin-panel customer-panel" id="customer-intake">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Guided Intake</p>
              <h2>Enter a sample in three screens instead of one long form.</h2>
            </div>
            <div className="admin-panel__caption">
              Step 1 choose or create the patient, step 2 enter sample details, step 3 add FedEx or skip it.
            </div>
          </div>

          <div className="customer-steps">
            <div className={`customer-step ${intakeStep === "patient" ? "customer-step--active" : ""}`}>
              <span>1</span>
              <strong>Patient</strong>
            </div>
            <div className={`customer-step ${intakeStep === "sample" ? "customer-step--active" : ""}`}>
              <span>2</span>
              <strong>Sample</strong>
            </div>
            <div className={`customer-step ${intakeStep === "package" ? "customer-step--active" : ""}`}>
              <span>3</span>
              <strong>FedEx</strong>
            </div>
          </div>

          {intakeStep === "patient" && (
            <form className="panel form-panel customer-wizard" method="get">
              <input type="hidden" name="customer_view" value="intake" />
              <input type="hidden" name="intake_step" value="sample" />
              <p className="eyebrow">Step 1</p>
              <h3>Find an existing patient or create a new one</h3>
              <div className="field">
                <label>Existing patient</label>
                <input
                  name="patient_id"
                  list="customer-patient-options"
                  placeholder="Type patient name"
                  defaultValue={patientDraft.patientId}
                />
                <datalist id="customer-patient-options">
                  <PatientLookupOptions patients={patients} />
                </datalist>
              </div>
              <p className="wizard-divider">Or enter a new patient record</p>
              <div className="form-grid">
                <div className="field">
                  <label>First name</label>
                  <input name="first_name" defaultValue={patientDraft.firstName} />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input name="last_name" defaultValue={patientDraft.lastName} />
                </div>
                <div className="field">
                  <label>Date of birth</label>
                  <input name="date_of_birth" type="date" defaultValue={patientDraft.dateOfBirth} />
                </div>
                <div className="field">
                  <label>Race / ethnicity</label>
                  <input name="race_ethnicity" defaultValue={patientDraft.raceEthnicity} />
                </div>
                <div className="field">
                  <label>Weight (lbs)</label>
                  <input name="weight_lbs" type="number" step="0.01" defaultValue={patientDraft.weightLbs} />
                </div>
                <div className="field">
                  <label>Height (inches)</label>
                  <input name="height_inches" type="number" step="0.01" defaultValue={patientDraft.heightInches} />
                </div>
              </div>
              <div className="checkbox-row">
                <label>
                  <input name="angioplasty_or_stent" type="checkbox" defaultChecked={patientDraft.angioplastyOrStent} />
                  Angioplasty or Stent
                </label>
                <label>
                  <input name="cabg" type="checkbox" defaultChecked={patientDraft.cabg} />
                  CABG
                </label>
              </div>
              <button className="button button--primary" type="submit">
                Continue to Sample Details
              </button>
            </form>
          )}

          {intakeStep === "sample" && (
            <form className="panel form-panel customer-wizard" method="get">
              <input type="hidden" name="customer_view" value="intake" />
              <input type="hidden" name="intake_step" value="package" />
              <input type="hidden" name="patient_id" value={patientDraft.patientId} />
              <input type="hidden" name="first_name" value={patientDraft.firstName} />
              <input type="hidden" name="last_name" value={patientDraft.lastName} />
              <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
              <input type="hidden" name="race_ethnicity" value={patientDraft.raceEthnicity} />
              <input type="hidden" name="weight_lbs" value={patientDraft.weightLbs} />
              <input type="hidden" name="height_inches" value={patientDraft.heightInches} />
              <input type="hidden" name="angioplasty_or_stent" value={patientDraft.angioplastyOrStent ? "true" : "false"} />
              <input type="hidden" name="cabg" value={patientDraft.cabg ? "true" : "false"} />
              <p className="eyebrow">Step 2</p>
              <h3>Add sample details</h3>
              {!canAdvanceToSample && (
                <div className="status-banner status-banner--error">
                  Choose a patient or complete the patient details before moving to sample entry.
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label>Sample number</label>
                  <input name="sample_number" defaultValue={sampleDraft.sampleNumber} required />
                </div>
                <div className="field">
                  <label>Collected date</label>
                  <input name="collected_at" type="date" defaultValue={sampleDraft.collectedAt} />
                </div>
              </div>
              <div className="checkbox-row">
                <label>
                  <input name="hart_cadhs" type="checkbox" defaultChecked={sampleDraft.hartCadhs} />
                  Hart_CADhs
                </label>
                <label>
                  <input name="hart_cve" type="checkbox" defaultChecked={sampleDraft.hartCve} />
                  Hart_CVE
                </label>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Collected by</label>
                  <input name="collected_by" defaultValue={sampleDraft.collectedBy} />
                </div>
                <div className="field">
                  <label>Sex</label>
                  <input name="sex" defaultValue={sampleDraft.sex} />
                </div>
                <Icd10CodeFields values={sampleDraft.icd10Codes} />
              </div>
                <div className="form-subsection">
                  <p className="form-subsection__title">Ordering Provider</p>
                  <div className="form-grid">
                    <div className="field">
                      <label>Provider name</label>
                      <input
                        name="ordering_provider_name"
                        defaultValue={sampleDraft.orderingProviderName}
                      />
                    </div>
                    <div className="field">
                      <label>NPI #</label>
                      <input
                        name="npi_number"
                        defaultValue={sampleDraft.npiNumber}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Missing info notes</label>
                  <textarea name="missing_info" rows={3} defaultValue={sampleDraft.missingInfo} />
                </div>
              <div className="customer-wizard__actions">
                <a className="button button--secondary" href="/?customer_view=intake&intake_step=patient">
                  Back to Patient
                </a>
                <button className="button button--primary" type="submit" disabled={!canAdvanceToSample}>
                  Continue to FedEx
                </button>
              </div>
            </form>
          )}

          {intakeStep === "package" && (
            <form action={createCustomerIntakeAction} className="panel form-panel customer-wizard">
              <input type="hidden" name="patient_id" value={patientDraft.patientId} />
              <input type="hidden" name="first_name" value={patientDraft.firstName} />
              <input type="hidden" name="last_name" value={patientDraft.lastName} />
              <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
              <input type="hidden" name="race_ethnicity" value={patientDraft.raceEthnicity} />
              <input type="hidden" name="weight_lbs" value={patientDraft.weightLbs} />
              <input type="hidden" name="height_inches" value={patientDraft.heightInches} />
              <input type="hidden" name="angioplasty_or_stent" value={patientDraft.angioplastyOrStent ? "true" : "false"} />
              <input type="hidden" name="cabg" value={patientDraft.cabg ? "true" : "false"} />
              <input type="hidden" name="sample_number" value={sampleDraft.sampleNumber} />
              <input type="hidden" name="collected_at" value={sampleDraft.collectedAt} />
              <input type="hidden" name="collected_by" value={sampleDraft.collectedBy} />
              <input type="hidden" name="sex" value={sampleDraft.sex} />
              <input type="hidden" name="ordering_provider_name" value={sampleDraft.orderingProviderName} />
              <input type="hidden" name="npi_number" value={sampleDraft.npiNumber} />
              <input type="hidden" name="missing_info" value={sampleDraft.missingInfo} />
              {sampleDraft.icd10Codes.map((code, index) => (
                <input key={index} type="hidden" name={`icd10_code_${index + 1}`} value={code} />
              ))}
              <input type="hidden" name="hart_cadhs" value={sampleDraft.hartCadhs ? "true" : "false"} />
              <input type="hidden" name="hart_cve" value={sampleDraft.hartCve ? "true" : "false"} />
              <p className="eyebrow">Step 3</p>
              <h3>Add FedEx package details or skip this step</h3>
              {!canAdvanceToPackage && (
                <div className="status-banner status-banner--error">
                  Enter the sample details before opening the FedEx step.
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label>Package ID</label>
                  <input name="package_id" defaultValue={packageDraft.packageId} placeholder="Optional" />
                </div>
                <div className="field">
                  <label>Date mailed</label>
                  <input name="mailed_at" type="datetime-local" defaultValue={packageDraft.mailedAt} />
                </div>
              </div>
              <div className="customer-wizard__actions">
                <a className="button button--secondary" href="/?customer_view=intake&intake_step=sample">
                  Back to Sample
                </a>
                <button className="button button--secondary" name="skip_package" type="submit" value="true" disabled={!canAdvanceToPackage}>
                  Skip and Submit
                </button>
                <button className="button button--primary" type="submit" disabled={!canAdvanceToPackage}>
                  Submit Intake
                </button>
              </div>
            </form>
          )}
        </section>}

        {customerView === "operations" && <section className="admin-panel customer-panel" id="customer-documents">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Operations</p>
              <h2>Upload documents and review recent records in your company scope.</h2>
            </div>
          </div>

          <div className="create-grid">
          <form action={uploadDocumentAction} className="panel form-panel">
            <p className="eyebrow">Document Upload</p>
            <h3>Attach files</h3>
            <div className="field">
              <label>Patient</label>
              <select name="patient_id" defaultValue="">
                <option value="">Unassigned</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Sample</label>
              <select name="sample_id" defaultValue="">
                <option value="">Unassigned</option>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.sample_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>File</label>
              <input name="document" type="file" accept=".pdf,image/png,image/jpeg" required />
            </div>
            <button className="button button--secondary" type="submit">
              Upload Document
            </button>
          </form>

          <article className="panel">
            <p className="eyebrow">Patients</p>
            <h3>Recent records</h3>
            <div className="list-grid">
              {patients.map((patient) => (
                <div className="list-row" key={patient.id}>
                  <strong>{patient.first_name} {patient.last_name}</strong>
                  <span>DOB {formatDate(patient.date_of_birth)}</span>
                </div>
              ))}
              {patients.length === 0 && <div className="empty-state">No patients in scope yet.</div>}
            </div>
          </article>
          </div>

          <div className="data-grid">
          <article className="panel">
            <p className="eyebrow">FedEx Packages</p>
            <h3>Tracked shipments</h3>
            <div className="list-grid">
              {packages.map((entry) => (
                <div className="list-row" key={entry.id}>
                  <strong>{entry.package_id}</strong>
                  <span>Mailed {formatDateTime(entry.mailed_at)} | Received {formatDateTime(entry.received_at)}</span>
                </div>
              ))}
              {packages.length === 0 && <div className="empty-state">No packages recorded yet.</div>}
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">Uploaded Documents</p>
            <h3>Metadata table</h3>
            <div className="list-grid">
              {documents.map((document) => (
                <div className="list-row" key={document.id}>
                  <strong>{document.original_filename}</strong>
                  <span>{document.storage_path}</span>
                </div>
              ))}
              {documents.length === 0 && <div className="empty-state">No documents uploaded yet.</div>}
            </div>
          </article>
          </div>
        </section>}
      </div>
    </main>
  );
}

function AdminWorkspace({
  userEmail,
  profile,
  companies,
  accounts,
  samples,
  patients,
  packages,
  documents,
  message,
  error,
  q,
  companyFilter,
  statusFilter,
  rejectedFilter,
  userEmailById,
}: {
  userEmail: string;
  profile: ProfileRow | null;
  companies: CompanyRow[];
  accounts: AdminUserRow[];
  samples: AdminSampleRow[];
  patients: PatientRow[];
  packages: PackageRow[];
  documents: DocumentRow[];
  message: string;
  error: string;
  q: string;
  companyFilter: string;
  statusFilter: string;
  rejectedFilter: string;
  userEmailById: Map<string, string>;
}) {
  return (
    <main className="admin-shell admin-shell--portal">
      <aside className="admin-sidebar admin-sidebar--portal">
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__mark">CO</div>
          <div>
            <p className="eyebrow">Complete Omics</p>
            <p className="brand">Admin Panel</p>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          <a className="admin-nav-item" href="#admin-overview">Overview</a>
          <a className="admin-nav-item" href="#admin-samples">Sample Data</a>
          <a className="admin-nav-item" href="#admin-intake">Create Records</a>
          <a className="admin-nav-item" href="#admin-accounts">Accounts</a>
          <a className="admin-nav-item" href="#admin-records">Operations</a>
        </nav>

        <div className="admin-sidebar__meta">
          <p className="eyebrow">Signed In</p>
          <strong>{userEmail}</strong>
          <span>Admins are global users and can review every company record.</span>
          <form action={signOutAction}>
            <button className="button button--ghost" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="admin-content">
        <div className="admin-utilitybar">
          <div>
            <p className="eyebrow">Operations Hub</p>
            <strong>Platform Admin Dashboard</strong>
          </div>
          <div className="admin-utilitybar__chips">
            <span>Live Supabase</span>
            <span>{companies.length} companies</span>
            <span>{samples.length} samples in view</span>
          </div>
        </div>

        <section className="admin-header admin-header--portal" id="admin-overview">
          <div className="admin-header__title">
            <div className="admin-header__badge">CO</div>
            <div>
              <p className="eyebrow">Platform Admin</p>
              <h1>{profile?.first_name ? `${profile.first_name}'s Admin Console` : "Admin Console"}</h1>
              <p>
                Review sample operations, customer access, and company activity from one
                bank-style control surface built for dense daily workflows.
              </p>
            </div>
          </div>

          <div className="admin-kpis">
            <article>
              <span>{companies.length}</span>
              <p>Companies</p>
            </article>
            <article>
              <span>{accounts.length}</span>
              <p>Users</p>
            </article>
            <article>
              <span>{samples.length}</span>
              <p>Visible samples</p>
            </article>
            <article>
              <span>{documents.length}</span>
              <p>Documents</p>
            </article>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}
        </section>

        <section className="admin-panel" id="admin-samples">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Sample Data</p>
              <h2>Filter and edit all submitted sample records.</h2>
            </div>
            <div className="admin-panel__caption">
              Rejection fields, company assignment, dates, and related patient/package links are all
              editable here.
            </div>
          </div>

          <form className="admin-toolbar" method="get">
            <input defaultValue={q} name="q" placeholder="Find by patient, sample number, package, or company" />
            <select name="company_id" defaultValue={companyFilter}>
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={statusFilter}>
              <option value="">All statuses</option>
              <option value="draft">draft</option>
              <option value="submitted">submitted</option>
              <option value="mailed">mailed</option>
              <option value="received">received</option>
              <option value="ready_for_review">ready_for_review</option>
              <option value="awaiting_documentation">awaiting_documentation</option>
              <option value="rejected">rejected</option>
            </select>
            <select name="rejected" defaultValue={rejectedFilter}>
              <option value="">All review states</option>
              <option value="false">Active</option>
              <option value="true">Rejected</option>
            </select>
            <button className="button button--secondary" type="submit">
              Apply Filters
            </button>
          </form>

          <div className="admin-record-list">
            <div className="admin-record-list__head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Company</span>
              <span>Status</span>
              <span>Sex</span>
              <span>Collected</span>
              <span>Received</span>
            </div>
            {samples.map((sample) => (
              <details className="admin-record" key={sample.id}>
                <summary className="admin-record__summary">
                  <div>
                    <strong>{sample.sample_number}</strong>
                    <span>{sample.package_id ?? "No package assigned"}</span>
                  </div>
                  <div>
                    <strong>
                      {sample.patient_first_name} {sample.patient_last_name}
                    </strong>
                    <span>Patient record</span>
                  </div>
                  <div>
                    <strong>{sample.company_name}</strong>
                    <span>{sample.fedex_package_id ? "Linked package" : "Unassigned package"}</span>
                  </div>
                  <div>
                    <strong>{sample.rejected ? "Rejected" : sample.status}</strong>
                    <span>{sample.rejection_reason ?? "No rejection reason"}</span>
                  </div>
                  <div>
                    <strong>{sample.sex ?? "Not set"}</strong>
                    <span>Sex</span>
                  </div>
                  <div>
                    <strong>{formatDate(sample.collected_at)}</strong>
                    <span>Collected</span>
                  </div>
                  <div className="admin-record__actions">
                    <strong>{formatDate(sample.received_at)}</strong>
                    <span className="admin-record__toggle">Edit</span>
                  </div>
                </summary>

                <form action={updateSampleAction} className="admin-record__details">
                  <input type="hidden" name="id" value={sample.id} />
                  <div className="form-grid form-grid--compact">
                    <div className="field field--compact">
                      <label>Sample number</label>
                      <input name="sample_number" defaultValue={sample.sample_number} required />
                    </div>
                    <div className="field field--compact">
                      <label>Company</label>
                      <input
                        name="company_id"
                        list={`sample-company-options-${sample.id}`}
                        defaultValue={`${sample.company_name} | ${sample.company_id}`}
                      />
                      <datalist id={`sample-company-options-${sample.id}`}>
                        <CompanyLookupOptions companies={companies} />
                      </datalist>
                    </div>
                    <div className="field field--compact">
                      <label>Patient</label>
                      <input
                        name="patient_id"
                        list={`sample-patient-options-${sample.id}`}
                        defaultValue={`${sample.patient_first_name} ${sample.patient_last_name} | ${sample.patient_id}`}
                      />
                      <datalist id={`sample-patient-options-${sample.id}`}>
                        <PatientLookupOptions patients={patients} />
                      </datalist>
                    </div>
                    <div className="field field--compact">
                      <label>FedEx package</label>
                      <input
                        name="fedex_package_id"
                        list={`sample-package-options-${sample.id}`}
                        defaultValue={
                          sample.fedex_package_id && sample.package_id
                            ? `${sample.package_id} | ${sample.fedex_package_id}`
                            : ""
                        }
                        placeholder="Type package ID"
                      />
                      <datalist id={`sample-package-options-${sample.id}`}>
                        <PackageLookupOptions packages={packages} />
                      </datalist>
                    </div>
                    <div className="field field--compact">
                      <label>Status</label>
                      <select name="status" defaultValue={sample.status}>
                        <option value="draft">draft</option>
                        <option value="submitted">submitted</option>
                        <option value="mailed">mailed</option>
                        <option value="received">received</option>
                        <option value="ready_for_review">ready_for_review</option>
                        <option value="awaiting_documentation">awaiting_documentation</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </div>
                    <div className="field field--compact">
                      <label>Rejected</label>
                      <select name="rejected" defaultValue={sample.rejected ? "true" : "false"}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                    <div className="field field--compact">
                      <label>Rejection reason</label>
                      <input name="rejection_reason" defaultValue={sample.rejection_reason ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>Collected at</label>
                      <input name="collected_at" type="date" defaultValue={toDateInput(sample.collected_at)} />
                    </div>
                    <div className="field field--compact">
                      <label>Received at</label>
                      <input name="received_at" type="date" defaultValue={toDateInput(sample.received_at)} />
                    </div>
                  </div>
                  <div className="checkbox-row checkbox-row--compact">
                    <label><input name="hart_cadhs" type="checkbox" defaultChecked={sample.hart_cadhs} /> Hart_CADhs</label>
                    <label><input name="hart_cve" type="checkbox" defaultChecked={sample.hart_cve} /> Hart_CVE</label>
                  </div>
                  <div className="form-grid form-grid--compact">
                    <div className="field field--compact">
                      <label>Collected by</label>
                      <input name="collected_by" defaultValue={sample.collected_by ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>Sex</label>
                      <input name="sex" defaultValue={sample.sex ?? ""} />
                    </div>
                  </div>
                  <Icd10CodeFields values={sample.icd10_codes} compact />
                  <div className="form-subsection form-subsection--compact">
                    <p className="form-subsection__title">Ordering Provider</p>
                    <div className="form-grid form-grid--compact">
                      <div className="field field--compact">
                        <label>Provider name</label>
                        <input
                          name="ordering_provider_name"
                          defaultValue={sample.ordering_provider_name ?? ""}
                        />
                      </div>
                      <div className="field field--compact">
                        <label>NPI #</label>
                        <input
                          name="npi_number"
                          defaultValue={sample.npi_number ?? ""}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="field field--compact">
                    <label>Missing info</label>
                    <textarea name="missing_info" rows={2} defaultValue={sample.missing_info ?? ""} />
                  </div>
                  <div className="admin-record__details-actions">
                    <button className="button button--primary button--compact" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              </details>
            ))}
            {samples.length === 0 && <div className="empty-state">No samples matched the selected filters.</div>}
          </div>
        </section>

        <section className="admin-panel" id="admin-intake">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Create Records</p>
              <h2>Add companies, patients, packages, and samples.</h2>
            </div>
          </div>

          <div className="create-grid">
          <form action={createCompanyAction} className="panel form-panel">
            <p className="eyebrow">Company Directory</p>
            <h3>Create company</h3>
            <div className="field">
              <label>Company name</label>
              <input name="name" required />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Address</label>
                <input name="address_line_1" />
              </div>
              <div className="field">
                <label>City</label>
                <input name="city" />
              </div>
              <div className="field">
                <label>State</label>
                <input name="state" maxLength={2} />
              </div>
              <div className="field">
                <label>Zip code</label>
                <input name="postal_code" />
              </div>
              <div className="field">
                <label>Contact email</label>
                <input name="contact_email" type="email" />
              </div>
              <div className="field">
                <label>Contact phone</label>
                <input name="contact_phone" />
              </div>
            </div>
            <button className="button button--primary" type="submit">
              Create Company
            </button>
          </form>

          <form action={createPatientAction} className="panel form-panel">
            <p className="eyebrow">Patient Intake</p>
            <h3>Create patient</h3>
            <div className="field">
              <label>Company</label>
              <input
                name="company_id"
                list="admin-company-options"
                placeholder="Type company name"
                required
              />
              <datalist id="admin-company-options">
                <CompanyLookupOptions companies={companies} />
              </datalist>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>First name</label>
                <input name="first_name" required />
              </div>
              <div className="field">
                <label>Last name</label>
                <input name="last_name" required />
              </div>
              <div className="field">
                <label>Date of birth</label>
                <input name="date_of_birth" type="date" required />
              </div>
              <div className="field">
                <label>Race / ethnicity</label>
                <input name="race_ethnicity" />
              </div>
              <div className="field">
                <label>Weight (lbs)</label>
                <input name="weight_lbs" type="number" step="0.01" />
              </div>
              <div className="field">
                <label>Height (inches)</label>
                <input name="height_inches" type="number" step="0.01" />
              </div>
            </div>
            <div className="checkbox-row">
              <label><input name="angioplasty_or_stent" type="checkbox" /> Angioplasty or Stent</label>
              <label><input name="cabg" type="checkbox" /> CABG</label>
            </div>
            <button className="button button--secondary" type="submit">
              Create Patient
            </button>
          </form>

          <form action={createPackageAction} className="panel form-panel">
            <p className="eyebrow">FedEx Tracking</p>
            <h3>Create package</h3>
            <div className="field">
              <label>Company</label>
              <select name="company_id" defaultValue="" required>
                <CompanyOptions companies={companies} />
              </select>
            </div>
            <div className="field">
              <label>Package ID</label>
              <input name="package_id" required />
            </div>
            <div className="field">
              <label>Date mailed</label>
              <input name="mailed_at" type="datetime-local" />
            </div>
            <div className="field">
              <label>Date received</label>
              <input name="received_at" type="datetime-local" />
            </div>
            <button className="button button--secondary" type="submit">
              Create Package
            </button>
          </form>

          <form action={createSampleAction} className="panel form-panel">
            <p className="eyebrow">Sample Entry</p>
            <h3>Create sample</h3>
            <div className="field">
              <label>Company</label>
              <select name="company_id" defaultValue="" required>
                <CompanyOptions companies={companies} />
              </select>
            </div>
            <div className="field">
              <label>Sample number</label>
              <input name="sample_number" required />
            </div>
            <div className="field">
              <label>Patient</label>
              <input
                name="patient_id"
                list="admin-patient-options"
                placeholder="Type patient name"
                required
              />
              <datalist id="admin-patient-options">
                <PatientLookupOptions patients={patients} />
              </datalist>
            </div>
            <div className="field">
              <label>FedEx package</label>
              <input
                name="fedex_package_id"
                list="admin-package-options"
                placeholder="Type package ID"
              />
              <datalist id="admin-package-options">
                <PackageLookupOptions packages={packages} />
              </datalist>
            </div>
            <div className="field">
              <label>Status</label>
              <select name="status" defaultValue="submitted">
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="mailed">mailed</option>
                <option value="received">received</option>
                <option value="ready_for_review">ready_for_review</option>
                <option value="awaiting_documentation">awaiting_documentation</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="field">
              <label>Collected at</label>
              <input name="collected_at" type="date" />
            </div>
            <div className="field">
              <label>Received at</label>
              <input name="received_at" type="date" />
            </div>
            <div className="checkbox-row">
              <label><input name="hart_cadhs" type="checkbox" /> Hart_CADhs</label>
              <label><input name="hart_cve" type="checkbox" /> Hart_CVE</label>
            </div>
            <div className="field">
              <label>Collected by</label>
              <input name="collected_by" />
            </div>
            <div className="field">
              <label>Sex</label>
              <input name="sex" />
            </div>
            <Icd10CodeFields values={[]} />
            <div className="form-subsection">
              <p className="form-subsection__title">Ordering Provider</p>
              <div className="form-grid">
                <div className="field">
                  <label>Provider name</label>
                  <input name="ordering_provider_name" />
                </div>
                <div className="field">
                  <label>NPI #</label>
                  <input name="npi_number" inputMode="numeric" />
                </div>
              </div>
            </div>
            <div className="field">
              <label>Missing info</label>
              <textarea name="missing_info" rows={3} />
            </div>
            <button className="button button--primary" type="submit">
              Create Sample
            </button>
          </form>
          </div>
        </section>

        <section className="admin-panel" id="admin-accounts">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Accounts</p>
              <h2>Manage company records and customer/admin assignments.</h2>
            </div>
          </div>

          <div className="data-grid">
          <article className="panel">
            <p className="eyebrow">Companies</p>
            <h3>Editable company directory</h3>
            <div className="list-grid">
              {companies.map((company) => (
                <form action={updateCompanyAction} className="list-row" key={company.id}>
                  <input type="hidden" name="id" value={company.id} />
                  <strong>{company.name}</strong>
                  <div className="form-grid">
                    <div className="field">
                      <label>Name</label>
                      <input name="name" defaultValue={company.name} />
                    </div>
                    <div className="field">
                      <label>Address</label>
                      <input name="address_line_1" defaultValue={company.address_line_1 ?? ""} />
                    </div>
                    <div className="field">
                      <label>City</label>
                      <input name="city" defaultValue={company.city ?? ""} />
                    </div>
                    <div className="field">
                      <label>State</label>
                      <input name="state" defaultValue={company.state ?? ""} maxLength={2} />
                    </div>
                    <div className="field">
                      <label>Zip code</label>
                      <input name="postal_code" defaultValue={company.postal_code ?? ""} />
                    </div>
                    <div className="field">
                      <label>Contact email</label>
                      <input name="contact_email" type="email" defaultValue={company.contact_email ?? ""} />
                    </div>
                    <div className="field">
                      <label>Contact phone</label>
                      <input name="contact_phone" defaultValue={company.contact_phone ?? ""} />
                    </div>
                  </div>
                  <button className="button button--secondary" type="submit">
                    Save Company
                  </button>
                </form>
              ))}
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">User Profiles</p>
            <h3>Customer and admin access</h3>
            <div className="list-grid">
              {accounts.map((account) => (
                <form action={updateUserProfileAction} className="list-row" key={account.id}>
                  <input type="hidden" name="id" value={account.id} />
                  <strong>{userEmailById.get(account.id) ?? "No auth email found"}</strong>
                  <span>Created {formatDate(account.created_at)}</span>
                  <div className="form-grid">
                    <div className="field">
                      <label>First name</label>
                      <input name="first_name" defaultValue={account.first_name ?? ""} />
                    </div>
                    <div className="field">
                      <label>Last name</label>
                      <input name="last_name" defaultValue={account.last_name ?? ""} />
                    </div>
                    <div className="field">
                      <label>Role</label>
                      <select name="role" defaultValue={account.role}>
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Company</label>
                      <select
                        name="company_id"
                        defaultValue={account.role === "admin" ? "" : account.company_id ?? ""}
                        disabled={account.role === "admin"}
                      >
                        <option value="">Unassigned</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {account.role === "admin" && (
                    <span>Admins are not attached to a company.</span>
                  )}
                  <button className="button button--secondary" type="submit">
                    Save User
                  </button>
                </form>
              ))}
            </div>
          </article>
          </div>
        </section>

        <section className="admin-panel" id="admin-records">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Operations</p>
              <h2>Patient, package, and document maintenance.</h2>
            </div>
          </div>

          <div className="data-grid">
          <article className="panel">
            <p className="eyebrow">Patients, Packages, Documents</p>
            <h3>Operational record maintenance</h3>
            <div className="list-grid">
              {patients.map((patient) => (
                <form action={updatePatientAction} className="list-row" key={patient.id}>
                  <input type="hidden" name="id" value={patient.id} />
                  <strong>{patient.first_name} {patient.last_name}</strong>
                  <div className="form-grid">
                    <div className="field">
                      <label>Company</label>
                      <select name="company_id" defaultValue={patient.company_id}>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>First name</label>
                      <input name="first_name" defaultValue={patient.first_name} />
                    </div>
                    <div className="field">
                      <label>Last name</label>
                      <input name="last_name" defaultValue={patient.last_name} />
                    </div>
                    <div className="field">
                      <label>DOB</label>
                      <input name="date_of_birth" type="date" defaultValue={patient.date_of_birth} />
                    </div>
                    <div className="field">
                      <label>Race / ethnicity</label>
                      <input name="race_ethnicity" defaultValue={patient.race_ethnicity ?? ""} />
                    </div>
                    <div className="field">
                      <label>Weight (lbs)</label>
                      <input
                        name="weight_lbs"
                        type="number"
                        step="0.01"
                        defaultValue={patient.weight_lbs ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label>Height (inches)</label>
                      <input
                        name="height_inches"
                        type="number"
                        step="0.01"
                        defaultValue={patient.height_inches ?? ""}
                      />
                    </div>
                  </div>
                  <div className="checkbox-row">
                    <label>
                      <input
                        name="angioplasty_or_stent"
                        type="checkbox"
                        defaultChecked={patient.angioplasty_or_stent}
                      />
                      Angioplasty or Stent
                    </label>
                    <label>
                      <input name="cabg" type="checkbox" defaultChecked={patient.cabg} />
                      CABG
                    </label>
                  </div>
                  <button className="button button--secondary" type="submit">
                    Save Patient
                  </button>
                </form>
              ))}

              {packages.map((entry) => (
                <form action={updatePackageAction} className="list-row" key={entry.id}>
                  <input type="hidden" name="id" value={entry.id} />
                  <strong>{entry.package_id}</strong>
                  <div className="form-grid">
                    <div className="field">
                      <label>Company</label>
                      <select name="company_id" defaultValue={entry.company_id}>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Package ID</label>
                      <input name="package_id" defaultValue={entry.package_id} />
                    </div>
                    <div className="field">
                      <label>Mailed</label>
                      <input name="mailed_at" type="datetime-local" defaultValue={toDateTimeLocal(entry.mailed_at)} />
                    </div>
                    <div className="field">
                      <label>Received</label>
                      <input name="received_at" type="datetime-local" defaultValue={toDateTimeLocal(entry.received_at)} />
                    </div>
                  </div>
                  <button className="button button--secondary" type="submit">
                    Save Package
                  </button>
                </form>
              ))}

              {documents.map((document) => (
                <div className="list-row" key={document.id}>
                  <strong>{document.original_filename}</strong>
                  <span>{document.storage_path}</span>
                </div>
              ))}
            </div>
          </article>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");
  const q = readParam(resolvedSearchParams, "q");
  const companyFilter = readParam(resolvedSearchParams, "company_id");
  const statusFilter = readParam(resolvedSearchParams, "status");
  const rejectedFilter = readParam(resolvedSearchParams, "rejected");
  const customerView = normalizeCustomerView(readParam(resolvedSearchParams, "customer_view"));
  const intakeStep = normalizeIntakeStep(readParam(resolvedSearchParams, "intake_step"));
  const patientDraft: IntakePatientDraft = {
    patientId: readParam(resolvedSearchParams, "patient_id"),
    firstName: readParam(resolvedSearchParams, "first_name"),
    lastName: readParam(resolvedSearchParams, "last_name"),
    dateOfBirth: readParam(resolvedSearchParams, "date_of_birth"),
    city: readParam(resolvedSearchParams, "city"),
    state: readParam(resolvedSearchParams, "state"),
    postalCode: readParam(resolvedSearchParams, "postal_code"),
    raceEthnicity: readParam(resolvedSearchParams, "race_ethnicity"),
    weightLbs: readParam(resolvedSearchParams, "weight_lbs"),
    heightInches: readParam(resolvedSearchParams, "height_inches"),
    angioplastyOrStent: readBooleanParam(resolvedSearchParams, "angioplasty_or_stent"),
    cabg: readBooleanParam(resolvedSearchParams, "cabg"),
  };
  const sampleDraft: IntakeSampleDraft = {
    sampleNumber: readParam(resolvedSearchParams, "sample_number"),
    collectedAt: readParam(resolvedSearchParams, "collected_at"),
    collectedBy: readParam(resolvedSearchParams, "collected_by"),
    sex: readParam(resolvedSearchParams, "sex"),
    orderingProviderName: readParam(resolvedSearchParams, "ordering_provider_name"),
    npiNumber: readParam(resolvedSearchParams, "npi_number"),
    missingInfo: readParam(resolvedSearchParams, "missing_info"),
    icd10Codes: Array.from({ length: 5 }, (_, index) =>
      readParam(resolvedSearchParams, `icd10_code_${index + 1}`),
    ),
    hartCadhs: readBooleanParam(resolvedSearchParams, "hart_cadhs"),
    hartCve: readBooleanParam(resolvedSearchParams, "hart_cve"),
  };
  const packageDraft: IntakePackageDraft = {
    packageId: readParam(resolvedSearchParams, "package_id"),
    mailedAt: readParam(resolvedSearchParams, "mailed_at"),
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthLanding error={error} message={message} />;
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, role, company_id")
    .eq("id", user.id)
    .single();

  const profile = (profileData ?? null) as ProfileRow | null;

  if (profile?.role === "admin") {
    const admin = createSupabaseAdminClient();
    let sampleQuery = admin
      .from("admin_sample_directory")
      .select(
        "id, sample_number, company_id, company_name, patient_id, patient_first_name, patient_last_name, fedex_package_id, package_id, status, rejected, rejection_reason, received_at, collected_at, collected_by, sex, missing_info, icd10_codes, ordering_provider_name, npi_number, hart_cadhs, hart_cve",
      )
      .order("collected_at", { ascending: false })
      .limit(10);

    if (q) {
      const safeQuery = q.replace(/[,]/g, " ");
      sampleQuery = sampleQuery.or(
        `company_name.ilike.%${safeQuery}%,patient_first_name.ilike.%${safeQuery}%,patient_last_name.ilike.%${safeQuery}%,sample_number.ilike.%${safeQuery}%,package_id.ilike.%${safeQuery}%`,
      );
    }

    if (companyFilter) {
      sampleQuery = sampleQuery.eq("company_id", companyFilter);
    }

    if (statusFilter) {
      sampleQuery = sampleQuery.eq("status", statusFilter);
    }

    if (rejectedFilter === "true" || rejectedFilter === "false") {
      sampleQuery = sampleQuery.eq("rejected", rejectedFilter === "true");
    }

    const [companiesResult, accountsResult, samplesResult, patientsResult, packagesResult, documentsResult, authUsersResult] =
      await Promise.all([
        admin
          .from("companies")
          .select("id, name, address_line_1, city, state, postal_code, contact_email, contact_phone")
          .order("name"),
        admin
          .from("admin_user_directory")
          .select("id, first_name, last_name, role, company_id, company_name, created_at")
          .order("created_at", { ascending: false }),
        sampleQuery,
        admin
          .from("patients")
          .select("id, company_id, first_name, last_name, date_of_birth, city, state, postal_code, race_ethnicity, weight_lbs, height_inches, angioplasty_or_stent, cabg, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        admin
          .from("fedex_packages")
          .select("id, company_id, package_id, mailed_at, received_at, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        admin
          .from("patient_documents")
          .select("id, company_id, patient_id, sample_id, original_filename, storage_path")
          .order("created_at", { ascending: false })
          .limit(10),
        admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      ]);

    const userEmailById = new Map(
      (authUsersResult.data.users ?? []).map((authUser) => [authUser.id, authUser.email ?? "No email"]),
    );

    return (
      <AdminWorkspace
        userEmail={user.email ?? "Unknown email"}
        profile={profile}
        companies={(companiesResult.data ?? []) as CompanyRow[]}
        accounts={(accountsResult.data ?? []) as AdminUserRow[]}
        samples={(samplesResult.data ?? []) as AdminSampleRow[]}
        patients={(patientsResult.data ?? []) as PatientRow[]}
        packages={(packagesResult.data ?? []) as PackageRow[]}
        documents={(documentsResult.data ?? []) as DocumentRow[]}
        message={message}
        error={error}
        q={q}
        companyFilter={companyFilter}
        statusFilter={statusFilter}
        rejectedFilter={rejectedFilter}
        userEmailById={userEmailById}
      />
    );
  }

  const companyPromise = profile?.company_id
    ? supabase
        .from("companies")
        .select("id, name, address_line_1, city, state, postal_code, contact_email, contact_phone")
        .eq("id", profile.company_id)
        .single()
    : Promise.resolve({ data: null });

  let sampleQuery = supabase
    .from("sample_search")
    .select("id, sample_number, status, rejected, collected_at, received_at, patient_full_name, company_name, package_id")
    .order("collected_at", { ascending: false })
    .limit(8);

  if (q) {
    const safeQuery = q.replace(/[,]/g, " ");
    sampleQuery = sampleQuery.or(
      `patient_full_name.ilike.%${safeQuery}%,sample_number.ilike.%${safeQuery}%,package_id.ilike.%${safeQuery}%`,
    );
  }

  const [companyResult, samplesResult, patientsResult, packagesResult, documentsResult] = await Promise.all([
    companyPromise,
    sampleQuery,
    supabase
      .from("patients")
      .select("id, company_id, first_name, last_name, date_of_birth, city, state, postal_code, race_ethnicity, weight_lbs, height_inches, angioplasty_or_stent, cabg, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("fedex_packages")
      .select("id, company_id, package_id, mailed_at, received_at, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("patient_documents")
      .select("id, company_id, patient_id, sample_id, original_filename, storage_path")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return (
    <CustomerWorkspace
      userEmail={user.email ?? "Unknown email"}
      profile={profile}
      company={(companyResult.data ?? null) as CompanyRow | null}
      samples={(samplesResult.data ?? []) as SampleRow[]}
      patients={(patientsResult.data ?? []) as PatientRow[]}
      packages={(packagesResult.data ?? []) as PackageRow[]}
      documents={(documentsResult.data ?? []) as DocumentRow[]}
      message={message}
      error={error}
      q={q}
      customerView={customerView}
      intakeStep={intakeStep}
      patientDraft={patientDraft}
      sampleDraft={sampleDraft}
      packageDraft={packageDraft}
    />
  );
}
