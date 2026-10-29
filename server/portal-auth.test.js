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
})
