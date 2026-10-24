import assert from "node:assert/strict"
import test from "node:test"

import { config } from "./config.js"
import { logError } from "./error-logging.js"

test("request error logging preserves safe context and redacts secrets", () => {
  const lines = []
  const originalError = console.error
  console.error = (...values) => lines.push(values)

  try {
    const error = new Error(
      `failed with ${config.supabaseServiceRoleKey} and Cookie: session-value, Authorization: Bearer access-token`,
      { cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" }) },
    )
    logError("AceEdu API request failed:", error, {
      method: "GET",
      path: "/api/auth/me",
    })
  } finally {
    console.error = originalError
  }

  assert.equal(lines.length, 1)
  const [context, request, details] = lines[0]
  assert.equal(context, "AceEdu API request failed:")
  assert.deepEqual(request, { method: "GET", path: "/api/auth/me" })
  assert.equal(details.name, "Error")
  assert.equal(details.cause.code, "ECONNRESET")
  assert.match(details.message, /\[REDACTED\]/)
  assert.equal(details.message.includes(config.supabaseServiceRoleKey), false)
  assert.doesNotMatch(details.message, /session-value/)
  assert.doesNotMatch(details.message, /access-token/)
})
