import assert from "node:assert/strict"

import test from "node:test"

import {
  validatePortalLogin,
  validateStudentPortalPassword,
} from "./portal-validation.js"

const validStudentLogin = {
  schoolSlug: "bright-future",
  accessPin: "482193",
}

test("validates shared school-scoped sign-in details", () => {
  assert.deepEqual(validatePortalLogin(validStudentLogin), {
    ...validStudentLogin,
    password: "",
  })
})

test("allows the server to resolve account role instead of trusting a client role", () => {
  assert.throws(
    () => validatePortalLogin({ ...validStudentLogin, role: "teacher" }),
    /Unsupported sign-in field/,
  )
})

test("rejects malformed or reserved school slugs and invalid PINs", () => {
  assert.throws(
    () => validatePortalLogin({ ...validStudentLogin, schoolSlug: "platform" }),

    /school space address is invalid/i,
  )

  assert.throws(
    () => validatePortalLogin({ ...validStudentLogin, accessPin: "123" }),

    /six-digit access PIN/,
  )
})

test("does not accept a client-supplied school ID", () => {
  assert.throws(
    () => validatePortalLogin({ ...validStudentLogin, schoolId: "2" }),

    /Unsupported sign-in field/,
  )
})

test("validates a new student portal password without requiring an old password", () => {
  assert.deepEqual(
    validateStudentPortalPassword({ newPassword: "SecurePass123" }),
    { currentPassword: "", newPassword: "SecurePass123" },
  )
})

test("rejects short passwords and unrecognized password fields", () => {
  assert.throws(
    () => validateStudentPortalPassword({ newPassword: "short" }),
    /between 8 and 128 characters/,
  )
  assert.throws(
    () =>
      validateStudentPortalPassword({
        newPassword: "SecurePass123",
        schoolId: "99",
      }),
    /Unsupported password field/,
  )
})
