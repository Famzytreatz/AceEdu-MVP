$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AdminPath = Join-Path $ProjectRoot "server/routes/admin.js"
$ApiPath = Join-Path $ProjectRoot "src/data/api.js"
$SnippetPath = Join-Path $ProjectRoot "src/data/registration-api-snippet.js"

foreach ($Path in @($AdminPath, $ApiPath, $SnippetPath)) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required file not found: $Path. Extract this bundle into the AceEdu-MVP project root."
  }
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$Admin = [System.IO.File]::ReadAllText($AdminPath)
$ImportAnchor = 'import communicationsRouter from "./communications.js"'
$ImportLine = 'import registrationRouter from "./registration.js"'
if (-not $Admin.Contains($ImportLine)) {
  if (-not $Admin.Contains($ImportAnchor)) {
    throw "Could not find the communications router import in server/routes/admin.js. No changes were written to that file."
  }
  $Admin = $Admin.Replace($ImportAnchor, $ImportAnchor + [Environment]::NewLine + $ImportLine)
}

$MountAnchor = 'router.use("/communications", communicationsRouter)'
$MountLine = 'router.use("/registration", registrationRouter)'
if (-not $Admin.Contains($MountLine)) {
  if (-not $Admin.Contains($MountAnchor)) {
    throw "Could not find the communications router mount in server/routes/admin.js. No changes were written to that file."
  }
  $Admin = $Admin.Replace($MountAnchor, $MountAnchor + [Environment]::NewLine + $MountLine)
}

[System.IO.File]::WriteAllText($AdminPath, $Admin, $Utf8NoBom)

$Api = [System.IO.File]::ReadAllText($ApiPath)
if (-not $Api.Contains("export function getRegistrationForms()")) {
  $ApiAnchor = @'
export async function createEnrollment(values) {
  return postJson("/api/admin/users", values)
}
'@
  if (-not $Api.Contains($ApiAnchor)) {
    throw "Could not find the createEnrollment() insertion point in src/data/api.js. The admin route file has been patched; add the API snippet manually using PATCH-INSTRUCTIONS.md."
  }
  $Snippet = [System.IO.File]::ReadAllText($SnippetPath)
  $Snippet = $Snippet -replace '^// Add these functions to src/data/api\.js near createEnrollment\(\)\.\r?\n', ''
  $Api = $Api.Replace($ApiAnchor, $ApiAnchor + [Environment]::NewLine + $Snippet.Trim() + [Environment]::NewLine)
  [System.IO.File]::WriteAllText($ApiPath, $Api, $Utf8NoBom)
}

Write-Host "Registration backend routes and API helpers were added." -ForegroundColor Green
Write-Host "Next: run node --test server/registration-validation.test.js and node --test src/data/registration-api.test.js"
