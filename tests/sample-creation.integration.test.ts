import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  cleanupFixture,
  createAdminClient,
  createFixtureCompany,
  createFixturePackage,
  createFixturePatient,
  type FixtureIds,
} from "./supabase-test-helpers";

test("creates a sample with clinic, patient, package, and searchable directory data", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const patient = await createFixturePatient(client, company.id, suffix);
    ids.patientId = patient.id;

    const fedexPackage = await createFixturePackage(client, company.id, suffix);
    ids.packageId = fedexPackage.id;

    const { data: sample, error: sampleError } = await client
      .from("samples")
      .insert({
        company_id: company.id,
        patient_id: patient.id,
        fedex_package_id: fedexPackage.id,
        sample_number: `SMP-${suffix}`,
        status: "submitted",
        collected_at: "2026-04-28",
        received_at: null,
        collected_by: "Nurse Carter",
        sex: "Female",
        ordering_provider_name: "Dr. Renee Walker",
        hart_cadhs: true,
        hart_cve: false,
        icd10_codes: ["I10", "E11.9"],
        npi_number: "NPI-TEST-1001",
        missing_info: "Awaiting external report",
        rejected: false,
      })
      .select("id, status, rejected, fedex_package_id, icd10_codes, ordering_provider_name")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;

    assert.equal(sample.status, "submitted");
    assert.equal(sample.rejected, false);
    assert.equal(sample.fedex_package_id, fedexPackage.id);
    assert.deepEqual(sample.icd10_codes, ["I10", "E11.9"]);
    assert.equal(sample.ordering_provider_name, "Dr. Renee Walker");

    const { data: directoryRow, error: directoryError } = await client
      .from("admin_sample_directory")
      .select("sample_number, company_name, patient_first_name, patient_last_name, package_id, icd10_codes, npi_number")
      .eq("id", sample.id)
      .single();

    assert.ifError(directoryError);
    assert.ok(directoryRow);
    assert.equal(directoryRow.sample_number, `SMP-${suffix}`);
    assert.equal(directoryRow.company_name, company.name);
    assert.equal(directoryRow.patient_first_name, patient.first_name);
    assert.equal(directoryRow.patient_last_name, patient.last_name);
    assert.equal(directoryRow.package_id, fedexPackage.package_id);
    assert.deepEqual(directoryRow.icd10_codes, ["I10", "E11.9"]);
    assert.equal(directoryRow.npi_number, "NPI-TEST-1001");
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("creates a sample without a package and keeps it visible in the sample search view", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const patient = await createFixturePatient(client, company.id, suffix);
    ids.patientId = patient.id;

    const { data: sample, error: sampleError } = await client
      .from("samples")
      .insert({
        company_id: company.id,
        patient_id: patient.id,
        sample_number: `SMP-NOPKG-${suffix}`,
        status: "mailed",
        collected_at: "2026-04-27",
        received_at: null,
        sex: "Male",
        hart_cadhs: false,
        hart_cve: true,
        rejected: false,
      })
      .select("id, fedex_package_id, status")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;

    assert.equal(sample.fedex_package_id, null);
    assert.equal(sample.status, "mailed");

    const { data: searchRow, error: searchError } = await client
      .from("sample_search")
      .select("sample_number, company_name, patient_full_name, package_id, status")
      .eq("id", sample.id)
      .single();

    assert.ifError(searchError);
    assert.ok(searchRow);
    assert.equal(searchRow.sample_number, `SMP-NOPKG-${suffix}`);
    assert.equal(searchRow.company_name, company.name);
    assert.equal(searchRow.patient_full_name, `${patient.first_name} ${patient.last_name}`);
    assert.equal(searchRow.package_id, null);
    assert.equal(searchRow.status, "mailed");
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("rejects a sample payload with more than five ICD-10 codes", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const patient = await createFixturePatient(client, company.id, suffix);
    ids.patientId = patient.id;

    const { error } = await client.from("samples").insert({
      company_id: company.id,
      patient_id: patient.id,
      sample_number: `SMP-ICD-${suffix}`,
      status: "submitted",
      rejected: false,
      icd10_codes: ["I10", "E11.9", "N18.9", "Z79.4", "I25.10", "R07.9"],
    });

    assert.ok(error);
    assert.match(error.message, /icd10|check/i);
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("rejects a sample row that marks status rejected without the rejected flag", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const patient = await createFixturePatient(client, company.id, suffix);
    ids.patientId = patient.id;

    const { error } = await client.from("samples").insert({
      company_id: company.id,
      patient_id: patient.id,
      sample_number: `SMP-REJ-${suffix}`,
      status: "rejected",
      rejected: false,
    });

    assert.ok(error);
    assert.match(error.message, /rejected|check|admin users/i);
  } finally {
    await cleanupFixture(client, ids);
  }
});
