import { randomUUID } from "node:crypto"

import { supabase } from "../supabase.js"
import { config } from "../config.js"

const BUCKET = "aceedu-registration-documents"
const MAX_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])
const columns =
  "id,school_id,form_id,storage_path,original_filename,mime_type,file_size_bytes,upload_status,analysis_status,uploaded_at,expires_at,created_at,updated_at"

function throwIfError(error) {
  if (error) throw error
}

function mapDocument(row) {
  return {
    id: String(row.id),
    formId: String(row.form_id),
    fileName: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.file_size_bytes || 0),
    uploadStatus: row.upload_status,
    analysisStatus: row.analysis_status,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
  }
}

function safeFileName(value) {
  return String(value || "registration-document")
    .normalize("NFKC")
    .replace(/[\/\\\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255) || "registration-document"
}

function signedUrlAbsolute(value) {
  if (/^https?:\/\//i.test(value)) return value
  return `${config.supabaseUrl.replace(/\/$/, "")}/storage/v1${value.startsWith("/") ? "" : "/"}${value}`
}

function matchesFileSignature(mimeType, bytes) {
  if (mimeType === "application/pdf") {
    const header = Buffer.from(bytes.subarray(0, 1024)).toString("latin1")
    return header.includes("%PDF-")
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
  }
  return false
}

async function findForm(schoolId, formId) {
  const { data, error } = await supabase
    .from("school_registration_forms")
    .select("id,is_active")
    .eq("school_id", schoolId)
    .eq("id", formId)
    .maybeSingle()
  throwIfError(error)
  return data
}

async function findDocument(schoolId, formId, documentId) {
  const { data, error } = await supabase
    .from("school_registration_documents")
    .select(columns)
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .eq("id", documentId)
    .neq("upload_status", "deleted")
    .maybeSingle()
  throwIfError(error)
  return data
}

export async function listRegistrationDocuments(schoolId, formId) {
  const { data, error } = await supabase
    .from("school_registration_documents")
    .select(columns)
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .neq("upload_status", "deleted")
    .order("created_at", { ascending: false })
  throwIfError(error)
  return (data || []).map(mapDocument)
}

export async function createRegistrationDocumentUpload({
  schoolId,
  formId,
  fileName,
  mimeType,
  sizeBytes,
}) {
  const form = await findForm(schoolId, formId)
  if (!form || !form.is_active) {
    const error = new Error("Registration form not found or inactive.")
    error.code = "P0002"
    throw error
  }

  const extension = ALLOWED_TYPES.get(mimeType)
  if (!extension) {
    const error = new Error("Choose a PDF, JPG, PNG or WebP document.")
    error.code = "22023"
    throw error
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
    const error = new Error("Each document must be larger than 0 bytes and no more than 15 MB.")
    error.code = "22023"
    throw error
  }

  const cleanName = safeFileName(fileName)
  const storagePath = `${schoolId}/${formId}/${randomUUID()}.${extension}`

  const { data: row, error: insertError } = await supabase
    .from("school_registration_documents")
    .insert({
      school_id: schoolId,
      form_id: formId,
      storage_path: storagePath,
      original_filename: cleanName,
      mime_type: mimeType,
      file_size_bytes: sizeBytes,
      upload_status: "pending",
      analysis_status: "not_started",
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select(columns)
    .single()
  throwIfError(insertError)

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (signedError || !signed?.signedUrl) {
    await supabase
      .from("school_registration_documents")
      .update({ upload_status: "failed", updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("id", row.id)
    throw signedError || new Error("Could not create a secure upload link.")
  }

  return {
    document: mapDocument(row),
    upload: {
      signedUrl: signedUrlAbsolute(signed.signedUrl),
      token: signed.token,
      path: storagePath,
    },
  }
}

export async function completeRegistrationDocumentUpload(schoolId, formId, documentId) {
  const row = await findDocument(schoolId, formId, documentId)
  if (!row) return null
  if (row.upload_status === "uploaded") return mapDocument(row)
  if (row.upload_status !== "pending" || Date.parse(row.expires_at) <= Date.now()) {
    const error = new Error("This upload reservation has expired. Please upload the document again.")
    error.code = "22023"
    throw error
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path)
  if (downloadError || !file) {
    const error = new Error("The uploaded file could not be found. Please try uploading it again.")
    error.code = "P0002"
    throw error
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length !== Number(row.file_size_bytes) || bytes.length > MAX_FILE_BYTES) {
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    await supabase
      .from("school_registration_documents")
      .update({ upload_status: "failed", updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("id", documentId)
    const error = new Error("The uploaded file size did not match the selected file. Please try again.")
    error.code = "22023"
    throw error
  }

  if (!matchesFileSignature(row.mime_type, bytes)) {
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    await supabase
      .from("school_registration_documents")
      .update({ upload_status: "failed", updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("id", documentId)
    const error = new Error("The file contents do not match the selected document type.")
    error.code = "22023"
    throw error
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from("school_registration_documents")
    .update({
      upload_status: "uploaded",
      uploaded_at: now,
      updated_at: now,
    })
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .eq("id", documentId)
    .eq("upload_status", "pending")
    .select(columns)
    .maybeSingle()
  throwIfError(updateError)
  return updated ? mapDocument(updated) : null
}

export async function createRegistrationDocumentDownload(schoolId, formId, documentId) {
  const row = await findDocument(schoolId, formId, documentId)
  if (!row || row.upload_status !== "uploaded") return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60, { download: row.original_filename })
  throwIfError(error)
  return { url: data.signedUrl, fileName: row.original_filename }
}

export async function deleteRegistrationDocument(schoolId, formId, documentId) {
  const row = await findDocument(schoolId, formId, documentId)
  if (!row) return false

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.storage_path])
  if (storageError && !/not found|does not exist/i.test(storageError.message || "")) {
    throw storageError
  }

  const { error: updateError } = await supabase
    .from("school_registration_documents")
    .update({
      upload_status: "deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .eq("id", documentId)
  throwIfError(updateError)
  return true
}
