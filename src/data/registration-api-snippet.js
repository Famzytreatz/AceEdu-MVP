// Add these functions to src/data/api.js near createEnrollment().
export function getRegistrationForms() {
  const path = "/api/admin/registration/forms"
  return getOnce(path, async () => {
    const response = await fetch(path, { credentials: "same-origin" })
    return readJson(response)
  })
}

export async function getRegistrationForm(formId) {
  const response = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}`,
    { credentials: "same-origin" },
  )
  return readJson(response)
}

export function createRegistrationForm(values) {
  return postJson("/api/admin/registration/forms", values)
}

export async function saveRegistrationFormDraft(formId, values) {
  const response = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/draft`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    },
  )
  return readJson(response)
}

export function publishRegistrationForm(formId, versionId) {
  return postJson(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/publish`,
    { versionId },
  )
}
