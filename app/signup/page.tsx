import { redirect } from "next/navigation";
import { signUpAction } from "../actions";
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

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");

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
            <div className="customer-login-brand__mark">CO</div>
            <p className="customer-login-brand__wordmark">
              Complete<span>Omics</span>
            </p>
          </div>

          <h1>Create Account</h1>
          <p>
            Register a customer account for your clinic or hospital and start entering patient and
            sample information online.
          </p>
        </aside>

        <section className="customer-login-panel customer-signup-panel">
          <div className="customer-login-panel__header">
            <h2>Customer Sign Up</h2>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}

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
              <label>Company</label>
              <select name="company_id" defaultValue="" required>
                <CompanyOptions companies={companies} />
              </select>
            </div>
            <button className="button button--primary" type="submit">
              Create Account
            </button>
          </form>

          <div className="customer-login-panel__actions">
            <a className="customer-login-panel__link" href="/">
              Back to login
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
