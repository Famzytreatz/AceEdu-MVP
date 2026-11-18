$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$routePath = Join-Path $root "server/routes/registration.js"
$modelPath = Join-Path $root "server/models/RegistrationDocuments.js"
$apiPath = Join-Path $root "src/data/api.js"

if (!(Test-Path $routePath) -or !(Test-Path $apiPath)) {
  throw "Run this script from the AceEdu-MVP repository root."
}

$route = Get-Content $routePath -Raw
$api = Get-Content $apiPath -Raw

if ($route.Contains("RegistrationDocuments.js") -or $route.Contains('"/forms/:formId/documents"')) {
  throw "Registration document routes appear to be installed already. No files were changed."
}
if ($api.Contains("getRegistrationDocuments(formId)")) {
  throw "Registration document API helpers appear to be installed already. No files were changed."
}

New-Item -ItemType Directory -Force -Path (Split-Path $modelPath) | Out-Null

$importAnchor = 'import { isValidDatabaseId } from "../ids.js"'
$importBlock = @'
import {
  listRegistrationDocuments,
  createRegistrationDocumentUpload,
  completeRegistrationDocumentUpload,
  createRegistrationDocumentDownload,
  deleteRegistrationDocument,
} from "../models/RegistrationDocuments.js"
'@
if (!$route.Contains($importAnchor)) { throw "Could not find registration route import anchor." }
$route = $route.Replace($importAnchor, "$importAnchor`r`n$importBlock")

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
if (!$route.Contains($serviceAnchor)) { throw "Could not find registration service anchor." }
$route = $route.Replace($serviceAnchor, $serviceReplacement)

$routeSnippet = Get-Content (Join-Path $PSScriptRoot "server/routes/registration-documents-routes.snippet.js") -Raw
$returnAnchor = "  return router`r`n}"
if (!$route.Contains($returnAnchor)) {
  $returnAnchor = "  return router`n}"
}
if (!$route.Contains($returnAnchor)) { throw "Could not find registration router insertion point." }
$route = $route.Replace($returnAnchor, "$routeSnippet`r`n$returnAnchor")

$apiSnippet = Get-Content (Join-Path $PSScriptRoot "src/data/registration-documents-api.snippet.js") -Raw
Set-Content -Path $routePath -Value $route -Encoding utf8
Set-Content -Path $apiPath -Value ($api.TrimEnd() + "`r`n`r`n" + $apiSnippet) -Encoding utf8

Write-Host "Registration document backend installed." -ForegroundColor Green
Write-Host "Next run: npm run test:server"
Write-Host "Then run: npm run build"
