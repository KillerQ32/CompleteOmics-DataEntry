import { normalizeSampleStatus as normalizeWorkflowSampleStatus } from "./sample-workflow";

export type CustomerView =
  | "home"
  | "samples"
  | "patients"
  | "packages"
  | "intake"
  | "operations"
  | "account"
  | "contact";

export type IntakeStep = "patient" | "sample" | "files" | "package" | "review";

type CustomerPatientAdvanceDraft = {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

type CustomerSampleAdvanceDraft = {
  sampleNumber: string;
};

function isLookupSelection(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return trimmed.includes(" | ") || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
}

export function normalizeCustomerView(value: string): CustomerView {
  if (
    value === "samples" ||
    value === "patients" ||
    value === "packages" ||
    value === "intake" ||
    value === "operations" ||
    value === "account" ||
    value === "contact"
  ) {
    return value;
  }

  return "home";
}

export function normalizeIntakeStep(value: string): IntakeStep {
  if (value === "sample" || value === "files" || value === "package" || value === "review") {
    return value;
  }

  return "patient";
}

export function normalizeSampleStatus(value: string | null | undefined) {
  return normalizeWorkflowSampleStatus(value);
}

export function formatSampleStatus(status: string, rejected = false) {
  return rejected ? "Rejected" : normalizeSampleStatus(status);
}

export function nextDateString(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function canAdvanceCustomerToSample(patientDraft: CustomerPatientAdvanceDraft) {
  return (
    isLookupSelection(patientDraft.patientId) ||
    Boolean(patientDraft.firstName && patientDraft.lastName && patientDraft.dateOfBirth)
  );
}

export function canAdvanceCustomerToFiles(
  patientDraft: CustomerPatientAdvanceDraft,
  sampleDraft: CustomerSampleAdvanceDraft,
) {
  return canAdvanceCustomerToSample(patientDraft) && Boolean(sampleDraft.sampleNumber);
}

export function resolveCustomerIntakeStep(
  requestedStep: IntakeStep,
  patientDraft: CustomerPatientAdvanceDraft,
  sampleDraft: CustomerSampleAdvanceDraft,
) {
  if (!canAdvanceCustomerToSample(patientDraft)) {
    return "patient";
  }

  if (!canAdvanceCustomerToFiles(patientDraft, sampleDraft)) {
    return requestedStep === "patient" || requestedStep === "sample" ? requestedStep : "sample";
  }

  return requestedStep;
}
