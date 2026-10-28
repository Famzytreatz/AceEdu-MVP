import assert from "node:assert/strict"
import test from "node:test"

import {
  generateSchoolSlug,
  publicSchoolBranding,
  schoolSlugMatches,
  validateSchoolPublicId,
  validateSchoolSlug,
} from "./school-slugs.js"

const publicSchoolId = "80415273906182740519362847051936"

test("school slugs normalize names and use the opaque public school ID", () => {
  assert.equal(
    generateSchoolSlug("Bright Future Academy", publicSchoolId),
    `bright-future-academy-${publicSchoolId}`,
  )
  assert.equal(
    generateSchoolSlug("École Example", "70000000000000000000000000000007"),
    "cole-example-70000000000000000000000000000007",
  )
  assert.equal(generateSchoolSlug("!!!", publicSchoolId), `school-${publicSchoolId}`)
})

test("school slug suffixes remain unique for duplicate school names", () => {
  assert.notEqual(
    generateSchoolSlug("Royal Crest School", "10000000000000000000000000000011"),
    generateSchoolSlug("Royal Crest School", "20000000000000000000000000000012"),
  )
})

test("school slug generation respects the address length limit", () => {
  const slug = generateSchoolSlug("a".repeat(160), publicSchoolId)
  assert.equal(slug.length, 63)
  assert.equal(validateSchoolSlug(slug), slug)
})

test("school slug validation rejects reserved, malformed, and oversized addresses", () => {
  for (const slug of ["www", "api", "admin", "platform", "login", "register", "settings"]) {
    assert.throws(() => validateSchoolSlug(slug), /address is invalid/)
  }
  for (const slug of ["", "ab", "-school", "school-", "two words", "a".repeat(64)]) {
    assert.throws(() => validateSchoolSlug(slug), /address is invalid/)
  }
})

test("slug generation rejects missing names and malformed public school IDs", () => {
  assert.throws(() => generateSchoolSlug("", 1), /school name is required/)
  for (const id of ["4", "1".repeat(31), "1".repeat(33), "a".repeat(32)]) {
    assert.throws(() => validateSchoolPublicId(id), /school ID is invalid/)
    assert.throws(() => generateSchoolSlug("Example", id), /school ID is invalid/)
  }
})

test("public branding contains no private school or administrator fields", () => {
  assert.deepEqual(
    publicSchoolBranding({
      _id: "42",
      schoolName: "Example School",
      slug: "example-school-80415273906182740519362847051936",
      publicId: publicSchoolId,
      logoUrl: "https://cdn.example/logo.png",
      adminEmail: "private@example.com",
      passwordHash: "must-not-leak",
    }),
    {
      id: publicSchoolId,
      schoolName: "Example School",
      slug: "example-school-80415273906182740519362847051936",
      logoUrl: "https://cdn.example/logo.png",
    },
  )
})

test("school login context must match the resolved school's slug", () => {
  const school = { slug: "bright-future-42" }
  assert.equal(schoolSlugMatches(school, "bright-future-42"), true)
  assert.equal(schoolSlugMatches(school, "royal-crest-14"), false)
  assert.equal(schoolSlugMatches(school, undefined), true)
})
