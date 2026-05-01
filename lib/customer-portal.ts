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
    Boolean(patientDraft.patientId) ||
    Boolean(patientDraft.firstName && patientDraft.lastName && patientDraft.dateOfBirth)
  );
}

export function canAdvanceCustomerToFiles(
  patientDraft: CustomerPatientAdvanceDraft,
  sampleDraft: CustomerSampleAdvanceDraft,
) {
  return canAdvanceCustomerToSample(patientDraft) && Boolean(sampleDraft.sampleNumber);
}
