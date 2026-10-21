const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const schoolTypes = new Set(["Nursery/Primary", "Secondary", "Combined", "Other"])
const adminRoles = new Set(["Proprietor", "Principal", "School Administrator", "Other"])
const enrollmentRoles = new Set(["student", "teacher", "sub-admin", "school-admin"])

function text(value, label, maxLength) {
  if (typeof value !== "string") throw new Error(`${label} is required.`)
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label} is required.`)
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`)
  return normalized
}

function email(value, label) {
  const normalized = text(value, label, 254).toLowerCase()
  if (!emailPattern.test(normalized)) throw new Error(`Enter a valid ${label.toLowerCase()}.`)
  return normalized
}

export function validateRegistration(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Registration details must be a JSON object.")
  }
  const schoolType = text(body.schoolType, "School type", 40)
  const adminRole = text(body.adminRole, "Administrator role", 40)
  if (!schoolTypes.has(schoolType)) throw new Error("Choose a valid school type.")
  if (!adminRoles.has(adminRole)) throw new Error("Choose a valid administrator role.")
  if (typeof body.password !== "string" || body.password.length < 8 || Buffer.byteLength(body.password, "utf8") > 72) {
    throw new Error("Password must be at least 8 characters and no more than 72 UTF-8 bytes.")
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

  return {
    fullName: text(body.fullName, "Full name", 160),
    role,
    designation: text(body.designation, "Class or designation", 120),
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
