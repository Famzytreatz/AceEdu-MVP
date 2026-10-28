import assert from "node:assert/strict"
import { createServer } from "node:http"
import test from "node:test"
import express from "express"

import { createSchoolsRouter } from "./schools.js"

test("school resolver returns only public branding, rejects reserved slugs, and reports unknown slugs", async () => {
  const schools = new Map([
    ["bright-future-80415273906182740519362847051936", {
      schoolName: "Bright Future Academy",
      slug: "bright-future-80415273906182740519362847051936",
      publicId: "80415273906182740519362847051936",
      logoUrl: "https://cdn.example/logo.png",
      adminEmail: "private@example.com",
    }],
  ])
  const app = express()
  app.use("/api/schools", createSchoolsRouter(async (slug) => schools.get(slug) ?? null))
  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/schools`

    const found = await fetch(`${baseUrl}/bright-future-80415273906182740519362847051936`)
    assert.equal(found.status, 200)
    assert.deepEqual(await found.json(), {
      school: {
        id: "80415273906182740519362847051936",
        schoolName: "Bright Future Academy",
        slug: "bright-future-80415273906182740519362847051936",
        logoUrl: "https://cdn.example/logo.png",
      },
    })

    const unknown = await fetch(`${baseUrl}/unknown-school-9`)
    assert.equal(unknown.status, 404)
    assert.deepEqual(await unknown.json(), { error: "School space not found." })

    const reserved = await fetch(`${baseUrl}/platform`)
    assert.equal(reserved.status, 400)
    assert.deepEqual(await reserved.json(), { error: "The school space address is invalid." })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
