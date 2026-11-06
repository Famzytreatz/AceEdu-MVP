import { validateSchoolSlug } from "./school-slugs.js"
import { isValidPhone, normalizePhone } from "./phone.js"

export function validateStudentPortalPassword(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Password details must be a JSON object.")
  }

  const allowedKeys = new Set(["currentPassword", "newPassword"])
  const unsupportedKeys = Object.keys(body).filter(
    (key) => !allowedKeys.has(key),
  )

  if (unsupportedKeys.length) {
    throw new Error(
      `Unsupported password field(s): ${unsupportedKeys.join(", ")}.`,
    )
  }

  const currentPassword = body.currentPassword ?? ""
  const newPassword = body.newPassword

  if (typeof currentPassword !== "string" || currentPassword.length > 128) {
    throw new Error("The current password is invalid.")
  }

  if (
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    throw new Error("Choose a password between 8 and 128 characters.")
  }

  return { currentPassword, newPassword }
}

export function validatePortalLogin(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Sign-in details must be a JSON object.")
  }

  const allowedKeys = new Set(["schoolSlug", "accessPin", "password"])

  const unsupportedKeys = Object.keys(body).filter(
    (key) => !allowedKeys.has(key),
  )

  if (unsupportedKeys.length) {
    throw new Error(
      `Unsupported sign-in field(s): ${unsupportedKeys.join(", ")}.`,
    )
  }

  const schoolSlug = validateSchoolSlug(body.schoolSlug)

  if (
    typeof body.accessPin !== "string" ||
    !/^(?:[A-Z]{3}-\d{5}|\d{6})$/i.test(body.accessPin.trim())
  ) {
    throw new Error("Enter the access code issued by your school.")
  }

  if (
    body.password !== undefined &&
    (typeof body.password !== "string" || body.password.length > 128)
  ) {
    throw new Error("The password is invalid.")
  }

  return {
    schoolSlug,

    accessPin: body.accessPin.trim().toUpperCase(),

    password: body.password || "",
  }
}

export function validateParentPortalLogin(body = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Parent sign-in details must be a JSON object.")
  }

  const allowedKeys = new Set(["schoolSlug", "role", "phone", "password"])
  const unsupportedKeys = Object.keys(body).filter(
    (key) => !allowedKeys.has(key),
  )
  if (unsupportedKeys.length) {
    throw new Error(
      `Unsupported parent sign-in field(s): ${unsupportedKeys.join(", ")}.`,
    )
  }

  if (body.role !== "parent") {
    throw new Error("Choose the parent sign-in option.")
  }

  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : ""
  if (!isValidPhone(phone)) {
    throw new Error("Enter the phone number registered by your school.")
  }
  if (
    typeof body.password !== "string" ||
    body.password.length < 8 ||
    body.password.length > 128
  ) {
    throw new Error("Enter the password issued by your school.")
  }

  return {
    schoolSlug: validateSchoolSlug(body.schoolSlug),
    phone,
    password: body.password,
  }
}
