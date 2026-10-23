import assert from "node:assert/strict"

import test from "node:test"

import { getCurrentSchool, getEnrollments } from "./api.js"

test("registry searches preserve role and status filters in the authenticated request", async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl
  let requestedCredentials

  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url, "http://localhost")
    requestedCredentials = options.credentials
    return Response.json({ items: [], nextCursor: null })
  }

  try {
    const result = await getEnrollments({
      query: "Ada Lovelace",
      role: "student",
      status: "Active",
    })

    assert.deepEqual(result, { items: [], nextCursor: null })
    assert.equal(requestedUrl.pathname, "/api/admin/users")
    assert.equal(requestedUrl.searchParams.get("q"), "Ada Lovelace")
    assert.equal(requestedUrl.searchParams.get("role"), "student")
    assert.equal(requestedUrl.searchParams.get("status"), "Active")
    assert.equal(requestedCredentials, "same-origin")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("concurrent session checks share one request and allow later retries", async () => {
  const originalFetch = globalThis.fetch

  let requestCount = 0

  globalThis.fetch = async () => {
    requestCount += 1

    await new Promise((resolve) => setTimeout(resolve, 10))

    return new Response(null, { status: 401 })
  }

  try {
    const results = await Promise.all([getCurrentSchool(), getCurrentSchool()])

    assert.deepEqual(results, [null, null])

    assert.equal(requestCount, 1)

    await getCurrentSchool()

    assert.equal(requestCount, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a failed session check surfaces the error and releases the in-flight request", async () => {
  const originalFetch = globalThis.fetch

  let requestCount = 0

  globalThis.fetch = async () => {
    requestCount += 1

    if (requestCount === 1) throw new TypeError("Network unavailable")

    return new Response(null, { status: 401 })
  }

  try {
    await assert.rejects(getCurrentSchool(), /Network unavailable/)

    assert.equal(await getCurrentSchool(), null)

    assert.equal(requestCount, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})
