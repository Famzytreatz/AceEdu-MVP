import assert from "node:assert/strict"
import test from "node:test"
import {
  validateAcademicName,
  validateAcademicYearPayload,
} from "./academic-validation.js"

test("academic year validation normalizes names and accepts configurable terms", () => {
  assert.deepEqual(
    validateAcademicYearPayload({
      name: "  2026–2027  ",
      startsOn: "2026-09-01",
      endsOn: "2027-07-31",
      termCount: "4",
    }),
    {
      name: "2026–2027",
      startsOn: "2026-09-01",
      endsOn: "2027-07-31",
      termCount: 4,
    },
  )
})

test("academic year validation rejects invalid dates, reversed ranges, and invalid term counts", () => {
  const valid = {
    name: "2026–2027",
    startsOn: "2026-09-01",
    endsOn: "2027-07-31",
    termCount: 3,
  }
  assert.throws(
    () => validateAcademicYearPayload({ ...valid, startsOn: "2026-02-30" }),
    /valid academic year date range/,
  )
  assert.throws(
    () => validateAcademicYearPayload({ ...valid, endsOn: valid.startsOn }),
    /valid academic year date range/,
  )
  assert.throws(
    () => validateAcademicYearPayload({ ...valid, termCount: 13 }),
    /between 1 and 12 terms/,
  )
  assert.throws(
    () =>
      validateAcademicYearPayload({
        ...valid,
        startsOn: "2026-09-01",
        endsOn: "2026-09-02",
        termCount: 3,
      }),
    /too short/,
  )
})

test("academic names are trimmed and bounded", () => {
  assert.equal(validateAcademicName("  JSS 1 ", "Class name", 80), "JSS 1")
  assert.throws(() => validateAcademicName("", "Class name", 80), /Class name/)
  assert.throws(
    () => validateAcademicName("x".repeat(81), "Class name", 80),
    /Class name/,
  )
})
