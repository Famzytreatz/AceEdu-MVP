import assert from "node:assert/strict"

import test from "node:test"

import {
  validateAcademicListIds,
  validateAssessmentId,
  validateAssessmentPayload,
  validateAssessmentResultsPayload,
  validateAttendancePayload,
} from "./academic-operations-validation.js"

test("attendance validation normalizes IDs, notes, and statuses", () => {
  assert.deepEqual(
    validateAttendancePayload({
      classId: 12,

      termId: "4",

      date: "2026-10-28",

      entries: [{ studentId: 7, status: "present", note: "  " }],
    }),

    {
      classId: "12",

      termId: "4",

      date: "2026-10-28",

      entries: [{ studentId: "7", status: "present", note: null }],
    },
  )
})

test("attendance validation rejects duplicate students, invalid dates, and statuses", () => {
  const payload = {
    classId: "12",

    termId: "4",

    date: "2026-10-28",

    entries: [{ studentId: "7", status: "present" }],
  }

  assert.throws(() =>
    validateAttendancePayload({ ...payload, date: "2026-02-30" }),
  )

  assert.throws(() =>
    validateAttendancePayload({
      ...payload,

      entries: [
        { studentId: "7", status: "present" },

        { studentId: "7", status: "absent" },
      ],
    }),
  )

  assert.throws(() =>
    validateAttendancePayload({
      ...payload,

      entries: [{ studentId: "7", status: "unknown" }],
    }),
  )
})

test("assessment validation enforces types, positive scores, and date format", () => {
  assert.deepEqual(
    validateAssessmentPayload({
      classId: "12",

      subjectId: "15",

      termId: "4",

      title: " Midterm ",

      type: "test",

      maximumScore: "80.5",

      dueOn: "2026-10-30",
    }),

    {
      classId: "12",

      subjectId: "15",

      termId: "4",

      title: "Midterm",

      type: "test",

      maximumScore: 80.5,

      dueOn: "2026-10-30",
    },
  )

  assert.throws(() =>
    validateAssessmentPayload({
      classId: "12",

      subjectId: "15",

      termId: "4",

      title: "Midterm",

      type: "test",

      maximumScore: 0,
    }),
  )

  assert.throws(() =>
    validateAssessmentPayload({
      classId: "12",

      subjectId: "15",

      termId: "4",

      title: "Midterm",

      type: "project",

      maximumScore: 80,
    }),
  )
})

test("assessment results require unique, valid scores and bounded feedback", () => {
  assert.deepEqual(
    validateAssessmentResultsPayload({
      results: [{ studentId: 8, score: "42.5", feedback: "  Good work  " }],
    }),

    [{ studentId: "8", score: 42.5, feedback: "Good work" }],
  )

  assert.throws(() =>
    validateAssessmentResultsPayload({
      results: [
        { studentId: "8", score: 20 },

        { studentId: "8", score: 21 },
      ],
    }),
  )

  assert.throws(() =>
    validateAssessmentResultsPayload({
      results: [{ studentId: "8", score: -1 }],
    }),
  )

  assert.throws(() =>
    validateAssessmentResultsPayload({
      results: [{ studentId: "8", score: "" }],
    }),
  )

  assert.equal(
    validateAssessmentResultsPayload({
      results: [{ studentId: "8", score: "0.29" }],
    })[0].score,

    0.29,
  )
})

test("academic list and assessment IDs are validated", () => {
  assert.deepEqual(validateAcademicListIds("1", 2), {
    classId: "1",
    termId: "2",
  })

  assert.equal(validateAssessmentId(3), "3")

  assert.throws(() => validateAcademicListIds("0", "2"))

  assert.throws(() => validateAssessmentId("2x"))
})
