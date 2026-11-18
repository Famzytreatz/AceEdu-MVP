
export async function getRegistrationDocuments(formId) {
  const response = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/documents`,
    { credentials: "same-origin" },
  )
  return readJson(response)
}

export async function createRegistrationDocumentUpload(formId, file) {
  const reservation = await postJson(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/documents`,
    { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
  )

  const uploadResponse = await fetch(reservation.upload.signedUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    let message = "The document upload failed. Please try again."
    try {
      const result = await uploadResponse.json()
      message = result.message || result.error || message
    } catch {
      // Keep the safe fallback message for non-JSON storage errors.
    }
    throw new Error(message)
  }

  const completeResponse = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/documents/${encodeURIComponent(reservation.document.id)}/complete`,
    { method: "POST", credentials: "same-origin" },
  )
  return readJson(completeResponse)
}

export async function getRegistrationDocumentDownload(formId, documentId) {
  const response = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/documents/${encodeURIComponent(documentId)}/download`,
    { credentials: "same-origin" },
  )
  return readJson(response)
}

export async function deleteRegistrationDocument(formId, documentId) {
  const response = await fetch(
    `/api/admin/registration/forms/${encodeURIComponent(formId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE", credentials: "same-origin" },
  )
  return readJson(response)
}

