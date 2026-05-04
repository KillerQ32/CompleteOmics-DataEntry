import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { cleanupFixture, createAdminClient, createFixtureCompany, type FixtureIds } from "./supabase-test-helpers";

test("rejects duplicate active clinic requests with the same clinic name", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const requestIds: string[] = [];

  try {
    const clinicName = `Request Clinic ${suffix}`;
    const { data: firstRequest, error: firstRequestError } = await client
      .from("clinic_requests")
      .insert({
        clinic_name: clinicName,
        address_line_1: "100 Request Way",
        city: "Baltimore",
        state: "MD",
        postal_code: "21227",
        contact_email: `clinic-${suffix}@example.test`,
        contact_phone: "410-555-0111",
        requester_first_name: "Casey",
        requester_last_name: "Requester",
        requester_email: `requester-${suffix}@example.test`,
      })
      .select("id")
      .single();

    assert.ifError(firstRequestError);
    assert.ok(firstRequest);
    requestIds.push(firstRequest.id);

    const { error: duplicateError } = await client.from("clinic_requests").insert({
      clinic_name: clinicName.toLowerCase(),
      address_line_1: "101 Request Way",
      city: "Baltimore",
      state: "MD",
      postal_code: "21227",
      contact_email: `clinic-alt-${suffix}@example.test`,
      contact_phone: "410-555-0112",
      requester_first_name: "Jordan",
      requester_last_name: "Requester",
      requester_email: `alt-requester-${suffix}@example.test`,
    });

    assert.ok(duplicateError);
    assert.match(duplicateError.message, /duplicate key|unique/i);
  } finally {
    if (requestIds.length > 0) {
      await client.from("clinic_requests").delete().in("id", requestIds);
    }
  }
});

test("rejects duplicate active clinic requests with the same requester email", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const requestIds: string[] = [];

  try {
    const requesterEmail = `requester-${suffix}@example.test`;
    const { data: firstRequest, error: firstRequestError } = await client
      .from("clinic_requests")
      .insert({
        clinic_name: `Email Request Clinic ${suffix}`,
        address_line_1: "200 Request Way",
        city: "Baltimore",
        state: "MD",
        postal_code: "21227",
        contact_email: `email-clinic-${suffix}@example.test`,
        contact_phone: "410-555-0121",
        requester_first_name: "Taylor",
        requester_last_name: "Requester",
        requester_email: requesterEmail,
      })
      .select("id")
      .single();

    assert.ifError(firstRequestError);
    assert.ok(firstRequest);
    requestIds.push(firstRequest.id);

    const { error: duplicateError } = await client.from("clinic_requests").insert({
      clinic_name: `Different Clinic ${suffix}`,
      address_line_1: "201 Request Way",
      city: "Baltimore",
      state: "MD",
      postal_code: "21227",
      contact_email: `different-clinic-${suffix}@example.test`,
      contact_phone: "410-555-0122",
      requester_first_name: "Morgan",
      requester_last_name: "Requester",
      requester_email: requesterEmail.toUpperCase(),
    });

    assert.ok(duplicateError);
    assert.match(duplicateError.message, /duplicate key|unique/i);
  } finally {
    if (requestIds.length > 0) {
      await client.from("clinic_requests").delete().in("id", requestIds);
    }
  }
});

test("allows a clinic request to be resubmitted after the previous one is rejected", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const requestIds: string[] = [];
  const requesterEmail = `resubmit-${suffix}@example.test`;
  const clinicName = `Resubmit Clinic ${suffix}`;

  try {
    const { data: rejectedRequest, error: rejectedRequestError } = await client
      .from("clinic_requests")
      .insert({
        clinic_name: clinicName,
        address_line_1: "300 Request Way",
        city: "Baltimore",
        state: "MD",
        postal_code: "21227",
        contact_email: `resubmit-clinic-${suffix}@example.test`,
        contact_phone: "410-555-0131",
        requester_first_name: "Jamie",
        requester_last_name: "Requester",
        requester_email: requesterEmail,
        status: "rejected",
      })
      .select("id")
      .single();

    assert.ifError(rejectedRequestError);
    assert.ok(rejectedRequest);
    requestIds.push(rejectedRequest.id);

    const { data: newRequest, error: newRequestError } = await client
      .from("clinic_requests")
      .insert({
        clinic_name: clinicName,
        address_line_1: "301 Request Way",
        city: "Baltimore",
        state: "MD",
        postal_code: "21227",
        contact_email: `resubmit-clinic-next-${suffix}@example.test`,
        contact_phone: "410-555-0132",
        requester_first_name: "Jamie",
        requester_last_name: "Requester",
        requester_email: requesterEmail,
      })
      .select("id")
      .single();

    assert.ifError(newRequestError);
    assert.ok(newRequest);
    requestIds.push(newRequest.id);
  } finally {
    if (requestIds.length > 0) {
      await client.from("clinic_requests").delete().in("id", requestIds);
    }
  }
});

test("rejects clinic names that only differ by case at the company level", async () => {
  const client = createAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const ids: FixtureIds = {};

  try {
    const company = await createFixtureCompany(client, suffix);
    ids.companyId = company.id;

    const { error } = await client.from("companies").insert({
      name: company.name.toLowerCase(),
      address_line_1: "999 Duplicate Way",
      city: "Baltimore",
      state: "MD",
      postal_code: "21227",
      contact_phone: `410-555-019${suffix[0] ?? "0"}`,
      contact_email: `duplicate-${suffix}@example.test`,
    });

    assert.ok(error);
    assert.match(error.message, /duplicate key|unique/i);
  } finally {
    await cleanupFixture(client, ids);
  }
});
