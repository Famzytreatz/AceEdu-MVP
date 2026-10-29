import assert from "node:assert/strict"
import test from "node:test"
import {
  removeAuthenticationSession,
  updateAuthenticationSession,
} from "./session-auth.js"

function createRequestSession(initial = {}) {
  const session = {
    ...initial,
    regenerate(callback) {
      for (const key of Object.keys(this)) {
        if (key !== "regenerate" && key !== "save" && key !== "destroy") {
          delete this[key]
        }
      }
      callback()
    },
    save(callback) {
      callback()
    },
    destroy(callback) {
      this.destroyed = true
      callback()
    },
  }

  return { session }
}

function createResponse() {
  return {
    clearedCookies: [],
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options })
    },
  }
}

test("authenticating a portal preserves the admin session while rotating the session ID", async () => {
  const req = createRequestSession({ schoolId: "42" })

  await updateAuthenticationSession(req, {
    portalMemberId: "15",
    portalSchoolId: "42",
    portalRole: "teacher",
  })

  assert.equal(req.session.schoolId, "42")
  assert.equal(req.session.portalMemberId, "15")
  assert.equal(req.session.portalSchoolId, "42")
  assert.equal(req.session.portalRole, "teacher")
})

test("logging out of the portal preserves the admin session and cookie", async () => {
  const req = createRequestSession({
    schoolId: "42",
    portalMemberId: "15",
    portalSchoolId: "42",
    portalRole: "teacher",
  })
  const res = createResponse()

  await removeAuthenticationSession(req, res, [
    "portalMemberId",
    "portalSchoolId",
    "portalRole",
  ])

  assert.equal(req.session.schoolId, "42")
  assert.equal(req.session.portalMemberId, undefined)
  assert.equal(req.session.destroyed, undefined)
  assert.deepEqual(res.clearedCookies, [])
})

test("logging out of the admin preserves the portal session and cookie", async () => {
  const req = createRequestSession({
    schoolId: "42",
    portalMemberId: "15",
    portalSchoolId: "42",
    portalRole: "student",
  })
  const res = createResponse()

  await removeAuthenticationSession(req, res, ["schoolId"])

  assert.equal(req.session.schoolId, undefined)
  assert.equal(req.session.portalMemberId, "15")
  assert.equal(req.session.portalSchoolId, "42")
  assert.equal(req.session.portalRole, "student")
  assert.equal(req.session.destroyed, undefined)
  assert.deepEqual(res.clearedCookies, [])
})

test("logging out of the last authenticated context destroys the session and clears its cookie", async () => {
  const req = createRequestSession({ schoolId: "42" })
  const res = createResponse()

  await removeAuthenticationSession(req, res, ["schoolId"])

  assert.equal(req.session.schoolId, undefined)
  assert.equal(req.session.destroyed, true)
  assert.equal(res.clearedCookies.length, 1)
  assert.equal(res.clearedCookies[0].name, "aceedu.sid")
})
