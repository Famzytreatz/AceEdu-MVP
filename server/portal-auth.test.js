import assert from "node:assert/strict"

import { createServer } from "node:http"

import express from "express"

import test from "node:test"

import { createPortalAuthRouter } from "./routes/portal-auth.js"

const school = {
  _id: "42",

  schoolName: "Bright Future Academy",

  slug: "bright-future",

  logoUrl: null,
}

function activeMember(role = "teacher") {
  return {
    id: "15",

    school_id: "42",

    full_name: "Alex Teacher",

    role,

    designation: "Science",

    passport: null,

    access_pin: "482193",

    status: "Active",

    password_hash: "hashed-password",
  }
}

async function postLogin(body, dependencies) {
  const app = express()

  app.use(express.json())

  app.use((req, _res, next) => {
    req.session = {
      regenerate(callback) {
        callback()
      },

      save(callback) {
        callback()
      },

      destroy(callback) {
        callback()
      },
    }

    next()
  })

  app.use("/api/portal", createPortalAuthRouter(dependencies))

  const server = createServer(app)

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/portal/login`,
      {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(body),
      },
    )

    return { status: response.status, body: await response.json() }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

async function patchStudentPassword(body, dependencies = {}) {
  const {
    hasPortalPassword = false,
    role: memberRole = "student",
    ...routerDependencies
  } = dependencies
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.session = {}
    next()
  })
  app.use(
    "/api/portal",
    createPortalAuthRouter({
      requireMember: () => (req, _res, next) => {
        req.portalMember = {
          id: "15",
          schoolId: "42",
          role: memberRole,
          hasPortalPassword,
        }
        next()
      },
      ...routerDependencies,
    }),
  )

  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/portal/password`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    )
    return { status: response.status, body: await response.json() }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

test("shared school member login detects role and binds session to resolved school", async () => {
  let schoolQuery

  let enrollmentQuery

  let sessionStarted

  const result = await postLogin(
    {
      schoolSlug: "bright-future",
      accessPin: "482193",
      password: "my-password",
    },

    {
      findSchool: async (slug) => {
        schoolQuery = slug

        return school
      },

      findEnrollment: async (...args) => {
        enrollmentQuery = args

        return activeMember("teacher")
      },

      comparePassword: async (password, hash) =>
        password === "my-password" && hash === "hashed-password",

      findEntitlement: async (schoolId) => {
        assert.equal(schoolId, "42")

        return { plan: "premium" }
      },

      startSession: async (_req, member, schoolId) => {
        sessionStarted = { memberId: member.id, schoolId, role: member.role }
      },
    },
  )

  assert.equal(result.status, 200)

  assert.equal(schoolQuery, "bright-future")

  assert.deepEqual(enrollmentQuery, ["42", "482193"])

  assert.deepEqual(sessionStarted, {
    memberId: "15",
    schoolId: "42",
    role: "teacher",
  })

  assert.equal(result.body.member.premiumAccess, true)

  assert.equal(result.body.member.school.slug, "bright-future")

  assert.equal(result.body.member.hasPortalPassword, true)

  assert.equal(result.body.member.access_pin, undefined)

  assert.equal(result.body.member.password_hash, undefined)
})

test("shared sign-in rejects accounts outside the student and teacher portals", async () => {
  const result = await postLogin(
    { schoolSlug: "bright-future", accessPin: "482193" },

    {
      findSchool: async () => school,

      findEnrollment: async () => ({
        ...activeMember("teacher"),
        role: "sub-admin",
      }),

      findEntitlement: async () => null,

      startSession: async () =>
        assert.fail("Invalid role login must not start a session."),
    },
  )

  assert.equal(result.status, 401)

  assert.match(result.body.error, /details are incorrect/)
})

test("unknown school slugs fail before member credential lookup", async () => {
  let credentialLookupCalled = false

  const result = await postLogin(
    {
      schoolSlug: "bright-future",
      accessPin: "482193",
      password: "my-password",
    },

    {
      findSchool: async () => null,

      findEnrollment: async () => {
        credentialLookupCalled = true

        return activeMember()
      },
    },
  )

  assert.equal(result.status, 404)

  assert.equal(credentialLookupCalled, false)
})

test("a student without a configured password can use only the school-issued PIN", async () => {
  const result = await postLogin(
    { schoolSlug: "bright-future", accessPin: "482193" },

    {
      findSchool: async () => school,

      findEnrollment: async () => ({
        ...activeMember("student"),
        password_hash: null,
      }),

      findEntitlement: async () => ({ plan: "mvp" }),

      startSession: async () => {},
    },
  )

  assert.equal(result.status, 200)

  assert.equal(result.body.member.premiumAccess, false)

  assert.equal(result.body.code, "PREMIUM_REQUIRED")

  assert.equal(result.body.member.accessCode, "482193")

  assert.equal(result.body.member.hasPortalPassword, false)
})

test("students can set a portal password using their school-bound session", async () => {
  let savedPassword
  let hashedPasswordInput
  const result = await patchStudentPassword(
    { newPassword: "StudentPass123" },
    {
      hashPassword: async (password) => {
        hashedPasswordInput = password
        return "secure-hash"
      },
      setMemberPassword: async (...args) => {
        savedPassword = args
        return true
      },
    },
  )

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { hasPortalPassword: true })
  assert.equal(hashedPasswordInput, "StudentPass123")
  assert.deepEqual(savedPassword, ["42", "15", "student", "secure-hash"])
})

test("changing a student password requires and verifies the current password", async () => {
  const dependencies = {
    hasPortalPassword: true,
    findActiveEnrollment: async (schoolId, id) => {
      assert.equal(schoolId, "42")
      assert.equal(id, "15")
      return { id: "15", password_hash: "existing-hash" }
    },
    comparePassword: async (password, hash) =>
      password === "CurrentPass123" && hash === "existing-hash",
    hashPassword: async () => "new-hash",
    setMemberPassword: async () => true,
  }

  const missingCurrentPassword = await patchStudentPassword(
    { newPassword: "NextPass123" },
    dependencies,
  )
  assert.equal(missingCurrentPassword.status, 400)
  assert.match(missingCurrentPassword.body.error, /current password/i)

  const incorrectCurrentPassword = await patchStudentPassword(
    { currentPassword: "WrongPass123", newPassword: "NextPass123" },
    dependencies,
  )
  assert.equal(incorrectCurrentPassword.status, 401)
  assert.match(incorrectCurrentPassword.body.error, /incorrect/i)

  const correctCurrentPassword = await patchStudentPassword(
    { currentPassword: "CurrentPass123", newPassword: "NextPass123" },
    dependencies,
  )
  assert.equal(correctCurrentPassword.status, 200)
  assert.deepEqual(correctCurrentPassword.body, { hasPortalPassword: true })
})

test("teachers can change their portal password after verifying the current password", async () => {
  let savedPassword
  const result = await patchStudentPassword(
    { currentPassword: "CurrentPass123", newPassword: "NextPass123" },
    {
      role: "teacher",
      hasPortalPassword: true,
      findActiveEnrollment: async () => ({
        id: "15",
        password_hash: "teacher-hash",
      }),
      comparePassword: async (password, hash) =>
        password === "CurrentPass123" && hash === "teacher-hash",
      hashPassword: async () => "next-hash",
      setMemberPassword: async (...args) => {
        savedPassword = args
        return true
      },
    },
  )

  assert.equal(result.status, 200)
  assert.deepEqual(savedPassword, ["42", "15", "teacher", "next-hash"])
})
