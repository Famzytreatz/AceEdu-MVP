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

const inFlightGetRequests = new Map()

function getOnce(path, request) {
  if (!inFlightGetRequests.has(path)) {
    const pending = Promise.resolve()
      .then(request)
      .finally(() => inFlightGetRequests.delete(path))
    inFlightGetRequests.set(path, pending)
  }
  return inFlightGetRequests.get(path)
}

export function getCurrentSchool() {
  return getOnce("/api/auth/me", async () => {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" })
    if (response.status === 401) return null
    const result = await readJson(response)
    return result.school
  })
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

export function getDashboard() {
  const path = "/api/admin/dashboard"
  return getOnce(path, async () => {
    const response = await fetch(path, { credentials: "same-origin" })
    return readJson(response)
  })
}

export function getSchoolEntitlement() {
  const path = "/api/admin/entitlements"
  return getOnce(path, async () => {
    const response = await fetch(path, { credentials: "same-origin" })
    return readJson(response)
  })
}

export function requestSchoolVerification(registrationId) {
  return postJson("/api/admin/entitlements/verification-requests", {
    registrationId,
  })
}

export async function getCurrentPlatformOperator() {
  const response = await fetch("/api/platform/me", { credentials: "same-origin" })
  if (response.status === 401) return null
  const result = await readJson(response)
  return result.operator
}

export async function loginPlatformOperator({ email, password }) {
  const result = await postJson("/api/platform/login", { email, password })
  return result.operator
}

export async function logoutPlatformOperator() {
  const response = await fetch("/api/platform/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  await readJson(response)
}

export async function getVerificationRequests() {
  const response = await fetch("/api/platform/verification-requests", {
    credentials: "same-origin",
  })
  return readJson(response)
}

export function approveSchoolVerificationRequest(requestId) {
  return postJson(
    `/api/platform/verification-requests/${encodeURIComponent(requestId)}/approve`,
    {},
  )
}

export function rejectSchoolVerificationRequest(requestId, reason) {
  return postJson(
    `/api/platform/verification-requests/${encodeURIComponent(requestId)}/reject`,
    { reason },
  )
}

export function getEnrollments({
  query = "",
  cursor = null,
  role = "",
  status = "",
} = {}) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (cursor) params.set("cursor", cursor)
  if (role) params.set("role", role)
  if (status) params.set("status", status)
  const path = `/api/admin/users${params.size ? `?${params.toString()}` : ""}`
  return getOnce(path, async () => {
    const response = await fetch(path, { credentials: "same-origin" })
    return readJson(response)
  })
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
