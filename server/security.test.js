import assert from "node:assert/strict"
import test from "node:test"
import { config } from "./config.js"
import {
  createRequireEntitlement,
  createRequirePortalMember,
  createRequireSchool,
  requireAllowedOrigin,
} from "./security.js"

function requestFor({ origin, host = "localhost:8443", protocol = "http", method = "POST" }) {
  return {
    method,
    protocol,
    get(name) {
      if (name === "origin") return origin
      if (name === "host") return host
      return undefined
    },
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test("origin guard accepts the configured application origin", () => {
  const response = responseRecorder()
  let continued = false

  requireAllowedOrigin(requestFor({ origin: config.appOrigin }), response, () => {
    continued = true
  })

  assert.equal(continued, true)
  assert.equal(response.statusCode, 200)
})

test("development origin guard accepts the request host when it differs from APP_ORIGIN", (context) => {
  if (config.isProduction) {
    context.skip("development-only origin behavior")
    return
  }

  const response = responseRecorder()
  let continued = false

  requireAllowedOrigin(requestFor({ origin: "http://127.0.0.1:8443", host: "127.0.0.1:8443" }), response, () => {
    continued = true
  })

  assert.equal(continued, true)
  assert.equal(response.statusCode, 200)
})

test("origin guard rejects an origin that does not match the configured origin or request host", () => {
  const response = responseRecorder()
  let continued = false

  requireAllowedOrigin(requestFor({ origin: "https://untrusted.example" }), response, () => {
    continued = true
  })

  assert.equal(continued, false)
  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: "Request origin is not allowed." })
})

test("school authorization uses the authenticated session ID, not a requested school ID", async () => {
  let queriedSchoolId
  const middleware = createRequireSchool(async (id) => {
    queriedSchoolId = id
    return { _id: id }
  })
  const req = {
    session: { schoolId: "42" },
    body: { schoolId: "99" },
    params: { schoolId: "99" },
    query: { schoolId: "99" },
  }
  const response = responseRecorder()
  await new Promise((resolve, reject) => {
    middleware(req, response, (error) => error ? reject(error) : resolve())
  })

  assert.equal(queriedSchoolId, "42")
  assert.deepEqual(req.school, { _id: "42" })
})

test("school administrators cannot use member-only portal APIs", () => {
  const middleware = createRequirePortalMember({
    findEnrollment: async () => null,
    findSchool: async () => null,
  })()
  const response = responseRecorder()
  let continued = false

  middleware({ session: { schoolId: "42" } }, response, () => {
    continued = true
  })

  assert.equal(continued, false)
  assert.equal(response.statusCode, 401)
})

test("portal authorization is pinned to the member role and internal school ID", async () => {
  let lookedUpSchoolId
  let lookedUpMemberId
  const middleware = createRequirePortalMember({
    findEnrollment: async (schoolId, memberId) => {
      lookedUpSchoolId = schoolId
      lookedUpMemberId = memberId
      return {
        id: memberId,
        school_id: schoolId,
        role: "student",
        full_name: "A Student",
        status: "Active",
      }
    },
    findSchool: async (schoolId) => ({ _id: schoolId }),
  })("student")
  const req = {
    session: { portalMemberId: "15", portalSchoolId: "42", portalRole: "student" },
    body: { schoolId: "99", role: "teacher" },
  }
  const response = responseRecorder()
  await new Promise((resolve, reject) => {
    middleware(req, response, (error) => error ? reject(error) : resolve())
  })

  assert.equal(lookedUpSchoolId, "42")
  assert.equal(lookedUpMemberId, "15")
  assert.equal(req.portalMember.schoolId, "42")
  assert.equal(req.portalMember.role, "student")
  assert.deepEqual(req.school, { _id: "42" })
})

test("portal role mismatch is denied before membership lookup", () => {
  let queried = false
  const middleware = createRequirePortalMember({
    findEnrollment: async () => { queried = true },
    findSchool: async () => ({ _id: "42" }),
  })("teacher")
  const response = responseRecorder()

  middleware(
    { session: { portalMemberId: "15", portalSchoolId: "42", portalRole: "student" } },
    response,
    () => assert.fail("Wrong-role session must not continue."),
  )

  assert.equal(queried, false)
  assert.equal(response.statusCode, 401)
})

test("the Premium teacher portal requires the school's active entitlement", async () => {
  let entitlementSchoolId
  const middleware = createRequireEntitlement(async (schoolId) => {
    entitlementSchoolId = schoolId
    return { plan: "mvp" }
  })("teacherPortal")
  const response = responseRecorder()
  await new Promise((resolve, reject) => {
    middleware(
      { school: { _id: "42" }, session: { portalSchoolId: "99" } },
      response,
      (error) => error ? reject(error) : resolve(),
    )
    setImmediate(resolve)
  })

  assert.equal(entitlementSchoolId, "42")
  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, {
    error: "This feature requires an active Premium entitlement.",
    code: "PREMIUM_REQUIRED",
  })
})
