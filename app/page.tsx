import {
  approveClinicRequestAction,
  createCompanyAction,
  createCustomerIntakeAction,
  createPackageAction,
  createPatientAction,
  denyClinicRequestAction,
  reviewIncomingSampleAction,
  signInAction,
  signOutAction,
  signUpAction,
  submitContactMessageAction,
  updateAccountApprovalAction,
  updateCustomerAccountAction,
  updateCompanyAction,
  updatePackageAction,
  updatePatientAction,
  updateSampleAction,
  updateUserProfileAction,
  uploadDocumentAction,
} from "./actions";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CustomerView = "home" | "samples" | "intake" | "operations" | "account" | "contact";
type IntakeStep = "patient" | "sample" | "files" | "package" | "review";
export type AdminPage = "overview" | "samples" | "intake" | "clinics" | "accounts" | "operations" | "contact";

type CompanyRow = {
  id: string;
  name: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  fax_number: string | null;
};

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "clinic_admin" | "customer";
  company_id: string | null;
  account_status: string;
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
  created_at: string;
};

type PatientRow = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone_number: string | null;
  email_address: string | null;
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
  company_name?: string;
  patient_id: string;
  patient_first_name?: string;
  patient_last_name?: string;
  sample_id: string;
  sample_number?: string;
  original_filename: string;
  storage_path: string;
  created_at?: string;
};

type IntakePatientDraft = {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  phoneNumber: string;
  emailAddress: string;
  raceEthnicity: string;
  weightLbs: string;
  heightInches: string;
  angioplastyOrStent: boolean;
  cabg: boolean;
};

type IntakeSampleDraft = {
  sampleNumber: string;
  collectedAt: string;
  receivedAt: string;
  collectedBy: string;
  sex: string;
  status: string;
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
  skipPackage: boolean;
};

type AdminUserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "clinic_admin" | "customer";
  account_status: string;
  company_id: string | null;
  company_name: string | null;
  created_at: string;
};

type ClinicRequestRow = {
  id: string;
  clinic_name: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  contact_email: string;
  contact_phone: string;
  fax_number: string | null;
  requester_first_name: string;
  requester_last_name: string;
  requester_email: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type ContactMessageRow = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  institution: string | null;
  purpose: string | null;
  source: string | null;
  message: string;
  status: string;
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
  if (
    value === "samples" ||
    value === "intake" ||
    value === "operations" ||
    value === "account" ||
    value === "contact"
  ) {
    return value;
  }

  return "home";
}

function normalizeIntakeStep(value: string): IntakeStep {
  if (value === "sample" || value === "files" || value === "package" || value === "review") {
    return value;
  }

  return "patient";
}

function buildPath(pathname: string, params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
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

function nextDateString(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function CompanyOptions({ companies }: { companies: CompanyRow[] }) {
  return (
    <>
      <option value="" disabled>
        Select a clinic
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

function SampleLookupOptions({ samples }: { samples: SampleRow[] }) {
  return (
    <>
      {samples.map((sample) => (
        <option key={sample.id} value={`${sample.sample_number} | ${sample.id}`} />
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
    <a className={`customer-site-link ${active ? "customer-site-link--active" : ""}`} href={href}>
      {label}
    </a>
  );
}

function ReviewItem({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const displayValue =
    typeof value === "boolean" ? (value ? "Yes" : "No") : value?.toString().trim() || "Not provided";

  return (
    <div className="review-item">
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
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
            <img className="brand-logo brand-logo--full" src="/completeomics-logo.png" alt="Complete Omics" />
          </div>

          <h1>Customer Portal</h1>
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
            <input type="hidden" name="login_scope" value="customer" />
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
            <a className="customer-login-panel__link" href="/signup?request_clinic=true">
              Request to add a clinic
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

function PendingApproval({ userEmail, profile }: { userEmail: string; profile: ProfileRow | null }) {
  const denied = profile?.account_status === "denied";

  return (
    <main className="customer-login-page">
      <div className="customer-login-bg">
        <span className="customer-login-bg__cell customer-login-bg__cell--one" />
        <span className="customer-login-bg__cell customer-login-bg__cell--two" />
        <span className="customer-login-bg__cell customer-login-bg__cell--three" />
      </div>

      <section className="customer-login-shell">
        <aside className="customer-login-brand">
          <div className="customer-login-brand__logo">
            <img className="brand-logo brand-logo--full" src="/completeomics-logo.png" alt="Complete Omics" />
          </div>
          <h1>{denied ? "Access Denied" : "Approval Pending"}</h1>
        </aside>

        <section className="customer-login-panel">
          <div className="customer-login-panel__header">
            <h2>{denied ? "Account not approved" : "Waiting for clinic approval"}</h2>
          </div>
          <p className="signup-helper-text">
            {denied
              ? "This customer account was denied by an admin. Contact Complete Omics if this looks incorrect."
              : "Your account was created, but a clinic admin or Complete Omics admin must approve it before you can use the portal."}
          </p>
          <p className="signup-helper-text">Signed in as {userEmail}</p>
          <form action={signOutAction}>
            <button className="button button--primary" type="submit">
              Sign Out
            </button>
          </form>
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
  sampleNumberFilter,
  patientFilter,
  sampleStatusFilter,
  collectedDateFilter,
  receivedDateFilter,
  packageFilter,
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
  sampleNumberFilter: string;
  patientFilter: string;
  sampleStatusFilter: string;
  collectedDateFilter: string;
  receivedDateFilter: string;
  packageFilter: string;
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
  const canAdvanceToFiles = canAdvanceToSample && Boolean(sampleDraft.sampleNumber);
  const canAdvanceToPackage = canAdvanceToFiles;
  const patientStepHref = buildPath("/", { customer_view: "intake", intake_step: "patient" });
  const sampleStepHref = buildPath("/", {
    customer_view: "intake",
    intake_step: "sample",
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
  });
  const filesStepHref = buildPath("/", {
    customer_view: "intake",
    intake_step: "files",
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
    sample_number: sampleDraft.sampleNumber,
    collected_at: sampleDraft.collectedAt,
    received_at: sampleDraft.receivedAt,
    status: sampleDraft.status,
    collected_by: sampleDraft.collectedBy,
    sex: sampleDraft.sex,
    ordering_provider_name: sampleDraft.orderingProviderName,
    npi_number: sampleDraft.npiNumber,
    missing_info: sampleDraft.missingInfo,
    icd10_code_1: sampleDraft.icd10Codes[0],
    icd10_code_2: sampleDraft.icd10Codes[1],
    icd10_code_3: sampleDraft.icd10Codes[2],
    icd10_code_4: sampleDraft.icd10Codes[3],
    icd10_code_5: sampleDraft.icd10Codes[4],
    hart_cadhs: sampleDraft.hartCadhs ? "true" : "false",
    hart_cve: sampleDraft.hartCve ? "true" : "false",
  });
  const packageStepHref = buildPath("/", {
    customer_view: "intake",
    intake_step: "package",
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
    sample_number: sampleDraft.sampleNumber,
    collected_at: sampleDraft.collectedAt,
    received_at: sampleDraft.receivedAt,
    status: sampleDraft.status,
    collected_by: sampleDraft.collectedBy,
    sex: sampleDraft.sex,
    ordering_provider_name: sampleDraft.orderingProviderName,
    npi_number: sampleDraft.npiNumber,
    missing_info: sampleDraft.missingInfo,
    icd10_code_1: sampleDraft.icd10Codes[0],
    icd10_code_2: sampleDraft.icd10Codes[1],
    icd10_code_3: sampleDraft.icd10Codes[2],
    icd10_code_4: sampleDraft.icd10Codes[3],
    icd10_code_5: sampleDraft.icd10Codes[4],
    hart_cadhs: sampleDraft.hartCadhs ? "true" : "false",
    hart_cve: sampleDraft.hartCve ? "true" : "false",
    package_id: packageDraft.packageId,
    mailed_at: packageDraft.mailedAt,
    skip_package: packageDraft.skipPackage ? "true" : "false",
  });

  return (
    <main className="customer-site-shell">
      <header className="customer-site-nav">
        <a className="customer-site-brand" href="/?customer_view=home" aria-label="Complete Omics customer portal">
          <img className="brand-logo brand-logo--customer" src="/completeomics-logo.png" alt="Complete Omics" />
        </a>

        <nav className="customer-site-nav__links" aria-label="Customer portal">
          <CustomerShellLink href="/?customer_view=home" label="Home" active={customerView === "home"} />
          <CustomerShellLink
            href="/?customer_view=samples"
            label="Clinic Samples"
            active={customerView === "samples"}
          />
          <CustomerShellLink
            href="/?customer_view=intake&intake_step=patient"
            label="Add Sample"
            active={customerView === "intake"}
          />
          <CustomerShellLink
            href="/?customer_view=operations"
            label="Documents"
            active={customerView === "operations"}
          />
        </nav>

        <div className="customer-site-nav__meta">
          <label className="customer-menu-button" htmlFor="customer-menu-toggle" aria-label="Open customer menu">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} />
            ))}
          </label>
        </div>
      </header>

      <input className="customer-menu-toggle" id="customer-menu-toggle" type="checkbox" aria-hidden="true" />
      <label className="customer-menu-scrim" htmlFor="customer-menu-toggle" aria-label="Close customer menu" />
      <aside className="customer-drawer" aria-label="Customer menu">
        <div className="customer-drawer__header">
          <div>
            <p className="eyebrow">Portal Menu</p>
            <h2>{company?.name ?? "Complete Omics"}</h2>
          </div>
          <label className="customer-drawer__close" htmlFor="customer-menu-toggle" aria-label="Close customer menu">
            <span />
          </label>
        </div>
        <nav className="customer-drawer__nav">
          <CustomerShellLink href="/?customer_view=home" label="Home" active={customerView === "home"} />
          <CustomerShellLink href="/?customer_view=samples" label="Clinic Samples" active={customerView === "samples"} />
          <CustomerShellLink href="/?customer_view=intake&intake_step=patient" label="Add Sample" active={customerView === "intake"} />
          <CustomerShellLink href="/?customer_view=operations" label="Documents" active={customerView === "operations"} />
          <CustomerShellLink href="/?customer_view=account" label="Account" active={customerView === "account"} />
          <CustomerShellLink href="/?customer_view=contact" label="Contact Us" active={customerView === "contact"} />
        </nav>
        <form action={signOutAction}>
          <button className="button button--secondary" type="submit">
            Sign Out
          </button>
        </form>
      </aside>

      <div className="customer-site-content">
        {customerView === "home" && (
          <section className="customer-site-hero customer-header" id="customer-overview">
            <div className="customer-site-hero__copy">
              <div>
                <p className="eyebrow">Customer Portal</p>
                <h1>{profile?.first_name ? `${profile.first_name}'s Workspace` : "Portal Workspace"}</h1>
                <p>
                  Submit patient and sample information directly into the Complete Omics database,
                  then track files and FedEx packages from one secure clinic workspace.
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
          </section>
        )}

        {(message || error) && (
          <div className={`status-banner customer-status-banner ${error ? "status-banner--error" : ""}`}>
            {error || message}
          </div>
        )}

        {customerView === "home" && (
          <section className="admin-panel customer-panel customer-home">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">Start Here</p>
                <h2>Clinic workspace</h2>
              </div>
            </div>

            <div className="customer-home__actions">
              <a className="panel customer-action-card" href="/?customer_view=samples">
                <p className="eyebrow">Review</p>
                <h3>View clinic samples</h3>
                <span>{samples.length} recent samples</span>
              </a>
              <a className="panel customer-action-card" href="/?customer_view=intake&intake_step=patient">
                <p className="eyebrow">Intake</p>
                <h3>Add a sample</h3>
                <span>4 guided steps</span>
              </a>
              <a className="panel customer-action-card" href="/?customer_view=operations">
                <p className="eyebrow">Documents</p>
                <h3>Upload documents</h3>
                <span>{documents.length} tracked files</span>
              </a>
            </div>

            <div className="customer-home__summary">
              <article className="panel">
                <p className="eyebrow">Clinic Scope</p>
                <h3>{company?.name ?? "Assigned clinic"}</h3>
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
              <h2>Clinic samples</h2>
            </div>
          </div>

          <form className="table table--filters" method="get">
            <input type="hidden" name="customer_view" value="samples" />
            <div className="table__head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Status</span>
              <span>Collected</span>
              <span>Received</span>
              <span>Package</span>
            </div>
            <div className="table__filters">
              <input name="sample_filter_number" defaultValue={sampleNumberFilter} placeholder="Filter sample" />
              <input name="sample_filter_patient" defaultValue={patientFilter} placeholder="Filter patient" />
              <input name="sample_filter_status" defaultValue={sampleStatusFilter} placeholder="Filter status" />
              <input name="sample_filter_collected" type="date" defaultValue={collectedDateFilter} />
              <input name="sample_filter_received" type="date" defaultValue={receivedDateFilter} />
              <input name="sample_filter_package" defaultValue={packageFilter} placeholder="Filter package" />
            </div>
            <div className="table__actions">
              <button className="button button--secondary" type="submit">
                Apply Filters
              </button>
              <a className="button button--ghost" href="/?customer_view=samples">
                Clear
              </a>
            </div>
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
            {samples.length === 0 && <div className="empty-state">No samples matched the selected column filters.</div>}
          </div>
        </section>}

        {customerView === "intake" && <section className="admin-panel customer-panel" id="customer-intake">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Guided Intake</p>
              <h2>Add a sample</h2>
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
            <div className={`customer-step ${intakeStep === "files" ? "customer-step--active" : ""}`}>
              <span>3</span>
              <strong>Files</strong>
            </div>
            <div className={`customer-step ${intakeStep === "package" ? "customer-step--active" : ""}`}>
              <span>4</span>
              <strong>FedEx</strong>
            </div>
            <div className={`customer-step ${intakeStep === "review" ? "customer-step--active" : ""}`}>
              <span>5</span>
              <strong>Review</strong>
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
                  <label>Street address</label>
                  <input name="address_line_1" defaultValue={patientDraft.addressLine1} />
                </div>
                <div className="field">
                  <label>City</label>
                  <input name="city" defaultValue={patientDraft.city} />
                </div>
                <div className="field">
                  <label>State</label>
                  <input name="state" defaultValue={patientDraft.state} maxLength={2} />
                </div>
                <div className="field">
                  <label>Zip code</label>
                  <input name="postal_code" defaultValue={patientDraft.postalCode} />
                </div>
                <div className="field">
                  <label>Phone number</label>
                  <input name="phone_number" defaultValue={patientDraft.phoneNumber} />
                </div>
                <div className="field">
                  <label>Email address</label>
                  <input name="email_address" type="email" defaultValue={patientDraft.emailAddress} />
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
                  Coronary Artery Bypass Graft (CABG)
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
              <input type="hidden" name="intake_step" value="files" />
              <input type="hidden" name="patient_id" value={patientDraft.patientId} />
              <input type="hidden" name="first_name" value={patientDraft.firstName} />
              <input type="hidden" name="last_name" value={patientDraft.lastName} />
              <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
              <input type="hidden" name="address_line_1" value={patientDraft.addressLine1} />
              <input type="hidden" name="city" value={patientDraft.city} />
              <input type="hidden" name="state" value={patientDraft.state} />
              <input type="hidden" name="postal_code" value={patientDraft.postalCode} />
              <input type="hidden" name="phone_number" value={patientDraft.phoneNumber} />
              <input type="hidden" name="email_address" value={patientDraft.emailAddress} />
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
                <a className="button button--secondary" href={patientStepHref}>
                  Back to Patient
                </a>
                <button className="button button--primary" type="submit" disabled={!canAdvanceToFiles}>
                  Continue to Files
                </button>
              </div>
            </form>
          )}

          {intakeStep === "files" && (
            <div className="panel form-panel customer-wizard">
              <p className="eyebrow">Step 3</p>
              <h3>Documents are uploaded after the sample is created</h3>
              <p className="signup-helper-text">
                To keep every document tied to the correct patient and sample, finish the sample intake first.
                After submission, use the Documents tab to upload files for that patient and sample.
              </p>
              <div className="customer-wizard__actions">
                <a className="button button--secondary" href={sampleStepHref}>
                  Back to Sample
                </a>
                <a className="button button--primary" href={packageStepHref}>
                  Continue to FedEx
                </a>
              </div>
            </div>
          )}

          {intakeStep === "package" && (
            <form className="panel form-panel customer-wizard" method="get">
              <input type="hidden" name="customer_view" value="intake" />
              <input type="hidden" name="intake_step" value="review" />
              <input type="hidden" name="patient_id" value={patientDraft.patientId} />
              <input type="hidden" name="first_name" value={patientDraft.firstName} />
              <input type="hidden" name="last_name" value={patientDraft.lastName} />
              <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
              <input type="hidden" name="address_line_1" value={patientDraft.addressLine1} />
              <input type="hidden" name="city" value={patientDraft.city} />
              <input type="hidden" name="state" value={patientDraft.state} />
              <input type="hidden" name="postal_code" value={patientDraft.postalCode} />
              <input type="hidden" name="phone_number" value={patientDraft.phoneNumber} />
              <input type="hidden" name="email_address" value={patientDraft.emailAddress} />
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
              <p className="eyebrow">Step 4</p>
              <h3>Find an existing FedEx package, create a new one, or skip this step</h3>
              {!canAdvanceToPackage && (
                <div className="status-banner status-banner--error">
                  Enter the sample details before opening the FedEx step.
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label>Existing package or new package ID</label>
                  <input
                    name="package_id"
                    list="customer-package-options"
                    defaultValue={packageDraft.packageId}
                    placeholder="Type package ID"
                  />
                  <datalist id="customer-package-options">
                    <PackageLookupOptions packages={packages} />
                  </datalist>
                </div>
                <div className="field">
                  <label>Date mailed for new package</label>
                  <input name="mailed_at" type="datetime-local" defaultValue={packageDraft.mailedAt} />
                </div>
              </div>
              <div className="customer-wizard__actions">
                <a className="button button--secondary" href={filesStepHref}>
                  Back to Files
                </a>
                <button className="button button--secondary" name="skip_package" type="submit" value="true" disabled={!canAdvanceToPackage}>
                  Skip and Review
                </button>
                <button className="button button--primary" type="submit" disabled={!canAdvanceToPackage}>
                  Continue to Review
                </button>
              </div>
            </form>
          )}

          {intakeStep === "review" && (
            <form action={createCustomerIntakeAction} className="panel form-panel customer-wizard">
              <input type="hidden" name="patient_id" value={patientDraft.patientId} />
              <input type="hidden" name="first_name" value={patientDraft.firstName} />
              <input type="hidden" name="last_name" value={patientDraft.lastName} />
              <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
              <input type="hidden" name="address_line_1" value={patientDraft.addressLine1} />
              <input type="hidden" name="city" value={patientDraft.city} />
              <input type="hidden" name="state" value={patientDraft.state} />
              <input type="hidden" name="postal_code" value={patientDraft.postalCode} />
              <input type="hidden" name="phone_number" value={patientDraft.phoneNumber} />
              <input type="hidden" name="email_address" value={patientDraft.emailAddress} />
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
              <input type="hidden" name="package_id" value={packageDraft.packageId} />
              <input type="hidden" name="mailed_at" value={packageDraft.mailedAt} />
              <input type="hidden" name="skip_package" value={packageDraft.skipPackage ? "true" : "false"} />
              <p className="eyebrow">Step 5</p>
              <h3>Review before submitting</h3>
              {!canAdvanceToPackage && (
                <div className="status-banner status-banner--error">
                  Complete the patient and sample details before submitting.
                </div>
              )}
              <div className="review-grid">
                <section className="review-card">
                  <p className="form-subsection__title">Patient</p>
                  <ReviewItem label="Existing patient" value={patientDraft.patientId} />
                  <ReviewItem label="First name" value={patientDraft.firstName} />
                  <ReviewItem label="Last name" value={patientDraft.lastName} />
                  <ReviewItem label="Date of birth" value={patientDraft.dateOfBirth} />
                  <ReviewItem label="Phone" value={patientDraft.phoneNumber} />
                  <ReviewItem label="Email" value={patientDraft.emailAddress} />
                </section>
                <section className="review-card">
                  <p className="form-subsection__title">Sample</p>
                  <ReviewItem label="Sample number" value={sampleDraft.sampleNumber} />
                  <ReviewItem label="Collected date" value={sampleDraft.collectedAt} />
                  <ReviewItem label="Collected by" value={sampleDraft.collectedBy} />
                  <ReviewItem label="Sex" value={sampleDraft.sex} />
                  <ReviewItem label="Provider" value={sampleDraft.orderingProviderName} />
                  <ReviewItem label="NPI #" value={sampleDraft.npiNumber} />
                </section>
                <section className="review-card">
                  <p className="form-subsection__title">Diagnosis</p>
                  <ReviewItem label="ICD10 codes" value={sampleDraft.icd10Codes.filter(Boolean).join(", ")} />
                  <ReviewItem label="Hart_CADhs" value={sampleDraft.hartCadhs} />
                  <ReviewItem label="Hart_CVE" value={sampleDraft.hartCve} />
                  <ReviewItem label="Missing info notes" value={sampleDraft.missingInfo} />
                </section>
                <section className="review-card">
                  <p className="form-subsection__title">FedEx</p>
                  <ReviewItem label="Package skipped" value={packageDraft.skipPackage} />
                  <ReviewItem label="Package ID" value={packageDraft.skipPackage ? "" : packageDraft.packageId} />
                  <ReviewItem label="Date mailed" value={packageDraft.skipPackage ? "" : packageDraft.mailedAt} />
                </section>
              </div>
              <div className="customer-wizard__actions">
                <a className="button button--secondary" href={packageStepHref}>
                  Back to FedEx
                </a>
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
              <p className="eyebrow">Documents</p>
              <h2>Patient and sample documents</h2>
            </div>
          </div>

          <div className="create-grid">
          <form action={uploadDocumentAction} className="panel form-panel">
            <p className="eyebrow">Document Upload</p>
            <h3>Attach to patient and sample</h3>
            <div className="field">
              <label>Patient</label>
              <input
                name="patient_id"
                list="customer-upload-patient-options"
                placeholder="Type patient name"
                required
              />
              <datalist id="customer-upload-patient-options">
                <PatientLookupOptions patients={patients} />
              </datalist>
            </div>
            <div className="field">
              <label>Sample</label>
              <input
                name="sample_id"
                list="customer-upload-sample-options"
                placeholder="Type sample number"
                required
              />
              <datalist id="customer-upload-sample-options">
                <SampleLookupOptions samples={samples} />
              </datalist>
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
          <article className="panel panel--wide">
            <p className="eyebrow">Uploaded Documents</p>
            <h3>Search by patient or sample</h3>
            <div className="list-grid">
              {documents.map((document) => (
                <div className="list-row" key={document.id}>
                  <strong>{document.original_filename}</strong>
                  <span>
                    {[document.patient_first_name, document.patient_last_name].filter(Boolean).join(" ") || "Patient not found"}
                    {" | "}
                    {document.sample_number ?? "Sample not found"}
                  </span>
                </div>
              ))}
              {documents.length === 0 && <div className="empty-state">No documents uploaded yet.</div>}
            </div>
          </article>
          </div>
        </section>}

        {customerView === "account" && (
          <section className="admin-panel customer-panel" id="customer-account">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">Account</p>
                <h2>Account information</h2>
              </div>
            </div>

            <div className="create-grid">
              <form action={updateCustomerAccountAction} className="panel form-panel">
                <input type="hidden" name="redirect_to" value="/?customer_view=account" />
                <p className="eyebrow">Profile</p>
                <h3>Update your name</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>First name</label>
                    <input name="first_name" defaultValue={profile?.first_name ?? ""} placeholder="Enter here" />
                  </div>
                  <div className="field">
                    <label>Last name</label>
                    <input name="last_name" defaultValue={profile?.last_name ?? ""} placeholder="Enter here" />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input value={userEmail} readOnly />
                  </div>
                  <div className="field">
                    <label>Clinic</label>
                    <input value={company?.name ?? "Clinic not assigned"} readOnly />
                  </div>
                </div>
                <button className="button button--primary" type="submit">
                  Save Account
                </button>
              </form>

              <article className="panel">
                <p className="eyebrow">Clinic Details</p>
                <h3>{company?.name ?? "Assigned clinic"}</h3>
                <div className="list-grid">
                  <div className="list-row">
                    <strong>Address</strong>
                    <span>
                      {[company?.address_line_1, company?.city, company?.state, company?.postal_code]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </span>
                  </div>
                  <div className="list-row">
                    <strong>Clinic Contact</strong>
                    <span>{company?.contact_phone ?? "Phone not provided"}</span>
                    <span>{company?.contact_email ?? "Email not provided"}</span>
                  </div>
                </div>
              </article>

              <article className="panel">
                <h3>CSV Exports</h3>
                <div className="export-button-grid">
                  <a className="button button--secondary button--compact" href="/api/export?entity=samples">
                    Sample Data
                  </a>
                  <a className="button button--secondary button--compact" href="/api/export?entity=patients">
                    Patient Data
                  </a>
                  <a className="button button--secondary button--compact" href="/api/export?entity=clinics">
                    Clinic Data
                  </a>
                  <a className="button button--secondary button--compact" href="/api/export?entity=fedex">
                    FedEx Data
                  </a>
                </div>
              </article>
            </div>
          </section>
        )}

        {customerView === "contact" && (
          <section className="customer-contact-page customer-panel" id="customer-contact">
            <div className="customer-contact-hero">
              <p className="eyebrow">Contact Us</p>
              <h2>We are looking forward to hearing from YOU!</h2>
              <p>
                Send a question, request support, or reach out about Complete Omics services.
                Your message can be routed to the right team by purpose.
              </p>
            </div>

            <div className="customer-contact-layout">
              <form action={submitContactMessageAction} className="panel form-panel customer-contact-form">
                <input type="hidden" name="redirect_to" value="/?customer_view=contact" />
                <div className="form-grid">
                  <div className="field">
                    <label>First name</label>
                    <input name="first_name" defaultValue={profile?.first_name ?? ""} placeholder="Enter here" />
                  </div>
                  <div className="field">
                    <label>Last name</label>
                    <input name="last_name" defaultValue={profile?.last_name ?? ""} placeholder="Enter here" />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input name="email" type="email" defaultValue={userEmail} placeholder="Enter here" required />
                  </div>
                  <div className="field">
                    <label>Institution</label>
                    <input name="institution" defaultValue={company?.name ?? ""} placeholder="Enter here" />
                  </div>
                  <div className="field">
                    <label>Purpose of Contact</label>
                    <select name="purpose" defaultValue="">
                      <option value="" disabled>
                        Select a category
                      </option>
                      <option>Customer portal support</option>
                      <option>Ask a question</option>
                      <option>Request a quote</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>How did you hear about us?</label>
                    <select name="source" defaultValue="">
                      <option value="" disabled>
                        Select a channel
                      </option>
                      <option>Complete Omics website</option>
                      <option>Clinic referral</option>
                      <option>Conference or event</option>
                      <option>Publication</option>
                      <option>Search engine</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Comment or Message</label>
                  <textarea
                    name="message"
                    rows={6}
                    placeholder="Ask a question, request support, or message the Complete Omics team."
                    required
                  />
                </div>
                <button className="button button--primary" type="submit">
                  Send Message
                </button>
              </form>

              <aside className="customer-contact-info">
                <article className="customer-contact-info__card">
                  <p className="eyebrow">Have a Project?</p>
                  <h3>info@completeomics.com</h3>
                  <a href="mailto:info@completeomics.com">Email us</a>
                </article>
                <article className="customer-contact-info__card">
                  <p className="eyebrow">Office</p>
                  <h3>1448 South Rolling Rd</h3>
                  <span>Baltimore, MD 21227</span>
                </article>
                <article className="customer-contact-info__card">
                  <p className="eyebrow">Phone</p>
                  <h3>+1 410 215 2760</h3>
                  <a href="tel:+14102152760">Call Complete Omics</a>
                </article>
                <article className="customer-contact-info__card">
                  <p className="eyebrow">Website</p>
                  <h3>completeomics.com</h3>
                  <a href="https://www.completeomics.com/contact-us/" target="_blank" rel="noreferrer">
                    Open public contact page
                  </a>
                </article>
              </aside>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export async function loadAdminWorkspaceData(
  resolvedSearchParams: Record<string, string | string[] | undefined>,
) {
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");
  const q = readParam(resolvedSearchParams, "q");
  const companyFilter = readParam(resolvedSearchParams, "company_id");
  const statusFilter = readParam(resolvedSearchParams, "status");
  const rejectedFilter = readParam(resolvedSearchParams, "rejected");
  const documentSearch = readParam(resolvedSearchParams, "document_q");
  const adminSampleNumberFilter = readParam(resolvedSearchParams, "admin_sample_number");
  const adminPatientFilter = readParam(resolvedSearchParams, "admin_patient");
  const adminClinicFilter = readParam(resolvedSearchParams, "admin_clinic");
  const adminStatusFilter = readParam(resolvedSearchParams, "admin_status");
  const adminSexFilter = readParam(resolvedSearchParams, "admin_sex");
  const adminHartCadhsFilter = readParam(resolvedSearchParams, "admin_hart_cadhs");
  const adminHartCveFilter = readParam(resolvedSearchParams, "admin_hart_cve");
  const adminCollectedFilter = readParam(resolvedSearchParams, "admin_collected");
  const adminReceivedFilter = readParam(resolvedSearchParams, "admin_received");
  const intakeStep = normalizeIntakeStep(readParam(resolvedSearchParams, "intake_step"));
  const adminIntakeCompanyId = readParam(resolvedSearchParams, "admin_intake_company_id");
  const patientDraft: IntakePatientDraft = {
    patientId: readParam(resolvedSearchParams, "patient_id"),
    firstName: readParam(resolvedSearchParams, "first_name"),
    lastName: readParam(resolvedSearchParams, "last_name"),
    dateOfBirth: readParam(resolvedSearchParams, "date_of_birth"),
    addressLine1: readParam(resolvedSearchParams, "address_line_1"),
    city: readParam(resolvedSearchParams, "city"),
    state: readParam(resolvedSearchParams, "state"),
    postalCode: readParam(resolvedSearchParams, "postal_code"),
    phoneNumber: readParam(resolvedSearchParams, "phone_number"),
    emailAddress: readParam(resolvedSearchParams, "email_address"),
    raceEthnicity: readParam(resolvedSearchParams, "race_ethnicity"),
    weightLbs: readParam(resolvedSearchParams, "weight_lbs"),
    heightInches: readParam(resolvedSearchParams, "height_inches"),
    angioplastyOrStent: readBooleanParam(resolvedSearchParams, "angioplasty_or_stent"),
    cabg: readBooleanParam(resolvedSearchParams, "cabg"),
  };
  const sampleDraft: IntakeSampleDraft = {
    sampleNumber: readParam(resolvedSearchParams, "sample_number"),
    collectedAt: readParam(resolvedSearchParams, "collected_at"),
    receivedAt: readParam(resolvedSearchParams, "received_at"),
    collectedBy: readParam(resolvedSearchParams, "collected_by"),
    sex: readParam(resolvedSearchParams, "sex"),
    status: readParam(resolvedSearchParams, "status"),
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
    skipPackage: readBooleanParam(resolvedSearchParams, "skip_package"),
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin?error=You%20must%20sign%20in%20to%20continue.");
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, role, company_id, account_status")
    .eq("id", user.id)
    .single();

  const profile = (profileData ?? null) as ProfileRow | null;

  if (profile?.role !== "admin" && profile?.role !== "clinic_admin") {
    redirect("/");
  }

  const admin = createSupabaseAdminClient();
  const isUltimateAdmin = profile.role === "admin";
  const staffCompanyId = profile.company_id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const todayStartIso = todayStart.toISOString();
  const tomorrowStartIso = tomorrowStart.toISOString();
  let sampleQuery = admin
    .from("admin_sample_directory")
    .select(
      "id, sample_number, company_id, company_name, patient_id, patient_first_name, patient_last_name, fedex_package_id, package_id, status, rejected, rejection_reason, received_at, collected_at, collected_by, sex, missing_info, icd10_codes, ordering_provider_name, npi_number, hart_cadhs, hart_cve, created_at",
    )
    .order("collected_at", { ascending: false })
    .limit(10);

  if (q) {
    const safeQuery = q.replace(/[,]/g, " ");
    sampleQuery = sampleQuery.or(
      `company_name.ilike.%${safeQuery}%,patient_first_name.ilike.%${safeQuery}%,patient_last_name.ilike.%${safeQuery}%,sample_number.ilike.%${safeQuery}%,package_id.ilike.%${safeQuery}%`,
    );
  }

  if (!isUltimateAdmin && staffCompanyId) {
    sampleQuery = sampleQuery.eq("company_id", staffCompanyId);
  } else if (companyFilter) {
    sampleQuery = sampleQuery.eq("company_id", companyFilter);
  }

  if (statusFilter) {
    sampleQuery = sampleQuery.eq("status", statusFilter);
  }

  if (rejectedFilter === "true" || rejectedFilter === "false") {
    sampleQuery = sampleQuery.eq("rejected", rejectedFilter === "true");
  }

  if (adminSampleNumberFilter) {
    sampleQuery = sampleQuery.ilike("sample_number", `%${adminSampleNumberFilter}%`);
  }

  if (adminPatientFilter) {
    const safePatient = adminPatientFilter.replace(/[,]/g, " ");
    sampleQuery = sampleQuery.or(`patient_first_name.ilike.%${safePatient}%,patient_last_name.ilike.%${safePatient}%`);
  }

  if (adminClinicFilter) {
    sampleQuery = sampleQuery.ilike("company_name", `%${adminClinicFilter}%`);
  }

  if (adminStatusFilter) {
    sampleQuery = sampleQuery.eq("status", adminStatusFilter);
  }

  if (adminSexFilter) {
    sampleQuery = sampleQuery.ilike("sex", `%${adminSexFilter}%`);
  }

  if (adminHartCadhsFilter === "true" || adminHartCadhsFilter === "false") {
    sampleQuery = sampleQuery.eq("hart_cadhs", adminHartCadhsFilter === "true");
  }

  if (adminHartCveFilter === "true" || adminHartCveFilter === "false") {
    sampleQuery = sampleQuery.eq("hart_cve", adminHartCveFilter === "true");
  }

  if (adminCollectedFilter) {
    const nextCollectedDate = nextDateString(adminCollectedFilter);
    if (nextCollectedDate) {
      sampleQuery = sampleQuery.gte("collected_at", adminCollectedFilter).lt("collected_at", nextCollectedDate);
    }
  }

  if (adminReceivedFilter) {
    const nextReceivedDate = nextDateString(adminReceivedFilter);
    if (nextReceivedDate) {
      sampleQuery = sampleQuery.gte("received_at", adminReceivedFilter).lt("received_at", nextReceivedDate);
    }
  }

  let documentQuery = admin
    .from("document_directory")
    .select("id, company_id, company_name, patient_id, patient_first_name, patient_last_name, sample_id, sample_number, original_filename, storage_path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isUltimateAdmin && staffCompanyId) {
    documentQuery = documentQuery.eq("company_id", staffCompanyId);
  }

  if (documentSearch) {
    const safeDocumentSearch = documentSearch.replace(/[,]/g, " ");
    documentQuery = documentQuery.or(
      `patient_first_name.ilike.%${safeDocumentSearch}%,patient_last_name.ilike.%${safeDocumentSearch}%,sample_number.ilike.%${safeDocumentSearch}%,original_filename.ilike.%${safeDocumentSearch}%`,
    );
  }

  let contactMessagesQuery = admin
    .from("contact_message_directory")
    .select("id, user_id, company_id, company_name, first_name, last_name, email, institution, purpose, source, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!isUltimateAdmin && staffCompanyId) {
    contactMessagesQuery = contactMessagesQuery.eq("company_id", staffCompanyId);
  }

  let todaySamplesQuery = admin
    .from("admin_sample_directory")
    .select(
      "id, sample_number, company_id, company_name, patient_id, patient_first_name, patient_last_name, fedex_package_id, package_id, status, rejected, rejection_reason, received_at, collected_at, collected_by, sex, missing_info, icd10_codes, ordering_provider_name, npi_number, hart_cadhs, hart_cve, created_at",
    )
    .gte("created_at", todayStartIso)
    .lt("created_at", tomorrowStartIso)
    .order("created_at", { ascending: false });

  let todayPatientsQuery = admin
    .from("patients")
    .select("id, company_id, first_name, last_name, date_of_birth, address_line_1, city, state, postal_code, phone_number, email_address, race_ethnicity, weight_lbs, height_inches, angioplasty_or_stent, cabg, created_at")
    .gte("created_at", todayStartIso)
    .lt("created_at", tomorrowStartIso)
    .order("created_at", { ascending: false });

  let todayDocumentsQuery = admin
    .from("document_directory")
    .select("id, company_id, company_name, patient_id, patient_first_name, patient_last_name, sample_id, sample_number, original_filename, storage_path, created_at")
    .gte("created_at", todayStartIso)
    .lt("created_at", tomorrowStartIso)
    .order("created_at", { ascending: false });

  if (!isUltimateAdmin && staffCompanyId) {
    todaySamplesQuery = todaySamplesQuery.eq("company_id", staffCompanyId);
    todayPatientsQuery = todayPatientsQuery.eq("company_id", staffCompanyId);
    todayDocumentsQuery = todayDocumentsQuery.eq("company_id", staffCompanyId);
  }

  const [
    companiesResult,
    clinicRequestsResult,
    accountsResult,
    samplesResult,
    patientsResult,
    packagesResult,
    documentsResult,
    todaySamplesResult,
    todayPatientsResult,
    todayDocumentsResult,
    contactMessagesResult,
    authUsersResult,
  ] =
    await Promise.all([
      admin
        .from("companies")
        .select("id, name, address_line_1, city, state, postal_code, contact_email, contact_phone, fax_number")
        .match(!isUltimateAdmin && staffCompanyId ? { id: staffCompanyId } : {})
        .order("name"),
      admin
        .from("clinic_requests")
        .select("id, clinic_name, address_line_1, city, state, postal_code, contact_email, contact_phone, fax_number, requester_first_name, requester_last_name, requester_email, notes, status, created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("admin_user_directory")
        .select("id, first_name, last_name, role, account_status, company_id, company_name, created_at")
        .match(!isUltimateAdmin && staffCompanyId ? { company_id: staffCompanyId } : {})
        .order("created_at", { ascending: false }),
      sampleQuery,
      admin
        .from("patients")
        .select("id, company_id, first_name, last_name, date_of_birth, address_line_1, city, state, postal_code, phone_number, email_address, race_ethnicity, weight_lbs, height_inches, angioplasty_or_stent, cabg, created_at")
        .match(!isUltimateAdmin && staffCompanyId ? { company_id: staffCompanyId } : {})
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("fedex_packages")
        .select("id, company_id, package_id, mailed_at, received_at, created_at")
        .match(!isUltimateAdmin && staffCompanyId ? { company_id: staffCompanyId } : {})
        .order("created_at", { ascending: false })
        .limit(10),
      documentQuery,
      todaySamplesQuery,
      todayPatientsQuery,
      todayDocumentsQuery,
      contactMessagesQuery,
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

  const userEmailById = new Map(
    (authUsersResult.data.users ?? []).map((authUser) => [authUser.id, authUser.email ?? "No email"]),
  );

  return {
    userEmail: user.email ?? "Unknown email",
    profile,
    companies: (companiesResult.data ?? []) as CompanyRow[],
    clinicRequests: (clinicRequestsResult.data ?? []) as ClinicRequestRow[],
    accounts: ((accountsResult.data ?? []) as AdminUserRow[]).filter((account) =>
      isUltimateAdmin ? ["customer", "clinic_admin"].includes(account.role) : account.role === "customer",
    ),
    samples: (samplesResult.data ?? []) as AdminSampleRow[],
    patients: (patientsResult.data ?? []) as PatientRow[],
    packages: (packagesResult.data ?? []) as PackageRow[],
    documents: (documentsResult.data ?? []) as DocumentRow[],
    todaySamples: (todaySamplesResult.data ?? []) as AdminSampleRow[],
    todayPatients: (todayPatientsResult.data ?? []) as PatientRow[],
    todayDocuments: (todayDocumentsResult.data ?? []) as DocumentRow[],
    contactMessages: (contactMessagesResult.data ?? []) as ContactMessageRow[],
    message,
    error,
    q,
    companyFilter,
    statusFilter,
    rejectedFilter,
    documentSearch,
    adminSampleNumberFilter,
    adminPatientFilter,
    adminClinicFilter,
    adminStatusFilter,
    adminSexFilter,
    adminHartCadhsFilter,
    adminHartCveFilter,
    adminCollectedFilter,
    adminReceivedFilter,
    isUltimateAdmin,
    userEmailById,
    intakeStep,
    adminIntakeCompanyId,
    patientDraft,
    sampleDraft,
    packageDraft,
  };
}

export function AdminWorkspace({
  userEmail,
  profile,
  companies,
  clinicRequests,
  accounts,
  samples,
  patients,
  packages,
  documents,
  todaySamples,
  todayPatients,
  todayDocuments,
  contactMessages,
  message,
  error,
  q,
  companyFilter,
  statusFilter,
  rejectedFilter,
  documentSearch,
  adminSampleNumberFilter,
  adminPatientFilter,
  adminClinicFilter,
  adminStatusFilter,
  adminSexFilter,
  adminHartCadhsFilter,
  adminHartCveFilter,
  adminCollectedFilter,
  adminReceivedFilter,
  isUltimateAdmin,
  userEmailById,
  intakeStep,
  adminIntakeCompanyId,
  patientDraft,
  sampleDraft,
  packageDraft,
  activePage = "overview",
}: {
  userEmail: string;
  profile: ProfileRow | null;
  companies: CompanyRow[];
  clinicRequests: ClinicRequestRow[];
  accounts: AdminUserRow[];
  samples: AdminSampleRow[];
  patients: PatientRow[];
  packages: PackageRow[];
  documents: DocumentRow[];
  todaySamples: AdminSampleRow[];
  todayPatients: PatientRow[];
  todayDocuments: DocumentRow[];
  contactMessages: ContactMessageRow[];
  message: string;
  error: string;
  q: string;
  companyFilter: string;
  statusFilter: string;
  rejectedFilter: string;
  documentSearch: string;
  adminSampleNumberFilter: string;
  adminPatientFilter: string;
  adminClinicFilter: string;
  adminStatusFilter: string;
  adminSexFilter: string;
  adminHartCadhsFilter: string;
  adminHartCveFilter: string;
  adminCollectedFilter: string;
  adminReceivedFilter: string;
  isUltimateAdmin: boolean;
  userEmailById: Map<string, string>;
  intakeStep: IntakeStep;
  adminIntakeCompanyId: string;
  patientDraft: IntakePatientDraft;
  sampleDraft: IntakeSampleDraft;
  packageDraft: IntakePackageDraft;
  activePage?: AdminPage;
}) {
  const adminPatientChosen = Boolean(patientDraft.patientId);
  const adminClinicChosen = Boolean(adminIntakeCompanyId);
  const canAdvanceAdminToSample =
    adminClinicChosen &&
    (adminPatientChosen ||
      Boolean(patientDraft.firstName && patientDraft.lastName && patientDraft.dateOfBirth));
  const canAdvanceAdminToFiles = canAdvanceAdminToSample && Boolean(sampleDraft.sampleNumber);
  const canAdvanceAdminToPackage = canAdvanceAdminToFiles;
  const pendingClinicRequests = clinicRequests.filter((request) => request.status === "pending");
  const incomingSamples = samples.filter((sample) => !sample.rejected);
  const adminPatientStepHref = buildPath("/admin/intake", { intake_step: "patient" });
  const adminSampleStepHref = buildPath("/admin/intake", {
    intake_step: "sample",
    admin_intake_company_id: adminIntakeCompanyId,
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
  });
  const adminFilesStepHref = buildPath("/admin/intake", {
    intake_step: "files",
    admin_intake_company_id: adminIntakeCompanyId,
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
    sample_number: sampleDraft.sampleNumber,
    collected_at: sampleDraft.collectedAt,
    received_at: sampleDraft.receivedAt,
    status: sampleDraft.status,
    collected_by: sampleDraft.collectedBy,
    sex: sampleDraft.sex,
    ordering_provider_name: sampleDraft.orderingProviderName,
    npi_number: sampleDraft.npiNumber,
    missing_info: sampleDraft.missingInfo,
    icd10_code_1: sampleDraft.icd10Codes[0],
    icd10_code_2: sampleDraft.icd10Codes[1],
    icd10_code_3: sampleDraft.icd10Codes[2],
    icd10_code_4: sampleDraft.icd10Codes[3],
    icd10_code_5: sampleDraft.icd10Codes[4],
    hart_cadhs: sampleDraft.hartCadhs ? "true" : "false",
    hart_cve: sampleDraft.hartCve ? "true" : "false",
  });
  const adminPackageStepHref = buildPath("/admin/intake", {
    intake_step: "package",
    admin_intake_company_id: adminIntakeCompanyId,
    patient_id: patientDraft.patientId,
    first_name: patientDraft.firstName,
    last_name: patientDraft.lastName,
    date_of_birth: patientDraft.dateOfBirth,
    address_line_1: patientDraft.addressLine1,
    city: patientDraft.city,
    state: patientDraft.state,
    postal_code: patientDraft.postalCode,
    phone_number: patientDraft.phoneNumber,
    email_address: patientDraft.emailAddress,
    race_ethnicity: patientDraft.raceEthnicity,
    weight_lbs: patientDraft.weightLbs,
    height_inches: patientDraft.heightInches,
    angioplasty_or_stent: patientDraft.angioplastyOrStent ? "true" : "false",
    cabg: patientDraft.cabg ? "true" : "false",
    sample_number: sampleDraft.sampleNumber,
    collected_at: sampleDraft.collectedAt,
    collected_by: sampleDraft.collectedBy,
    sex: sampleDraft.sex,
    ordering_provider_name: sampleDraft.orderingProviderName,
    npi_number: sampleDraft.npiNumber,
    missing_info: sampleDraft.missingInfo,
    icd10_code_1: sampleDraft.icd10Codes[0],
    icd10_code_2: sampleDraft.icd10Codes[1],
    icd10_code_3: sampleDraft.icd10Codes[2],
    icd10_code_4: sampleDraft.icd10Codes[3],
    icd10_code_5: sampleDraft.icd10Codes[4],
    hart_cadhs: sampleDraft.hartCadhs ? "true" : "false",
    hart_cve: sampleDraft.hartCve ? "true" : "false",
    package_id: packageDraft.packageId,
    mailed_at: packageDraft.mailedAt,
  });
  return (
    <main className="admin-shell admin-shell--portal">
      <aside className="admin-sidebar admin-sidebar--portal">
        <div className="admin-sidebar__brand">
          <img className="brand-logo brand-logo--sidebar" src="/completeomics-logo.png" alt="Complete Omics" />
        </div>

        <nav className="admin-sidebar__nav">
          <a className={`admin-nav-item ${activePage === "overview" ? "admin-nav-item--active" : ""}`} href="/admin/overview">Overview</a>
          <a className={`admin-nav-item ${activePage === "samples" ? "admin-nav-item--active" : ""}`} href="/admin/samples">Sample Data</a>
          <a className={`admin-nav-item ${activePage === "intake" ? "admin-nav-item--active" : ""}`} href="/admin/intake">Create Records</a>
          <a className={`admin-nav-item ${activePage === "clinics" ? "admin-nav-item--active" : ""}`} href="/admin/clinics">Clinics</a>
          <a className={`admin-nav-item ${activePage === "accounts" ? "admin-nav-item--active" : ""}`} href="/admin/accounts">Accounts</a>
          <a className={`admin-nav-item ${activePage === "operations" ? "admin-nav-item--active" : ""}`} href="/admin/documents">Documents</a>
          <a className={`admin-nav-item ${activePage === "contact" ? "admin-nav-item--active" : ""}`} href="/admin/contact">Contact Messages</a>
        </nav>

        <div className="admin-sidebar__meta">
          <p className="eyebrow">Signed In</p>
          <strong>{userEmail}</strong>
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
            <strong>Admin Portal</strong>
          </div>
          <div className="admin-utilitybar__chips">
            <span>{companies.length} clinics</span>
            <span>{samples.length} samples in view</span>
          </div>
        </div>

        {(message || error) && (
          <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
            {error || message}
          </div>
        )}

        {activePage === "overview" && <>
        <section className="admin-header admin-header--portal" id="admin-overview">
          <div className="admin-header__title">
            <h1>Admin Console</h1>
          </div>

          <div className="admin-kpis">
            <article>
              <span>{companies.length}</span>
              <p>Clinics</p>
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

        </section>

        <section className="admin-overview-grid">
          <article className="panel admin-overview-card admin-export-card panel--wide">
            <div className="panel__header">
              <h3>CSV Exports</h3>
            </div>
            <div className="export-button-grid">
              <a className="button button--secondary button--compact" href="/api/export?entity=samples">
                Sample Data
              </a>
              <a className="button button--secondary button--compact" href="/api/export?entity=patients">
                Patient Data
              </a>
              <a className="button button--secondary button--compact" href="/api/export?entity=clinics">
                Clinic Data
              </a>
              <a className="button button--secondary button--compact" href="/api/export?entity=fedex">
                FedEx Data
              </a>
            </div>
          </article>

          <article className="panel admin-overview-card admin-overview-card--inbox">
            <div className="panel__header">
              <div>
                <h3>Contact Messages</h3>
              </div>
              <span className="admin-overview-count">{contactMessages.length}</span>
            </div>
            <div className="list-grid">
              {contactMessages.slice(0, 3).map((contactMessage) => (
                <div className="list-row" key={contactMessage.id}>
                  <strong>
                    {[contactMessage.first_name, contactMessage.last_name].filter(Boolean).join(" ") ||
                      contactMessage.email}
                  </strong>
                  <span>
                    {contactMessage.purpose ?? "General message"}
                    {" | "}
                    {contactMessage.company_name ?? contactMessage.institution ?? "No clinic listed"}
                  </span>
                </div>
              ))}
              {contactMessages.length === 0 && <div className="empty-state">No contact messages yet.</div>}
            </div>
          </article>

          <article className="panel admin-overview-card">
            <div className="panel__header">
              <div>
                <h3>Clinic Requests</h3>
              </div>
              <span className="admin-overview-count">{pendingClinicRequests.length}</span>
            </div>
            <div className="list-grid">
              {pendingClinicRequests.map((request) => (
                <div className="list-row" key={request.id}>
                  <strong>{request.clinic_name}</strong>
                  <span>
                    Clinic request
                    {" | "}
                    {request.requester_first_name} {request.requester_last_name}
                    {" | "}
                    {request.requester_email}
                  </span>
                </div>
              ))}
              {pendingClinicRequests.length === 0 && <div className="empty-state">No pending clinic requests.</div>}
            </div>
          </article>

          <article className="panel admin-overview-card panel--wide">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Daily Activity</p>
                <h3>Created today</h3>
              </div>
              <span className="admin-overview-count">
                {todaySamples.length + todayPatients.length + todayDocuments.length}
              </span>
            </div>
            <div className="today-activity-grid">
              <section>
                <p className="eyebrow">Samples</p>
                <div className="list-grid">
                  {todaySamples.map((sample) => (
                    <div className="list-row" key={sample.id}>
                      <strong>{sample.sample_number}</strong>
                      <span>
                        {sample.patient_first_name} {sample.patient_last_name}
                        {" | "}
                        {sample.company_name}
                        {" | "}
                        {formatDateTime(sample.created_at)}
                      </span>
                    </div>
                  ))}
                  {todaySamples.length === 0 && <div className="empty-state">No samples created today.</div>}
                </div>
              </section>

              <section>
                <p className="eyebrow">Documents</p>
                <div className="list-grid">
                  {todayDocuments.map((document) => (
                    <div className="list-row" key={document.id}>
                      <strong>{document.original_filename}</strong>
                      <span>
                        {document.sample_number ?? "No sample"}
                        {" | "}
                        {[document.patient_first_name, document.patient_last_name].filter(Boolean).join(" ") || "No patient"}
                        {" | "}
                        {formatDateTime(document.created_at ?? null)}
                      </span>
                    </div>
                  ))}
                  {todayDocuments.length === 0 && <div className="empty-state">No documents created today.</div>}
                </div>
              </section>

              <section>
                <p className="eyebrow">Patients</p>
                <div className="list-grid">
                  {todayPatients.map((patient) => (
                    <div className="list-row" key={patient.id}>
                      <strong>{patient.first_name} {patient.last_name}</strong>
                      <span>
                        DOB {formatDate(patient.date_of_birth)}
                        {" | "}
                        {formatDateTime(patient.created_at)}
                      </span>
                    </div>
                  ))}
                  {todayPatients.length === 0 && <div className="empty-state">No patients created today.</div>}
                </div>
              </section>
            </div>
          </article>
        </section>
        </>}

        {activePage === "samples" && <section className="admin-panel" id="admin-samples">
          <div className="admin-panel__header">
            <div>
              <h2>Samples</h2>
            </div>
            <a className="button button--primary button--compact" href="/admin/intake?intake_step=patient">
              Add Sample
            </a>
          </div>

          <article className="panel incoming-samples-panel">
            <div className="panel__header">
              <h3>Incoming Samples</h3>
              <span className="admin-overview-count">{incomingSamples.length}</span>
            </div>
            <div className="incoming-samples-grid">
              {incomingSamples.slice(0, 6).map((sample) => (
                <div className="incoming-sample-card" key={sample.id}>
                  <div className="incoming-sample-card__sample">
                    <strong>{sample.sample_number}</strong>
                  </div>
                  <div className="incoming-sample-card__patient">
                    <strong>{sample.patient_first_name} {sample.patient_last_name}</strong>
                  </div>
                  <div className="incoming-sample-card__clinic">
                    <span>{sample.company_name}</span>
                  </div>
                  <div className="incoming-sample-card__status">
                    <span>{sample.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="incoming-sample-card__actions">
                    <form action={reviewIncomingSampleAction}>
                      <input type="hidden" name="id" value={sample.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <input type="hidden" name="redirect_to" value="/admin/samples" />
                      <button className="button button--secondary button--compact" type="submit">
                        Accept
                      </button>
                    </form>
                    <form action={reviewIncomingSampleAction}>
                      <input type="hidden" name="id" value={sample.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input type="hidden" name="redirect_to" value="/admin/samples" />
                      <button className="button button--ghost button--compact" type="submit">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {incomingSamples.length === 0 && <div className="empty-state">No incoming samples awaiting rejection review.</div>}
            </div>
          </article>

          <details className="admin-sample-column-filters">
            <summary>Filter Samples</summary>
            <form className="admin-sample-filter-panel" method="get">
              <div className="admin-sample-filter-row">
                <input name="admin_sample_number" defaultValue={adminSampleNumberFilter} placeholder="Sample" />
                <input name="admin_patient" defaultValue={adminPatientFilter} placeholder="Patient" />
                <input name="admin_clinic" defaultValue={adminClinicFilter} placeholder="Clinic" />
                <select name="admin_status" defaultValue={adminStatusFilter}>
                  <option value="">All statuses</option>
                  <option value="draft">draft</option>
                  <option value="submitted">submitted</option>
                  <option value="mailed">mailed</option>
                  <option value="received">received</option>
                  <option value="ready_for_review">ready_for_review</option>
                  <option value="awaiting_documentation">awaiting_documentation</option>
                  <option value="rejected">rejected</option>
                </select>
                <input name="admin_sex" defaultValue={adminSexFilter} placeholder="Sex" />
                <select name="admin_hart_cadhs" defaultValue={adminHartCadhsFilter}>
                  <option value="">CADhs</option>
                  <option value="true">CADhs: Yes</option>
                  <option value="false">CADhs: No</option>
                </select>
                <select name="admin_hart_cve" defaultValue={adminHartCveFilter}>
                  <option value="">CVE</option>
                  <option value="true">CVE: Yes</option>
                  <option value="false">CVE: No</option>
                </select>
                <input name="admin_collected" type="date" defaultValue={adminCollectedFilter} />
                <input name="admin_received" type="date" defaultValue={adminReceivedFilter} />
              </div>
              <div className="admin-sample-filter-actions">
                <button className="button button--secondary button--compact" type="submit">
                  Apply Filters
                </button>
                <a className="button button--ghost button--compact" href="/admin/samples">
                  Clear
                </a>
              </div>
            </form>
          </details>

          <div className="admin-record-list admin-record-list--samples">
            <div className="admin-record-list__head">
              <span>Sample</span>
              <span>Patient</span>
              <span>Clinic</span>
              <span>Status</span>
              <span>Sex</span>
              <span>Hart CADhs</span>
              <span>Hart CVE</span>
              <span>Collected</span>
              <span>Received</span>
              <span></span>
            </div>
            {samples.map((sample) => (
              <details className="admin-record" key={sample.id}>
                <summary className="admin-record__summary">
                  <div>
                    <strong>{sample.sample_number}</strong>
                  </div>
                  <div>
                    <strong>
                      {sample.patient_first_name} {sample.patient_last_name}
                    </strong>
                  </div>
                  <div>
                    <strong>{sample.company_name}</strong>
                  </div>
                  <div>
                    <strong>{sample.rejected ? "Rejected" : sample.status.replaceAll("_", " ")}</strong>
                  </div>
                  <div>
                    <strong>{sample.sex ?? "Not set"}</strong>
                  </div>
                  <div>
                    <strong>{sample.hart_cadhs ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <strong>{sample.hart_cve ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <strong>{sample.collected_at ? formatDate(sample.collected_at) : "Not collected"}</strong>
                  </div>
                  <div>
                    <strong>{sample.received_at ? formatDate(sample.received_at) : "Not received"}</strong>
                  </div>
                  <div className="admin-record__actions">
                    <span className="admin-record__toggle">Edit</span>
                  </div>
                </summary>

                <form action={updateSampleAction} className="admin-record__details">
                  <input type="hidden" name="id" value={sample.id} />
                  <input type="hidden" name="redirect_to" value="/admin/samples" />
                  <div className="form-grid form-grid--compact">
                    <div className="field field--compact">
                      <label>Sample number</label>
                      <input name="sample_number" defaultValue={sample.sample_number} required />
                    </div>
                    <div className="field field--compact">
                      <label>Clinic</label>
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
        </section>}

        {activePage === "intake" && <section className="admin-panel" id="admin-intake">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Create Records</p>
              <h2>Add records</h2>
            </div>
          </div>

          <section className="panel form-panel customer-wizard">
            <p className="eyebrow">Guided Sample Intake</p>
            <h3>Add sample</h3>
            <div className="customer-steps">
              <div className={`customer-step ${intakeStep === "patient" ? "customer-step--active" : ""}`}>
                <span>1</span>
                <strong>Patient</strong>
              </div>
              <div className={`customer-step ${intakeStep === "sample" ? "customer-step--active" : ""}`}>
                <span>2</span>
                <strong>Sample</strong>
              </div>
              <div className={`customer-step ${intakeStep === "files" ? "customer-step--active" : ""}`}>
                <span>3</span>
                <strong>Files</strong>
              </div>
              <div className={`customer-step ${intakeStep === "package" ? "customer-step--active" : ""}`}>
                <span>4</span>
                <strong>FedEx</strong>
              </div>
            </div>

            {intakeStep === "patient" && (
              <form method="get">
                <input type="hidden" name="intake_step" value="sample" />
                <div className="field">
                  <label>Clinic</label>
                  <input
                    name="admin_intake_company_id"
                    list="admin-intake-company-options"
                    defaultValue={adminIntakeCompanyId}
                    placeholder="Type clinic name"
                    required
                  />
                  <datalist id="admin-intake-company-options">
                    <CompanyLookupOptions companies={companies} />
                  </datalist>
                </div>
                <div className="field">
                  <label>Existing patient</label>
                  <input
                    name="patient_id"
                    list="admin-intake-patient-options"
                    defaultValue={patientDraft.patientId}
                    placeholder="Type patient name"
                  />
                  <datalist id="admin-intake-patient-options">
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
                    <label>Street address</label>
                    <input name="address_line_1" defaultValue={patientDraft.addressLine1} />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input name="city" defaultValue={patientDraft.city} />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input name="state" defaultValue={patientDraft.state} maxLength={2} />
                  </div>
                  <div className="field">
                    <label>Zip code</label>
                    <input name="postal_code" defaultValue={patientDraft.postalCode} />
                  </div>
                  <div className="field">
                    <label>Phone number</label>
                    <input name="phone_number" defaultValue={patientDraft.phoneNumber} />
                  </div>
                  <div className="field">
                    <label>Email address</label>
                    <input name="email_address" type="email" defaultValue={patientDraft.emailAddress} />
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
                    Coronary Artery Bypass Graft (CABG)
                  </label>
                </div>
                <button className="button button--primary" type="submit">
                  Continue to Sample Details
                </button>
              </form>
            )}

            {intakeStep === "sample" && (
              <form method="get">
                <input type="hidden" name="intake_step" value="files" />
                <input type="hidden" name="admin_intake_company_id" value={adminIntakeCompanyId} />
                <input type="hidden" name="patient_id" value={patientDraft.patientId} />
                <input type="hidden" name="first_name" value={patientDraft.firstName} />
                <input type="hidden" name="last_name" value={patientDraft.lastName} />
                <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
                <input type="hidden" name="address_line_1" value={patientDraft.addressLine1} />
                <input type="hidden" name="city" value={patientDraft.city} />
                <input type="hidden" name="state" value={patientDraft.state} />
                <input type="hidden" name="postal_code" value={patientDraft.postalCode} />
                <input type="hidden" name="phone_number" value={patientDraft.phoneNumber} />
                <input type="hidden" name="email_address" value={patientDraft.emailAddress} />
                <input type="hidden" name="race_ethnicity" value={patientDraft.raceEthnicity} />
                <input type="hidden" name="weight_lbs" value={patientDraft.weightLbs} />
                <input type="hidden" name="height_inches" value={patientDraft.heightInches} />
                <input type="hidden" name="angioplasty_or_stent" value={patientDraft.angioplastyOrStent ? "true" : "false"} />
                <input type="hidden" name="cabg" value={patientDraft.cabg ? "true" : "false"} />
                {!canAdvanceAdminToSample && (
                  <div className="status-banner status-banner--error">
                    Choose a clinic and patient, or complete the new patient details before moving forward.
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
                  <div className="field">
                    <label>Received date</label>
                    <input name="received_at" type="date" defaultValue={sampleDraft.receivedAt} />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select name="status" defaultValue={sampleDraft.status || "submitted"}>
                      <option value="draft">draft</option>
                      <option value="submitted">submitted</option>
                      <option value="mailed">mailed</option>
                      <option value="received">received</option>
                      <option value="ready_for_review">ready_for_review</option>
                      <option value="awaiting_documentation">awaiting_documentation</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>
                </div>
                <div className="checkbox-row">
                  <label><input name="hart_cadhs" type="checkbox" defaultChecked={sampleDraft.hartCadhs} /> Hart_CADhs</label>
                  <label><input name="hart_cve" type="checkbox" defaultChecked={sampleDraft.hartCve} /> Hart_CVE</label>
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
                      <input name="ordering_provider_name" defaultValue={sampleDraft.orderingProviderName} />
                    </div>
                    <div className="field">
                      <label>NPI #</label>
                      <input name="npi_number" defaultValue={sampleDraft.npiNumber} inputMode="numeric" />
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Missing info notes</label>
                  <textarea name="missing_info" rows={3} defaultValue={sampleDraft.missingInfo} />
                </div>
                <div className="customer-wizard__actions">
                  <a className="button button--secondary" href={adminPatientStepHref}>Back to Patient</a>
                  <button className="button button--primary" type="submit" disabled={!canAdvanceAdminToFiles}>
                    Continue to Files
                  </button>
                </div>
              </form>
            )}

            {intakeStep === "files" && (
              <div>
                <p className="eyebrow">Step 3</p>
                <h3>Upload files before FedEx details</h3>
                {adminPatientChosen ? (
                  <form action={uploadDocumentAction}>
                    <input type="hidden" name="redirect_to" value={adminFilesStepHref} />
                    <input type="hidden" name="company_id" value={adminIntakeCompanyId} />
                    <input type="hidden" name="patient_id" value={patientDraft.patientId} />
                    <div className="field">
                      <label>Patient</label>
                      <input
                        name="patient_id"
                        list="admin-file-step-patient-options"
                        defaultValue={patientDraft.patientId}
                        placeholder="Type patient name"
                      />
                      <datalist id="admin-file-step-patient-options">
                        <PatientLookupOptions patients={patients} />
                      </datalist>
                    </div>
                    <div className="field">
                      <label>File</label>
                      <input name="document" type="file" accept=".pdf,image/png,image/jpeg" required />
                    </div>
                    <button className="button button--secondary" type="submit">
                      Upload File
                    </button>
                  </form>
                ) : (
                  <div className="empty-state">
                    File upload is available after the new patient is created. Continue to FedEx and submit the intake first.
                  </div>
                )}
                <div className="customer-wizard__actions">
                  <a className="button button--secondary" href={adminSampleStepHref}>Back to Sample</a>
                  <a className="button button--primary" href={adminPackageStepHref}>Continue to FedEx</a>
                </div>
              </div>
            )}

            {intakeStep === "package" && (
              <form action={createCustomerIntakeAction}>
                <input type="hidden" name="redirect_to" value="/admin/intake" />
                <input type="hidden" name="company_id" value={adminIntakeCompanyId} />
                <input type="hidden" name="patient_id" value={patientDraft.patientId} />
                <input type="hidden" name="first_name" value={patientDraft.firstName} />
                <input type="hidden" name="last_name" value={patientDraft.lastName} />
                <input type="hidden" name="date_of_birth" value={patientDraft.dateOfBirth} />
                <input type="hidden" name="address_line_1" value={patientDraft.addressLine1} />
                <input type="hidden" name="city" value={patientDraft.city} />
                <input type="hidden" name="state" value={patientDraft.state} />
                <input type="hidden" name="postal_code" value={patientDraft.postalCode} />
                <input type="hidden" name="phone_number" value={patientDraft.phoneNumber} />
                <input type="hidden" name="email_address" value={patientDraft.emailAddress} />
                <input type="hidden" name="race_ethnicity" value={patientDraft.raceEthnicity} />
                <input type="hidden" name="weight_lbs" value={patientDraft.weightLbs} />
                <input type="hidden" name="height_inches" value={patientDraft.heightInches} />
                <input type="hidden" name="angioplasty_or_stent" value={patientDraft.angioplastyOrStent ? "true" : "false"} />
                <input type="hidden" name="cabg" value={patientDraft.cabg ? "true" : "false"} />
                <input type="hidden" name="sample_number" value={sampleDraft.sampleNumber} />
                <input type="hidden" name="collected_at" value={sampleDraft.collectedAt} />
                <input type="hidden" name="received_at" value={sampleDraft.receivedAt} />
                <input type="hidden" name="status" value={sampleDraft.status || "submitted"} />
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
                <p className="eyebrow">Step 4</p>
                <h3>Find an existing FedEx package, create a new one, or skip this step</h3>
                {!canAdvanceAdminToPackage && (
                  <div className="status-banner status-banner--error">
                    Enter the clinic, patient, and sample details before submitting intake.
                  </div>
                )}
                <div className="form-grid">
                  <div className="field">
                    <label>Existing package or new package ID</label>
                    <input
                      name="package_id"
                      list="admin-intake-package-options"
                      defaultValue={packageDraft.packageId}
                      placeholder="Type package ID"
                    />
                    <datalist id="admin-intake-package-options">
                      <PackageLookupOptions packages={packages} />
                    </datalist>
                  </div>
                  <div className="field">
                    <label>Date mailed for new package</label>
                    <input name="mailed_at" type="datetime-local" defaultValue={packageDraft.mailedAt} />
                  </div>
                </div>
                <div className="customer-wizard__actions">
                  <a className="button button--secondary" href={adminFilesStepHref}>Back to Files</a>
                  <button className="button button--secondary" name="skip_package" type="submit" value="true" disabled={!canAdvanceAdminToPackage}>
                    Skip and Submit
                  </button>
                  <button className="button button--primary" type="submit" disabled={!canAdvanceAdminToPackage}>
                    Submit Intake
                  </button>
                </div>
              </form>
            )}
          </section>

          <div className="create-grid">
          <form action={createCompanyAction} className="panel form-panel">
            <input type="hidden" name="redirect_to" value="/admin/intake" />
            <p className="eyebrow">Clinic Directory</p>
            <h3>Create clinic</h3>
            <div className="field">
              <label>Clinic name</label>
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
                <label>Clinic Contact Email</label>
                <input name="contact_email" type="email" />
              </div>
              <div className="field">
                <label>Clinic Contact</label>
                <input name="contact_phone" />
              </div>
              <div className="field">
                <label>Fax Number</label>
                <input name="fax_number" />
              </div>
            </div>
            <button className="button button--primary" type="submit">
              Create Clinic
            </button>
          </form>

          <form action={createPatientAction} className="panel form-panel">
            <input type="hidden" name="redirect_to" value="/admin/intake" />
            <p className="eyebrow">Patient Intake</p>
            <h3>Create patient</h3>
            <div className="field">
              <label>Clinic</label>
              <input
                name="company_id"
                list="admin-company-options"
                placeholder="Type clinic name"
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
                <label>Street address</label>
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
                <label>Phone number</label>
                <input name="phone_number" />
              </div>
              <div className="field">
                <label>Email address</label>
                <input name="email_address" type="email" />
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
              <label><input name="cabg" type="checkbox" /> Coronary Artery Bypass Graft (CABG)</label>
            </div>
            <button className="button button--secondary" type="submit">
              Create Patient
            </button>
          </form>

          <form action={createPackageAction} className="panel form-panel">
            <input type="hidden" name="redirect_to" value="/admin/intake" />
            <p className="eyebrow">FedEx Tracking</p>
            <h3>Create package</h3>
            <div className="field">
              <label>Clinic</label>
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

          </div>
        </section>}

        {activePage === "accounts" && <section className="admin-panel" id="admin-accounts">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Accounts</p>
              <h2>Accounts</h2>
            </div>
          </div>

          <div className="data-grid">
          <article className="panel panel--wide">
            <p className="eyebrow">User Profiles</p>
            <h3>Customer and clinic admin access</h3>
            <div className="admin-record-list admin-record-list--accounts">
              <div className="admin-record-list__head">
                <span>Email</span>
                <span>Name</span>
                <span>Role</span>
                <span>Clinic</span>
                <span>Status</span>
                <span>Created</span>
                <span>Edit</span>
              </div>
              {accounts.map((account) => (
                <details className="admin-record" key={account.id}>
                  <summary className="admin-record__summary">
                    <div>
                      <strong>{userEmailById.get(account.id) ?? "No auth email found"}</strong>
                      <span>Auth account</span>
                    </div>
                    <div>
                      <strong>
                        {[account.first_name, account.last_name].filter(Boolean).join(" ") || "Name not set"}
                      </strong>
                      <span>User profile</span>
                    </div>
                    <div>
                      <strong>{account.role === "clinic_admin" ? "clinic admin" : account.role}</strong>
                      <span>Access level</span>
                    </div>
                    <div>
                      <strong>{account.role === "admin" ? "Global admin" : account.company_name ?? "Unassigned"}</strong>
                      <span>{account.role === "admin" ? "No clinic assignment" : "Clinic scope"}</span>
                    </div>
                    <div>
                      <strong>{account.account_status}</strong>
                      <span>Approval</span>
                    </div>
                    <div>
                      <strong>{formatDate(account.created_at)}</strong>
                      <span>Created</span>
                    </div>
                    <div className="admin-record__actions">
                      <span className="admin-record__toggle">{isUltimateAdmin ? "Edit" : "Review"}</span>
                    </div>
                  </summary>

                  {isUltimateAdmin ? (
                  <form action={updateUserProfileAction} className="admin-record__details">
                    <input type="hidden" name="id" value={account.id} />
                    <input type="hidden" name="redirect_to" value="/admin/accounts" />
                    <div className="form-grid form-grid--compact">
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
                        <option value="clinic_admin">clinic_admin</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Approval status</label>
                      <select name="account_status" defaultValue={account.account_status}>
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="denied">denied</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Clinic</label>
                      <select
                        name="company_id"
                        defaultValue={account.role === "admin" ? "" : account.company_id ?? ""}
                        disabled={account.role === "admin"}
                      >
                        <option value="" disabled>
                          Choose clinic
                        </option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {account.role === "admin" && (
                    <span>Admins are not attached to a clinic.</span>
                  )}
                    <div className="admin-record__details-actions">
                      <button className="button button--primary button--compact" type="submit">
                        Save User
                      </button>
                    </div>
                  </form>
                  ) : (
                    <form action={updateAccountApprovalAction} className="admin-record__details">
                      <input type="hidden" name="id" value={account.id} />
                      <input type="hidden" name="redirect_to" value="/admin/accounts" />
                      <div className="form-grid form-grid--compact">
                        <div className="field">
                          <label>Approval status</label>
                          <select name="account_status" defaultValue={account.account_status}>
                            <option value="pending">pending</option>
                            <option value="approved">approved</option>
                            <option value="denied">denied</option>
                          </select>
                        </div>
                      </div>
                      <div className="admin-record__details-actions">
                        <button className="button button--primary button--compact" type="submit">
                          Save Approval
                        </button>
                      </div>
                    </form>
                  )}
                </details>
              ))}
              {accounts.length === 0 && <div className="empty-state">No accounts found.</div>}
            </div>
          </article>
          </div>
        </section>}

        {activePage === "clinics" && <section className="admin-panel" id="admin-clinics">
          <div className="admin-panel__header">
            <div>
              <h2>Clinics</h2>
            </div>
          </div>

          {isUltimateAdmin && <article className="panel clinic-requests-panel">
            <div className="panel__header">
              <div>
                <h3>Clinic Requests</h3>
              </div>
              <span>{clinicRequests.length} requests</span>
            </div>
            <div className="list-grid">
              {clinicRequests.map((request) => (
                <div className="list-row clinic-request-row" key={request.id}>
                  <div>
                    <strong>{request.clinic_name}</strong>
                    <span>
                      {[request.address_line_1, request.city, request.state, request.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  <div>
                    <strong>{request.contact_email}</strong>
                    <span>{request.contact_phone}</span>
                    <span>{request.fax_number ? `Fax ${request.fax_number}` : "Fax not provided"}</span>
                  </div>
                  <div>
                    <strong>{request.requester_first_name} {request.requester_last_name}</strong>
                    <span>{request.requester_email}</span>
                    <span>{request.status}</span>
                  </div>
                  {request.notes && <p>{request.notes}</p>}
                  <div className="clinic-request-row__actions">
                    <form action={approveClinicRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="redirect_to" value="/admin/clinics" />
                      <button
                        className="button button--primary button--compact"
                        type="submit"
                        disabled={request.status === "approved"}
                      >
                        Approve and Create Clinic Admin
                      </button>
                    </form>
                    <form action={denyClinicRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="redirect_to" value="/admin/clinics" />
                      <button
                        className="button button--secondary button--compact"
                        type="submit"
                        disabled={request.status === "approved" || request.status === "rejected"}
                      >
                        Deny
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {clinicRequests.length === 0 && <div className="empty-state">No clinic requests yet.</div>}
            </div>
          </article>}

          {isUltimateAdmin ? <div className="admin-record-list admin-record-list--clinics">
            <div className="admin-record-list__head">
              <span>Clinic</span>
              <span>Location</span>
              <span>Contact</span>
              <span>Email</span>
              <span>Fax</span>
              <span></span>
            </div>
            {companies.map((company) => (
              <details className="admin-record" key={company.id}>
                <summary className="admin-record__summary">
                  <div>
                    <strong>{company.name}</strong>
                    <span>{company.address_line_1 ?? "Address not set"}</span>
                  </div>
                  <div>
                    <strong>{[company.city, company.state].filter(Boolean).join(", ") || "Location not set"}</strong>
                    <span>{company.postal_code ?? "Zip not set"}</span>
                  </div>
                  <div>
                    <strong>{company.contact_phone ?? "Contact not set"}</strong>
                    <span>Clinic Contact</span>
                  </div>
                  <div>
                    <strong>{company.contact_email ?? "Email not set"}</strong>
                    <span>Clinic Contact Email</span>
                  </div>
                  <div>
                    <strong>{company.fax_number ?? "Fax not set"}</strong>
                    <span>Fax Number</span>
                  </div>
                  <div className="admin-record__actions">
                    <span className="admin-record__toggle">Edit</span>
                  </div>
                </summary>

                <form action={updateCompanyAction} className="admin-record__details">
                  <input type="hidden" name="id" value={company.id} />
                  <input type="hidden" name="redirect_to" value="/admin/clinics" />
                  <div className="form-grid form-grid--compact">
                    <div className="field field--compact">
                      <label>Name</label>
                      <input name="name" defaultValue={company.name} />
                    </div>
                    <div className="field field--compact">
                      <label>Address</label>
                      <input name="address_line_1" defaultValue={company.address_line_1 ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>City</label>
                      <input name="city" defaultValue={company.city ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>State</label>
                      <input name="state" defaultValue={company.state ?? ""} maxLength={2} />
                    </div>
                    <div className="field field--compact">
                      <label>Zip code</label>
                      <input name="postal_code" defaultValue={company.postal_code ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>Clinic Contact Email</label>
                      <input name="contact_email" type="email" defaultValue={company.contact_email ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>Clinic Contact</label>
                      <input name="contact_phone" defaultValue={company.contact_phone ?? ""} />
                    </div>
                    <div className="field field--compact">
                      <label>Fax Number</label>
                      <input name="fax_number" defaultValue={company.fax_number ?? ""} />
                    </div>
                  </div>
                  <div className="admin-record__details-actions">
                    <button className="button button--primary button--compact" type="submit">
                      Save Clinic
                    </button>
                  </div>
                </form>
              </details>
            ))}
            {companies.length === 0 && <div className="empty-state">No clinics found.</div>}
          </div> : (
            <div className="empty-state">Clinic admins can manage account approvals from the Accounts page.</div>
          )}
        </section>}

        {activePage === "operations" && <section className="admin-panel" id="admin-documents">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Documents</p>
              <h2>Patient and sample documents</h2>
            </div>
          </div>

          <article className="panel panel--wide document-directory-panel">
            <p className="eyebrow">Document Directory</p>
            <h3>Search patient or sample documents</h3>
            <form className="search-form" method="get">
              <input name="document_q" defaultValue={documentSearch} placeholder="Search patient, sample number, or file name" />
              <button className="button button--secondary" type="submit">
                Search
              </button>
              <a className="button button--ghost" href="/admin/documents">
                Clear
              </a>
            </form>
            <div className="list-grid">
              {documents.map((document) => (
                <div className="list-row" key={document.id}>
                  <strong>{document.original_filename}</strong>
                  <span>
                    {[document.patient_first_name, document.patient_last_name].filter(Boolean).join(" ")}
                    {" | "}
                    {document.sample_number}
                    {" | "}
                    {document.company_name}
                  </span>
                </div>
              ))}
              {documents.length === 0 && <div className="empty-state">No documents found.</div>}
            </div>

            <details className="document-add-dropdown">
              <summary className="button button--secondary">Add Document</summary>
              <form action={uploadDocumentAction} className="document-add-form">
                <input type="hidden" name="redirect_to" value="/admin/documents" />
                <div className="document-add-form__header">
                  <p className="eyebrow">Add Document</p>
                  <h3>Attach to patient and sample</h3>
                </div>
                <div className="form-grid">
                  {isUltimateAdmin && (
                    <div className="field">
                      <label>Clinic</label>
                      <select name="company_id" defaultValue="" required>
                        <CompanyOptions companies={companies} />
                      </select>
                    </div>
                  )}
                  <div className="field">
                    <label>Patient</label>
                    <input name="patient_id" list="admin-document-patient-options" placeholder="Type patient name" required />
                    <datalist id="admin-document-patient-options">
                      <PatientLookupOptions patients={patients} />
                    </datalist>
                  </div>
                  <div className="field">
                    <label>Sample</label>
                    <input name="sample_id" list="admin-document-sample-options" placeholder="Type sample number" required />
                    <datalist id="admin-document-sample-options">
                      {samples.map((sample) => (
                        <option key={sample.id} value={`${sample.sample_number} | ${sample.id}`} />
                      ))}
                    </datalist>
                  </div>
                  <div className="field">
                    <label>File</label>
                    <input name="document" type="file" accept=".pdf,image/png,image/jpeg" required />
                  </div>
                </div>
                <div className="document-add-form__actions">
                  <button className="button button--secondary" type="submit">
                    Upload Document
                  </button>
                </div>
              </form>
            </details>
          </article>
        </section>}

        {activePage === "contact" && <section className="admin-panel" id="admin-contact-messages">
          <div className="admin-panel__header">
            <div>
              <h2>Contact Messages</h2>
            </div>
            <span className="admin-panel__caption">{contactMessages.length} messages</span>
          </div>

          <div className="contact-message-list">
            {contactMessages.map((contactMessage) => (
              <article className="contact-message-card" key={contactMessage.id}>
                <div>
                  <strong>
                    {[contactMessage.first_name, contactMessage.last_name].filter(Boolean).join(" ") ||
                      contactMessage.email}
                  </strong>
                  <span>{contactMessage.email}</span>
                </div>
                <div>
                  <strong>{contactMessage.purpose ?? "General message"}</strong>
                  <span>{contactMessage.company_name ?? contactMessage.institution ?? "No clinic listed"}</span>
                </div>
                <div>
                  <strong>{formatDateTime(contactMessage.created_at)}</strong>
                  <span>{contactMessage.status}</span>
                </div>
                <p>{contactMessage.message}</p>
                {contactMessage.source && <span>Source: {contactMessage.source}</span>}
              </article>
            ))}
            {contactMessages.length === 0 && <div className="empty-state">No contact messages yet.</div>}
          </div>
        </section>}
      </div>
    </main>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");
  const q = readParam(resolvedSearchParams, "q");
  const sampleNumberFilter = readParam(resolvedSearchParams, "sample_filter_number");
  const patientFilter = readParam(resolvedSearchParams, "sample_filter_patient");
  const sampleStatusFilter = readParam(resolvedSearchParams, "sample_filter_status");
  const collectedDateFilter = readParam(resolvedSearchParams, "sample_filter_collected");
  const receivedDateFilter = readParam(resolvedSearchParams, "sample_filter_received");
  const packageFilter = readParam(resolvedSearchParams, "sample_filter_package");
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
    addressLine1: readParam(resolvedSearchParams, "address_line_1"),
    city: readParam(resolvedSearchParams, "city"),
    state: readParam(resolvedSearchParams, "state"),
    postalCode: readParam(resolvedSearchParams, "postal_code"),
    phoneNumber: readParam(resolvedSearchParams, "phone_number"),
    emailAddress: readParam(resolvedSearchParams, "email_address"),
    raceEthnicity: readParam(resolvedSearchParams, "race_ethnicity"),
    weightLbs: readParam(resolvedSearchParams, "weight_lbs"),
    heightInches: readParam(resolvedSearchParams, "height_inches"),
    angioplastyOrStent: readBooleanParam(resolvedSearchParams, "angioplasty_or_stent"),
    cabg: readBooleanParam(resolvedSearchParams, "cabg"),
  };
  const sampleDraft: IntakeSampleDraft = {
    sampleNumber: readParam(resolvedSearchParams, "sample_number"),
    collectedAt: readParam(resolvedSearchParams, "collected_at"),
    receivedAt: readParam(resolvedSearchParams, "received_at"),
    collectedBy: readParam(resolvedSearchParams, "collected_by"),
    sex: readParam(resolvedSearchParams, "sex"),
    status: readParam(resolvedSearchParams, "status"),
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
    skipPackage: readBooleanParam(resolvedSearchParams, "skip_package"),
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
    .select("first_name, last_name, role, company_id, account_status")
    .eq("id", user.id)
    .single();

  const profile = (profileData ?? null) as ProfileRow | null;

  if (profile?.role === "admin" || profile?.role === "clinic_admin") {
    redirect("/admin/overview");
  }

  if (profile?.role === "customer" && profile.account_status !== "approved") {
    return <PendingApproval userEmail={user.email ?? "Unknown email"} profile={profile} />;
  }

  const companyPromise = profile?.company_id
    ? supabase
        .from("companies")
        .select("id, name, address_line_1, city, state, postal_code, contact_email, contact_phone, fax_number")
        .eq("id", profile.company_id)
        .single()
    : Promise.resolve({ data: null });

  let sampleQuery = supabase
    .from("sample_search")
    .select("id, sample_number, status, rejected, collected_at, received_at, patient_full_name, company_name, package_id")
    .order("collected_at", { ascending: false });

  if (q) {
    const safeQuery = q.replace(/[,]/g, " ");
    sampleQuery = sampleQuery.or(
      `patient_full_name.ilike.%${safeQuery}%,sample_number.ilike.%${safeQuery}%,package_id.ilike.%${safeQuery}%`,
    );
  }

  if (sampleNumberFilter) {
    sampleQuery = sampleQuery.ilike("sample_number", `%${sampleNumberFilter}%`);
  }

  if (patientFilter) {
    sampleQuery = sampleQuery.ilike("patient_full_name", `%${patientFilter}%`);
  }

  if (sampleStatusFilter) {
    sampleQuery = sampleQuery.ilike("status", `%${sampleStatusFilter}%`);
  }

  if (packageFilter) {
    sampleQuery = sampleQuery.ilike("package_id", `%${packageFilter}%`);
  }

  if (collectedDateFilter) {
    const nextCollectedDate = nextDateString(collectedDateFilter);
    if (nextCollectedDate) {
      sampleQuery = sampleQuery.gte("collected_at", collectedDateFilter).lt("collected_at", nextCollectedDate);
    }
  }

  if (receivedDateFilter) {
    const nextReceivedDate = nextDateString(receivedDateFilter);
    if (nextReceivedDate) {
      sampleQuery = sampleQuery.gte("received_at", receivedDateFilter).lt("received_at", nextReceivedDate);
    }
  }

  const [companyResult, samplesResult, patientsResult, packagesResult, documentsResult] = await Promise.all([
    companyPromise,
    sampleQuery,
    supabase
      .from("patients")
      .select("id, company_id, first_name, last_name, date_of_birth, address_line_1, city, state, postal_code, phone_number, email_address, race_ethnicity, weight_lbs, height_inches, angioplasty_or_stent, cabg, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("fedex_packages")
      .select("id, company_id, package_id, mailed_at, received_at, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("document_directory")
      .select("id, company_id, company_name, patient_id, patient_first_name, patient_last_name, sample_id, sample_number, original_filename, storage_path, created_at")
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
      sampleNumberFilter={sampleNumberFilter}
      patientFilter={patientFilter}
      sampleStatusFilter={sampleStatusFilter}
      collectedDateFilter={collectedDateFilter}
      receivedDateFilter={receivedDateFilter}
      packageFilter={packageFilter}
      customerView={customerView}
      intakeStep={intakeStep}
      patientDraft={patientDraft}
      sampleDraft={sampleDraft}
      packageDraft={packageDraft}
    />
  );
}
