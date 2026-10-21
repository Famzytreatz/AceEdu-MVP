import assert from "node:assert/strict"
import test from "node:test"
import { config } from "./config.js"
import { requireAllowedOrigin } from "./security.js"

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
