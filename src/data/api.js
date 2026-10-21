async function readJson(response) {
  let result
  try {
    result = response.status === 204 ? null : await response.json()
  } catch {
    if (!response.ok) {
      throw new Error(`Account service request failed (HTTP ${response.status}).`)
    }
    throw new Error("The server returned an unreadable response.")
  }

  if (!response.ok) {
    throw new Error(result?.error || "The request could not be completed.")
  }
  return result
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return readJson(response)
}

export async function getCurrentSchool() {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" })
  if (response.status === 401) return null
  const result = await readJson(response)
  return result.school
}

export async function registerSchool(values) {
  const {
    schoolName,
    schoolType,
    country,
    state,
    city,
    address,
    schoolEmail,
    schoolPhone,
    adminName,
    adminEmail,
    adminPhone,
    adminRole,
    password,
    confirmPassword,
    acceptTerms,
  } = values
  const result = await postJson("/api/auth/register", {
    schoolName,
    schoolType,
    country,
    state,
    city,
    address,
    schoolEmail,
    schoolPhone,
    adminName,
    adminEmail,
    adminPhone,
    adminRole,
    password,
    confirmPassword,
    acceptTerms,
  })
  return result.school
}

export async function loginSchool({ email, password }) {
  const result = await postJson("/api/auth/login", { email, password })
  return result.school
}

export async function logoutSchool() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  await readJson(response)
}

export async function getDashboard() {
  const response = await fetch("/api/admin/dashboard", { credentials: "same-origin" })
  return readJson(response)
}

export async function getEnrollments({ query = "", cursor = null } = {}) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (cursor) params.set("cursor", cursor)
  const suffix = params.size ? `?${params.toString()}` : ""
  const response = await fetch(`/api/admin/users${suffix}`, { credentials: "same-origin" })
  return readJson(response)
}

export async function createEnrollment(values) {
  return postJson("/api/admin/users", values)
}

export async function verifyEnrollment(id) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/verify`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  return readJson(response)
}

export async function deleteEnrollment(id) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  await readJson(response)
}

export async function downloadRegistry() {
  const response = await fetch("/api/admin/users/export.csv", {
    credentials: "same-origin",
  })
  if (!response.ok) {
    await readJson(response)
    return
  }
  const file = await response.blob()
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = "aceedu-school-registry.csv"
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
