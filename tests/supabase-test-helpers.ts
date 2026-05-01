import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EnvShape = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export type FixtureIds = {
  companyId?: string;
  patientId?: string;
  secondaryPatientId?: string;
  packageId?: string;
  sampleId?: string;
  documentId?: string;
};

function loadLocalEnv(): EnvShape {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContents = readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};

  for (const rawLine of envContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function createAdminClient() {
  const env = loadLocalEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function cleanupFixture(client: SupabaseClient, ids: FixtureIds) {
  if (ids.documentId) {
    await client.from("patient_documents").delete().eq("id", ids.documentId);
  }

  if (ids.sampleId) {
    await client.from("samples").delete().eq("id", ids.sampleId);
  }

  if (ids.packageId) {
    await client.from("fedex_packages").delete().eq("id", ids.packageId);
  }

  if (ids.secondaryPatientId) {
    await client.from("patients").delete().eq("id", ids.secondaryPatientId);
  }

  if (ids.patientId) {
    await client.from("patients").delete().eq("id", ids.patientId);
  }

  if (ids.companyId) {
    await client.from("companies").delete().eq("id", ids.companyId);
  }
}

export async function createFixtureCompany(client: SupabaseClient, suffix: string) {
  const { data, error } = await client
    .from("companies")
    .insert({
      name: `Integration Clinic ${suffix}`,
      address_line_1: "100 Test Way",
      city: "Baltimore",
      state: "MD",
      postal_code: "21227",
      contact_phone: "410-555-0100",
      contact_email: `clinic-${suffix}@example.test`,
    })
    .select("id, name")
    .single();

  assert.ifError(error);
  assert.ok(data);
  return data;
}

export async function createFixturePatient(client: SupabaseClient, companyId: string, suffix: string, label = "Patient") {
  const { data, error } = await client
    .from("patients")
    .insert({
      company_id: companyId,
      first_name: "Test",
      last_name: `${label}-${suffix}`,
      date_of_birth: "1988-04-12",
      address_line_1: "200 Patient Ave",
      city: "Baltimore",
      state: "MD",
      postal_code: "21227",
      phone_number: "410-555-0101",
      email_address: `${label.toLowerCase()}-${suffix}@example.test`,
      weight_lbs: 176.4,
      height_inches: 70.5,
      angioplasty_or_stent: true,
      cabg: false,
    })
    .select("id, first_name, last_name")
    .single();

  assert.ifError(error);
  assert.ok(data);
  return data;
}

export async function createFixturePackage(client: SupabaseClient, companyId: string, suffix: string) {
  const { data, error } = await client
    .from("fedex_packages")
    .insert({
      company_id: companyId,
      package_id: `PKG-${suffix}`,
      mailed_at: "2026-04-29",
    })
    .select("id, package_id")
    .single();

  assert.ifError(error);
  assert.ok(data);
  return data;
}
