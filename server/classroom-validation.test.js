import assert from "node:assert/strict"

import test from "node:test"

import {
  validateClassroomPost,
  validateExamAnswers,
  validatePortalExam,
} from "./classroom-validation.js"

const validExam = {
  classId: "4",

  subjectId: "7",

  termId: "2",

  title: "Term one review",

  durationMinutes: 45,

  attemptsAllowed: 2,

  validityMinutes: 1440,

  questions: [
    {
      questionText: "Which answer is correct?",

      options: ["One", "Two", "Three", "Four"],

      correctAnswerIndex: 1,
    },
  ],
}

test("validates and normalizes classroom announcements", () => {
  assert.deepEqual(
    validateClassroomPost({
      classId: "4",

      type: "notice",

      title: "  Class update ",

      contentBody: "  Bring your books. ",

      meetingUrl: "https://meet.example.edu/room",
    }),
    {
      classId: "4",

      subjectId: null,

      type: "notice",

      title: "Class update",

      contentBody: "Bring your books.",

      deadline: null,

      meetingUrl: "https://meet.example.edu/room",

      attachment: null,
    },
  )
})

test("rejects unsafe meeting links and assignments without due dates", () => {
  assert.throws(
    () =>
      validateClassroomPost({
        classId: "4",

        type: "notice",

        title: "Class update",

        meetingUrl: "http://meet.example.edu/room",
      }),
    /HTTPS/,
  )

  assert.throws(
    () =>
      validateClassroomPost({
        classId: "4",

        type: "assignment",

        title: "Homework",

        contentBody: "Complete the worksheet.",
      }),
    /due date/,
  )
})

test("validates exam settings and four-option questions", () => {
  const exam = validatePortalExam(validExam)

  assert.equal(exam.title, "Term one review")

  assert.equal(exam.questions[0].correctAnswerIndex, 1)

  assert.ok(Date.parse(exam.expiresAt) > Date.now())

  assert.throws(
    () =>
      validatePortalExam({
        ...validExam,

        questions: [{ ...validExam.questions[0], options: ["Only one"] }],
      }),
    /four answer options/,
  )
})

test("validates unique answer indices and rejects out-of-range values", () => {
  assert.deepEqual(
    validateExamAnswers({
      answers: [
        { questionIndex: 0, selectedOptionIndex: 1 },

        { questionIndex: 1, selectedOptionIndex: 2 },
      ],
    }),
    [
      { questionIndex: 0, selectedOptionIndex: 1 },

      { questionIndex: 1, selectedOptionIndex: 2 },
    ],
  )

  assert.throws(
    () =>
      validateExamAnswers({
        answers: [
          { questionIndex: 0, selectedOptionIndex: 1 },

          { questionIndex: 0, selectedOptionIndex: 2 },
        ],
      }),
    /cannot repeat/,
  )

  assert.throws(
    () =>
      validateExamAnswers({
        answers: [{ questionIndex: 0, selectedOptionIndex: 4 }],
      }),
    /invalid/,
  )
})
