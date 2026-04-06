"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";

type SessionProfile = {
  id: string;
  role: "admin" | "customer";
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

function resolveCompanyId(profile: SessionProfile, formData: FormData) {
  if (profile.role === "admin") {
    const companyId = parseLookupValue(optionalValue(formData, "company_id"));

    if (!companyId) {
      redirectWith("error", "Choose a company for this admin action.");
    }

    return companyId;
  }

  if (!profile.company_id) {
    redirectWith("error", "Your user profile is missing a company assignment.");
  }

  return profile.company_id;
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const redirectPath = getRedirectPath(formData);
  const { error } = await supabase.auth.signInWithPassword({
    email: getValue(formData, "email"),
    password: getValue(formData, "password"),
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Signed in successfully.");
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/signup");

  const firstName = getValue(formData, "first_name");
  const lastName = getValue(formData, "last_name");
  const companyId = getValue(formData, "company_id");

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
  });

  if (profileError) {
    redirectWithPath(redirectPath, "error", profileError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Account created. You can now use the portal.");
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

  const { error } = await admin.from("companies").insert({
    name: getValue(formData, "name"),
    address_line_1: optionalValue(formData, "address_line_1"),
    address_line_2: optionalValue(formData, "address_line_2"),
    city: optionalValue(formData, "city"),
    state: optionalValue(formData, "state"),
    postal_code: optionalValue(formData, "postal_code"),
    contact_phone: optionalValue(formData, "contact_phone"),
    contact_email: optionalValue(formData, "contact_email"),
  });

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Company created.");
}

export async function updateCompanyAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const companyId = getValue(formData, "id");

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
    })
    .eq("id", companyId);

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Company updated.");
}

export async function updateUserProfileAction(formData: FormData) {
  const { user } = await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const profileId = getValue(formData, "id");
  const nextRole = getValue(formData, "role");
  const nextCompanyId = nextRole === "admin" ? null : optionalValue(formData, "company_id");

  if (user.id === profileId && nextRole !== "admin") {
    redirectWith("error", "Your current session must remain an admin.");
  }

  const { error } = await admin
    .from("user_profiles")
    .update({
      first_name: optionalValue(formData, "first_name"),
      last_name: optionalValue(formData, "last_name"),
      role: nextRole,
      company_id: nextCompanyId,
    })
    .eq("id", profileId);

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "User profile updated.");
}

export async function createPatientAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  const { error } = await supabase.from("patients").insert({
    company_id: companyId,
    first_name: getValue(formData, "first_name"),
    last_name: getValue(formData, "last_name"),
    date_of_birth: getValue(formData, "date_of_birth"),
    city: optionalValue(formData, "city"),
    state: optionalValue(formData, "state"),
    postal_code: optionalValue(formData, "postal_code"),
    race_ethnicity: optionalValue(formData, "race_ethnicity"),
    weight_lbs: normalizeFloatInput(optionalValue(formData, "weight_lbs")),
    height_inches: normalizeFloatInput(optionalValue(formData, "height_inches")),
    angioplasty_or_stent: formData.has("angioplasty_or_stent"),
    cabg: formData.has("cabg"),
  });

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Patient added.");
}

export async function updatePatientAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const patientId = getValue(formData, "id");

  const { error } = await admin
    .from("patients")
    .update({
      company_id: getValue(formData, "company_id"),
      first_name: getValue(formData, "first_name"),
      last_name: getValue(formData, "last_name"),
      date_of_birth: getValue(formData, "date_of_birth"),
      city: optionalValue(formData, "city"),
      state: optionalValue(formData, "state"),
      postal_code: optionalValue(formData, "postal_code"),
      race_ethnicity: optionalValue(formData, "race_ethnicity"),
      weight_lbs: normalizeFloatInput(optionalValue(formData, "weight_lbs")),
      height_inches: normalizeFloatInput(optionalValue(formData, "height_inches")),
      angioplasty_or_stent: formData.has("angioplasty_or_stent"),
      cabg: formData.has("cabg"),
    })
    .eq("id", patientId);

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Patient updated.");
}

export async function createPackageAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);

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
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Package added.");
}

export async function updatePackageAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const packageId = getValue(formData, "id");

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
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Package updated.");
}

export async function createSampleAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);

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
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Sample submitted.");
}

export async function createCustomerIntakeAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);

  const admin = profile.role === "admin" ? createSupabaseAdminClient() : null;
  const supabase = admin ?? (await createSupabaseServerClient());

  let patientId = parseLookupValue(optionalValue(formData, "patient_id"));

  if (!patientId) {
    const firstName = getValue(formData, "first_name");
    const lastName = getValue(formData, "last_name");
    const dateOfBirth = getValue(formData, "date_of_birth");

    if (!firstName || !lastName || !dateOfBirth) {
      redirectWith("error", "Choose an existing patient or enter first name, last name, and date of birth.");
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        city: optionalValue(formData, "city"),
        state: optionalValue(formData, "state"),
        postal_code: optionalValue(formData, "postal_code"),
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
      redirectWith("error", patientError?.message ?? "Patient could not be created.");
    }

    patientId = patient.id;
  }

  let fedexPackageId: string | null = null;
  const skipPackage = getValue(formData, "skip_package") === "true";
  const packageValue = getValue(formData, "package_id");

  if (!skipPackage && packageValue) {
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
      redirectWith("error", packageError?.message ?? "FedEx package could not be created.");
    }

    fedexPackageId = fedexPackage.id;
  }

  const { error } = await supabase.from("samples").insert({
    company_id: companyId,
    sample_number: getValue(formData, "sample_number"),
    patient_id: patientId,
    fedex_package_id: fedexPackageId,
    collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
    received_at: null,
    collected_by: optionalValue(formData, "collected_by"),
    missing_info: optionalValue(formData, "missing_info"),
    sex: optionalValue(formData, "sex"),
    ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
    hart_cadhs: formData.has("hart_cadhs") || getValue(formData, "hart_cadhs") === "true",
    hart_cve: formData.has("hart_cve") || getValue(formData, "hart_cve") === "true",
    icd10_codes: normalizeIcd10CodesFromForm(formData),
    npi_number: optionalValue(formData, "npi_number"),
    status: "submitted",
  });

  if (error) {
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Sample intake submitted.");
}

export async function updateSampleAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const sampleId = getValue(formData, "id");
  const rejected = getValue(formData, "rejected") === "true";

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
    redirectWith("error", error.message);
  }

  revalidatePath("/");
  redirectWith("message", "Sample updated.");
}

export async function uploadDocumentAction(formData: FormData) {
  const uploadCandidate = formData.get("document");

  if (!(uploadCandidate instanceof File) || uploadCandidate.size === 0) {
    redirectWith("error", "Choose a document before uploading.");
  }

  const fileToUpload = uploadCandidate;
  const { profile, user } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const patientId = optionalValue(formData, "patient_id");
  const sampleId = optionalValue(formData, "sample_id");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${companyId}/${patientId ?? "unassigned"}/${timestamp}-${cleanName}`;

  const client = profile.role === "admin" ? createSupabaseAdminClient() : await createSupabaseServerClient();

  const { error: uploadError } = await client.storage
    .from("patient-documents")
    .upload(storagePath, fileToUpload, {
      contentType: fileToUpload.type,
      upsert: false,
    });

  if (uploadError) {
    redirectWith("error", uploadError.message);
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
    redirectWith("error", metadataError.message);
  }

  revalidatePath("/");
  redirectWith("message", "Document uploaded.");
}
