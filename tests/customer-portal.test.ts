import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdvanceCustomerToFiles,
  canAdvanceCustomerToSample,
  formatSampleStatus,
  nextDateString,
  normalizeCustomerView,
  normalizeIntakeStep,
  normalizeSampleStatus,
} from "../lib/customer-portal";

test("normalizeCustomerView keeps valid customer pages", () => {
  assert.equal(normalizeCustomerView("samples"), "samples");
  assert.equal(normalizeCustomerView("intake"), "intake");
  assert.equal(normalizeCustomerView("contact"), "contact");
});

test("normalizeCustomerView falls back to home for invalid values", () => {
  assert.equal(normalizeCustomerView("admin"), "home");
  assert.equal(normalizeCustomerView("Samples"), "home");
  assert.equal(normalizeCustomerView(""), "home");
});

test("normalizeIntakeStep keeps valid steps", () => {
  assert.equal(normalizeIntakeStep("sample"), "sample");
  assert.equal(normalizeIntakeStep("files"), "files");
  assert.equal(normalizeIntakeStep("review"), "review");
});

test("normalizeIntakeStep falls back to patient for invalid steps", () => {
  assert.equal(normalizeIntakeStep("home"), "patient");
  assert.equal(normalizeIntakeStep(""), "patient");
});

test("normalizeSampleStatus preserves supported statuses", () => {
  assert.equal(normalizeSampleStatus("submitted"), "submitted");
  assert.equal(normalizeSampleStatus("mailed"), "mailed");
  assert.equal(normalizeSampleStatus("accepted"), "accepted");
  assert.equal(normalizeSampleStatus("rejected"), "rejected");
});

test("normalizeSampleStatus maps legacy statuses into the current flow", () => {
  assert.equal(normalizeSampleStatus("draft"), "submitted");
  assert.equal(normalizeSampleStatus("received"), "accepted");
  assert.equal(normalizeSampleStatus("ready_for_review"), "accepted");
  assert.equal(normalizeSampleStatus("awaiting_documentation"), "accepted");
});

test("normalizeSampleStatus handles unexpected values safely", () => {
  assert.equal(normalizeSampleStatus("unknown"), "submitted");
  assert.equal(normalizeSampleStatus(""), "submitted");
  assert.equal(normalizeSampleStatus(null), "submitted");
  assert.equal(normalizeSampleStatus(undefined), "submitted");
});

test("formatSampleStatus shows rejected label when rejected flag is set", () => {
  assert.equal(formatSampleStatus("submitted", true), "Rejected");
  assert.equal(formatSampleStatus("accepted", true), "Rejected");
});

test("nextDateString advances normal and boundary dates", () => {
  assert.equal(nextDateString("2026-04-27"), "2026-04-28");
  assert.equal(nextDateString("2026-01-31"), "2026-02-01");
  assert.equal(nextDateString("2024-02-29"), "2024-03-01");
});

test("nextDateString returns null for invalid input", () => {
  assert.equal(nextDateString("not-a-date"), null);
  assert.equal(nextDateString("2026-13-01"), null);
});

test("canAdvanceCustomerToSample allows an existing patient lookup", () => {
  assert.equal(
    canAdvanceCustomerToSample({
      patientId: "patient-123",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
    }),
    true,
  );
});

test("canAdvanceCustomerToSample allows a fully entered new patient", () => {
  assert.equal(
    canAdvanceCustomerToSample({
      patientId: "",
      firstName: "Jamie",
      lastName: "Cole",
      dateOfBirth: "1990-08-16",
    }),
    true,
  );
});

test("canAdvanceCustomerToSample blocks incomplete new-patient drafts", () => {
  assert.equal(
    canAdvanceCustomerToSample({
      patientId: "",
      firstName: "Jamie",
      lastName: "",
      dateOfBirth: "1990-08-16",
    }),
    false,
  );
});

test("canAdvanceCustomerToFiles requires both a valid patient step and sample number", () => {
  const patientDraft = {
    patientId: "patient-123",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
  };

  assert.equal(canAdvanceCustomerToFiles(patientDraft, { sampleNumber: "SMP-1001" }), true);
  assert.equal(canAdvanceCustomerToFiles(patientDraft, { sampleNumber: "" }), false);
});
