$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashboardPath = Join-Path $ProjectRoot "src/pages/AdminDashboard.jsx"
$WorkspacePath = Join-Path $ProjectRoot "src/pages/RegistrationWorkspace.jsx"
$WorkspaceCssPath = Join-Path $ProjectRoot "src/pages/RegistrationWorkspace.css"

foreach ($Path in @($DashboardPath, $WorkspacePath, $WorkspaceCssPath)) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required file not found: $Path. Extract the package into the AceEdu project root."
  }
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Dashboard = [System.IO.File]::ReadAllText($DashboardPath)
$Original = $Dashboard

$ImportAnchor = 'import SchoolSettings from "./SchoolSettings"'
$ImportLine = 'import RegistrationWorkspace from "./RegistrationWorkspace"'
if (-not $Dashboard.Contains($ImportLine)) {
  if (-not $Dashboard.Contains($ImportAnchor)) {
    throw "Could not find the SchoolSettings import in AdminDashboard.jsx. No dashboard changes were written."
  }
  $Dashboard = $Dashboard.Replace($ImportAnchor, $ImportAnchor + [Environment]::NewLine + $ImportLine)
}

$NavigationAnchor = '{ id: "enrollment", label: "Add record", Icon: Plus },'
$NavigationLine = '{ id: "registrationSetup", label: "Registration setup", Icon: ClipboardList },'
if (-not $Dashboard.Contains($NavigationLine)) {
  if (-not $Dashboard.Contains($NavigationAnchor)) {
    throw "Could not find the Add record navigation entry. No dashboard changes were written."
  }
  $Dashboard = $Dashboard.Replace($NavigationAnchor, $NavigationAnchor + [Environment]::NewLine + '  ' + $NavigationLine)
}

$DescriptionAnchor = @'
                {activeView === "enrollment" &&
                  "Create and manage student and staff registry entries."}
'@
$DescriptionLine = @'
                {activeView === "registrationSetup" &&
                  "Configure, preview, save, and publish the student registration form used by your school."}
'@
if (-not $Dashboard.Contains($DescriptionLine)) {
  if (-not $Dashboard.Contains($DescriptionAnchor)) {
    throw "Could not find the enrollment page description. No dashboard changes were written."
  }
  $Dashboard = $Dashboard.Replace($DescriptionAnchor, $DescriptionAnchor + $DescriptionLine)
}

$HeaderListAnchor = @'
            {![
              "enrollment",
              "settings",
'@
$HeaderListReplacement = @'
            {![
              "enrollment",
              "registrationSetup",
              "settings",
'@
if (-not $Dashboard.Contains($HeaderListReplacement)) {
  if (-not $Dashboard.Contains($HeaderListAnchor)) {
    throw "Could not find the page-heading action exclusion list. No dashboard changes were written."
  }
  $Dashboard = $Dashboard.Replace($HeaderListAnchor, $HeaderListReplacement)
}

$RenderAnchor = @'
          {activeView === "settings" && (
'@
$RenderBlock = @'
          {activeView === "registrationSetup" && (
            <RegistrationWorkspace schoolName={school.schoolName} />
          )}
          {activeView === "settings" && (
'@
if (-not $Dashboard.Contains('<RegistrationWorkspace schoolName={school.schoolName} />')) {
  if (-not $Dashboard.Contains($RenderAnchor)) {
    throw "Could not find the settings workspace render position. No dashboard changes were written."
  }
  $Dashboard = $Dashboard.Replace($RenderAnchor, $RenderBlock)
}

if ($Dashboard -ne $Original) {
  $BackupPath = "$DashboardPath.registration-setup.bak"
  if (-not (Test-Path -LiteralPath $BackupPath)) {
    [System.IO.File]::WriteAllText($BackupPath, $Original, $Utf8NoBom)
  }
  [System.IO.File]::WriteAllText($DashboardPath, $Dashboard, $Utf8NoBom)
}

Write-Host "Registration Setup workspace connected to Admin Dashboard." -ForegroundColor Green
Write-Host "A one-time backup was saved beside AdminDashboard.jsx." -ForegroundColor DarkGray
Write-Host "Next: run npm run build and npm run test:server." -ForegroundColor Cyan
