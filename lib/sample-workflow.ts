export const SAMPLE_STATUS_OPTIONS = ["submitted", "mailed", "accepted", "rejected"] as const;

export type SampleStatus = (typeof SAMPLE_STATUS_OPTIONS)[number];

const FIVE_DAYS_IN_MS = 5 * 24 * 60 * 60 * 1000;

export function normalizeSampleStatus(value: string | null | undefined): SampleStatus {
  switch (value) {
    case "mailed":
    case "accepted":
    case "rejected":
    case "submitted":
      return value;
    case "draft":
      return "submitted";
    case "received":
    case "ready_for_review":
    case "awaiting_documentation":
      return "accepted";
    default:
      return "submitted";
  }
}

export function isReviewDecisionStatus(status: string): boolean {
  return status === "accepted" || status === "rejected";
}

export function isSampleReviewDecisionAllowed(
  status: string,
  receivedAt: string | null | undefined,
): boolean {
  return !isReviewDecisionStatus(normalizeSampleStatus(status)) || Boolean(receivedAt);
}

export function isSampleReceived(receivedAt: string | null | undefined): boolean {
  return Boolean(receivedAt);
}

export function isSampleReviewOverdue(
  receivedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!receivedAt) {
    return false;
  }

  const receivedTime = new Date(receivedAt).getTime();

  if (Number.isNaN(receivedTime)) {
    return false;
  }

  return nowMs - receivedTime >= FIVE_DAYS_IN_MS;
}

export function normalizeIcd10Codes(
  explicitCodes: Array<string | null | undefined>,
  fallbackValue?: string | null,
): string[] {
  const cleanedExplicitCodes = explicitCodes.map((code) => code?.trim() ?? "").filter(Boolean);

  if (cleanedExplicitCodes.length > 0) {
    return cleanedExplicitCodes;
  }

  return (fallbackValue ?? "")
    .split(/[\n,;]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

export function exceedsIcd10CodeLimit(codes: string[]): boolean {
  return codes.length > 5;
}
