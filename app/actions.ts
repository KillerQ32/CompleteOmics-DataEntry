"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  exceedsIcd10CodeLimit,
  isSampleReviewDecisionAllowed,
  normalizeIcd10Codes,
  normalizeSampleStatus,
} from "../lib/sample-workflow";
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { createSupabaseServerClient } from "../lib/supabase/server";

type SessionProfile = {
  id: string;
  role: "admin" | "clinic_admin" | "customer";
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type RestorableUserProfile = {
  id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "clinic_admin" | "customer";
  account_status: "pending" | "approved" | "denied";
  notes: string | null;
};

function getProfileDisplayName(profile: Pick<SessionProfile, "first_name" | "last_name">) {
  const parts = [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);
  return value.length > 0 ? value : null;
}

function normalizeEmailAddress(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function withCleanupWarning(message: string, cleanupSucceeded: boolean, subject: string) {
  return cleanupSucceeded
    ? message
    : `${message} Cleanup also failed for the partial ${subject}; please review it in the admin portal.`;
}

function cleanupWarningText(cleanupSucceeded: boolean, subject: string) {
  return cleanupSucceeded
    ? ""
    : `Cleanup also failed for the partial ${subject}; please review it in the admin portal.`;
}

async function deleteAuthUserBestEffort(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Failed to remove partial auth user", { userId, error: error.message });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove partial auth user", { userId, error });
    return false;
  }
}

async function deleteCompanyBestEffort(admin: ReturnType<typeof createSupabaseAdminClient>, companyId: string) {
  try {
    const { error } = await admin.from("companies").delete().eq("id", companyId);

    if (error) {
      console.error("Failed to remove partial clinic", { companyId, error: error.message });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove partial clinic", { companyId, error });
    return false;
  }
}

async function restoreUserProfileBestEffort(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  profile: RestorableUserProfile | null,
) {
  if (!profile) {
    return true;
  }

  try {
    const { error } = await admin
      .from("user_profiles")
      .update({
        company_id: profile.company_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        account_status: profile.account_status,
        notes: profile.notes,
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Failed to restore user profile", { profileId: profile.id, error: error.message });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to restore user profile", { profileId: profile.id, error });
    return false;
  }
}

async function ensureClinicRequestAvailability(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  {
    clinicName,
    requesterEmail,
    redirectPath,
  }: {
    clinicName: string;
    requesterEmail: string;
    redirectPath: string;
  },
) {
  const normalizedClinicName = clinicName.trim();
  const normalizedRequesterEmail = normalizeEmailAddress(requesterEmail);

  const [
    { data: existingCompany, error: existingCompanyError },
    { data: existingClinicRequest, error: existingClinicRequestError },
    { data: existingEmailRequest, error: existingEmailRequestError },
  ] = await Promise.all([
    admin.from("companies").select("id").ilike("name", normalizedClinicName).limit(1).maybeSingle(),
    admin
      .from("clinic_requests")
      .select("id")
      .ilike("clinic_name", normalizedClinicName)
      .in("status", ["pending", "reviewing"])
      .limit(1)
      .maybeSingle(),
    admin
      .from("clinic_requests")
      .select("id")
      .ilike("requester_email", normalizedRequesterEmail)
      .in("status", ["pending", "reviewing"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (existingCompanyError || existingClinicRequestError || existingEmailRequestError) {
    redirectWithPath(
      redirectPath,
      "error",
      existingCompanyError?.message
        ?? existingClinicRequestError?.message
        ?? existingEmailRequestError?.message
        ?? "Clinic availability could not be checked.",
    );
  }

  if (existingCompany) {
    redirectWithPath(redirectPath, "error", "A clinic with this name already exists.");
  }

  if (existingClinicRequest) {
    redirectWithPath(redirectPath, "error", "A request for this clinic is already pending admin review.");
  }

  if (existingEmailRequest) {
    redirectWithPath(redirectPath, "error", "A clinic request is already pending for this email address.");
  }
}

async function findAuthUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.users.find((authUser) => authUser.email?.toLowerCase() === normalizedEmail) ?? null;
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

function normalizeSexInput(value: string | null) {
  if (!value) {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case "m":
    case "male":
      return "Male";
    case "f":
    case "female":
      return "Female";
    default:
      return value.trim();
  }
}

function requireAssignedCompanyId(profile: SessionProfile, redirectPath: string) {
  if (!profile.company_id) {
    redirectWithPath(redirectPath, "error", "Your user profile is missing a clinic assignment.");
  }

  return profile.company_id;
}

function normalizeCustomerEditableSampleStatus(currentStatus: string, requestedStatus: string) {
  const normalizedCurrentStatus = normalizeSampleStatus(currentStatus);
  const normalizedRequestedStatus = normalizeSampleStatus(requestedStatus || currentStatus);

  if (normalizedCurrentStatus === "accepted" || normalizedCurrentStatus === "rejected") {
    return normalizedCurrentStatus;
  }

  return normalizedRequestedStatus === "mailed" ? "mailed" : "submitted";
}

function ensureReviewDecisionAllowed(
  status: string,
  receivedAt: string | null,
  redirectPath: string,
): void {
  if (!isSampleReviewDecisionAllowed(status, receivedAt)) {
    redirectWithPath(
      redirectPath,
      "error",
      "A sample must be marked received before it can be accepted or rejected.",
    );
  }
}

function normalizeIcd10CodesFromForm(formData: FormData) {
  const codes = normalizeIcd10Codes(
    Array.from({ length: 5 }, (_, index) => getValue(formData, `icd10_code_${index + 1}`)),
    optionalValue(formData, "icd10_codes"),
  );

  if (exceedsIcd10CodeLimit(codes)) {
    redirectWith("error", "ICD10 Codes can contain up to 5 codes.");
  }

  return codes;
}

function getRedirectPath(formData: FormData, fallback = "/") {
  const redirectTo = getValue(formData, "redirect_to");
  return redirectTo.startsWith("/") ? redirectTo : fallback;
}

async function finalizePendingIntakeDocuments({
  client,
  companyId,
  userId,
  draftKey,
  patientId,
  sampleId,
}: {
  client: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>;
  companyId: string;
  userId: string;
  draftKey: string | null;
  patientId: string;
  sampleId: string;
}) {
  if (!draftKey) {
    return;
  }

  const { data: pendingDocuments, error: pendingDocumentsError } = await client
    .from("pending_intake_documents")
    .select("id, storage_path, original_filename, mime_type")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("draft_key", draftKey)
    .order("created_at", { ascending: true });

  if (pendingDocumentsError) {
    throw new Error(pendingDocumentsError.message);
  }

  if (!pendingDocuments || pendingDocuments.length === 0) {
    return;
  }

  const { error: metadataError } = await client.from("patient_documents").insert(
    pendingDocuments.map((document) => ({
      company_id: companyId,
      patient_id: patientId,
      sample_id: sampleId,
      storage_path: document.storage_path,
      original_filename: document.original_filename,
      mime_type: document.mime_type || "application/octet-stream",
      uploaded_by: userId,
    })),
  );

  if (metadataError) {
    throw new Error(metadataError.message);
  }

  const pendingDocumentIds = pendingDocuments.map((document) => document.id);
  const { error: cleanupError } = await client
    .from("pending_intake_documents")
    .delete()
    .in("id", pendingDocumentIds);

  if (cleanupError) {
    throw new Error(cleanupError.message);
  }
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
    .select("id, role, company_id, first_name, last_name")
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
      redirectWith("error", "Choose a clinic for this admin action.");
    }

    return companyId;
  }

  if (!profile.company_id) {
    redirectWith("error", "Your user profile is missing a clinic assignment.");
  }

  return profile.company_id;
}

function ensureCompanyDeleteScope(profile: SessionProfile, companyId: string, redirectPath: string) {
  if (profile.role === "admin") {
    return;
  }

  const assignedCompanyId = requireAssignedCompanyId(profile, redirectPath);

  if (assignedCompanyId !== companyId) {
    redirectWithPath(redirectPath, "error", "You can only remove records tied to your clinic.");
  }
}

async function bestEffortRemoveDocumentObjects(storagePaths: Array<string | null | undefined>) {
  const uniquePaths = Array.from(
    new Set(
      storagePaths
        .filter((path): path is string => typeof path === "string" && path.trim().length > 0)
        .map((path) => path.trim()),
    ),
  );

  if (uniquePaths.length === 0) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from("patient-documents").remove(uniquePaths);

    if (error) {
      console.error("Document storage cleanup failed:", error.message);
    }
  } catch (error) {
    console.error("Document storage cleanup failed:", error);
  }
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

  const isStaff = profile.role === "admin";

  if (loginScope === "admin" && !isStaff) {
    await supabase.auth.signOut();
    redirectWithPath("/admin", "error", "Incorrect login information.");
  }

  if (loginScope !== "admin" && isStaff) {
    await supabase.auth.signOut();
    redirectWithPath("/", "error", "Incorrect login information.");
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
  const notes = optionalValue(formData, "notes");

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
    notes,
    role: "customer",
    account_status: "pending",
  });

  if (profileError) {
    const cleanedUp = await deleteAuthUserBestEffort(admin, userId);
    redirectWithPath(redirectPath, "error", withCleanupWarning(profileError.message, cleanedUp, "account"));
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Account created and sent for admin approval.");
}

export async function requestClinicAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/signup?request_clinic=true");
  const clinicName = getValue(formData, "clinic_name");
  const requesterEmail = normalizeEmailAddress(getValue(formData, "requester_email"));
  const requesterFirstName = getValue(formData, "requester_first_name");
  const requesterLastName = getValue(formData, "requester_last_name");
  const password = getValue(formData, "password");
  const contactEmail = normalizeEmailAddress(getValue(formData, "contact_email"));

  if (password.length < 8) {
    redirectWithPath(redirectPath, "error", "Password must be at least 8 characters.");
  }

  await ensureClinicRequestAvailability(admin, {
    clinicName,
    requesterEmail,
    redirectPath,
  });

  let existingUser = null;

  try {
    existingUser = await findAuthUserByEmail(requesterEmail);
  } catch (lookupError) {
    redirectWithPath(
      redirectPath,
      "error",
      lookupError instanceof Error ? lookupError.message : "Existing users could not be checked.",
    );
  }

  if (existingUser) {
    redirectWithPath(
      redirectPath,
      "error",
      "An account already exists for this email. Use that login or contact an admin if you need help.",
    );
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: requesterEmail,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: requesterFirstName,
      last_name: requesterLastName,
    },
  });

  if (createUserError || !createdUser.user) {
    redirectWithPath(
      redirectPath,
      "error",
      createUserError?.message ?? "The clinic requester account could not be created.",
    );
  }

  const requesterUserId = createdUser.user.id;

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: requesterUserId,
    company_id: null,
    first_name: requesterFirstName,
    last_name: requesterLastName,
    notes: optionalValue(formData, "notes"),
    role: "customer",
    account_status: "pending",
  });

  if (profileError) {
    const cleanedUp = await deleteAuthUserBestEffort(admin, requesterUserId);
    redirectWithPath(redirectPath, "error", withCleanupWarning(profileError.message, cleanedUp, "account"));
  }

  const { error } = await admin.from("clinic_requests").insert({
    clinic_name: clinicName,
    address_line_1: getValue(formData, "address_line_1"),
    city: getValue(formData, "city"),
    state: getValue(formData, "state"),
    postal_code: getValue(formData, "postal_code"),
    contact_email: contactEmail,
    contact_phone: getValue(formData, "contact_phone"),
    fax_number: optionalValue(formData, "fax_number"),
    requester_first_name: requesterFirstName,
    requester_last_name: requesterLastName,
    requester_email: requesterEmail,
    notes: optionalValue(formData, "notes"),
  });

  if (error) {
    const cleanedUp = await deleteAuthUserBestEffort(admin, requesterUserId);
    redirectWithPath(redirectPath, "error", withCleanupWarning(error.message, cleanedUp, "account"));
  }

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/accounts");
  redirectWithPath(
    redirectPath,
    "message",
    "Clinic request submitted. Your login was created and will stay pending until the clinic is approved.",
  );
}

export async function approveClinicRequestAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const requestId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  const { data: request, error: requestError } = await admin
    .from("clinic_requests")
    .select(
      "id, clinic_name, address_line_1, city, state, postal_code, contact_email, contact_phone, fax_number, requester_first_name, requester_last_name, requester_email, status",
    )
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    redirectWithPath(redirectPath, "error", requestError?.message ?? "Clinic request could not be found.");
  }

  if (request.status === "approved") {
    redirectWithPath(redirectPath, "message", "This clinic request is already approved and linked to a customer account.");
  }

  if (request.status === "rejected") {
    redirectWithPath(redirectPath, "error", "This clinic request was already rejected.");
  }

  const { data: existingCompany, error: existingCompanyError } = await admin
    .from("companies")
    .select("id")
    .ilike("name", request.clinic_name)
    .limit(1)
    .maybeSingle();

  if (existingCompanyError) {
    redirectWithPath(redirectPath, "error", existingCompanyError.message);
  }

  if (existingCompany) {
    redirectWithPath(
      redirectPath,
      "error",
      "A clinic with this name already exists. This request must be denied or changed before it can be approved.",
    );
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
  let existingUser = null;

  try {
    existingUser = await findAuthUserByEmail(requesterEmail);
  } catch (lookupError) {
    redirectWithPath(
      redirectPath,
      "error",
      lookupError instanceof Error ? lookupError.message : "Existing users could not be checked.",
    );
  }

  let userId = existingUser?.id;
  let createdUserDuringApproval = false;
  let previousProfile: RestorableUserProfile | null = null;

  if (userId) {
    const { data: existingProfile, error: existingProfileError } = await admin
      .from("user_profiles")
      .select("id, company_id, first_name, last_name, role, account_status, notes")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfileError) {
      const companyDeleted = await deleteCompanyBestEffort(admin, company.id);
      redirectWithPath(
        redirectPath,
        "error",
        withCleanupWarning(existingProfileError.message, companyDeleted, "clinic"),
      );
    }

    previousProfile = (existingProfile ?? null) as RestorableUserProfile | null;
  }

  if (!userId) {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(request.requester_email, {
      data: {
        first_name: request.requester_first_name,
        last_name: request.requester_last_name,
      },
    });

    if (inviteError || !invitedUser.user) {
      const companyDeleted = await deleteCompanyBestEffort(admin, company.id);
      redirectWithPath(
        redirectPath,
        "error",
        withCleanupWarning(
          inviteError?.message ?? "Clinic requester invitation could not be created.",
          companyDeleted,
          "clinic",
        ),
      );
    }

    userId = invitedUser.user.id;
    createdUserDuringApproval = true;
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    company_id: company.id,
    first_name: request.requester_first_name,
    last_name: request.requester_last_name,
    role: "customer",
    account_status: "approved",
  });

  if (profileError) {
    const companyDeleted = await deleteCompanyBestEffort(admin, company.id);
    const userCleanedUp = createdUserDuringApproval
      ? await deleteAuthUserBestEffort(admin, userId)
      : true;
    redirectWithPath(
      redirectPath,
      "error",
      [
        withCleanupWarning(profileError.message, companyDeleted, "clinic"),
        createdUserDuringApproval ? cleanupWarningText(userCleanedUp, "account") : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const { error: updateError } = await admin
    .from("clinic_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateError) {
    const companyDeleted = await deleteCompanyBestEffort(admin, company.id);
    const profileRolledBack = createdUserDuringApproval
      ? await deleteAuthUserBestEffort(admin, userId)
      : await restoreUserProfileBestEffort(admin, previousProfile);
    redirectWithPath(
      redirectPath,
      "error",
      [
        withCleanupWarning(updateError.message, companyDeleted, "clinic"),
        createdUserDuringApproval
          ? cleanupWarningText(profileRolledBack, "account")
          : cleanupWarningText(profileRolledBack, "user profile"),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  revalidatePath("/");
  revalidatePath("/admin/clinics");
  revalidatePath("/admin/accounts");
  redirectWithPath(redirectPath, "message", "Clinic approved and requester assigned as a customer account.");
}

export async function denyClinicRequestAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const requestId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  const { data: request, error: requestError } = await admin
    .from("clinic_requests")
    .select("requester_email, status")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    redirectWithPath(redirectPath, "error", requestError?.message ?? "Clinic request could not be found.");
  }

  if (request.status === "approved") {
    redirectWithPath(redirectPath, "error", "Approved clinic requests cannot be denied.");
  }

  if (request.status === "rejected") {
    redirectWithPath(redirectPath, "message", "This clinic request is already denied.");
  }

  const requesterUser = await findAuthUserByEmail(request.requester_email).catch((lookupError) => {
    redirectWithPath(
      redirectPath,
      "error",
      lookupError instanceof Error ? lookupError.message : "The requester account could not be checked.",
    );
  });

  let previousAccountStatus: "pending" | "approved" | "denied" | null = null;

  if (requesterUser) {
    const { data: existingProfile, error: existingProfileError } = await admin
      .from("user_profiles")
      .select("account_status")
      .eq("id", requesterUser.id)
      .maybeSingle();

    if (existingProfileError) {
      redirectWithPath(redirectPath, "error", existingProfileError.message);
    }

    previousAccountStatus = (existingProfile?.account_status as "pending" | "approved" | "denied" | null) ?? null;

    const { error: profileError } = await admin
      .from("user_profiles")
      .update({ account_status: "denied" })
      .eq("id", requesterUser.id);

    if (profileError) {
      redirectWithPath(redirectPath, "error", profileError.message);
    }
  }

  const { error } = await admin
    .from("clinic_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) {
    if (requesterUser) {
      const profileRolledBack = previousAccountStatus
        ? await admin
            .from("user_profiles")
            .update({ account_status: previousAccountStatus })
            .eq("id", requesterUser.id)
        : null;

      if (profileRolledBack?.error) {
        redirectWithPath(
          redirectPath,
          "error",
          withCleanupWarning(error.message, false, "user profile"),
        );
      }
    }

    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/admin/clinics");
  revalidatePath("/admin/accounts");
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
    const cleanedUp = await deleteAuthUserBestEffort(admin, userId);
    redirectWithPath(redirectPath, "error", withCleanupWarning(profileError.message, cleanedUp, "account"));
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

export async function signOutAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const redirectPath = getRedirectPath(formData);
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect(redirectPath);
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
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/clinics")
      : getRedirectPath(formData, "/?customer_view=account");
  const companyId =
    profile.role === "admin"
      ? getValue(formData, "id")
      : requireAssignedCompanyId(profile, redirectPath);

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

export async function deleteCompanyAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const redirectPath = getRedirectPath(formData, "/admin/clinics");

  if (profile.role !== "admin") {
    redirectWithPath(redirectPath, "error", "Only admins can remove clinics.");
  }

  const companyId = getValue(formData, "id");

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    redirectWithPath(redirectPath, "error", companyError?.message ?? "Clinic could not be found.");
  }

  const [{ data: documentRows, error: documentRowsError }, { data: pendingRows, error: pendingRowsError }] =
    await Promise.all([
      admin.from("patient_documents").select("storage_path").eq("company_id", company.id),
      admin.from("pending_intake_documents").select("storage_path").eq("company_id", company.id),
    ]);

  if (documentRowsError) {
    redirectWithPath(redirectPath, "error", documentRowsError.message);
  }

  if (pendingRowsError) {
    redirectWithPath(redirectPath, "error", pendingRowsError.message);
  }

  const { error } = await admin.from("companies").delete().eq("id", company.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  await bestEffortRemoveDocumentObjects([
    ...(documentRows ?? []).map((row) => row.storage_path),
    ...(pendingRows ?? []).map((row) => row.storage_path),
  ]);

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Clinic removed.");
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
    redirectWithPath(redirectPath, "error", "Customer accounts must be attached to an approved clinic.");
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
  await requireAdminSession();
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
  const { profile } = await requireSessionProfile();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/patients")
      : getRedirectPath(formData, "/?customer_view=patients");
  const companyId =
    profile.role === "admin"
      ? parseLookupValue(getValue(formData, "company_id")) ?? getValue(formData, "company_id")
      : requireAssignedCompanyId(profile, redirectPath);
  const supabase = profile.role === "admin" ? createSupabaseAdminClient() : await createSupabaseServerClient();
  const patientId = getValue(formData, "id");

  const { error } = await supabase
    .from("patients")
    .update({
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
    })
    .eq("id", patientId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Patient updated.");
}

export async function deletePatientAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/patients")
      : getRedirectPath(formData, "/?customer_view=patients");
  const patientId = getValue(formData, "id");

  const { data: patient, error: patientError } = await admin
    .from("patients")
    .select("id, company_id")
    .eq("id", patientId)
    .single();

  if (patientError || !patient) {
    redirectWithPath(redirectPath, "error", patientError?.message ?? "Patient could not be found.");
  }

  ensureCompanyDeleteScope(profile, patient.company_id, redirectPath);

  const { data: documentRows, error: documentRowsError } = await admin
    .from("patient_documents")
    .select("id, storage_path")
    .eq("patient_id", patient.id);

  if (documentRowsError) {
    redirectWithPath(redirectPath, "error", documentRowsError.message);
  }

  const documentIds = (documentRows ?? []).map((row) => row.id);
  const documentPaths = (documentRows ?? []).map((row) => row.storage_path);

  if (documentIds.length > 0) {
    const { error: deleteDocumentsError } = await admin.from("patient_documents").delete().in("id", documentIds);

    if (deleteDocumentsError) {
      redirectWithPath(redirectPath, "error", deleteDocumentsError.message);
    }
  }

  const { error: deleteSamplesError } = await admin.from("samples").delete().eq("patient_id", patient.id);

  if (deleteSamplesError) {
    redirectWithPath(redirectPath, "error", deleteSamplesError.message);
  }

  const { error } = await admin.from("patients").delete().eq("id", patient.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  await bestEffortRemoveDocumentObjects(documentPaths);

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Patient removed.");
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
  const { profile } = await requireSessionProfile();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/packages")
      : getRedirectPath(formData, "/?customer_view=packages");
  const companyId =
    profile.role === "admin"
      ? parseLookupValue(getValue(formData, "company_id")) ?? getValue(formData, "company_id")
      : requireAssignedCompanyId(profile, redirectPath);
  const supabase = profile.role === "admin" ? createSupabaseAdminClient() : await createSupabaseServerClient();
  const packageId = getValue(formData, "id");

  const { error } = await supabase
    .from("fedex_packages")
    .update({
      company_id: companyId,
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

export async function deletePackageAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/packages")
      : getRedirectPath(formData, "/?customer_view=packages");
  const packageRecordId = getValue(formData, "id");

  const { data: fedexPackage, error: packageError } = await admin
    .from("fedex_packages")
    .select("id, company_id")
    .eq("id", packageRecordId)
    .single();

  if (packageError || !fedexPackage) {
    redirectWithPath(redirectPath, "error", packageError?.message ?? "Package could not be found.");
  }

  ensureCompanyDeleteScope(profile, fedexPackage.company_id, redirectPath);

  const { error } = await admin.from("fedex_packages").delete().eq("id", fedexPackage.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Package removed.");
}

export async function createSampleAction(formData: FormData) {
  const { supabase, profile } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData, "/admin/intake");

  const receivedAt = normalizeDateInput(optionalValue(formData, "received_at"));
  const status =
    profile.role === "admin"
      ? normalizeSampleStatus(getValue(formData, "status"))
      : "submitted";
  const collectedBy =
    profile.role === "admin"
      ? optionalValue(formData, "collected_by")
      : getProfileDisplayName(profile) ?? optionalValue(formData, "collected_by");

  ensureReviewDecisionAllowed(status, receivedAt, redirectPath);

  const { error } = await supabase.from("samples").insert({
    company_id: companyId,
    sample_number: getValue(formData, "sample_number"),
    patient_id: parseLookupValue(getValue(formData, "patient_id")),
    fedex_package_id: parseLookupValue(optionalValue(formData, "fedex_package_id")),
    collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
    received_at: receivedAt,
    collected_by: collectedBy,
    missing_info: optionalValue(formData, "missing_info"),
    sex: normalizeSexInput(optionalValue(formData, "sex")),
    ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
    hart_cadhs: formData.has("hart_cadhs"),
    hart_cve: formData.has("hart_cve"),
    icd10_codes: normalizeIcd10CodesFromForm(formData),
    npi_number: optionalValue(formData, "npi_number"),
    status,
    rejected: status === "rejected",
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample submitted.");
}

export async function createCustomerIntakeAction(formData: FormData) {
  const { supabase, profile, user } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const redirectPath = getRedirectPath(formData);
  const draftKey = optionalValue(formData, "draft_key");
  const adminClient = createSupabaseAdminClient();

  const status =
    profile.role === "admin"
      ? normalizeSampleStatus(getValue(formData, "status"))
      : "submitted";
  const collectedBy = getProfileDisplayName(profile) ?? optionalValue(formData, "collected_by");
  const receivedAt =
    profile.role === "admin" ? normalizeDateInput(optionalValue(formData, "received_at")) : null;

  ensureReviewDecisionAllowed(status, receivedAt, redirectPath);

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

  if (!patientId) {
    redirectWithPath(redirectPath, "error", "Patient could not be resolved for this intake.");
  }

  const { data: sample, error } = await supabase
    .from("samples")
    .insert({
      company_id: companyId,
      sample_number: getValue(formData, "sample_number"),
      patient_id: patientId,
      fedex_package_id: fedexPackageId,
      collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
      received_at: receivedAt,
      collected_by: collectedBy,
      missing_info: optionalValue(formData, "missing_info"),
      sex: normalizeSexInput(optionalValue(formData, "sex")),
      ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
      hart_cadhs: formData.has("hart_cadhs") || getValue(formData, "hart_cadhs") === "true",
      hart_cve: formData.has("hart_cve") || getValue(formData, "hart_cve") === "true",
      icd10_codes: normalizeIcd10CodesFromForm(formData),
      npi_number: optionalValue(formData, "npi_number"),
      status,
      rejected: status === "rejected",
    })
    .select("id")
    .single();

  if (error || !sample) {
    redirectWithPath(redirectPath, "error", error?.message ?? "Sample intake could not be created.");
  }

  try {
    await finalizePendingIntakeDocuments({
      client: adminClient,
      companyId,
      userId: user.id,
      draftKey,
      patientId,
      sampleId: sample.id,
    });
  } catch (pendingDocumentError) {
    const message =
      pendingDocumentError instanceof Error
        ? pendingDocumentError.message
        : "Sample submitted, but staged documents could not be attached.";
    redirectWithPath(redirectPath, "error", message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample intake submitted.");
}

export async function uploadPendingIntakeDocumentAction(formData: FormData) {
  const uploadCandidate = formData.get("document");
  const redirectPath = getRedirectPath(formData, "/?customer_view=intake&intake_step=files");

  if (!(uploadCandidate instanceof File) || uploadCandidate.size === 0) {
    redirectWithPath(redirectPath, "error", "Choose a document before uploading.");
  }

  const draftKey = optionalValue(formData, "draft_key");

  if (!draftKey) {
    redirectWithPath(redirectPath, "error", "This intake draft is missing its document key.");
  }

  const fileToUpload = uploadCandidate;
  const { profile, user } = await requireSessionProfile();
  const companyId = resolveCompanyId(profile, formData);
  const client = createSupabaseAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cleanName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${companyId}/pending/${user.id}/${draftKey}/${timestamp}-${cleanName}`;

  const { error: uploadError } = await client.storage
    .from("patient-documents")
    .upload(storagePath, fileToUpload, {
      contentType: fileToUpload.type,
      upsert: false,
    });

  if (uploadError) {
    redirectWithPath(redirectPath, "error", uploadError.message);
  }

  const { error: metadataError } = await client.from("pending_intake_documents").insert({
    company_id: companyId,
    user_id: user.id,
    draft_key: draftKey,
    storage_path: storagePath,
    original_filename: fileToUpload.name,
    mime_type: fileToUpload.type || "application/octet-stream",
  });

  if (metadataError) {
    redirectWithPath(redirectPath, "error", metadataError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Document staged for this intake.");
}

export async function updateSampleAction(formData: FormData) {
  const { supabase, profile } = await requireSessionProfile();
  const sampleId = getValue(formData, "id");
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/samples")
      : getRedirectPath(formData, "/?customer_view=samples");
  const companyId =
    profile.role === "admin"
      ? parseLookupValue(getValue(formData, "company_id")) ?? getValue(formData, "company_id")
      : requireAssignedCompanyId(profile, redirectPath);
  const receivedAt =
    profile.role === "admin" ? normalizeDateInput(optionalValue(formData, "received_at")) : null;

  const { data: existingSample, error: existingSampleError } = await supabase
    .from("samples")
    .select("status, rejected, rejection_reason, rejected_at, rejected_by, received_at, collected_by")
    .eq("id", sampleId)
    .single();

  if (existingSampleError || !existingSample) {
    redirectWithPath(redirectPath, "error", existingSampleError?.message ?? "Sample could not be found.");
  }

  const requestedStatus = normalizeSampleStatus(getValue(formData, "status"));
  const status =
    profile.role === "admin"
      ? requestedStatus === "rejected" || getValue(formData, "rejected") === "true"
        ? "rejected"
        : requestedStatus
      : normalizeCustomerEditableSampleStatus(existingSample.status, requestedStatus);
  const rejected = profile.role === "admin" ? status === "rejected" : existingSample.rejected;
  const effectiveReceivedAt = profile.role === "admin" ? receivedAt : existingSample.received_at;

  ensureReviewDecisionAllowed(status, effectiveReceivedAt, redirectPath);

  const { error } = await supabase
    .from("samples")
    .update({
      sample_number: getValue(formData, "sample_number"),
      company_id: companyId,
      patient_id: parseLookupValue(getValue(formData, "patient_id")),
      fedex_package_id: parseLookupValue(optionalValue(formData, "fedex_package_id")),
      status,
      received_at: effectiveReceivedAt,
      collected_at: normalizeDateInput(optionalValue(formData, "collected_at")),
      collected_by:
        profile.role === "admin"
          ? optionalValue(formData, "collected_by")
          : existingSample.collected_by ?? getProfileDisplayName(profile),
      sex: normalizeSexInput(optionalValue(formData, "sex")),
      ordering_provider_name: optionalValue(formData, "ordering_provider_name"),
      missing_info: optionalValue(formData, "missing_info"),
      icd10_codes: normalizeIcd10CodesFromForm(formData),
      npi_number: optionalValue(formData, "npi_number"),
      rejection_reason:
        profile.role === "admin"
          ? rejected
            ? optionalValue(formData, "rejection_reason")
            : null
          : existingSample.rejection_reason,
      rejected_at:
        profile.role === "admin"
          ? rejected
            ? undefined
            : null
          : existingSample.rejected_at,
      rejected_by:
        profile.role === "admin"
          ? rejected
            ? undefined
            : null
          : existingSample.rejected_by,
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

export async function deleteSampleAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const sampleId = getValue(formData, "id");
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/samples")
      : getRedirectPath(formData, "/?customer_view=samples");

  const { data: sample, error: sampleError } = await admin
    .from("samples")
    .select("id, company_id")
    .eq("id", sampleId)
    .single();

  if (sampleError || !sample) {
    redirectWithPath(redirectPath, "error", sampleError?.message ?? "Sample could not be found.");
  }

  ensureCompanyDeleteScope(profile, sample.company_id, redirectPath);

  const { data: documentRows, error: documentRowsError } = await admin
    .from("patient_documents")
    .select("id, storage_path")
    .eq("sample_id", sample.id);

  if (documentRowsError) {
    redirectWithPath(redirectPath, "error", documentRowsError.message);
  }

  const documentIds = (documentRows ?? []).map((row) => row.id);
  const documentPaths = (documentRows ?? []).map((row) => row.storage_path);

  if (documentIds.length > 0) {
    const { error: deleteDocumentsError } = await admin.from("patient_documents").delete().in("id", documentIds);

    if (deleteDocumentsError) {
      redirectWithPath(redirectPath, "error", deleteDocumentsError.message);
    }
  }

  const { error } = await admin.from("samples").delete().eq("id", sample.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  await bestEffortRemoveDocumentObjects(documentPaths);

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample removed.");
}

export async function updateDocumentAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/documents")
      : getRedirectPath(formData, "/?customer_view=operations");
  const companyId =
    profile.role === "admin"
      ? parseLookupValue(getValue(formData, "company_id")) ?? getValue(formData, "company_id")
      : requireAssignedCompanyId(profile, redirectPath);
  const client = profile.role === "admin" ? createSupabaseAdminClient() : await createSupabaseServerClient();
  const documentId = getValue(formData, "id");
  const patientId = parseLookupValue(optionalValue(formData, "patient_id")) ?? optionalValue(formData, "patient_id");
  const sampleId = parseLookupValue(optionalValue(formData, "sample_id")) ?? optionalValue(formData, "sample_id");

  if (!patientId || !sampleId) {
    redirectWithPath(redirectPath, "error", "Choose both a patient and a sample before saving the document.");
  }

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

  const { error } = await client
    .from("patient_documents")
    .update({
      company_id: companyId,
      patient_id: patientId,
      sample_id: sampleId,
    })
    .eq("id", documentId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Document updated.");
}

export async function deleteDocumentAction(formData: FormData) {
  const { profile } = await requireSessionProfile();
  const admin = createSupabaseAdminClient();
  const redirectPath =
    profile.role === "admin"
      ? getRedirectPath(formData, "/admin/documents")
      : getRedirectPath(formData, "/?customer_view=operations");
  const documentId = getValue(formData, "id");

  const { data: document, error: documentError } = await admin
    .from("patient_documents")
    .select("id, company_id, storage_path")
    .eq("id", documentId)
    .single();

  if (documentError || !document) {
    redirectWithPath(redirectPath, "error", documentError?.message ?? "Document could not be found.");
  }

  ensureCompanyDeleteScope(profile, document.company_id, redirectPath);

  const { error } = await admin.from("patient_documents").delete().eq("id", document.id);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  await bestEffortRemoveDocumentObjects([document.storage_path]);

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Document removed.");
}

export async function deleteUserProfileAction(formData: FormData) {
  const { user } = await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const profileId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/accounts");

  if (user.id === profileId) {
    redirectWithPath(redirectPath, "error", "Your current admin session cannot delete itself.");
  }

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    redirectWithPath(redirectPath, "error", profileError?.message ?? "User profile could not be found.");
  }

  const { error: deleteProfileError } = await admin.from("user_profiles").delete().eq("id", profile.id);

  if (deleteProfileError) {
    redirectWithPath(redirectPath, "error", deleteProfileError.message);
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profile.id);

  if (deleteAuthError) {
    redirectWithPath(redirectPath, "error", deleteAuthError.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "User account removed.");
}

export async function deleteContactMessageAction(formData: FormData) {
  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const messageId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/contact");

  const { error } = await admin.from("contact_messages").delete().eq("id", messageId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Contact message removed.");
}

export async function markSampleReceivedAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const sampleId = getValue(formData, "id");
  const redirectPath = getRedirectPath(formData, "/admin/samples");
  const receivedAt = normalizeDateInput(optionalValue(formData, "received_at"));

  if (!receivedAt) {
    redirectWithPath(redirectPath, "error", "Choose a received date before marking this sample received.");
  }

  const { error } = await supabase
    .from("samples")
    .update({
      received_at: receivedAt,
    })
    .eq("id", sampleId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Sample marked received.");
}

export async function reviewIncomingSampleAction(formData: FormData) {
  const { supabase } = await requireAdminSession();
  const sampleId = getValue(formData, "id");
  const decision = getValue(formData, "decision");
  const redirectPath = getRedirectPath(formData, "/admin/samples");
  const rejectionReason = optionalValue(formData, "rejection_reason");

  const { data: sample, error: sampleError } = await supabase
    .from("samples")
    .select("received_at")
    .eq("id", sampleId)
    .single();

  if (sampleError || !sample) {
    redirectWithPath(redirectPath, "error", sampleError?.message ?? "Sample could not be found.");
  }

  if (!sample.received_at) {
    redirectWithPath(
      redirectPath,
      "error",
      "A sample must be marked received before it can be accepted or rejected.",
    );
  }

  if (decision === "reject" && !rejectionReason) {
    redirectWithPath(redirectPath, "error", "Enter a rejection reason before rejecting this sample.");
  }

  const update =
    decision === "reject"
      ? {
          rejected: true,
          status: "rejected",
          rejection_reason: rejectionReason,
        }
      : {
          rejected: false,
          status: "accepted",
          rejection_reason: null,
          rejected_at: null,
          rejected_by: null,
        };

  const { error } = await supabase.from("samples").update(update).eq("id", sampleId);

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", decision === "reject" ? "Sample rejected." : "Sample accepted.");
}

export async function submitContactMessageAction(formData: FormData) {
  const { profile, user } = await requireSessionProfile();
  const redirectPath = getRedirectPath(formData, "/?customer_view=contact");
  const email = getValue(formData, "email");
  const message = getValue(formData, "message");

  if (!email || !message) {
    redirectWithPath(redirectPath, "error", "Email and message are required.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("contact_messages").insert({
    user_id: user.id,
    company_id: profile.company_id,
    first_name: optionalValue(formData, "first_name"),
    last_name: optionalValue(formData, "last_name"),
    email,
    institution: optionalValue(formData, "institution"),
    purpose: optionalValue(formData, "purpose"),
    source: optionalValue(formData, "source"),
    message,
  });

  if (error) {
    redirectWithPath(redirectPath, "error", error.message);
  }

  revalidatePath("/");
  redirectWithPath(redirectPath, "message", "Your message was sent to Complete Omics.");
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
