import { createHash } from "node:crypto"

const reservedSlugs = new Set([
  "admin",
  "api",
  "login",
  "platform",
  "register",
  "settings",
  "www",
])

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateSchoolSlug(value) {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 63 ||
    !slugPattern.test(value) ||
    reservedSlugs.has(value)
  ) {
    throw new Error("The school space address is invalid.")
  }

  return value
}

export function validateSchoolPublicId(value) {
  if (typeof value !== "string" || !/^\d{32}$/.test(value)) {
    throw new Error("The school ID is invalid.")
  }

  return value
}

export function generateSchoolSlug(schoolName, publicSchoolId) {
  if (typeof schoolName !== "string" || !schoolName.trim()) {
    throw new Error("A school name is required to generate its address.")
  }
  const schoolId = validateSchoolPublicId(publicSchoolId)

  const base = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "school"
  const suffix = `-${createHash("md5").update(schoolId).digest("hex").slice(0, 16)}`
  const slug = `${base.slice(0, 63 - suffix.length)}${suffix}`

  return validateSchoolSlug(slug)
}

export function publicSchoolBranding(school) {
  return {
    id: school.publicId,
    schoolName: school.schoolName,
    slug: school.slug,
    logoUrl: school.logoUrl || null,
  }
}

export function schoolSlugMatches(school, slug) {
  return !slug || school.slug === slug
}
