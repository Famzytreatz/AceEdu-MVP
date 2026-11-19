
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$routePath = Join-Path $root "server/routes/registration.js"
$modelPath = Join-Path $root "server/models/RegistrationDocuments.js"
$apiPath = Join-Path $root "src/data/api.js"

foreach ($path in @($routePath, $modelPath, $apiPath)) {
  if (!(Test-Path $path)) {
    throw "Required file not found: $path. Run this script from the AceEdu-MVP root."
  }
}

$route = Get-Content $routePath -Raw
$api = Get-Content $apiPath -Raw

if ($route.Contains("listRegistrationDocuments")) {
  Write-Host "Registration document routes already appear to be installed." -ForegroundColor Yellow
} else {
  $importAnchor = 'import { isValidDatabaseId } from "../ids.js"'
  if (!$route.Contains($importAnchor)) {
    throw "Could not find the registration route import anchor."
  }

  $imports = @'
import {
  listRegistrationDocuments,
  createRegistrationDocumentUpload,
  completeRegistrationDocumentUpload,
  createRegistrationDocumentDownload,
  deleteRegistrationDocument,
} from "../models/RegistrationDocuments.js"
'@

  $route = $route.Replace($importAnchor, "$imports`r`n$importAnchor")

  $serviceAnchor = @'
    saveRegistrationFormDraft,
    ...services,
'@
  $serviceReplacement = @'
    saveRegistrationFormDraft,
    listRegistrationDocuments,
    createRegistrationDocumentUpload,
    completeRegistrationDocumentUpload,
    createRegistrationDocumentDownload,
    deleteRegistrationDocument,
    ...services,
'@

  if (!$route.Contains($serviceAnchor)) {
    throw "Could not find the registration service insertion point."
  }
  $route = $route.Replace($serviceAnchor, $serviceReplacement)

  $routeBlock = @'
  router.get(
    "/forms/:formId/documents",
    asyncRoute(async (req, res) => {
      if (!isValidDatabaseId(req.params.formId)) {
        return res.status(400).json({ error: "The registration form ID is invalid." })
      }
      const documents = await service.listRegistrationDocuments(
        req.session.schoolId,
        req.params.formId,
      )
      return res.json({ documents })
    }),
  )

  router.post(
    "/forms/:formId/documents",
    asyncRoute(async (req, res) => {
      if (!isValidDatabaseId(req.params.formId)) {
        return res.status(400).json({ error: "The registration form ID is invalid." })
      }
      const body = req.body
      const allowedKeys = ["fileName", "mimeType", "sizeBytes"]
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !allowedKeys.includes(key)) ||
        typeof body.fileName !== "string" ||
        typeof body.mimeType !== "string" ||
        !Number.isSafeInteger(body.sizeBytes)
      ) {
        return res.status(400).json({ error: "Provide a valid file name, document type and file size." })
      }
      try {
        const result = await service.createRegistrationDocumentUpload({
          schoolId: req.session.schoolId,
          formId: req.params.formId,
          ...body,
        })
        return res.status(201).json(result)
      } catch (error) {
        const response = expectedError(res, error)
        if (response) return response
        throw error
      }
    }),
  )

  router.post(
    "/forms/:formId/documents/:documentId/complete",
    asyncRoute(async (req, res) => {
      if (
        !isValidDatabaseId(req.params.formId) ||
        !isValidDatabaseId(req.params.documentId)
      ) {
        return res.status(400).json({ error: "The registration form or document ID is invalid." })
      }
      try {
        const document = await service.completeRegistrationDocumentUpload(
          req.session.schoolId,
          req.params.formId,
          req.params.documentId,
        )
        if (!document) return res.status(404).json({ error: "Registration document not found." })
        return res.json({ document })
      } catch (error) {
        const response = expectedError(res, error)
        if (response) return response
        throw error
      }
    }),
  )

  router.get(
    "/forms/:formId/documents/:documentId/download",
    asyncRoute(async (req, res) => {
      if (
        !isValidDatabaseId(req.params.formId) ||
        !isValidDatabaseId(req.params.documentId)
      ) {
        return res.status(400).json({ error: "The registration form or document ID is invalid." })
      }
      const download = await service.createRegistrationDocumentDownload(
        req.session.schoolId,
        req.params.formId,
        req.params.documentId,
      )
      if (!download) return res.status(404).json({ error: "Uploaded registration document not found." })
      return res.json(download)
    }),
  )

  router.delete(
    "/forms/:formId/documents/:documentId",
    asyncRoute(async (req, res) => {
      if (
        !isValidDatabaseId(req.params.formId) ||
        !isValidDatabaseId(req.params.documentId)
      ) {
        return res.status(400).json({ error: "The registration form or document ID is invalid." })
      }
      const deleted = await service.deleteRegistrationDocument(
        req.session.schoolId,
        req.params.formId,
        req.params.documentId,
      )
      if (!deleted) return res.status(404).json({ error: "Registration document not found." })
      return res.json({ deleted: true })
    }),
  )

'@

  $returnAnchor = "  return router"
  if (!$route.Contains($returnAnchor)) {
    throw "Could not find the registration router return point."
  }

  $route = $route.Replace($returnAnchor, "$routeBlock`r`n$returnAnchor")
  Set-Content -Path $routePath -Value $route -Encoding utf8
  Write-Host "Registration document routes installed." -ForegroundColor Green
}

if ($api.Contains("getRegistrationDocuments(formId)")) {
  Write-Host "Registration document API helpers already appear to be installed." -ForegroundColor Yellow
} else {
  $apiBlock = @'

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
'@

  Set-Content -Path $apiPath -Value ($api.TrimEnd() + "`r`n" + $apiBlock + "`r`n") -Encoding utf8
  Write-Host "Registration document API helpers installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "Registration upload integration applied." -ForegroundColor Green
Write-Host "Next: npm run test:server"
Write-Host "Then: npm run build"
