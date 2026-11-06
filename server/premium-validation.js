import { isValidDatabaseId } from "./ids.js"
import { isValidPhone, normalizePhone } from "./phone.js"

const feePaymentMethods = new Set(["cash", "bank_transfer", "cheque", "other"])
const announcementTypes = new Set(["announcement", "event", "newsletter"])
const announcementAudiences = new Set(["all", "students", "teachers", "parents"])

function objectBody(body, label, allowedKeys) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const unsupportedKeys = Object.keys(body).filter(
    (key) => !allowedKeys.has(key),
  )
  if (unsupportedKeys.length) {
    throw new Error(
      `Unsupported ${label.toLowerCase()} field(s): ${unsupportedKeys.join(", ")}.`,
    )
  }
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`)
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`)
  return normalized
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === "") return null
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} must be a valid calendar date.`)
  }
  return value
}

function positiveAmount(value, label) {
  const amount = Number(value)
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000 ||
    Math.round(amount * 100) !== amount * 100
  ) {
    throw new Error(`${label} must be a positive amount with up to two decimals.`)
  }
  return amount
}

export function validateFeeSchedulePayload(body = {}) {
  objectBody(
    body,
    "Fee schedule",
    new Set(["name", "amount", "currency", "dueOn", "classId", "academicTermId"]),
  )
  const currency =
    typeof body.currency === "string" ? body.currency.trim().toUpperCase() : ""
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Choose a valid three-letter currency code.")
  }
  if (!isValidDatabaseId(body.classId) || !isValidDatabaseId(body.academicTermId)) {
    throw new Error("Choose a valid class and academic term.")
  }
  return {
    name: requiredText(body.name, "Fee name", 120),
    amount: positiveAmount(body.amount, "Fee amount"),
    currency,
    dueOn: optionalDate(body.dueOn, "Due date"),
    classId: String(body.classId),
    academicTermId: String(body.academicTermId),
  }
}

export function validateInvoicePayload(body = {}) {
  objectBody(body, "Invoice", new Set(["feeScheduleId", "studentId"]))
  if (
    !isValidDatabaseId(body.feeScheduleId) ||
    !isValidDatabaseId(body.studentId)
  ) {
    throw new Error("Choose a valid fee schedule and student.")
  }
  return {
    feeScheduleId: String(body.feeScheduleId),
    studentId: String(body.studentId),
  }
}

export function validateFeePaymentPayload(body = {}) {
  objectBody(
    body,
    "Payment",
    new Set(["amount", "method", "reference", "paidOn"]),
  )
  if (!feePaymentMethods.has(body.method)) {
    throw new Error("Choose a valid payment method.")
  }
  const reference =
    body.reference === undefined || body.reference === ""
      ? null
      : requiredText(body.reference, "Payment reference", 100)
  return {
    amount: positiveAmount(body.amount, "Payment amount"),
    method: body.method,
    reference,
    paidOn: optionalDate(body.paidOn, "Payment date"),
  }
}

export function validateParentAccountPayload(body = {}) {
  objectBody(
    body,
    "Parent account",
    new Set(["fullName", "phone", "studentIds"]),
  )
  const phone = normalizePhone(requiredText(body.phone, "Phone number", 30))
  if (!isValidPhone(phone)) {
    throw new Error("Enter a valid parent phone number.")
  }
  if (
    !Array.isArray(body.studentIds) ||
    body.studentIds.length < 1 ||
    body.studentIds.length > 20 ||
    body.studentIds.some((id) => !isValidDatabaseId(id)) ||
    new Set(body.studentIds.map(String)).size !== body.studentIds.length
  ) {
    throw new Error("Link one to 20 unique student records.")
  }
  return {
    fullName: requiredText(body.fullName, "Parent name", 160),
    phone,
    studentIds: body.studentIds.map(String),
  }
}

export function validateParentStudentsPayload(body = {}) {
  objectBody(body, "Parent student links", new Set(["studentIds"]))
  if (
    !Array.isArray(body.studentIds) ||
    body.studentIds.length < 1 ||
    body.studentIds.length > 20 ||
    body.studentIds.some((id) => !isValidDatabaseId(id)) ||
    new Set(body.studentIds.map(String)).size !== body.studentIds.length
  ) {
    throw new Error("Link one to 20 unique student records.")
  }
  return { studentIds: body.studentIds.map(String) }
}

export function validateSchoolAnnouncementPayload(body = {}) {
  objectBody(
    body,
    "School announcement",
    new Set(["title", "body", "type", "audience", "eventDate"]),
  )
  const type = body.type || "announcement"
  const audience = body.audience || "all"
  if (!announcementTypes.has(type)) {
    throw new Error("Choose a valid announcement type.")
  }
  if (!announcementAudiences.has(audience)) {
    throw new Error("Choose a valid announcement audience.")
  }
  const eventDate = optionalDate(body.eventDate, "Event date")
  if (type === "event" && !eventDate) {
    throw new Error("An event date is required for school events.")
  }
  return {
    title: requiredText(body.title, "Title", 160),
    body: requiredText(body.body, "Message", 5000),
    type,
    audience,
    eventDate,
  }
}
