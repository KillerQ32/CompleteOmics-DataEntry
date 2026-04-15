"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";

type SessionProfile = {
  id: string;
  role: "admin" | "clinic_admin" | "customer";
  company_id: string | null;
};

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseLookupValue(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(" | ");
  return parts[parts.length - 1]?.trim() || null;
}

function normalizeDateTimeInput(value: string | null) {
  return value && value.length > 0 ? value : null;
}

function normalizeDateInput(value: string | null) {
  return value && value.length > 0 ? value : null;
}

function normalizeFloatInput(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIcd10CodesFromForm(formData: FormData) {
  const explicitCodes = Array.from({ length: 5 }, (_, index) =>
    getValue(formData, `icd10_code_${index + 1}`),
  ).filter(Boolean);

  const codes =
    explicitCodes.length > 0
      ? explicitCodes
      : (optionalValue(formData, "icd10_codes") ?? "")
          .split(/[\n,;]+/)
          .map((code) => code.trim())
          .filter(Boolean);

  if (codes.length > 5) {
    redirectWith("error", "ICD10 Codes can contain up to 5 codes.");
  }

  return codes;
}

function getRedirectPath(formData: FormData, fallback = "/") {
  const redirectTo = getValue(formData, "redirect_to");
  return redirectTo.startsWith("/") ? redirectTo : fallback;
}

function redirectWithPath(path: string, type: "message" | "error", text: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${type}=${encodeURIComponent(text)}`);
}

function redirectWith(type: "message" | "error", text: string): never {
  redirect(`/?${type}=${encodeURIComponent(text)}`);
}

async function requireSessionProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWith("error", "You must be signed in to continue.");
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id, role, company_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirectWith("error", "Your user profile could not be loaded.");
  }

  return { supabase, profile: profile as SessionProfile, user };
}

async function requireAdminSession() {
  const session = await requireSessionProfile();

  if (session.profile.role !== "admin") {
    redirectWith("error", "Admin access is required for that action.");
  }

  return session;
}

async function requireStaffSession() {
  const session = await requireSessionProfile();

  if (session.profile.role !== "admin" && session.profile.role !== "clinic_admin") {
    redirectWith("error", "Admin access is required for that action.");
  }

  return session;
}

function resolveCompanyId(profile: SessionProfile, formData: FormData) {
  if (profile.role === "admin") {
    const companyId = parseLookupValue(optionalValue(formData, "company_id"));

    if (!companyId) {
      redirectWith("error", "Choose a clinic for this admin action.");
    }

    return companyId;
  }

  if (!profile.company_id) {
    redirectWith("error", "Your user profile is missing a clinic assignment.");
  }

  return profile.company_id;
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const redirectPath = getRedirectPath(formData);
  const loginScope = getValue(formData, "login_scope") || "customer";
  const { data, error } = await supabase.auth.signInWithPassword({
    email: getValue(formData, "email"),
    password: getValue(formData, "password"),
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  const userId = data.user?.id;

  if (!userId) {
    redirectWithPath(redirectPath, "error", "Sign in did not return a user record.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, account_status")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirectWithPath(redirectPath, "error", profileError?.message ?? "Your user profile could not be loaded.");
  }

  const isStaff = profile.role === "admin" || profile.role === "clinic_admin";

  if (loginScope === "admin" && !isStaff) {
    await supabase.auth.signOut();
    redirectWithPath("/admin", "error", "Use the customer login for customer accounts.");
  }

  if (loginScope !== "admin" && isStaff) {
    await supabase.auth.signOut();
    redirectWithPath("/", "error", "Use the admin login for admin accounts.");
  }

  if (loginScope !== "admin" && profile.account_status !== "approved") {
    revalidatePath("/");
    redirectWithPath("/", "message", "Signed in. Your account is waiting for approval.");
  }

  revalidatePath("/");
  redirect(redirectPath);
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/signup");

  const firstName = getValue(formData, "first_name");
  const lastName = getValue(formData, "last_name");
  const companyId = getValue(formData, "company_id");

  if (!companyId) {
    redirectWithPath(redirectPath, "error", "Choose an approved clinic before creating a customer account.");
  }

  const { data: companyExists, error: companyError } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !companyExists) {
    redirectWithPath(redirectPath, "error", companyError?.message ?? "Choose an approved clinic before creating a customer account.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: getValue(formData, "email"),
    password: getValue(formData, "password"),
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  const userId = data.user?.id;

  if (!userId) {
    redirectWithPath(redirectPath, "error", "Account creation did not return a user record.");
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    company_id: companyId,
    first_name: firstName,
    last_name: lastName,
    role: "customer",
    account_status: "pending",
  });

  if (profileError) {
    redirectWithPath(redirectPath, "error", profileError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Account created and sent for clinic approval.");
}

export async function requestClinicAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/signup?request_clinic=true");

  const { error } = await admin.from("clinic_requests").insert({
    clinic_name: getValue(formData, "clinic_name"),
    address_line_1: getValue(formData, "address_line_1"),
    city: getValue(formData, "city"),
    state: getValue(formData, "state"),
    postal_code: getValue(formData, "postal_code"),
    contact_email: getValue(formData, "contact_email"),
    contact_phone: getValue(formData, "contact_phone"),
    fax_number: optionalValue(formData, "fax_number"),
    requester_first_name: getValue(formData, "requester_first_name"),
    requester_last_name: getValue(formData, "requester_last_name"),
    requester_email: getValue(formData, "requester_email"),
    notes: optionalValue(formData, "notes"),
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/admin/clinics");
  redirectWithPath(redirectPath, "message", "Clinic request submitted. Complete Omics will review it before account creation.");
}

export async function approveClinicRequestAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const requestId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  const { data: request, error: requestError } = await admin
    .from("clinic_requests")
    .select(
      "id, clinic_name, address_line_1, city, state, postal_code, contact_email, contact_phone, fax_number, requester_first_name, requester_last_name, requester_email",
    )
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    redirectWithPath(redirectPath, "error", requestError?.message ?? "Clinic request could not be found.");
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: request.clinic_name,
      address_line_1: request.address_line_1,
      city: request.city,
      state: request.state,
      postal_code: request.postal_code,
      contact_email: request.contact_email,
      contact_phone: request.contact_phone,
      fax_number: request.fax_number,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    redirectWithPath(redirectPath, "error", companyError?.message ?? "Clinic could not be created.");
  }

  const requesterEmail = request.requester_email.toLowerCase();
  const { data: authUsers, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersError) {
    redirectWithPath(redirectPath, "error", usersError.message);
  }

  const existingUser = authUsers.users.find((authUser) => authUser.email?.toLowerCase() === requesterEmail);
  let userId = existingUser?.id;

  if (!userId) {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(request.requester_email, {
      data: {
        first_name: request.requester_first_name,
        last_name: request.requester_last_name,
      },
    });

    if (inviteError || !invitedUser.user) {
      redirectWithPath(redirectPath, "error", inviteError?.message ?? "Clinic admin invitation could not be created.");
    }

    userId = invitedUser.user.id;
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    company_id: company.id,
    first_name: request.requester_first_name,
    last_name: request.requester_last_name,
    role: "clinic_admin",
    account_status: "approved",
  });

  if (profileError) {
    redirectWithPath(redirectPath, "error", profileError.message);
  }

  const { error: updateError } = await admin
    .from("clinic_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateError) {
    redirectWithPath(redirectPath, "error", updateError.message);
  }

  revalidatePath("/");
  revalidatePath("/admin/clinics");
  revalidatePath("/admin/accounts");
  redirectWithPath(redirectPath, "message", "Clinic approved and requester assigned as clinic admin.");
}

export async function denyClinicRequestAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const requestId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  const { error } = await admin
    .from("clinic_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/admin/clinics");
  redirectWithPath(redirectPath, "message", "Clinic request denied.");
}

export async function bootstrapAdminAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData);
  const firstName = getValue(formData, "first_name");
  const lastName = getValue(formData, "last_name");
  const email = getValue(formData, "email");
  const password = getValue(formData, "password");

  const { count, error: countError } = await admin
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (countError) {
    redirectWithPath(redirectPath, "error", countError.message);
  }

  if ((count ?? 0) > 0) {
    redirectWithPath(redirectPath, "error", "An admin account already exists. Sign in and manage users from the admin portal.");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  const userId = data.user?.id;

  if (!userId) {
    redirectWithPath(redirectPath, "error", "Admin creation did not return a user record.");
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    company_id: null,
    first_name: firstName,
    last_name: lastName,
    role: "admin",
    account_status: "approved",
  });

  if (profileError) {
    redirectWithPath(redirectPath, "error", profileError.message);
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    redirectWithPath(redirectPath, "error", signInError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Admin account created. You are now signed in.");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirectWith("message", "Signed out.");
}

export async function createCompanyAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/admin/intake");

  const { error } = await admin.from("companies").insert({
    name: getValue(formData, "name"),
    address_line_1: optionalValue(formData, "address_line_1"),
    address_line_2: optionalValue(formData, "address_line_2"),
    city: optionalValue(formData, "city"),
    state: optionalValue(formData, "state"),
    postal_code: optionalValue(formData, "postal_code"),
    contact_phone: optionalValue(formData, "contact_phone"),
    contact_email: optionalValue(formData, "contact_email"),
    fax_number: optionalValue(formData, "fax_number"),
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Clinic created.");
}

export async function updateCompanyAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const companyId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  const { error } = await admin
    .from("companies")
    .update({
      name: getValue(formData, "name"),
      address_line_1: optionalValue(formData, "address_line_1"),
      city: optionalValue(formData, "city"),
      state: optionalValue(formData, "state"),
      postal_code: optionalValue(formData, "postal_code"),
      contact_phone: optionalValue(formData, "contact_phone"),
      contact_email: optionalValue(formData, "contact_email"),
      fax_number: optionalValue(formData, "fax_number"),
    })
    .eq("id", companyId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Clinic updated.");
}

export async function updateUserProfileAction(formData: FormData) {
  const { user } = await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const profileId = getValue(formData, "id");
  const nextRole = getValue(formData, "role");
  const nextCompanyId = nextRole === "admin" ? null : optionalValue(formData, "company_id");
  const redirectPath = getRedirectPath(formData, "/admin/accounts");

  if (user.id === profileId && nextRole !== "admin") {
    redirectWithPath(redirectPath, "error", "Your current session must remain an admin.");
  }

  if (nextRole !== "admin" && !nextCompanyId) {
    redirectWithPath(redirectPath, "error", "Clinic admins and customer accounts must be attached to an approved clinic.");
  }

  const { error } = await admin
    .from("user_profiles")
    .update({
      first_name: optionalValue(formData, "first_name"),
      last_name: optionalValue(formData, "last_name"),
      role: nextRole,
      company_id: nextCompanyId,
      account_status: getValue(formData, "account_status") || "approved",
    })
    .eq("id", profileId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "User profile updated.");
}

export async function updateAccountApprovalAction(formData: FormData) {
  const { profile } = await requireStaffSession();
  const admin = createSupabaseAdminClient();
  const profileId = getValue(formData, "id");
  const nextStatus = getValue(formData, "account_status");
  const redirectPath = getRedirectPath(formData, "/admin/accounts");

  if (nextStatus !== "approved" && nextStatus !== "denied" && nextStatus !== "pending") {
    redirectWithPath(redirectPath, "error", "Choose a valid account status.");
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("user_profiles")
    .select("id, role, company_id")
    .eq("id", profileId)
    .single();

  if (targetError || !targetProfile) {
    redirectWithPath(redirectPath, "error", targetError?.message ?? "User profile could not be found.");
  }

  if (profile.role === "clinic_admin") {
    if (targetProfile.role !== "customer" || targetProfile.company_id !== profile.company_id) {
      redirectWithPath(redirectPath, "error", "Clinic admins can only approve or deny customer accounts for their clinic.");
    }
  }

  const { error } = await admin
    .from("user_profiles")
    .update({ account_status: nextStatus })
    .eq("id", profileId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin/accounts");
  redirectWithPath(redirectPath, "message", `Account ${nextStatus}.`);
}

export async function updateCustomerAccountAction(formData: FormData) {
  const { supabase, user } = await requireSessionProfile();
  const redirectPath = getRedirectPath(formData, "/?customer_view=account");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      first_name: optionalValue(formData, "first_name"),
      last_name: optionalValue(formData, "last_name"),
    })
    .eq("id", user.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Account information updated.");
}

export async function createPatientAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData, "/admin/intake");

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  const { error } = await supabase.from("patients").insert({
    company_id: companyId,
    first_name: getValue(formData, "first_name"),
    last_name: getValue(formData, "last_name"),
    date_of_birth: getValue(formData, "date_of_birth"),
    address_line_1: optionalValue(formData, "address_line_1"),
    city: optionalValue(formData, "city"),
    state: optionalValue(formData, "state"),
    postal_code: optionalValue(formData, "postal_code"),
    phone_number: optionalValue(formData, "phone_number"),
    email_address: optionalValue(formData, "email_address"),
    race_ethnicity: optionalValue(formData, "race_ethnicity"),
    weight_lbs: normalizeFloatInput(optionalValue(formData, "weight_lbs")),
    height_inches: normalizeFloatInput(optionalValue(formData, "height_inches")),
    angioplasty_or_stent: formData.has("angioplasty_or_stent"),
    cabg: formData.has("cabg"),
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Patient added.");
}

export async function updatePatientAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const patientId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/operations");

  const { error } = await admin
    .from("patients")
    .update({
      company_id: getValue(formData, "company_id"),
      first_name: getValue(formData, "first_name"),
      last_name: getValue(formData, "last_name"),
      date_of_birth: getValue(formData, "date_of_birth"),
      address_line_1: optionalValue(formData, "address_line_1"),
      city: optionalValue(formData, "city"),
      state: optionalValue(formData, "state"),
      postal_code: optionalValue(formData, "postal_code"),
      phone_number: optionalValue(formData, "phone_number"),
      email_address: optionalValue(formData, "email_address"),
      race_ethnicity: optionalValue(formData, "race_ethnicity"),
      weight_lbs: normalizeFloatInput(optionalValue(formData, "weight_lbs")),
      height_inches: normalizeFloatInput(optionalValue(formData, "height_inches")),
      angioplasty_or_stent: formData.has("angioplasty_or_stent"),
      cabg: formData.has("cabg"),
    })
    .eq("id", patientId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Patient updated.");
}

export async function createPackageAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData, "/admin/intake");

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  const { error } = await supabase.from("fedex_packages").insert({
    company_id: companyId,
    package_id: getValue(formData, "package_id"),
    mailed_at: normalizeDateTimeInput(optionalValue(formData, "mailed_at")),
    received_at:
      profile.role === "admin"
        ? normalizeDateTimeInput(optionalValue(formData, "received_at"))
        : null,
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Package added.");
}

export async function updatePackageAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const packageId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/operations");

  const { error } = await admin
    .from("fedex_packages")
    .update({
      company_id: getValue(formData, "company_id"),
      package_id: getValue(formData, "package_id"),
      mailed_at: normalizeDateTimeInput(optionalValue(formData, "mailed_at")),
      received_at: normalizeDateTimeInput(optionalValue(formData, "received_at")),
    })
    .eq("id", packageId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Package updated.");
}

export async function createSampleAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData, "/admin/intake");

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  const { error } = await supabase.from("samples").insert({
    company_id: companyId,
    sample_number: getValue(formData, "sample_number"),
    patient_id: parseLookupValue(getValue(formData, "patient_id")),
    fedex_package_id: parseLookupValue(optionalValue(formData, "fedex_package_id")),
    collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
    received_at: normalizeDateInput(optionalValue(formData, "received_at")),
    collected_by: optionalValue(formData, "collected_by"),
    missing_info: optionalValue(formData, "missing_info"),
    sex: optionalValue(formData, "sex"),
    ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
    hart_cadhs: formData.has("hart_cadhs"),
    hart_cve: formData.has("hart_cve"),
    icd10_codes: normalizeIcd10CodesFromForm(formData),
    npi_number: optionalValue(formData, "npi_number"),
    status: profile.role === "admin" ? getValue(formData, "status") || "submitted" : "submitted",
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample submitted.");
}

export async function createCustomerIntakeAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData);

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  let patientId = parseLookupValue(optionalValue(formData, "patient_id"));

  if (!patientId) {
    const firstName = getValue(formData, "first_name");
    const lastName = getValue(formData, "last_name");
    const dateOfBirth = getValue(formData, "date_of_birth");

    if (!firstName || !lastName || !dateOfBirth) {
      redirectWithPath(redirectPath, "error", "Choose an existing patient or enter first name, last name, and date of birth.");
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        address_line_1: optionalValue(formData, "address_line_1"),
        city: optionalValue(formData, "city"),
        state: optionalValue(formData, "state"),
        postal_code: optionalValue(formData, "postal_code"),
        phone_number: optionalValue(formData, "phone_number"),
        email_address: optionalValue(formData, "email_address"),
        race_ethnicity: optionalValue(formData, "race_ethnicity"),
        weight_lbs: normalizeFloatInput(optionalValue(formData, "weight_lbs")),
        height_inches: normalizeFloatInput(optionalValue(formData, "height_inches")),
        angioplasty_or_stent:
          formData.has("angioplasty_or_stent") ||
          getValue(formData, "angioplasty_or_stent") === "true",
        cabg: formData.has("cabg") || getValue(formData, "cabg") === "true",
      })
      .select("id")
      .single();

    if (patientError || !patient) {
      redirectWithPath(redirectPath, "error", patientError?.message ?? "Patient could not be created.");
    }

    patientId = patient.id;
  }

  let fedexPackageId: string | null = null;
  const skipPackage = getValue(formData, "skip_package") === "true";
  const packageValue = getValue(formData, "package_id");
  const existingPackageId = packageValue.includes(" | ") ? parseLookupValue(packageValue) : null;

  if (!skipPackage && packageValue) {
    if (existingPackageId) {
      fedexPackageId = existingPackageId;
    } else {
      const { data: fedexPackage, error: packageError } = await supabase
        .from("fedex_packages")
        .insert({
          company_id: companyId,
          package_id: packageValue,
          mailed_at: normalizeDateTimeInput(optionalValue(formData, "mailed_at")),
          received_at: null,
        })
        .select("id")
        .single();

      if (packageError || !fedexPackage) {
        redirectWithPath(redirectPath, "error", packageError?.message ?? "FedEx package could not be created.");
      }

      fedexPackageId = fedexPackage.id;
    }
  }

  const { error } = await supabase.from("samples").insert({
    company_id: companyId,
    sample_number: getValue(formData, "sample_number"),
    patient_id: patientId,
    fedex_package_id: fedexPackageId,
    collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
    received_at: profile.role === "admin" ? normalizeDateInput(optionalValue(formData, "received_at")) : null,
    collected_by: optionalValue(formData, "collected_by"),
    missing_info: optionalValue(formData, "missing_info"),
    sex: optionalValue(formData, "sex"),
    ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
    hart_cadhs: formData.has("hart_cadhs") || getValue(formData, "hart_cadhs") === "true",
    hart_cve: formData.has("hart_cve") || getValue(formData, "hart_cve") === "true",
    icd10_codes: normalizeIcd10CodesFromForm(formData),
    npi_number: optionalValue(formData, "npi_number"),
    status: profile.role === "admin" ? getValue(formData, "status") || "submitted" : "submitted",
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample intake submitted.");
}

export async function updateSampleAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const sampleId = getValue(formData, "id");
  const rejected = getValue(formData, "rejected") === "true";
  const redirectPath = getRedirectPath(formData, "/admin/samples");

  const { error } = await admin
    .from("samples")
    .update({
      sample_number: getValue(formData, "sample_number"),
      company_id: parseLookupValue(getValue(formData, "company_id")),
      patient_id: parseLookupValue(getValue(formData, "patient_id")),
      fedex_package_id: parseLookupValue(optionalValue(formData, "fedex_package_id")),
      status: getValue(formData, "status"),
      received_at: normalizeDateInput(optionalValue(formData, "received_at")),
      collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
      collected_by: optionalValue(formData, "collected_by"),
      sex: optionalValue(formData, "sex"),
      ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
      missing_info: optionalValue(formData, "missing_info"),
      icd10_codes: normalizeIcd10CodesFromForm(formData),
      npi_number: optionalValue(formData, "npi_number"),
      rejection_reason: rejected ? optionalValue(formData, "rejection_reason") : null,
      rejected_at: rejected ? undefined : null,
      rejected_by: rejected ? undefined : null,
      rejected,
      hart_cadhs: formData.has("hart_cadhs"),
      hart_cve: formData.has("hart_cve"),
    })
    .eq("id", sampleId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample updated.");
}

export async function uploadDocumentAction(formData: FormData) {
  const uploadCandidate = formData.get("document");
  const redirectPath = getRedirectPath(formData);

  if (!(uploadCandidate instanceof File) || uploadCandidate.size === 0) {
    redirectWithPath(redirectPath, "error", "Choose a document before uploading.");
  }

  const fileToUpload = uploadCandidate;
  const { profile, user } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const patientId = parseLookupValue(optionalValue(formData, "patient_id")) ?? optionalValue(formData, "patient_id");
  const sampleId = parseLookupValue(optionalValue(formData, "sample_id")) ?? optionalValue(formData, "sample_id");

  if (!patientId || !sampleId) {
    redirectWithPath(redirectPath, "error", "Choose both a patient and a sample before uploading a document.");
  }

  const client = profile.role === "admin" ? createSupabaseAdminClient() : await createSupabaseServerClient();
  const { data: sample, error: sampleError } = await client
    .from("samples")
    .select("id, patient_id, company_id")
    .eq("id", sampleId)
    .single();

  if (sampleError || !sample) {
    redirectWithPath(redirectPath, "error", sampleError?.message ?? "Selected sample could not be found.");
  }

  if (sample.patient_id !== patientId) {
    redirectWithPath(redirectPath, "error", "Selected sample is not tied to the selected patient.");
  }

  if (sample.company_id !== companyId) {
    redirectWithPath(redirectPath, "error", "Selected sample is not tied to the selected clinic.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${companyId}/${patientId}/${sampleId}/${timestamp}-${cleanName}`;

  const { error: uploadError } = await client.storage
    .from("patient-documents")
    .upload(storagePath, fileToUpload, {
      contentType: fileToUpload.type,
      upsert: false,
    });

  if (uploadError) {
    redirectWithPath(redirectPath, "error", uploadError.message);
  }

  const { error: metadataError } = await client.from("patient_documents").insert({
    company_id: companyId,
    patient_id: patientId,
    sample_id: sampleId,
    storage_path: storagePath,
    original_filename: fileToUpload.name,
    mime_type: fileToUpload.type || "application/octet-stream",
    uploaded_by: user.id,
  });

  if (metadataError) {
    redirectWithPath(redirectPath, "error", metadataError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Document uploaded.");
}
