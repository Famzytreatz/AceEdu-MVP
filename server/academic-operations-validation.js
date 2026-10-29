import { isValidDatabaseId } from "./ids.js"

const attendanceStatuses = new Set(["present", "absent", "late", "excused"])

const assessmentTypes = new Set(["assignment", "quiz", "test", "examination"])

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false

  const parsed = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function positiveId(value, label) {
  if (!isValidDatabaseId(value)) throw new Error(`${label} is invalid.`)

  return String(value)
}

function validScore(value) {
  const score = Number(value)

  return (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 99999.99 &&
    Math.abs(score * 100 - Math.round(score * 100)) < 1e-7
  )
}

function boundedText(value, label, maxLength, allowEmpty = false) {
  if (
    typeof value !== "string" ||
    (!allowEmpty && !value.trim()) ||
    value.trim().length > maxLength
  ) {
    throw new Error(
      `${label} must contain ${
        allowEmpty ? "0" : "1"
      } to ${maxLength} characters.`,
    )
  }

  return value.trim()
}

export function validateAttendancePayload(body) {
  const classId = positiveId(body?.classId, "Class ID")

  const termId = positiveId(body?.termId, "Academic term ID")

  const date = body?.date

  if (!validDate(date)) throw new Error("Enter a valid attendance date.")

  const entries = body?.entries

  if (
    !Array.isArray(entries) ||
    entries.length < 1 ||
    entries.length > 500 ||
    entries.some(
      (entry) =>
        !isValidDatabaseId(entry?.studentId) ||
        !attendanceStatuses.has(entry?.status) ||
        (entry?.note !== undefined &&
          (typeof entry.note !== "string" || entry.note.trim().length > 300)),
    )
  ) {
    throw new Error(
      "Provide attendance for 1 to 500 students with valid statuses and notes.",
    )
  }

  const normalizedEntries = entries.map((entry) => ({
    studentId: String(entry.studentId),

    status: entry.status,

    note:
      typeof entry.note === "string" && entry.note.trim()
        ? entry.note.trim()
        : null,
  }))

  if (
    new Set(normalizedEntries.map((entry) => entry.studentId)).size !==
    entries.length
  ) {
    throw new Error("Attendance entries must contain unique student IDs.")
  }

  return { classId, termId, date, entries: normalizedEntries }
}

export function validateAssessmentPayload(body) {
  const classId = positiveId(body?.classId, "Class ID")

  const subjectId = positiveId(body?.subjectId, "Subject ID")

  const termId = positiveId(body?.termId, "Academic term ID")

  const title = boundedText(body?.title, "Assessment title", 160)

  const type = body?.type

  const maximumScore = Number(body?.maximumScore)

  const dueOn = body?.dueOn || null

  if (!assessmentTypes.has(type)) {
    throw new Error("Choose a valid assessment type.")
  }

  if (
    !Number.isFinite(maximumScore) ||
    maximumScore <= 0 ||
    maximumScore > 99999.99 ||
    Math.abs(maximumScore * 100 - Math.round(maximumScore * 100)) >= 1e-7
  ) {
    throw new Error(
      "Maximum score must be greater than zero and have no more than two decimal places.",
    )
  }

  if (dueOn !== null && !validDate(dueOn)) {
    throw new Error("Enter a valid assessment due date.")
  }

  return { classId, subjectId, termId, title, type, maximumScore, dueOn }
}

export function validateAssessmentResultsPayload(body) {
  const results = body?.results

  if (
    !Array.isArray(results) ||
    results.length < 1 ||
    results.length > 500 ||
    results.some((result) => {
      return (
        !isValidDatabaseId(result?.studentId) ||
        !validScore(result?.score) ||
        (result?.feedback !== undefined &&
          (typeof result.feedback !== "string" ||
            result.feedback.trim().length > 1000))
      )
    })
  ) {
    throw new Error(
      "Provide 1 to 500 valid student scores and feedback entries.",
    )
  }

  const normalizedResults = results.map((result) => ({
    studentId: String(result.studentId),

    score: Number(result.score),

    feedback:
      typeof result.feedback === "string" && result.feedback.trim()
        ? result.feedback.trim()
        : null,
  }))

  if (
    new Set(normalizedResults.map((result) => result.studentId)).size !==
    results.length
  ) {
    throw new Error("Assessment results must contain unique student IDs.")
  }

  return normalizedResults
}

export function validateAcademicListIds(classId, termId) {
  return {
    classId: positiveId(classId, "Class ID"),

    termId: positiveId(termId, "Academic term ID"),
  }
}

export function validateAssessmentId(id) {
  return positiveId(id, "Assessment ID")
}

export function validateAttendanceLookup(classId, date) {
  const normalizedClassId = positiveId(classId, "Class ID")

  if (!validDate(date)) throw new Error("Enter a valid attendance date.")

  return { classId: normalizedClassId, date }
}
