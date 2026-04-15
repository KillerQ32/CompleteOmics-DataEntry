import { redirect } from "next/navigation";
import { bootstrapAdminAction, signInAction } from "../actions";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value ?? "";
}

export default async function AdminEntryPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const message = readParam(resolvedSearchParams, "message");
  const error = readParam(resolvedSearchParams, "error");

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [
    {
      data: { user },
    },
    { count: adminCount },
  ] = await Promise.all([
    supabase.auth.getUser(),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
  ]);

  const profileResult = user
    ? await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  const profile = profileResult.data;

  if (user && (profile?.role === "admin" || profile?.role === "clinic_admin")) {
    redirect("/admin/overview");
  }

  const showBootstrapAdmin = (adminCount ?? 0) === 0;

  return (
    <main className="admin-login-page">
      <div className="admin-login-bg">
        <span className="admin-login-bg__cell admin-login-bg__cell--one" />
        <span className="admin-login-bg__cell admin-login-bg__cell--two" />
        <span className="admin-login-bg__cell admin-login-bg__cell--three" />
        <span className="admin-login-bg__cell admin-login-bg__cell--four" />
        <span className="admin-login-bg__cell admin-login-bg__cell--five" />
      </div>

      <section className="admin-login-shell">
        <aside className="admin-login-brand">
          <div className="admin-login-brand__logo">
            <img className="brand-logo brand-logo--full" src="/completeomics-logo.png" alt="Complete Omics" />
          </div>

          <h1>Admin Portal</h1>

          <a className="admin-login-panel__link admin-login-panel__link--brand" href="/">
            Back to customer portal
          </a>
        </aside>

        <section className="admin-login-panel">
          <div className="admin-login-panel__header">
            <h2>Admin Login</h2>
          </div>

          {(message || error) && (
            <div className={`status-banner ${error ? "status-banner--error" : ""}`}>
              {error || message}
            </div>
          )}

          <form action={signInAction} className="admin-login-form">
            <input type="hidden" name="redirect_to" value="/admin/overview" />
            <input type="hidden" name="login_scope" value="admin" />
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" placeholder="Enter here" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input name="password" type="password" minLength={8} placeholder="Enter here" required />
            </div>
            <button className="button button--primary" type="submit">
              Login
            </button>
          </form>

          {showBootstrapAdmin && (
            <form action={bootstrapAdminAction} className="admin-login-bootstrap">
              <input type="hidden" name="redirect_to" value="/admin/overview" />
              <p className="eyebrow">Initial Setup</p>
              <h3>Create the first admin</h3>
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
                  <label>Email</label>
                  <input name="email" type="email" required />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input name="password" type="password" minLength={8} required />
                </div>
              </div>
              <button className="button button--secondary" type="submit">
                Create Admin Account
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
