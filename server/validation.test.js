import assert from "node:assert/strict"
import test from "node:test"
import { isValidDatabaseId } from "./ids.js"
import { normalizeEmail, validateEnrollment, validateRegistration } from "./validation.js"

const registration = {
  schoolName: "  Example School ",
  schoolType: "Combined",
  country: "Nigeria",
  state: "Lagos",
  city: "Ikeja",
  address: "12 School Road",
  schoolEmail: " office@example.edu ",
  schoolPhone: "+234 800 000 0000",
  adminName: "Ada Example",
  adminEmail: " ADA@example.edu ",
  adminPhone: "+234 800 000 0001",
  adminRole: "Principal",
  password: "secure-password",
  confirmPassword: "secure-password",
  acceptTerms: true,
}

test("registration keeps the submitted school and administrator profile", () => {
  const validated = validateRegistration(registration)
  assert.equal(validated.schoolName, "Example School")
  assert.equal(validated.adminName, "Ada Example")
  assert.equal(validated.adminEmail, "ada@example.edu")
  assert.equal(validated.schoolEmail, "office@example.edu")
  assert.equal(validated.password, registration.password)
  assert.equal("confirmPassword" in validated, false)
  assert.equal("acceptTerms" in validated, false)
})

test("registration rejects invalid email, unsupported roles, and weak passwords", () => {
  assert.throws(() => validateRegistration({ ...registration, adminEmail: "not-an-email" }), /valid administrator email/)
  assert.throws(() => validateRegistration({ ...registration, adminRole: "Root Admin" }), /administrator role/)
  assert.throws(() => validateRegistration({ ...registration, password: "short" }), /at least 8 characters/)
  assert.throws(() => validateRegistration({ ...registration, password: "a".repeat(73) }), /72 UTF-8 bytes/)
  assert.throws(() => validateRegistration({ ...registration, confirmPassword: "different-password" }), /Passwords do not match/)
  assert.throws(() => validateRegistration({ ...registration, acceptTerms: false }), /Accept the terms/)
  assert.throws(() => validateRegistration(null), /JSON object/)
})

test("enrollment only accepts supported fields and valid registry roles", () => {
  assert.deepEqual(
    validateEnrollment({ fullName: " Ada Example ", role: "teacher", designation: "Maths", schoolId: "forged" }),
    { fullName: "Ada Example", role: "teacher", designation: "Maths" },
  )
  assert.throws(() => validateEnrollment({ fullName: "Ada", role: "owner", designation: "Root" }), /valid role/)
})

test("database IDs accept positive safe integers only", () => {
  assert.equal(isValidDatabaseId("1"), true)
  assert.equal(isValidDatabaseId(String(Number.MAX_SAFE_INTEGER)), true)
  assert.equal(isValidDatabaseId("0"), false)
  assert.equal(isValidDatabaseId("-1"), false)
  assert.equal(isValidDatabaseId("1.5"), false)
  assert.equal(isValidDatabaseId("9007199254740992"), false)
  assert.equal(isValidDatabaseId("not-an-id"), false)
})

test("login email normalization is case-insensitive", () => {
  assert.equal(normalizeEmail(" ADMIN@EXAMPLE.EDU "), "admin@example.edu")
  assert.throws(() => normalizeEmail("not an email"), /valid email/)
})
