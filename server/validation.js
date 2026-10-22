const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schoolTypes = new Set([
  "Nursery/Primary",
  "Secondary",
  "Combined",
  "Other",
])

const adminRoles = new Set([
  "Proprietor",
  "Principal",
  "School Administrator",
  "Other",
])

const enrollmentRoles = new Set([
  "student",
  "teacher",
  "sub-admin",
  "school-admin",
])

function text(value, label, maxLength) {
  if (typeof value !== "string") throw new Error(`${label} is required.`)

  const normalized = value.trim()

  if (!normalized) throw new Error(`${label} is required.`)

  if (normalized.length > maxLength) throw new Error(`${label} is too long.`)

  return normalized
}

function email(value, label) {
  const normalized = text(value, label, 254).toLowerCase()

  if (!emailPattern.test(normalized))
    throw new Error(`Enter a valid ${label.toLowerCase()}.`)

  return normalized
}

export function validateRegistration(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Registration details must be a JSON object.")
  }

  const schoolType = text(body.schoolType, "School type", 40)

  const adminRole = text(body.adminRole, "Administrator role", 40)

  if (!schoolTypes.has(schoolType))
    throw new Error("Choose a valid school type.")

  if (!adminRoles.has(adminRole))
    throw new Error("Choose a valid administrator role.")

  if (
    typeof body.password !== "string" ||
    body.password.length < 8 ||
    Buffer.byteLength(body.password, "utf8") > 72
  ) {
    throw new Error(
      "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
    )
  }

  if (body.confirmPassword !== body.password) {
    throw new Error("Passwords do not match.")
  }

  if (body.acceptTerms !== true) {
    throw new Error("Accept the terms to register your school.")
  }

  return {
    schoolName: text(body.schoolName, "School name", 160),

    schoolType,

    country: text(body.country, "Country", 80),

    state: text(body.state, "State", 100),

    city: text(body.city, "City", 100),

    address: text(body.address, "Address", 300),

    schoolEmail: email(body.schoolEmail, "School email"),

    schoolPhone: text(body.schoolPhone, "School phone", 30),

    adminName: text(body.adminName, "Administrator name", 160),

    adminEmail: email(body.adminEmail, "Administrator email"),

    adminPhone: text(body.adminPhone, "Administrator phone", 30),

    adminRole,

    password: body.password,
  }
}

export function validateEnrollment(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Enrollment details must be a JSON object.")
  }

  const role = text(body.role, "Role", 20)

  if (!enrollmentRoles.has(role)) throw new Error("Choose a valid role.")

  const optionalText = (value, label, maxLength) => {
    if (value === undefined || value === null || value === "") return null

    return text(value, label, maxLength)
  }

  const dateOfBirth = optionalText(body.dob, "Date of birth", 10)

  if (dateOfBirth) {
    const parsedDate = new Date(`${dateOfBirth}T00:00:00Z`)

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(parsedDate.valueOf()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth
    ) {
      throw new Error("Enter a valid date of birth.")
    }
  }

  let password = null

  if (role !== "student") {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password, "utf8") > 72
    ) {
      throw new Error(
        "Staff password must be at least 8 characters and no more than 72 UTF-8 bytes.",
      )
    }

    password = body.password
  }

  const passport = optionalText(body.passport, "Passport image", 1_500_000)

  if (
    passport &&
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      passport,
    )
  ) {
    throw new Error("Upload a valid JPEG, PNG, or WebP passport image.")
  }

  return {
    fullName: text(body.fullName, "Full name", 160),

    role,

    designation: text(body.designation, "Class or designation", 120),

    assignedClasses: optionalText(
      body.assignedClasses,
      "Teaching classes",
      500,
    ),

    subjects: optionalText(body.subjects, "Department or subject", 300),

    passport,

    dob: dateOfBirth,

    guardianPhone: optionalText(body.guardianPhone, "Guardian phone", 30),

    address: optionalText(body.address, "House address", 300),

    stateOfOrigin: optionalText(body.stateOfOrigin, "State of origin", 100),

    phone: optionalText(body.phone, "Personal phone", 30),

    password,
  }
}

export function normalizeEmail(value) {
  if (typeof value !== "string") throw new Error("Enter a valid email address.")

  const normalized = value.trim().toLowerCase()

  if (!emailPattern.test(normalized) || normalized.length > 254) {
    throw new Error("Enter a valid email address.")
  }

  return normalized
}
