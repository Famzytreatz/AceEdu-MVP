import { isValidDatabaseId } from "./ids.js"

const postTypes = new Set([
  "lesson",
  "assignment",
  "notice",
  "material",
  "live_class",
])

const allowedAttachmentTypes = new Set([
  "application/pdf",

  "image/jpeg",

  "image/png",

  "image/webp",
])

function text(value, label, maxLength, optional = false) {
  if (
    typeof value !== "string" ||
    (!optional && !value.trim()) ||
    value.trim().length > maxLength
  ) {
    throw new Error(`${label} must contain 1 to ${maxLength} characters.`)
  }

  return value.trim()
}

function date(value, label, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) {
    return null
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid date.`)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid date.`)
  }

  return value
}

export function validateClassroomPost(body) {
  const classId = String(body?.classId || "")

  const subjectId = body?.subjectId ? String(body.subjectId) : null

  const type = body?.type

  const title = text(body?.title, "Title", 160)

  const contentBody = text(body?.contentBody ?? "", "Post content", 12000, true)

  const deadline = date(body?.deadline, "Deadline", true)

  const meetingUrl = body?.meetingUrl
    ? text(body.meetingUrl, "Meeting URL", 2048)
    : null

  if (!isValidDatabaseId(classId)) throw new Error("Select a valid class.")

  if (subjectId && !isValidDatabaseId(subjectId))
    throw new Error("Select a valid subject.")

  if (!postTypes.has(type))
    throw new Error("Choose a valid classroom post type.")

  if (!contentBody && !meetingUrl)
    throw new Error("Add post content or a meeting link.")

  if (type === "assignment" && !deadline) {
    throw new Error("Set a due date for the assignment.")
  }

  if (meetingUrl) {
    let url

    try {
      url = new URL(meetingUrl)
    } catch {
      throw new Error("Meeting links must be valid HTTPS URLs.")
    }

    if (url.protocol !== "https:")
      throw new Error("Meeting links must be valid HTTPS URLs.")
  }

  let attachment = null

  if (body?.attachment !== undefined && body.attachment !== null) {
    const { name, mimeType, dataBase64 } = body.attachment

    const safeName = text(name, "Attachment filename", 160)

    if (!allowedAttachmentTypes.has(mimeType)) {
      throw new Error("Attach a PDF or JPEG, PNG, or WebP image.")
    }

    if (
      typeof dataBase64 !== "string" ||
      dataBase64.length > 7_000_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        dataBase64,
      )
    ) {
      throw new Error("The attachment is invalid or larger than 5 MB.")
    }

    const size = Buffer.from(dataBase64, "base64").length

    if (!size || size > 5 * 1024 * 1024) {
      throw new Error("Attachments must be no larger than 5 MB.")
    }

    attachment = { name: safeName, mimeType, dataBase64 }
  }

  return {
    classId,
    subjectId,
    type,
    title,
    contentBody,
    deadline,
    meetingUrl,
    attachment,
  }
}

export function validatePortalExam(body) {
  const classId = String(body?.classId || "")

  const subjectId = body?.subjectId ? String(body.subjectId) : null

  const termId = String(body?.termId || "")

  const title = text(body?.title, "Exam title", 160)

  const durationMinutes = Number(body?.durationMinutes)

  const attemptsAllowed = Number(body?.attemptsAllowed)

  const validityMinutes = Number(body?.validityMinutes)

  const questions = body?.questions

  if (!isValidDatabaseId(classId)) throw new Error("Select a valid class.")

  if (!isValidDatabaseId(termId))
    throw new Error("Select a valid academic term.")

  if (subjectId && !isValidDatabaseId(subjectId))
    throw new Error("Select a valid subject.")

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 240
  ) {
    throw new Error("Exam duration must be from 1 to 240 minutes.")
  }

  if (
    !Number.isInteger(attemptsAllowed) ||
    attemptsAllowed < 1 ||
    attemptsAllowed > 5
  ) {
    throw new Error("Attempts allowed must be from 1 to 5.")
  }

  if (
    !Number.isInteger(validityMinutes) ||
    validityMinutes < 1 ||
    validityMinutes > 525600
  ) {
    throw new Error("Exam availability must be from 1 minute to 365 days.")
  }

  if (
    !Array.isArray(questions) ||
    questions.length < 1 ||
    questions.length > 100
  ) {
    throw new Error("Add between 1 and 100 exam questions.")
  }

  const normalizedQuestions = questions.map((question) => {
    const prompt = text(question?.questionText, "Question", 1200)

    if (!Array.isArray(question?.options) || question.options.length !== 4) {
      throw new Error("Each question must have four answer options.")
    }

    const options = question.options.map((option) =>
      text(option, "Answer option", 300),
    )

    const correctAnswerIndex = question.correctAnswerIndex

    if (
      !Number.isInteger(correctAnswerIndex) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      throw new Error("Select the correct answer for each question.")
    }

    return { questionText: prompt, options, correctAnswerIndex }
  })

  return {
    classId,

    subjectId,

    termId,

    title,

    durationMinutes,

    attemptsAllowed,

    expiresAt: new Date(Date.now() + validityMinutes * 60_000).toISOString(),

    questions: normalizedQuestions,
  }
}

export function validateExamAnswers(body) {
  const answers = body?.answers

  if (!Array.isArray(answers) || answers.length > 100) {
    throw new Error("Exam answers are invalid.")
  }

  const normalized = answers.map((answer) => {
    if (
      !Number.isInteger(answer?.questionIndex) ||
      answer.questionIndex < 0 ||
      !Number.isInteger(answer?.selectedOptionIndex) ||
      answer.selectedOptionIndex < 0 ||
      answer.selectedOptionIndex > 3
    ) {
      throw new Error("Exam answers are invalid.")
    }

    return {
      questionIndex: answer.questionIndex,

      selectedOptionIndex: answer.selectedOptionIndex,
    }
  })

  if (
    new Set(normalized.map((answer) => answer.questionIndex)).size !==
    normalized.length
  ) {
    throw new Error("Exam answers cannot repeat a question.")
  }

  return normalized
}
