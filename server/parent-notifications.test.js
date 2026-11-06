import test from "node:test"
import assert from "node:assert/strict"

import { sendParentSetupSms } from "./parent-notifications.js"

const setupMessage = {
  phone: "+2348012345678",
  parentName: "Ada Guardian",
  schoolName: "Bright Future School",
  schoolSlug: "bright-future",
  setupCode: "unique-one-time-code",
}

test("parent setup SMS is explicitly unavailable without Termii configuration", async () => {
  const result = await sendParentSetupSms(setupMessage, {
    apiKey: "",
    senderId: "",
    fetchImpl: async () => assert.fail("SMS provider must not be called."),
  })

  assert.deepEqual(result, { delivered: false, reason: "not_configured" })
})

test("parent setup SMS sends a school portal link and a phone without plus prefix", async () => {
  let request
  const result = await sendParentSetupSms(setupMessage, {
    apiKey: "test-key",
    senderId: "AceEdu",
    appOrigin: "https://aceedu.example",
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { ok: true }
    },
  })

  assert.deepEqual(result, { delivered: true })
  assert.equal(request.url, "https://api.ng.termii.com/api/sms/send")
  const body = JSON.parse(request.options.body)
  assert.equal(body.to, "2348012345678")
  assert.equal(body.from, "AceEdu")
  assert.match(body.sms, /https:\/\/aceedu\.example\/s\/bright-future\/portal/)
  assert.match(body.sms, /unique-one-time-code/)
})

test("parent setup SMS reports provider failures without exposing provider details", async () => {
  await assert.rejects(
    sendParentSetupSms(setupMessage, {
      apiKey: "test-key",
      senderId: "AceEdu",
      fetchImpl: async () => {
        throw new Error("provider internals")
      },
    }),
    { message: "The parent setup SMS could not be sent." },
  )

  await assert.rejects(
    sendParentSetupSms(setupMessage, {
      apiKey: "test-key",
      senderId: "AceEdu",
      fetchImpl: async () => ({ ok: false }),
    }),
    { message: "The parent setup SMS could not be sent." },
  )
})
