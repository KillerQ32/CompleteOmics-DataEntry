import assert from "node:assert/strict";
import test from "node:test";
import {
  exceedsIcd10CodeLimit,
  isSampleReceived,
  isSampleReviewDecisionAllowed,
  isSampleReviewOverdue,
  normalizeIcd10Codes,
  normalizeSampleStatus,
} from "../lib/sample-workflow";

test("normalizeSampleStatus preserves supported sample states", () => {
  assert.equal(normalizeSampleStatus("submitted"), "submitted");
  assert.equal(normalizeSampleStatus("mailed"), "mailed");
  assert.equal(normalizeSampleStatus("accepted"), "accepted");
  assert.equal(normalizeSampleStatus("rejected"), "rejected");
});

test("normalizeSampleStatus maps legacy states into the current workflow", () => {
  assert.equal(normalizeSampleStatus("draft"), "submitted");
  assert.equal(normalizeSampleStatus("received"), "accepted");
  assert.equal(normalizeSampleStatus("ready_for_review"), "accepted");
  assert.equal(normalizeSampleStatus("awaiting_documentation"), "accepted");
});

test("normalizeSampleStatus falls back safely for invalid values", () => {
  assert.equal(normalizeSampleStatus(""), "submitted");
  assert.equal(normalizeSampleStatus("unexpected"), "submitted");
  assert.equal(normalizeSampleStatus(null), "submitted");
});

test("isSampleReviewDecisionAllowed only allows accepted or rejected after receipt", () => {
  assert.equal(isSampleReviewDecisionAllowed("submitted", null), true);
  assert.equal(isSampleReviewDecisionAllowed("mailed", null), true);
  assert.equal(isSampleReviewDecisionAllowed("accepted", null), false);
  assert.equal(isSampleReviewDecisionAllowed("rejected", null), false);
  assert.equal(isSampleReviewDecisionAllowed("accepted", "2026-04-29"), true);
});

test("isSampleReceived tracks whether a sample has a received date", () => {
  assert.equal(isSampleReceived(null), false);
  assert.equal(isSampleReceived(""), false);
  assert.equal(isSampleReceived("2026-04-29"), true);
});

test("isSampleReviewOverdue handles null, invalid, boundary, and overdue cases", () => {
  const now = new Date("2026-04-29T12:00:00.000Z").getTime();

  assert.equal(isSampleReviewOverdue(null, now), false);
  assert.equal(isSampleReviewOverdue("not-a-date", now), false);
  assert.equal(isSampleReviewOverdue("2026-04-24T12:00:00.000Z", now), true);
  assert.equal(isSampleReviewOverdue("2026-04-24T12:00:01.000Z", now), false);
  assert.equal(isSampleReviewOverdue("2026-04-23T11:59:59.000Z", now), true);
});

test("normalizeIcd10Codes prefers explicit fields and trims values", () => {
  assert.deepEqual(
    normalizeIcd10Codes([" I10 ", "", "E11.9", "  ", undefined], "Z00.0"),
    ["I10", "E11.9"],
  );
});

test("normalizeIcd10Codes falls back to delimited free-text input", () => {
  assert.deepEqual(
    normalizeIcd10Codes([], "I10, E11.9\nN18.9; Z79.4"),
    ["I10", "E11.9", "N18.9", "Z79.4"],
  );
});

test("exceedsIcd10CodeLimit only trips when more than five codes are present", () => {
  assert.equal(exceedsIcd10CodeLimit(["A", "B", "C", "D", "E"]), false);
  assert.equal(exceedsIcd10CodeLimit(["A", "B", "C", "D", "E", "F"]), true);
});
