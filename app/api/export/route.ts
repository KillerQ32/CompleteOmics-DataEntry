import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type ExportEntity = "samples" | "patients" | "clinics" | "fedex";

type Profile = {
  role: "admin" | "clinic_admin" | "customer";
  company_id: string | null;
};

const EXPORT_COLUMNS: Record<ExportEntity, string[]> = {
  samples: [
    "sample_number",
    "company_name",
    "patient_first_name",
    "patient_last_name",
    "package_id",
    "status",
    "rejected",
    "rejection_reason",
    "received_at",
    "collected_at",
    "collected_by",
    "sex",
    "hart_cadhs",
    "hart_cve",
    "ordering_provider_name",
    "npi_number",
    "icd10_codes",
    "created_at",
  ],
  patients: [
    "first_name",
    "last_name",
    "date_of_birth",
    "address_line_1",
    "city",
    "state",
    "postal_code",
    "phone_number",
    "email_address",
    "race_ethnicity",
    "weight_lbs",
    "height_inches",
    "angioplasty_or_stent",
    "cabg",
    "created_at",
  ],
  clinics: [
    "name",
    "address_line_1",
    "city",
    "state",
    "postal_code",
    "contact_email",
    "contact_phone",
    "fax_number",
    "created_at",
  ],
  fedex: ["package_id", "mailed_at", "received_at", "created_at"],
};

function csvEscape(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return [header, ...body].join("\r\n");
}

function csvResponse(entity: ExportEntity, csv: string) {
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="completeomics-${entity}-${today}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity") as ExportEntity | null;

  if (!entity || !(entity in EXPORT_COLUMNS)) {
    return badRequest("Choose a valid export type.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return badRequest("You must be signed in to export data.", 401);
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return badRequest("Your user profile could not be loaded.", 403);
  }

  const typedProfile = profile as Profile;
  const isPlatformAdmin = typedProfile.role === "admin";

  if (!isPlatformAdmin && !typedProfile.company_id) {
    return badRequest("Your account is not assigned to a clinic.", 403);
  }

  const admin = createSupabaseAdminClient();
  let rows: Record<string, unknown>[] = [];

  if (entity === "samples") {
    let query = admin
      .from("admin_sample_directory")
      .select(EXPORT_COLUMNS.samples.join(","))
      .order("created_at", { ascending: false });

    if (!isPlatformAdmin) {
      query = query.eq("company_id", typedProfile.company_id);
    }

    const { data, error } = await query;

    if (error) {
      return badRequest(error.message, 500);
    }

    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }

  if (entity === "patients") {
    let query = admin
      .from("patients")
      .select(["company_id", ...EXPORT_COLUMNS.patients].join(","))
      .order("created_at", { ascending: false });

    if (!isPlatformAdmin) {
      query = query.eq("company_id", typedProfile.company_id);
    }

    const { data, error } = await query;

    if (error) {
      return badRequest(error.message, 500);
    }

    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }

  if (entity === "clinics") {
    let query = admin
      .from("companies")
      .select(["id", ...EXPORT_COLUMNS.clinics].join(","))
      .order("name");

    if (!isPlatformAdmin) {
      query = query.eq("id", typedProfile.company_id);
    }

    const { data, error } = await query;

    if (error) {
      return badRequest(error.message, 500);
    }

    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }

  if (entity === "fedex") {
    let query = admin
      .from("fedex_packages")
      .select(["company_id", ...EXPORT_COLUMNS.fedex].join(","))
      .order("created_at", { ascending: false });

    if (!isPlatformAdmin) {
      query = query.eq("company_id", typedProfile.company_id);
    }

    const { data, error } = await query;

    if (error) {
      return badRequest(error.message, 500);
    }

    rows = (data ?? []) as unknown as Record<string, unknown>[];
  }

  return csvResponse(entity, toCsv(rows, EXPORT_COLUMNS[entity]));
}
