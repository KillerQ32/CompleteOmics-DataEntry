import { redirect } from "next/navigation";
import { requestClinicAction, signUpAction } from "../actions";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CompanyRow = {
  id: string;
  name: string;
};

function readParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value ?? "";
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

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");
  const requestClinic = readParam(resolvedSearchParams, "request_clinic") === "true";

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [
    {
      data: { user },
    },
    { data: companiesData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    admin.from("companies").select("id, name").order("name"),
  ]);

  if (user) {
    redirect("/");
  }

  const companies = (companiesData ?? []) as CompanyRow[];

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

          <h1>{requestClinic ? "Request Clinic" : "Create Account"}</h1>
          <div className="customer-login-photo" aria-hidden="true">
            <img src="/clinic-pulse-check.jpeg" alt="" />
          </div>
        </aside>

        <section className="customer-login-panel customer-signup-panel">
          <div className="customer-login-panel__header">
            <h2>{requestClinic ? "Request to Add a Clinic" : "Customer Sign Up"}</h2>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}

          {!requestClinic && (
            <form action={signUpAction} className="customer-login-form">
              <input type="hidden" name="redirect_to" value="/signup" />
              <div className="form-grid">
                <div className="field">
                  <label>First name</label>
                  <input name="first_name" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input name="last_name" placeholder="Enter here" required />
                </div>
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
              </div>
              <div className="field">
                <label>Approved Clinic</label>
                <select name="company_id" defaultValue="" required>
                  <CompanyOptions companies={companies} />
                </select>
              </div>
              <a className="customer-login-panel__link" href="/signup?request_clinic=true">
                Don&apos;t see your clinic? Request to add it.
              </a>
              <button className="button button--primary" type="submit">
                Create Account
              </button>
            </form>
          )}

          {requestClinic && (
            <form action={requestClinicAction} className="customer-login-form">
              <input type="hidden" name="redirect_to" value="/signup?request_clinic=true" />
              <p className="signup-helper-text">
                Submit your clinic information for admin review. Once approved, customers can create accounts under that clinic.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>Clinic name</label>
                  <input name="clinic_name" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Street address</label>
                  <input name="address_line_1" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>City</label>
                  <input name="city" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>State</label>
                  <input name="state" maxLength={2} placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Zip code</label>
                  <input name="postal_code" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Clinic Contact Email</label>
                  <input name="contact_email" type="email" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Clinic Contact</label>
                  <input name="contact_phone" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Fax Number</label>
                  <input name="fax_number" placeholder="Enter here" />
                </div>
                <div className="field">
                  <label>Your first name</label>
                  <input name="requester_first_name" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Your last name</label>
                  <input name="requester_last_name" placeholder="Enter here" required />
                </div>
                <div className="field">
                  <label>Your email</label>
                  <input name="requester_email" type="email" placeholder="Enter here" required />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea name="notes" rows={3} placeholder="Anything the admin should know?" />
              </div>
              <button className="button button--primary" type="submit">
                Submit Clinic Request
              </button>
            </form>
          )}

          <div className="customer-login-panel__actions">
            <a className="customer-login-panel__link" href="/">
              Back to login
            </a>
            {requestClinic && (
              <a className="customer-login-panel__link" href="/signup">
                Create account
              </a>
            )}
            <a className="customer-login-panel__link" href="/admin">
              Admin login
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
