import test from "node:test"

import assert from "node:assert/strict"

import {
  bestExamAttempts,
  rankStudents,
  summarizeAttendance,
} from "./academic-records.js"

test("attendance summary excludes excused marks from attendance rate", () => {
  assert.deepEqual(
    summarizeAttendance([
      { status: "present" },

      { status: "late" },

      { status: "absent" },

      { status: "excused" },
    ]),

    {
      present: 1,

      absent: 1,

      late: 1,

      excused: 1,

      marked: 3,

      rate: 66.7,
    },
  )
})

test("students with tied result averages share positions", () => {
  const students = [
    { id: "1", fullName: "Ada", averagePercentage: 90 },

    { id: "2", fullName: "Ben", averagePercentage: 90 },

    { id: "3", fullName: "Cam", averagePercentage: 80 },

    { id: "4", fullName: "Dee", averagePercentage: null },
  ]

  assert.deepEqual(
    rankStudents(students).map((student) => [
      student.fullName,
      student.rank || null,
    ]),

    [
      ["Ada", 1],

      ["Ben", 1],

      ["Cam", 3],

      ["Dee", null],
    ],
  )
})

test("ranking compares unrounded scores rather than display-rounded averages", () => {
  const students = [
    {
      id: "1",
      fullName: "Ada",
      averagePercentage: 89.9,
      rankingPercentage: 89.94,
    },
    {
      id: "2",
      fullName: "Ben",
      averagePercentage: 89.9,
      rankingPercentage: 89.96,
    },
  ]

  assert.deepEqual(
    rankStudents(students).map((student) => [student.fullName, student.rank]),
    [
      ["Ben", 1],
      ["Ada", 2],
    ],
  )
})

test("exam history keeps each student's best submitted attempt", () => {
  assert.deepEqual(
    bestExamAttempts(
      [
        { id: 8, questions: [{}, {}, {}, {}] },
        { id: 9, questions: [] },
      ],
      [
        {
          exam_id: 8,
          student_id: 2,
          score: 2,
          status: "submitted",
          end_time: "2026-10-01T10:00:00Z",
        },
        {
          exam_id: 8,
          student_id: 2,
          score: 3,
          status: "submitted",
          end_time: "2026-10-02T10:00:00Z",
        },
        {
          exam_id: 8,
          student_id: 2,
          score: 4,
          status: "started",
          end_time: null,
        },
        {
          exam_id: 9,
          student_id: 3,
          score: 0,
          status: "submitted",
          end_time: "2026-10-03T10:00:00Z",
        },
      ],
    ),
    [
      {
        examId: "8",
        studentId: "2",
        score: 3,
        maximumScore: 4,
        submittedAt: "2026-10-02T10:00:00Z",
      },
    ],
  )
})
