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

test("accepts a valid patient document and exposes it through the document directory view", async () => {
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
        sample_number: `SMP-DOC-${suffix}`,
        status: "submitted",
        rejected: false,
      })
      .select("id, sample_number")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;

    const storagePath = `${company.id}/${patient.id}/${sample.id}/doc-${suffix}.pdf`;
    const { data: document, error: documentError } = await client
      .from("patient_documents")
      .insert({
        company_id: company.id,
        patient_id: patient.id,
        sample_id: sample.id,
        storage_path: storagePath,
        original_filename: `lab-report-${suffix}.pdf`,
        mime_type: "application/pdf",
      })
      .select("id, original_filename")
      .single();

    assert.ifError(documentError);
    assert.ok(document);
    ids.documentId = document.id;

    const { data: directoryRow, error: directoryError } = await client
      .from("document_directory")
      .select("original_filename, sample_number, patient_first_name, patient_last_name, company_name")
      .eq("id", document.id)
      .single();

    assert.ifError(directoryError);
    assert.ok(directoryRow);
    assert.equal(directoryRow.original_filename, `lab-report-${suffix}.pdf`);
    assert.equal(directoryRow.sample_number, sample.sample_number);
    assert.equal(directoryRow.patient_first_name, patient.first_name);
    assert.equal(directoryRow.patient_last_name, patient.last_name);
    assert.equal(directoryRow.company_name, company.name);
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("rejects a document whose sample does not belong to the selected patient", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const patient = await createFixturePatient(client, company.id, suffix, "PrimaryPatient");
    ids.patientId = patient.id;

    const secondaryPatient = await createFixturePatient(client, company.id, `${suffix}-2`, "SecondaryPatient");
    ids.secondaryPatientId = secondaryPatient.id;

    const { data: sample, error: sampleError } = await client
      .from("samples")
      .insert({
        company_id: company.id,
        patient_id: patient.id,
        sample_number: `SMP-MISMATCH-${suffix}`,
        status: "submitted",
        rejected: false,
      })
      .select("id")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;

    const { error } = await client.from("patient_documents").insert({
      company_id: company.id,
      patient_id: secondaryPatient.id,
      sample_id: sample.id,
      storage_path: `${company.id}/${secondaryPatient.id}/${sample.id}/bad-${suffix}.pdf`,
      original_filename: `bad-${suffix}.pdf`,
      mime_type: "application/pdf",
    });

    assert.ok(error);
    assert.match(error.message, /sample must match the selected patient|documents must be tied/i);
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("sets sample package link to null when the fedex package is deleted", async () => {
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
        sample_number: `SMP-SETNULL-${suffix}`,
        status: "mailed",
        rejected: false,
      })
      .select("id, fedex_package_id")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;
    assert.equal(sample.fedex_package_id, fedexPackage.id);

    const { error: deletePackageError } = await client.from("fedex_packages").delete().eq("id", fedexPackage.id);

    assert.ifError(deletePackageError);
    ids.packageId = undefined;

    const { data: sampleAfterDelete, error: sampleAfterDeleteError } = await client
      .from("samples")
      .select("fedex_package_id")
      .eq("id", sample.id)
      .single();

    assert.ifError(sampleAfterDeleteError);
    assert.ok(sampleAfterDelete);
    assert.equal(sampleAfterDelete.fedex_package_id, null);
  } finally {
    await cleanupFixture(client, ids);
  }
});

test("cascades clinic deletion across patients, packages, samples, and documents", async () => {
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
        sample_number: `SMP-CASCADE-${suffix}`,
        status: "submitted",
        rejected: false,
      })
      .select("id")
      .single();

    assert.ifError(sampleError);
    assert.ok(sample);
    ids.sampleId = sample.id;

    const { data: document, error: documentError } = await client
      .from("patient_documents")
      .insert({
        company_id: company.id,
        patient_id: patient.id,
        sample_id: sample.id,
        storage_path: `${company.id}/${patient.id}/${sample.id}/cascade-${suffix}.pdf`,
        original_filename: `cascade-${suffix}.pdf`,
        mime_type: "application/pdf",
      })
      .select("id")
      .single();

    assert.ifError(documentError);
    assert.ok(document);
    ids.documentId = document.id;

    const { error: deleteCompanyError } = await client.from("companies").delete().eq("id", company.id);

    assert.ifError(deleteCompanyError);
    ids.companyId = undefined;
    ids.patientId = undefined;
    ids.packageId = undefined;
    ids.sampleId = undefined;
    ids.documentId = undefined;

    const [{ count: patientCount }, { count: packageCount }, { count: sampleCount }, { count: documentCount }] =
      await Promise.all([
        client.from("patients").select("id", { count: "exact", head: true }).eq("company_id", company.id),
        client.from("fedex_packages").select("id", { count: "exact", head: true }).eq("company_id", company.id),
        client.from("samples").select("id", { count: "exact", head: true }).eq("company_id", company.id),
        client.from("patient_documents").select("id", { count: "exact", head: true }).eq("company_id", company.id),
      ]);

    assert.equal(patientCount, 0);
    assert.equal(packageCount, 0);
    assert.equal(sampleCount, 0);
    assert.equal(documentCount, 0);
  } finally {
    await cleanupFixture(client, ids);
  }
});
