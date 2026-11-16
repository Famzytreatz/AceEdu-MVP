import assert from "node:assert/strict"
import test from "node:test"
import {
  createRegistrationForm,
  getRegistrationForm,
  getRegistrationForms,
  publishRegistrationForm,
  saveRegistrationFormDraft,
} from "./api.js"

const originalFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test("registration form list uses the authenticated admin endpoint", async () => {
  let requestedUrl
  let requestedCredentials
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url, "http://localhost")
    requestedCredentials = options.credentials
    return Response.json({ forms: [], defaultFormId: null })
  }

  assert.deepEqual(await getRegistrationForms(), { forms: [], defaultFormId: null })
  assert.equal(requestedUrl.pathname, "/api/admin/registration/forms")
  assert.equal(requestedCredentials, "same-origin")
})

test("registration form detail safely encodes its form identifier", async () => {
  let requestedUrl
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url, "http://localhost")
    assert.equal(options.credentials, "same-origin")
    return Response.json({ form: { id: "7" } })
  }

  assert.deepEqual(await getRegistrationForm("7"), { form: { id: "7" } })
  assert.equal(requestedUrl.pathname, "/api/admin/registration/forms/7")
})

test("creating a registration form posts the supplied configuration", async () => {
  let requestBody
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/registration/forms")
    assert.equal(options.method, "POST")
    requestBody = JSON.parse(options.body)
    return Response.json({ form: { id: "8" } }, { status: 201 })
  }

  const values = { formName: "Junior Admission", formKey: "junior-admission" }
  assert.deepEqual(await createRegistrationForm(values), { form: { id: "8" } })
  assert.deepEqual(requestBody, values)
})

test("saving a registration form draft uses PUT", async () => {
  let requestBody
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/registration/forms/8/draft")
    assert.equal(options.method, "PUT")
    requestBody = JSON.parse(options.body)
    return Response.json({ form: { id: "8", draftVersion: { id: "9" } } })
  }

  const values = { formDefinition: { schemaVersion: 1, sections: [], fields: [] } }
  const result = await saveRegistrationFormDraft("8", values)
  assert.equal(result.form.draftVersion.id, "9")
  assert.deepEqual(requestBody, values)
})

test("publishing a registration form draft posts the selected version", async () => {
  let requestBody
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/registration/forms/8/publish")
    assert.equal(options.method, "POST")
    requestBody = JSON.parse(options.body)
    return Response.json({ form: { id: "8", publishedVersion: { id: "9" } } })
  }

  const result = await publishRegistrationForm("8", "9")
  assert.equal(result.form.publishedVersion.id, "9")
  assert.deepEqual(requestBody, { versionId: "9" })
})
