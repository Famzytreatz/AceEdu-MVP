import { useCallback, useEffect, useRef, useState } from "react"

import {
  ArrowUpRight,
  Activity,
  ArrowDownToLine,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Eye,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Moon,
  Sun,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  UserRound,
  UserPlus,
  X,
} from "lucide-react"

import {
  createEnrollment,
  deleteEnrollment,
  downloadRegistry,
  getDashboard,
  getEnrollments,
  getSchoolCurriculum,
  getSchoolEntitlement,
  requestSchoolVerification,
  resetStudentPortalPassword,
  verifyEnrollment,
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"
import PremiumOperations from "./PremiumOperations"
import SchoolCurriculumSetup from "./SchoolCurriculumSetup"
import SchoolSettings from "./SchoolSettings"

import "./AdminDashboard.css"

const navigation = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "students", label: "Students", Icon: GraduationCap },
  { id: "staff", label: "Staff", Icon: Users },
  { id: "registry", label: "Registry", Icon: IdCard },
  { id: "enrollment", label: "Add record", Icon: Plus },
  { id: "classes", label: "Classes & subjects", Icon: BookOpen },
  { id: "settings", label: "Settings", Icon: Settings },
]

const premiumNavigation = [
  { id: "academicRecords", label: "Academic records", Icon: ClipboardList },
  { id: "attendance", label: "Attendance", Icon: CalendarDays },
  { id: "examinations", label: "Exams & results", Icon: ChartNoAxesCombined },
  { id: "financialManagement", label: "Financial management", Icon: CircleDollarSign },
  { id: "advancedReports", label: "Reports & analytics", Icon: ChartNoAxesCombined },
  { id: "parentPortal", label: "Parent portal", Icon: UserRound },
  { id: "studentPortal", label: "Student portal", Icon: GraduationCap },
  { id: "teacherPortal", label: "Teacher portal", Icon: Users },
]

const implementedPremiumViews = new Set([
  "academicRecords",
  "attendance",
  "studentPortal",
  "teacherPortal",
])

const emptyForm = {
  fullName: "",

  role: "student",

  designation: "",

  classLevelId: "",

  assignedClasses: "",

  subjects: "",

  passport: "",

  dob: "",

  guardianPhone: "",

  address: "",

  stateOfOrigin: "",

  phone: "",

  password: "",
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)

  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
}

function formatActivityDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date)
}

async function optimizePassport(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.")
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Passport images must be 5 MB or smaller.")
  }

  let bitmap

  try {
    bitmap = await createImageBitmap(file)

    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement("canvas")

    canvas.width = Math.max(1, Math.round(bitmap.width * scale))

    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.78),
    )

    if (!blob || blob.size > 750_000)
      throw new Error(
        "Could not optimize this passport image. Choose a smaller image.",
      )

    return await new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => resolve(reader.result)

      reader.onerror = () =>
        reject(new Error("Could not read this passport image."))

      reader.readAsDataURL(blob)
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Could not"))
      throw error

    throw new Error(
      "Could not open this passport image. Choose a JPEG, PNG, or WebP image.",
    )
  } finally {
    bitmap?.close()
  }
}

export default function AdminDashboard({ school, onLogout, onSchoolUpdated }) {
  const [activeView, setActiveView] = useState("dashboard")
  const [classLevels, setClassLevels] = useState([])
  const [curriculumError, setCurriculumError] = useState("")
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem("aceedu-admin-theme") === "dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem("aceedu-admin-theme", theme)
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
  }, [theme])

  const [dashboard, setDashboard] = useState(null)

  const [records, setRecords] = useState([])

  const [nextCursor, setNextCursor] = useState(null)

  const [query, setQuery] = useState("")

  const [appliedQuery, setAppliedQuery] = useState("")

  const [registryStatus, setRegistryStatus] = useState("")

  const [globalQuery, setGlobalQuery] = useState("")

  const [registryLoading, setRegistryLoading] = useState(false)

  const [exportingRegistry, setExportingRegistry] = useState(false)

  const [dashboardLoading, setDashboardLoading] = useState(true)

  const [entitlement, setEntitlement] = useState(null)

  const [entitlementLoading, setEntitlementLoading] = useState(true)

  const [entitlementError, setEntitlementError] = useState("")

  const [registrationId, setRegistrationId] = useState("")

  const [verificationPending, setVerificationPending] = useState(false)

  const [verificationMessage, setVerificationMessage] = useState("")

  const [busyId, setBusyId] = useState("")

  const [error, setError] = useState("")

  const [registryError, setRegistryError] = useState("")

  const [dashboardError, setDashboardError] = useState("")

  const [success, setSuccess] = useState("")

  const [logoutPending, setLogoutPending] = useState(false)

  const [enrollmentPending, setEnrollmentPending] = useState(false)

  const [passportPending, setPassportPending] = useState(false)

  const loadCurriculum = useCallback(async () => {
    try {
      const result = await getSchoolCurriculum()
      setClassLevels(result.classLevels)
      setCurriculumError("")
    } catch (loadError) {
      setCurriculumError(loadError.message)
    }
  }, [])

  useEffect(() => {
    void loadCurriculum()
  }, [loadCurriculum])

  const enrollmentLock = useRef(false)

  const passportLock = useRef(false)

  const rowActionLock = useRef(false)
  const passwordResetLock = useRef(false)

  const verificationLock = useRef(false)

  const registryRequestId = useRef(0)

  const [form, setForm] = useState(emptyForm)

  const [createdEnrollment, setCreatedEnrollment] = useState(null)

  const [qrCode, setQrCode] = useState("")

  const [selectedRecord, setSelectedRecord] = useState(null)

  const [passwordResetPending, setPasswordResetPending] = useState(false)

  const [passwordResetResult, setPasswordResetResult] = useState(null)

  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    if (!createdEnrollment?.accessPin) {
      setQrCode("")

      return
    }

    let active = true

    import("qrcode")

      .then(({ default: QRCode }) =>
        QRCode.toDataURL(createdEnrollment.accessPin, {
          width: 128,
          margin: 1,
        }),
      )

      .then((dataUrl) => {
        if (active) setQrCode(dataUrl)
      })

      .catch((qrError) => {
        if (active)
          setError(
            `Could not generate the identity QR code: ${qrError.message}`,
          )
      })

    return () => {
      active = false
    }
  }, [createdEnrollment])

  useEffect(() => {
    if (!selectedRecord && !profileOpen) return undefined

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedRecord(null)
      setPasswordResetResult(null)

      setProfileOpen(false)
      }
    }

    window.addEventListener("keydown", closeOnEscape)

    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [profileOpen, selectedRecord])

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true)

    try {
      const result = await getDashboard()

      setDashboard(result)

      setDashboardError("")
    } catch (loadError) {
      setDashboardError(loadError.message)
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  const loadEntitlement = useCallback(async () => {
    setEntitlementLoading(true)
    try {
      const result = await getSchoolEntitlement()
      setEntitlement(result.entitlement)
      setEntitlementError("")
    } catch (loadError) {
      setEntitlementError(loadError.message)
    } finally {
      setEntitlementLoading(false)
    }
  }, [])

  const loadRegistry = useCallback(
    async ({ append = false, search = appliedQuery, cursor = null } = {}) => {
      const requestId = ++registryRequestId.current
      setRegistryLoading(true)
      setRegistryError("")
      if (!append) {
        setRecords([])
        setNextCursor(null)
      }

      try {
        const result = await getEnrollments({
          query: search,

          cursor: append ? cursor : null,

          role: activeView === "students" ? "student" : activeView === "staff" ? "staff" : "",
          status: registryStatus,
        })

        if (requestId !== registryRequestId.current) return

        setRecords((current) => {
          if (!append) return result.items

          // Cursor pages can overlap when a record matches more than one search
          // field. Deduplicate by database ID before appending the next page.
          const seen = new Set(current.map((record) => record._id))
          return [
            ...current,
            ...result.items.filter((record) => !seen.has(record._id)),
          ]
        })

        setNextCursor(result.nextCursor)

        setRegistryError("")
        setError("")
      } catch (loadError) {
        if (requestId === registryRequestId.current) {
          setRegistryError(loadError.message)
        }
      } finally {
        if (requestId === registryRequestId.current) {
          setRegistryLoading(false)
        }
      }
    },
    [activeView, appliedQuery, registryStatus],
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadEntitlement()
  }, [loadEntitlement])

  useEffect(() => {
    const refreshEntitlement = () => {
      if (document.visibilityState === "visible") void loadEntitlement()
    }
    window.addEventListener("focus", refreshEntitlement)
    return () => window.removeEventListener("focus", refreshEntitlement)
  }, [loadEntitlement])

  async function handleVerificationRequest(event) {
    event.preventDefault()
    if (verificationLock.current) return
    verificationLock.current = true
    setVerificationPending(true)
    setEntitlementError("")
    setVerificationMessage("")
    try {
      const result = await requestSchoolVerification(registrationId)
      setVerificationMessage(
        result.request.status === "review_required"
          ? "Your request needs an additional identity review. A Premium trial has not been activated."
          : "Your verification request was submitted. A Premium trial will begin only after an operator approves it.",
      )
      setRegistrationId("")
      await loadEntitlement()
    } catch (requestError) {
      setEntitlementError(requestError.message)
    } finally {
      verificationLock.current = false
      setVerificationPending(false)
    }
  }

  useEffect(() => {
    if (["registry", "students", "staff"].includes(activeView)) {
      void loadRegistry({ search: appliedQuery })
    }
  }, [activeView, appliedQuery, registryStatus, loadRegistry])

  async function handleEnrollmentSubmit(event) {
    event.preventDefault()
    if (enrollmentLock.current) return
    enrollmentLock.current = true
    setEnrollmentPending(true)

    setError("")

    setSuccess("")

    setCreatedEnrollment(null)

    try {
      const result = await createEnrollment(form)

      setCreatedEnrollment(result.enrollment)

      setSuccess(
        `${result.enrollment.fullName} was added to ${school.schoolName}'s registry. Access PIN: ${result.enrollment.accessPin}`,
      )

      setForm(emptyForm)

      await loadDashboard()

      if (["registry", "students", "staff"].includes(activeView))
        await loadRegistry({ search: appliedQuery })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      enrollmentLock.current = false
      setEnrollmentPending(false)
    }
  }

  async function handlePassportChange(event) {
    const file = event.target.files?.[0]

    if (!file || passportLock.current) return
    passportLock.current = true
    setPassportPending(true)

    setError("")

    try {
      const passport = await optimizePassport(file)

      setForm((current) => ({ ...current, passport }))
    } catch (photoError) {
      setError(photoError.message)

      event.target.value = ""
    } finally {
      passportLock.current = false
      setPassportPending(false)
    }
  }

  function handleRoleChange(role) {
    setCreatedEnrollment(null)

    setForm((current) => ({
      ...current,

      role,

      designation: "",

      classLevelId: "",

      assignedClasses: role === "teacher" ? current.assignedClasses : "",

      subjects: role === "teacher" ? current.subjects : "",

      dob: role === "student" ? current.dob : "",

      guardianPhone: role === "student" ? current.guardianPhone : "",

      phone: role === "student" ? "" : current.phone,

      password: role === "student" ? "" : current.password,
    }))
  }

  function setEnrollmentChoices(field, value, checked) {
    setForm((current) => {
      const selected = new Set(
        (current[field] || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      )
      if (checked) selected.add(value)
      else selected.delete(value)
      return { ...current, [field]: [...selected].join(", ") }
    })
  }

  function startEnrollment(role) {
    setForm({ ...emptyForm, role })
    setCreatedEnrollment(null)
    setActiveView("enrollment")
    setError("")
    setSuccess("")
  }

  async function handleVerify(record) {
    if (rowActionLock.current) return
    rowActionLock.current = true
    setBusyId(record._id)

    setError("")

    setSuccess("")

    try {
      const result = await verifyEnrollment(record._id)

      setRecords((current) =>
        current.map((entry) =>
          entry._id === record._id
            ? { ...entry, ...(result.enrollment || {}), status: "Active" }
            : entry,
        ),
      )

      setSuccess(`${record.fullName} is now verified.`)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId("")
      rowActionLock.current = false
    }
  }

  async function handleDelete(record) {
    if (
      !window.confirm(`Remove ${record.fullName} from this school's registry?`)
    )
      return

    if (rowActionLock.current) return
    rowActionLock.current = true
    setBusyId(record._id)

    setError("")

    setSuccess("")

    try {
      await deleteEnrollment(record._id)

      setRecords((current) =>
        current.filter((entry) => entry._id !== record._id),
      )

      setSuccess(`${record.fullName} was removed from the registry.`)

      await loadDashboard()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId("")
      rowActionLock.current = false
    }
  }

  async function handleStudentPasswordReset(record) {
    if (passwordResetLock.current) return

    if (
      !window.confirm(
        `Reset ${record.fullName}'s student portal password? A new temporary password will be shown once.`,
      )
    ) {
      return
    }

    passwordResetLock.current = true
    setPasswordResetPending(true)
    setPasswordResetResult(null)
    setError("")
    setSuccess("")

    try {
      const result = await resetStudentPortalPassword(record._id)
      const updatedRecord = {
        ...record,
        ...(result.enrollment || {}),
        hasPortalPassword: true,
      }
      setRecords((current) =>
        current.map((entry) =>
          entry._id === record._id ? updatedRecord : entry,
        ),
      )
      setSelectedRecord(updatedRecord)
      setPasswordResetResult({
        recordId: record._id,
        temporaryPassword: result.temporaryPassword,
      })
      setSuccess(`A temporary portal password was generated for ${record.fullName}.`)
    } catch (resetError) {
      setError(resetError.message)
    } finally {
      setPasswordResetPending(false)
      passwordResetLock.current = false
    }
  }

  async function handleExport() {
    if (exportingRegistry) return

    setExportingRegistry(true)
    setError("")
    setSuccess("")

    try {
      await downloadRegistry()
      setSuccess("Your school registry export is ready.")
    } catch (exportError) {
      setError(exportError.message)
    } finally {
      setExportingRegistry(false)
    }
  }

  async function handleLogout() {
    setLogoutPending(true)

    setError("")

    try {
      await onLogout()
    } catch (logoutError) {
      setError(logoutError.message)
    } finally {
      setLogoutPending(false)
    }
  }

  const title =
    navigation.find((item) => item.id === activeView)?.label ||
    premiumNavigation.find((item) => item.id === activeView)?.label
  const selectedTeacherClasses = new Set(
    form.assignedClasses.split(",").map((item) => item.trim()).filter(Boolean),
  )
  const teacherSubjectOptions = [
    ...new Set(
      classLevels
        .filter((level) => level.isActive && selectedTeacherClasses.has(level.name))
        .flatMap((level) =>
          level.subjects
            .filter((subject) => subject.isActive)
            .map((subject) => subject.name),
        ),
    ),
  ]
  const premiumAccessActive =
    entitlement?.effectivePlan === "premium" ||
    entitlement?.trialActive ||
    entitlement?.plan === "premium"

  return (
    <div className="admin-app" data-theme={theme}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#top" aria-label="AceEdu admin home">
          <span className="admin-brand__mark">
            <GraduationCap size={23} aria-hidden="true" />
          </span>
          <span>
            <strong>AceEdu</strong>
            <small>SCHOOL OPERATING SYSTEM</small>
          </span>
        </a>

        <div className="admin-sidebar__label">MVP workspace</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ id, label, Icon }) => (
            <button
              className={`admin-nav__item ${
                activeView === id ? "is-active" : ""
              }`}
              key={id}
              type="button"
              title={label}
              aria-label={label === "Students" ? "Student management" : label === "Staff" ? "Staff management" : label}
              onClick={() => {
                setActiveView(id)
                if (id === "students" || id === "staff") {
                  setQuery("")
                  setAppliedQuery("")
                  setGlobalQuery("")
                  setRegistryStatus("")
                }
                setError("")
                setSuccess("")
              }}
              aria-current={activeView === id ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {activeView === id && <span className="admin-nav__active-dot" />}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar__label admin-sidebar__label--premium">
          {premiumAccessActive ? "Premium access active" : "Premium roadmap"}
        </div>
        <nav className="admin-nav admin-nav--premium" aria-label="Premium features">
          {premiumNavigation.map(({ id, label, Icon }) => {
            const featureImplemented = implementedPremiumViews.has(id)
            const featureEnabled = premiumAccessActive && featureImplemented
            return (
              <button
                className={`admin-nav__item admin-nav__item--planned ${
                  activeView === id ? "is-active" : ""
                }`}
                key={id}
                type="button"
                disabled={!featureEnabled}
                aria-disabled={!featureEnabled}
                aria-current={activeView === id ? "page" : undefined}
                title={
                  featureEnabled
                    ? `Open ${label}.`
                    : premiumAccessActive
                      ? `${label} is still in development and is not available yet.`
                      : `${label} requires an active Premium entitlement and is not available yet.`
                }
                onClick={() => setActiveView(id)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {featureEnabled ? (
                  <Check className="admin-nav__lock" size={14} aria-hidden="true" />
                ) : (
                  <LockKeyhole className="admin-nav__lock" size={13} aria-hidden="true" />
                )}
              </button>
            )
          })}
        </nav>
        <div className="admin-sidebar__spacer" />
        <section className="admin-school-identity" aria-label="Current school">
          <span className="admin-school-identity__mark">
            <GraduationCap size={18} aria-hidden="true" />
          </span>
          <span>
            <small>YOUR SCHOOL</small>
            <strong>{school.schoolName}</strong>
            <span>{school.schoolType}</span>
          </span>
        </section>
        <section className="admin-sidebar-premium">
          <span className="admin-sidebar-premium__icon" aria-hidden="true">
            <ArrowUpRight size={16} />
          </span>
          <strong>{premiumAccessActive ? "Premium access is active" : "Unlock more for your school"}</strong>
          <p>
            {premiumAccessActive
              ? "Academic setup, attendance, and academic records are ready. More Premium workflows are being built."
              : "Explore the Premium roadmap and upcoming school workflows."}
          </p>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("premium-preview")
                ?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                })
            }
          >
            Explore Premium <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </section>
        <div className="admin-profile">
          <div className="admin-profile__avatar" aria-hidden="true">
            {school.adminName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="admin-profile__identity">
            <strong>{school.adminName}</strong>
            <span>{school.adminRole}</span>
          </div>
          <button
            className="admin-profile__view"
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="View school profile"
            title="View profile"
          >
            <UserRound size={17} aria-hidden="true" />
          </button>
          <button
            className="admin-profile__logout"
            type="button"
            onClick={handleLogout}
            disabled={logoutPending}
            aria-label="Sign out"
          >
            {logoutPending ? (
              <LoaderCircle size={18} className="admin-spin" />
            ) : (
              <LogOut size={18} />
            )}
          </button>
        </div>
      </aside>

      <main className="admin-main" id="top">
        <header className="admin-topbar">
          <form
            className="admin-global-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(globalQuery)
              setAppliedQuery(globalQuery.trim())
              setRegistryStatus("")
              setActiveView("registry")
              setError("")
            }}
          >
            <Search size={17} aria-hidden="true" />
            <input
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              aria-label="Search school registry"
              placeholder="Search people in your school…"
            />
            <kbd>Enter</kbd>
          </form>
          <button
            className="admin-theme-toggle"
            type="button"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <div className="admin-topbar__account">
            <span className="admin-online-dot" />
            <span>{school.schoolName}</span>
          </div>
          <button
            className="admin-topbar__profile"
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label={`View profile for ${school.adminName}`}
          >
            <span className="admin-topbar__avatar" aria-hidden="true">
              {school.adminName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span>{school.adminName.split(/\s+/)[0]}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            className="admin-topbar__logout"
            type="button"
            onClick={handleLogout}
            disabled={logoutPending}
          >
            {logoutPending ? (
              <LoaderCircle size={17} className="admin-spin" aria-hidden="true" />
            ) : (
              <LogOut size={17} aria-hidden="true" />
            )}
            {logoutPending ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">{activeView === "dashboard" ? "SCHOOL OVERVIEW" : school.schoolName}</p>
              <h1>{activeView === "dashboard" ? `Welcome back, ${school.adminName.split(/\s+/)[0]}` : title}</h1>
              <p className="admin-page-heading__description">
                {activeView === "dashboard" &&
                  `Your ${school.schoolName} workspace, at a glance.`}
                {activeView === "enrollment" &&
                  "Create and manage student and staff registry entries."}
                {(activeView === "registry" || activeView === "students" || activeView === "staff") &&
                  (activeView === "students"
                    ? "Manage student identities and enrollment records for your school."
                    : activeView === "staff"
                      ? "Manage teaching and administrative staff in your school."
                      : "Search, verify, and manage records belonging to your school.")}
              </p>
            </div>
            {activeView !== "enrollment" && (
              <button
                className="admin-primary-button"
                type="button"
                onClick={() => {
                  if (activeView === "students") startEnrollment("student")
                  else if (activeView === "staff") startEnrollment("teacher")
                  else startEnrollment("student")
                }}
              >
                <Plus size={18} aria-hidden="true" />
                {activeView === "staff" ? "Add staff" : "Add student"}
              </button>
            )}
          </div>

          {error && (
            <div className="admin-alert admin-alert--error" role="alert">
              <AlertCircleIcon />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {success && (
            <div className="admin-alert admin-alert--success" role="status">
              <Check size={18} aria-hidden="true" />
              <span>{success}</span>
              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Dismiss message"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {activeView === "dashboard" && (
            <section className="admin-dashboard" aria-label="School dashboard" aria-busy={dashboardLoading}>
              {dashboardError && (
                <div className="admin-dashboard-error" role="alert">
                  <span>Dashboard data could not be loaded: {dashboardError}</span>
                  <button
                    className="admin-outline-button"
                    type="button"
                    onClick={() => void loadDashboard()}
                    disabled={dashboardLoading}
                  >
                    {dashboardLoading ? <LoadingSpinner /> : "Try again"}
                  </button>
                </div>
              )}

              <section className="admin-welcome">
                <div className="admin-welcome__copy">
                  <span className="admin-welcome__eyebrow">
                    <span className="admin-online-dot" /> LIVE SCHOOL WORKSPACE
                  </span>
                  <h2>{school.schoolName}</h2>
                  <p>
                    A clear view of your people and the school records managed in AceEdu.
                  </p>
                  <div className="admin-welcome__meta">
                    <span><GraduationCap size={15} /> {school.schoolType}</span>
                    <span><UserRound size={15} /> {school.adminName}</span>
                    <span className="admin-welcome__school-id"><IdCard size={15} /> AceEdu school ID: {school.id || "Unavailable"}</span>
                    <span><CalendarDays size={15} /> Academic session not configured</span>
                  </div>
                </div>
                <div className="admin-welcome__visual" aria-hidden="true">
                  <svg viewBox="0 0 260 210" fill="none">
                    <defs>
                      <linearGradient id="ace-orbit" x1="58" y1="35" x2="208" y2="174" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#8CB9FF" />
                        <stop offset="1" stopColor="#9A8CFF" />
                      </linearGradient>
                      <linearGradient id="ace-book" x1="83" y1="78" x2="179" y2="153" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F8FBFF" />
                        <stop offset="1" stopColor="#C9D9FF" />
                      </linearGradient>
                    </defs>
                    <ellipse cx="130" cy="108" rx="92" ry="38" transform="rotate(-27 130 108)" stroke="url(#ace-orbit)" strokeOpacity=".48" />
                    <ellipse cx="130" cy="108" rx="69" ry="70" transform="rotate(34 130 108)" stroke="url(#ace-orbit)" strokeOpacity=".3" />
                    <circle cx="210" cy="62" r="5" fill="#96B7FF" />
                    <circle cx="54" cy="142" r="4" fill="#A699FF" />
                    <path d="M130 77 178 96 130 116 82 96l48-19Z" fill="url(#ace-orbit)" fillOpacity=".92" />
                    <path d="m98 103 32 14 32-14v37c-18-9-46-9-64 0v-37Z" fill="url(#ace-book)" />
                    <path d="M130 117v23" stroke="#829DE0" strokeWidth="2" />
                    <path d="m90 128-8-25 13-5" stroke="#B7C9FF" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="130" cy="108" r="61" fill="#AEC8FF" fillOpacity=".08" />
                  </svg>
                  <span>LEARNING, IN SYNC</span>
                </div>
              </section>

              <section className="admin-panel admin-school-space">
                <div>
                  <span className="admin-panel__icon"><ArrowUpRight size={18} /></span>
                  <div>
                    <h2>School sign-in link</h2>
                    <p>Share your permanent AceEdu school entry point with staff and families.</p>
                  </div>
                </div>
                {school.slug ? (
                  <>
                    <code>{window.location.origin}/s/{encodeURIComponent(school.slug)}</code>
                    <a
                      className="admin-outline-button"
                      href={`/s/${encodeURIComponent(school.slug)}`}
                    >
                      Open school entry <ArrowUpRight size={15} />
                    </a>
                  </>
                ) : (
                  <p role="status">School URL is unavailable until a school identity is configured.</p>
                )}
              </section>

              <div className="admin-stats-grid">
                <StatCard
                  Icon={GraduationCap}
                  label="Total students"
                  value={dashboard?.metrics.students}
                  loading={dashboardLoading}
                  error={dashboardError}
                  tone="blue"
                  context="Enrolled records"
                />
                <StatCard
                  Icon={BookOpen}
                  label="Active classes"
                  value={dashboard?.metrics.activeClasses}
                  loading={dashboardLoading}
                  error={dashboardError}
                  tone="violet"
                  context="Distinct student class groups"
                />
                <StatCard
                  Icon={Users}
                  label="Teaching staff"
                  value={dashboard?.metrics.teachingStaff}
                  loading={dashboardLoading}
                  error={dashboardError}
                  tone="gold"
                  context="Enrolled records"
                />
                <StatCard
                  Icon={ShieldCheck}
                  label="Administrative staff"
                  value={dashboard?.metrics.administrativeStaff}
                  loading={dashboardLoading}
                  error={dashboardError}
                  tone="blue"
                  context="Enrolled records"
                />
              </div>
              <div className="admin-analytics-grid">
                <section className="admin-panel admin-chart-panel" aria-busy={dashboardLoading}>
                  <div className="admin-panel__heading">
                    <div>
                      <span className="admin-panel__icon"><Activity size={18} /></span>
                      <div>
                        <h2>Student enrollment</h2>
                        <p>New student records by month · last 6 months</p>
                      </div>
                    </div>
                    <span className="admin-chart-period">6 MONTHS</span>
                  </div>
                  {dashboardLoading ? (
                    <div className="admin-chart-skeleton" role="status">Loading enrollment history…</div>
                  ) : dashboardError ? (
                    <DashboardSectionError error={dashboardError} onRetry={() => void loadDashboard()} />
                  ) : dashboard?.studentTrend?.some((item) => item.total > 0) ? (
                    <StudentTrendChart points={dashboard.studentTrend} />
                  ) : (
                    <DashboardEmpty
                      title="No enrollment history yet"
                      detail="New student registrations will appear here as records are added."
                    />
                  )}
                </section>
                <section className="admin-panel admin-chart-panel" aria-busy={dashboardLoading}>
                  <div className="admin-panel__heading">
                    <div>
                      <span className="admin-panel__icon"><BookOpen size={18} /></span>
                      <div>
                        <h2>Students by class</h2>
                        <p>Current student records grouped by class</p>
                      </div>
                    </div>
                  </div>
                  {dashboardLoading ? (
                    <div className="admin-chart-skeleton" role="status">Loading class distribution…</div>
                  ) : dashboardError ? (
                    <DashboardSectionError error={dashboardError} onRetry={() => void loadDashboard()} />
                  ) : dashboard?.classDistribution?.length ? (
                    <ClassDistribution items={dashboard.classDistribution} />
                  ) : (
                    <DashboardEmpty
                      title="No class groups yet"
                      detail="Add students with a class designation to see the distribution."
                    />
                  )}
                </section>
              </div>

              <div className="admin-dashboard-lower">
                <section className="admin-panel admin-activity-panel" aria-busy={dashboardLoading}>
                  <div className="admin-panel__heading">
                    <div>
                      <span className="admin-panel__icon"><Activity size={18} /></span>
                      <div>
                        <h2>School activity</h2>
                        <p>Recent registrations and verifications</p>
                      </div>
                    </div>
                    <button
                      className="admin-text-link"
                      type="button"
                      onClick={() => setActiveView("registry")}
                    >
                      Open registry <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {dashboardLoading ? (
                    <div className="admin-activity-skeleton" role="status">Loading recent school activity…</div>
                  ) : dashboardError ? (
                    <DashboardSectionError error={dashboardError} onRetry={() => void loadDashboard()} />
                  ) : dashboard?.recentActivity?.length ? (
                    <ul className="admin-activity-list">
                      {dashboard.recentActivity.map((item, index) => (
                        <li key={`${item.fullName}-${item.occurredAt}-${index}`}>
                          <span className={`admin-activity-icon is-${item.type}`}>
                            {item.type === "verified" ? <Check size={16} /> : <UserPlus size={16} />}
                          </span>
                          <span className="admin-activity-copy">
                            <strong>{item.fullName}</strong>
                            <span>
                              {item.type === "verified" ? "Verified" : "Registered"} ·{" "}
                              {item.role === "student" ? item.designation || "Student" : item.role.replace("-", " ")}
                            </span>
                          </span>
                          <time dateTime={item.occurredAt}>{formatActivityDate(item.occurredAt)}</time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <DashboardEmpty
                      title="Your school activity will appear here"
                      detail="Registrations and verifications will show up as your team uses the registry."
                    />
                  )}
                </section>
                <section className="admin-panel admin-quick-actions">
                  <div className="admin-panel__heading">
                    <div>
                      <span className="admin-panel__icon"><Plus size={18} /></span>
                      <div>
                        <h2>Quick actions</h2>
                        <p>Start a task in your MVP workspace.</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => startEnrollment("student")}>
                    <span><GraduationCap size={17} /></span>
                    <span>Add student<small>Create a student record</small></span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button type="button" onClick={() => startEnrollment("teacher")}>
                    <span><UserPlus size={17} /></span>
                    <span>Add staff<small>Create a staff account</small></span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button type="button" onClick={() => setActiveView("registry")}>
                    <span><IdCard size={17} /></span>
                    <span>Open registry<small>Search school records</small></span>
                    <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>

              <section className="admin-premium-preview" id="premium-preview">
                <div className="admin-premium-preview__copy">
                  <span className="admin-premium-preview__eyebrow">
                    <span className="admin-premium-preview__spark">✦</span> ACEEDU PREMIUM
                  </span>
                  <h2>More of the school day, connected.</h2>
                  <p>
                    Premium is designed for the full student portal, advanced academic workflows, financial management, and deeper reporting.
                  </p>
                  <span className="admin-premium-preview__notice">
                    {premiumAccessActive
                      ? "Premium is active. Academic setup, attendance, academic records, and the student and teacher portals are available now; more workflows are in development."
                      : "An active Premium plan or approved trial unlocks academic setup, attendance, academic records, and student and teacher portals. Other Premium workflows are in development."}
                  </span>
                </div>
                <ul className="admin-premium-preview__features">
                  <li><GraduationCap size={18} /><span>Student portal</span></li>
                  <li><Users size={18} /><span>Teacher portal</span></li>
                  <li><ClipboardList size={18} /><span>Advanced academic workflows</span></li>
                  <li><CircleDollarSign size={18} /><span>School financial management</span></li>
                  <li><ChartNoAxesCombined size={18} /><span>Advanced reports and analytics</span></li>
                </ul>
                <div className="admin-premium-access" aria-busy={entitlementLoading || verificationPending}>
                  <div className="admin-premium-access__summary">
                    <span className="admin-premium-access__label">
                      <ShieldCheck size={15} /> SCHOOL ACCESS
                    </span>
                    <strong className="admin-premium-access__state">
                      {entitlementLoading
                        ? "Checking entitlement…"
                        : premiumAccessActive && entitlement?.trialActive
                          ? `Premium trial · ends ${formatDate(entitlement.trialEndsAt)}`
                          : premiumAccessActive && entitlement?.plan === "premium"
                            ? "Premium plan active"
                            : entitlement?.trialPreviouslyGranted
                              ? "Trial ended · MVP access active"
                              : entitlement?.verificationStatus === "pending"
                                ? "School verification pending"
                                : entitlement?.verificationStatus === "review_required"
                                  ? "Additional identity review required"
                                  : entitlement?.verificationStatus === "verified"
                                    ? "School verified · MVP access active"
                                    : entitlement?.verificationStatus === "rejected"
                                      ? "Verification needs another review"
                                      : "MVP plan · default access"}
                    </strong>
                    <button
                      className="admin-premium-access__refresh"
                      type="button"
                      onClick={() => void loadEntitlement()}
                      disabled={entitlementLoading}
                    >
                      <RefreshCw size={13} className={entitlementLoading ? "is-spinning" : ""} />
                      Refresh access
                    </button>
                    <span className="admin-premium-access__hint">
                      Your school identity stays the same across MVP and Premium.
                    </span>
                  </div>
                  <div className="admin-premium-access__identity">
                    <span>AceEdu school ID</span>
                    <code>{school.id || "Unavailable"}</code>
                    <small>Permanent platform ID · not your official registration ID</small>
                  </div>
                  {!entitlementLoading &&
                    !entitlementError &&
                    !entitlement?.trialPreviouslyGranted &&
                    !["pending", "review_required", "verified"].includes(
                      entitlement?.verificationStatus,
                    ) && (
                      <form className="admin-verification-form" onSubmit={handleVerificationRequest}>
                        <div className="admin-verification-form__copy">
                          <strong>Request school verification</strong>
                          <small>Enter the official registration ID issued by your education authority.</small>
                        </div>
                        <label htmlFor="school-registration-id">
                          Official school registration ID
                        </label>
                        <div className="admin-verification-form__controls">
                          <input
                            id="school-registration-id"
                            autoComplete="off"
                            maxLength={80}
                            minLength={2}
                            required
                            value={registrationId}
                            onChange={(event) => setRegistrationId(event.target.value)}
                            placeholder="e.g. Ministry-issued registration number"
                            disabled={verificationPending}
                          />
                          <button
                            className="admin-primary-button"
                            type="submit"
                            disabled={verificationPending || registrationId.trim().length < 2}
                          >
                            {verificationPending ? "Submitting…" : "Request verification"}
                          </button>
                        </div>
                        <small className="admin-verification-form__footnote">
                          An authorized operator reviews each request. Approval starts one 90-day Premium trial; submission alone does not activate it.
                        </small>
                      </form>
                    )}
                  {entitlementError && (
                    <div className="admin-premium-access__message is-error" role="alert">
                      <span>{entitlementError}</span>
                      <button type="button" onClick={() => void loadEntitlement()}>
                        Retry
                      </button>
                    </div>
                  )}
                  {verificationMessage && (
                    <p className="admin-premium-access__message" role="status" aria-live="polite">
                      {verificationMessage}
                    </p>
                  )}
                  {!entitlementLoading && entitlement?.trialEndsAt && !entitlement?.trialActive && (
                    <p className="admin-premium-access__message">
                      The trial period has ended. Your school data remains available on the MVP plan.
                    </p>
                  )}
                </div>
              </section>
            </section>
          )}

          {activeView === "enrollment" && (
            <div className="admin-enrollment-layout">
              <section className="admin-panel admin-enrollment-panel">
                <div className="admin-panel__heading">
                  <div>
                    <span className="admin-panel__icon">
                      <Plus size={19} />
                    </span>
                    <h2>New registry entry</h2>
                  </div>
                  <span className="admin-private-label">
                    <ShieldCheck size={15} /> School only
                  </span>
                </div>
                <p className="admin-panel__description">
                  Each record and generated access PIN is scoped to{" "}
                  {school.schoolName}.
                </p>
                <form
                  className="admin-enrollment-form"
                  onSubmit={handleEnrollmentSubmit}
                aria-busy={enrollmentPending}
                >
                <fieldset
                  className="admin-enrollment-fieldset"
                  disabled={enrollmentPending}
                >
                <div className="admin-enrollment-fields">
                    <label>
                      Account role
                      <select
                        value={form.role}
                        onChange={(event) =>
                          handleRoleChange(event.target.value)
                        }
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Faculty / Teacher</option>
                        <option value="sub-admin">Sub-admin</option>
                        <option value="school-admin">School admin</option>
                      </select>
                    </label>
                    <label>
                      Full name
                      <input
                        value={form.fullName}
                        maxLength={160}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                        placeholder="Enter full name"
                        required
                      />
                    </label>
                    {form.role === "student" ? (
                      <label>
                        Student class
                        <select
                          value={form.classLevelId}
                          onChange={(event) => {
                            const selectedClass = classLevels.find(
                              (level) => level.id === event.target.value,
                            )
                            setForm((current) => ({
                              ...current,
                              classLevelId: event.target.value,
                              designation: selectedClass?.displayName || "",
                            }))
                          }}
                          required
                          disabled={Boolean(curriculumError)}
                        >
                          <option value="">Select a class…</option>
                          {classLevels
                            .filter((level) => level.isActive)
                            .map((level) => (
                              <option value={level.id} key={level.id}>
                                {level.displayName}
                                {level.isOptional ? " · Optional" : ""}
                              </option>
                            ))}
                        </select>
                        {curriculumError && (
                          <small role="alert">
                            Class options could not be loaded: {curriculumError}
                          </small>
                        )}
                      </label>
                    ) : (
                      <label>
                        Official designation
                        <input
                          value={form.designation}
                          maxLength={120}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              designation: event.target.value,
                            }))
                          }
                          placeholder={
                            form.role === "student"
                              ? "e.g. Year 7"
                              : "e.g. Mathematics teacher"
                          }
                          required
                        />
                      </label>
                    )}
                    <label>
                      State of origin
                      <input
                        value={form.stateOfOrigin}
                        maxLength={100}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            stateOfOrigin: event.target.value,
                          }))
                        }
                        placeholder="State"
                      />
                    </label>
                    <label>
                      House address
                      <input
                        value={form.address}
                        maxLength={300}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        placeholder="Residential address"
                      />
                    </label>
                    {form.role === "student" ? (
                      <>
                        <label>
                          Date of birth
                          <input
                            type="date"
                            value={form.dob}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                dob: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Guardian phone
                          <input
                            type="tel"
                            value={form.guardianPhone}
                            maxLength={30}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                guardianPhone: event.target.value,
                              }))
                            }
                            placeholder="Guardian contact number"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          Personal phone
                          <input
                            type="tel"
                            value={form.phone}
                            maxLength={30}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                phone: event.target.value,
                              }))
                            }
                            placeholder="Personal contact number"
                          />
                        </label>
                        <label>
                          Login password
                          <input
                            type="password"
                            value={form.password}
                            minLength={8}
                            maxLength={72}
                            autoComplete="new-password"
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </>
                    )}
                    {form.role === "teacher" && (
                      <>
                        <fieldset className="admin-enrollment-choice-list">
                          <legend>Teaching classes</legend>
                          {classLevels.filter((level) => level.isActive).map((level) => (
                            <label key={level.id}>
                              <input
                                type="checkbox"
                                checked={selectedTeacherClasses.has(level.name)}
                                onChange={(event) =>
                                  setEnrollmentChoices(
                                    "assignedClasses",
                                    level.name,
                                    event.target.checked,
                                  )
                                }
                              />
                              {level.displayName}
                            </label>
                          ))}
                        </fieldset>
                        <fieldset className="admin-enrollment-choice-list">
                          <legend>Subjects to teach</legend>
                          {teacherSubjectOptions.length ? teacherSubjectOptions.map((subject) => (
                            <label key={subject}>
                              <input
                                type="checkbox"
                                checked={form.subjects.split(",").map((item) => item.trim()).includes(subject)}
                                onChange={(event) =>
                                  setEnrollmentChoices(
                                    "subjects",
                                    subject,
                                    event.target.checked,
                                  )
                                }
                              />
                              {subject}
                            </label>
                          )) : (
                            <small>Select teaching classes that already have subject options configured.</small>
                          )}
                        </fieldset>
                      </>
                    )}
                    <label className="admin-photo-field">
                      Identity passport
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePassportChange}
                        disabled={passportPending || enrollmentPending}
                        aria-busy={passportPending}
                      />
                      <small role={passportPending ? "status" : undefined}>
                        {passportPending ? (
                          <>
                            <LoadingSpinner /> Optimizing image…
                          </>
                        ) : (
                          "JPEG, PNG, or WebP · maximum 5 MB"
                        )}
                      </small>
                    </label>
                    <div className="admin-enrollment-submit">
                      <button
                        className="admin-primary-button"
                        type="submit"
                        disabled={enrollmentPending}
                      >
                        {enrollmentPending ? (
                          <LoadingSpinner />
                        ) : (
                          <Plus size={18} />
                        )}
                        {enrollmentPending
                          ? form.role === "student"
                            ? "Registering student…"
                            : "Creating account…"
                          : "Create identity"}
                      </button>
                    </div>
                  </div>
                  </fieldset>
                </form>
              </section>
              <aside className="admin-enrollment-aside">
                {createdEnrollment ? (
                  <section className="admin-panel admin-issued-card">
                    <div className="admin-panel__heading">
                      <div>
                        <span className="admin-panel__icon">
                          <IdCard size={19} />
                        </span>
                        <h2>Issued identity card</h2>
                      </div>
                    </div>
                    <IdentityCard
                      record={createdEnrollment}
                      qrCode={qrCode}
                      printable
                    />
                    <button
                      className="admin-outline-button admin-print-button"
                      type="button"
                      onClick={() => window.print()}
                      disabled={!qrCode}
                    >
                      <Printer size={17} /> Print identity card
                    </button>
                  </section>
                ) : (
                  <section className="admin-panel admin-preview-panel">
                    <p className="admin-eyebrow">LIVE CARD PREVIEW</p>
                    <IdentityCard record={{ ...form, accessPin: "" }} />
                  </section>
                )}
                <div className="admin-enrollment-note">
                  <ShieldCheck size={24} aria-hidden="true" />
                  <h2>Private school records</h2>
                  <p>
                    New records are assigned to the signed-in school's secure
                    workspace. Other schools cannot access this registry.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {activeView === "classes" && (
            <SchoolCurriculumSetup
              schoolType={school.schoolType}
              onSchoolTypeChange={() => setActiveView("settings")}
            />
          )}
          {activeView === "settings" && (
            <SchoolSettings
              school={school}
              onSchoolUpdated={onSchoolUpdated}
              onCurriculumUpdated={setClassLevels}
            />
          )}
          {activeView === "attendance" && <PremiumOperations mode="attendance" />}
          {activeView === "academicRecords" && <PremiumOperations mode="academicRecords" />}
          {(activeView === "studentPortal" || activeView === "teacherPortal") && (
            <section className="admin-panel admin-portal-access">
              <div className="admin-panel__heading">
                <div>
                  <span className="admin-panel__icon">
                    {activeView === "studentPortal" ? (
                      <GraduationCap size={18} />
                    ) : (
                      <Users size={18} />
                    )}
                  </span>
                  <div>
                    <h2>{activeView === "studentPortal" ? "Student portal" : "Teacher portal"}</h2>
                    <p>Share one school-specific sign-in address with students and teachers.</p>
                  </div>
                </div>
              </div>
              <div className="admin-portal-access__link">
                {school.slug ? (
                  <>
                    <code>
                      {window.location.origin}/s/{encodeURIComponent(school.slug)}/portal
                    </code>
                    <a
                      className="admin-primary-button"
                      href={`/s/${encodeURIComponent(school.slug)}/portal`}
                    >
                      Open shared sign-in <ArrowUpRight size={15} />
                    </a>
                  </>
                ) : (
                  <span>School URL is unavailable until a school identity is configured.</span>
                )}
              </div>
              <p className="admin-portal-access__hint">
                Access requires an active enrollment in this school and the member’s existing school-issued sign-in credentials. Premium access is checked by the server.
              </p>
            </section>
          )}

          {["registry", "students", "staff"].includes(activeView) && (
            <section
              className="admin-panel admin-registry-panel"
              aria-label={title}
            >
              <div className="admin-registry-toolbar">
                <div className="admin-panel__heading">
                  <div>
                    <span className="admin-panel__icon">
                      <Users size={19} />
                    </span>
                    <h2>{title}</h2>
                  </div>
                  <span className="admin-count-badge">
                    {records.length} shown
                    {nextCursor ? " · more available" : ""}
                  </span>
                </div>
                <button
                  className="admin-outline-button"
                  type="button"
                  onClick={handleExport}
                  disabled={exportingRegistry}
                  aria-busy={exportingRegistry}
                >
                  {exportingRegistry ? (
                    <LoaderCircle size={17} className="admin-spin" />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}

                  {exportingRegistry ? "Preparing export…" : "Export CSV"}
                </button>
              </div>
              <form
                className="admin-search"
                aria-busy={registryLoading}
                onSubmit={(event) => {
                  event.preventDefault()
                  setAppliedQuery(query.trim())
                  setNextCursor(null)
                }}
              >
                <Search size={18} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, role, or access PIN"
                  aria-label="Search registry by name, role, or access PIN"
                />
                {query && (
                  <button
                    className="admin-search__button"
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setAppliedQuery("")
                      setNextCursor(null)
                    }}
                    aria-label="Clear registry search"
                  >
                    Clear
                  </button>
                )}
                <button className="admin-search__button" type="submit" disabled={registryLoading}>
                  {registryLoading ? "Searching…" : "Search"}
                </button>
              </form>
              <div className="admin-registry-filters">
                <label htmlFor="registry-status-filter">Account status</label>
                <select
                  id="registry-status-filter"
                  value={registryStatus}
                  disabled={registryLoading}
                  onChange={(event) => {
                    setRegistryStatus(event.target.value)
                    setNextCursor(null)
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                </select>
                <span>
                  {activeView === "students"
                    ? "Showing student records for this school"
                    : activeView === "staff"
                      ? "Showing staff records for this school"
                      : "Showing all school records"}
                </span>
              </div>
              {registryError && (
                <div className="admin-registry-error" role="alert">
                  <span>
                    {records.length
                      ? `Could not refresh the registry. Previously loaded records are still shown. ${registryError}`
                      : `Could not load the registry. ${registryError}`}
                  </span>
                  <button
                    className="admin-outline-button"
                    type="button"
                    disabled={registryLoading}
                    onClick={() => void loadRegistry({ search: appliedQuery })}
                  >
                    {registryLoading ? <LoadingSpinner /> : "Try again"}
                  </button>
                </div>
              )}
              {registryLoading && records.length > 0 && (
                <p className="admin-registry-loading" role="status">
                  <LoaderCircle size={15} className="admin-spin" /> Updating registry…
                </p>
              )}
              {registryLoading && records.length === 0 && (
                <p className="admin-visually-hidden" role="status">
                  Loading school records…
                </p>
              )}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Class / designation</th>
                      <th>Access PIN</th>
                      <th>Portal password</th>
                      <th>Status</th>
                      <th>Added</th>
                      <th>
                        <span className="admin-visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody aria-busy={registryLoading}>
                    {registryLoading && records.length === 0 && (
                      <RegistrySkeletonRows />
                    )}
                    {!registryLoading && !registryError && records.length === 0 && (
                      <tr>
                        <td colSpan="8" className="admin-empty">
                          <span className="admin-empty__icon"><Users size={20} /></span>
                          <strong>
                            {appliedQuery || registryStatus
                              ? "No matching records"
                              : activeView === "students"
                                ? "No students registered yet"
                                : activeView === "staff"
                                  ? "No staff records yet"
                                  : "No records in this registry"}
                          </strong>
                          <span>
                            {appliedQuery || registryStatus
                              ? "Try adjusting the search or status filter."
                              : activeView === "students"
                                ? "Register a student to start building your school roster."
                                : "New school records will appear here when they are added."}
                          </span>
                          {!appliedQuery && !registryStatus && activeView !== "staff" && (
                            <button
                              className="admin-outline-button"
                              type="button"
                              onClick={() => startEnrollment("student")}
                            >
                              <Plus size={16} /> Add student
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                    {records.map((record) => (
                      <tr key={record._id}>
                        <td>
                          <div className="admin-table-name">
                            {record.passport ? (
                              <img
                                className="admin-table-avatar admin-table-avatar--photo"
                                src={record.passport}
                                alt=""
                              />
                            ) : (
                              <span className="admin-table-avatar">
                                {record.fullName
                                  .split(/\s+/)
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            )}
                            <strong>{record.fullName}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="admin-role-badge">
                            {record.role}
                          </span>
                        </td>
                        <td>{record.designation}</td>
                        <td>
                          <code className="admin-pin">{record.accessPin}</code>
                        </td>
                        <td>
                          {record.role === "student"
                            ? record.hasPortalPassword
                              ? "Set"
                              : "Not set"
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`admin-status ${
                              record.status === "Active" ? "is-active" : "is-pending"
                            }`}
                            aria-label={`Status: ${record.status}`}
                          >
                            <span aria-hidden="true" />
                            {record.status}
                          </span>
                        </td>
                        <td>{formatDate(record.createdAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordResetResult(null)
                                setSelectedRecord(record)
                              }}
                              aria-label={`View ${record.fullName}`}
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            {record.status !== "Active" && (
                              <button
                                type="button"
                                onClick={() => handleVerify(record)}
                                disabled={Boolean(busyId)}
                                aria-busy={busyId === record._id}
                                aria-label={`Verify ${record.fullName}`}
                                title="Verify entry"
                              >
                                {busyId === record._id ? (
                                  <LoaderCircle
                                    size={16}
                                    className="admin-spin"
                                  />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                            )}
                            <button
                              className="is-danger"
                              type="button"
                              onClick={() => handleDelete(record)}
                              disabled={Boolean(busyId)}
                              aria-busy={busyId === record._id}
                              aria-label={`Delete ${record.fullName}`}
                              title="Delete entry"
                            >
                              {busyId === record._id ? (
                                <LoaderCircle
                                  size={16}
                                  className="admin-spin"
                                />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-registry-cards" aria-busy={registryLoading}>
                {registryLoading && records.length === 0 && (
                  <RegistryCardSkeleton />
                )}
                {!registryLoading && !registryError && records.length === 0 && (
                  <div className="admin-mobile-empty">
                    <Users size={22} aria-hidden="true" />
                    <strong>
                      {appliedQuery || registryStatus
                        ? "No matching records"
                        : activeView === "students"
                          ? "No students registered yet"
                          : activeView === "staff"
                            ? "No staff records yet"
                            : "No records in this registry"}
                    </strong>
                    <span>Adjust your filters or add a record to this school.</span>
                  </div>
                )}
                {records.map((record) => (
                  <RegistryRecordCard
                    key={`mobile-${record._id}`}
                    record={record}
                    busy={busyId === record._id}
                    disabled={Boolean(busyId)}
                    onView={() => {
                      setPasswordResetResult(null)
                      setSelectedRecord(record)
                    }}
                    onVerify={() => handleVerify(record)}
                    onDelete={() => handleDelete(record)}
                    onResetStudentPassword={() =>
                      handleStudentPasswordReset(record)
                    }
                    passwordResetPending={passwordResetPending}
                  />
                ))}
              </div>
              {nextCursor && (
                <div className="admin-load-more">
                  <button
                    className="admin-outline-button"
                    type="button"
                    disabled={registryLoading}
                    onClick={() =>
                      loadRegistry({ append: true, cursor: nextCursor })
                    }
                  >
                    {registryLoading ? "Loading…" : "Load more records"}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      {selectedRecord && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRecord(null)
              setPasswordResetResult(null)
            }
          }}
        >
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-record-modal-title"
          >
            <header className="admin-modal__header">
              <div>
                <span className="admin-panel__icon">
                  <IdCard size={19} />
                </span>
                <h2 id="admin-record-modal-title">Identity profile</h2>
              </div>
              <button
                className="admin-modal__close"
                type="button"
                onClick={() => {
                  setSelectedRecord(null)
                  setPasswordResetResult(null)
                }}
                aria-label="Close identity profile"
              >
                <X size={20} />
              </button>
            </header>
            <div className="admin-record-details">
              <div className="admin-record-photo">
                {selectedRecord.passport ? (
                  <img
                    src={selectedRecord.passport}
                    alt={`${selectedRecord.fullName} passport`}
                  />
                ) : (
                  <span>
                    {selectedRecord.fullName
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <dl>
                <Detail label="Full name" value={selectedRecord.fullName} />
                <Detail
                  label="Role and designation"
                  value={`${selectedRecord.role} — ${selectedRecord.designation}`}
                />
                <Detail label="Status" value={selectedRecord.status} />
                {selectedRecord.role === "student" && (
                  <Detail
                    label="Portal password"
                    value={
                      selectedRecord.hasPortalPassword
                        ? "Set — stored securely; cannot be viewed."
                        : "Not set"
                    }
                  />
                )}
                <Detail label="Address" value={selectedRecord.address} />
                <Detail
                  label="State of origin"
                  value={selectedRecord.stateOfOrigin}
                />
                {selectedRecord.role === "student" ? (
                  <>
                    <Detail label="Date of birth" value={selectedRecord.dob} />
                    <Detail
                      label="Guardian phone"
                      value={selectedRecord.guardianPhone}
                    />
                  </>
                ) : (
                  <>
                    <Detail
                      label="Personal phone"
                      value={selectedRecord.phone}
                    />
                    <Detail
                      label="Password"
                      value="Stored securely; passwords cannot be viewed."
                    />
                  </>
                )}
                {selectedRecord.role === "teacher" && (
                  <>
                    <Detail
                      label="Teaching classes"
                      value={selectedRecord.assignedClasses}
                    />
                    <Detail
                      label="Department / subject"
                      value={selectedRecord.subjects}
                    />
                  </>
                )}
                <Detail label="Access PIN" value={selectedRecord.accessPin} />
              </dl>
            </div>
            {selectedRecord.role === "student" && (
              <div style={{ padding: "0 1.5rem 1.5rem" }}>
                <button
                  className="admin-outline-button"
                  type="button"
                  disabled={passwordResetPending}
                  onClick={() => handleStudentPasswordReset(selectedRecord)}
                >
                  {passwordResetPending ? (
                    <LoaderCircle size={16} className="admin-spin" />
                  ) : (
                    <LockKeyhole size={16} />
                  )}
                  {passwordResetPending ? "Resetting password…" : "Reset student password"}
                </button>
                {passwordResetResult?.recordId === selectedRecord._id && (
                  <p
                    role="status"
                    style={{
                      margin: "0.85rem 0 0",
                      padding: "0.85rem",
                      borderRadius: "0.6rem",
                      background: "var(--admin-surface-muted, #f3f6fa)",
                      color: "var(--admin-ink, #33495c)",
                      fontSize: "0.78rem",
                      lineHeight: 1.6,
                      overflowWrap: "anywhere",
                    }}
                  >
                    Temporary password (shown once):{" "}
                    <code>{passwordResetResult.temporaryPassword}</code>
                    <br />
                    Share it securely with the student. They can change it in
                    portal settings.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {profileOpen && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileOpen(false)
          }}
        >
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-profile-modal-title"
          >
            <header className="admin-modal__header">
              <div>
                <span className="admin-panel__icon">
                  <UserRound size={19} />
                </span>
                <h2 id="admin-profile-modal-title">
                  School administrator profile
                </h2>
              </div>
              <button
                className="admin-modal__close"
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </header>
            <dl className="admin-profile-details">
              <Detail label="Administrator" value={school.adminName} />
              <Detail label="Role" value={school.adminRole} />
              <Detail label="Email" value={school.adminEmail} />
              <Detail label="Phone" value={school.adminPhone} />
              <Detail label="School" value={school.schoolName} />
              <Detail label="School type" value={school.schoolType} />
              <Detail
                label="Location"
                value={[school.city, school.state, school.country]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Detail label="Address" value={school.address} />
              <Detail
                label="School contact"
                value={`${school.schoolEmail} · ${school.schoolPhone}`}
              />
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}

function AlertCircleIcon() {
  return (
    <span className="admin-alert__symbol" aria-hidden="true">
      !
    </span>
  )
}

function StatCard({ Icon, label, value, loading, error, tone, context }) {
  return (
    <article className="admin-panel admin-stat-card">
      <span className={`admin-stat-card__icon is-${tone}`}>
        <Icon size={21} aria-hidden="true" />
      </span>
      <div>
        <p>{label}</p>
        <strong>
          {loading ? (
            <span className="admin-stat-skeleton" aria-hidden="true" />
          ) : error ? (
            "—"
          ) : (
            (value ?? 0)
          )}
        </strong>
      </div>
      <span className="admin-stat-card__tag">{context}</span>
    </article>
  )
}

function DashboardSectionError({ error, onRetry }) {
  return (
    <div className="admin-dashboard-section-error" role="alert">
      <span>Could not load this data.</span>
      <button type="button" onClick={onRetry} title={error}>Retry</button>
    </div>
  )
}

function StudentTrendChart({ points }) {
  const width = 560
  const height = 188
  const padding = { top: 16, right: 16, bottom: 30, left: 16 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maximum = Math.max(1, ...points.map((point) => point.total))
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (point.total / maximum) * chartHeight,
  }))
  const line = coordinates.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  ).join(" ")
  const area = `${line} L ${coordinates.at(-1).x} ${padding.top + chartHeight} L ${coordinates[0].x} ${padding.top + chartHeight} Z`

  return (
    <div className="admin-trend-chart">
      <div className="admin-trend-chart__summary">
        <span>New student records</span>
        <strong>{points.reduce((sum, point) => sum + point.total, 0).toLocaleString()}</strong>
        <small>Across the periods shown</small>
      </div>
      <svg
        className="admin-trend-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Student registrations for the last six months: ${points.map((point) => `${point.month} ${point.total}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="admin-trend-fill" x1="280" y1="15" x2="280" y2="158" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4384FF" stopOpacity=".22" />
            <stop offset="1" stopColor="#4384FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="admin-trend-line" x1="16" y1="20" x2="544" y2="155" gradientUnits="userSpaceOnUse">
            <stop stopColor="#397DFF" />
            <stop offset="1" stopColor="#7765E8" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((lineIndex) => {
          const y = padding.top + (chartHeight / 2) * lineIndex
          return <line key={lineIndex} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="admin-trend-chart__gridline" />
        })}
        <path d={area} fill="url(#admin-trend-fill)" />
        <path d={line} fill="none" stroke="url(#admin-trend-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="5" className="admin-trend-chart__point" />
            <text x={point.x} y={height - 8} textAnchor="middle" className="admin-trend-chart__label">{point.month}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ClassDistribution({ items }) {
  const maximum = Math.max(1, ...items.map((item) => item.total))
  return (
    <ul className="admin-class-distribution">
      {items.map((item) => (
        <li key={item.className}>
          <span className="admin-class-distribution__label">{item.className}</span>
          <span className="admin-class-distribution__track" aria-hidden="true">
            <span style={{ width: `${(item.total / maximum) * 100}%` }} />
          </span>
          <strong>{item.total.toLocaleString()}</strong>
        </li>
      ))}
    </ul>
  )
}

function DashboardEmpty({ title, detail }) {
  return (
    <div className="admin-dashboard-empty">
      <span aria-hidden="true"><Activity size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function RegistrySkeletonRows() {
  return Array.from({ length: 4 }, (_, row) => (
    <tr className="admin-table-skeleton" key={`loading-${row}`} aria-hidden="true">
      {Array.from({ length: 8 }, (_, column) => (
        <td key={`loading-${row}-${column}`}>
          <span className="admin-table-skeleton__bar" />
        </td>
      ))}
    </tr>
  ))
}

function RegistryCardSkeleton() {
  return (
    <div className="admin-registry-card-skeleton" role="status">
      <span className="admin-registry-card-skeleton__avatar" aria-hidden="true" />
      <span className="admin-registry-card-skeleton__line" aria-hidden="true" />
      <span className="admin-registry-card-skeleton__line is-short" aria-hidden="true" />
      <span className="admin-visually-hidden">Loading student records…</span>
    </div>
  )
}

function RegistryRecordCard({
  record,
  busy,
  disabled,
  onView,
  onVerify,
  onDelete,
  onResetStudentPassword,
  passwordResetPending,
}) {
  const active = record.status === "Active"

  return (
    <article className="admin-registry-card">
      <div className="admin-registry-card__header">
        {record.passport ? (
          <img
            className="admin-table-avatar admin-table-avatar--photo"
            src={record.passport}
            alt=""
          />
        ) : (
          <span className="admin-table-avatar" aria-hidden="true">
            {record.fullName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        <span className="admin-registry-card__identity">
          <strong>{record.fullName}</strong>
          <span>{record.role.replace("-", " ")}</span>
        </span>
        <span className={`admin-status ${active ? "is-active" : "is-pending"}`}>
          <span aria-hidden="true" />
          {record.status}
        </span>
      </div>
      <dl className="admin-registry-card__details">
        <div><dt>Class / designation</dt><dd>{record.designation || "—"}</dd></div>
        <div><dt>Access PIN</dt><dd><code className="admin-pin">{record.accessPin}</code></dd></div>
        {record.role === "student" && (
          <div>
            <dt>Portal password</dt>
            <dd>{record.hasPortalPassword ? "Set" : "Not set"}</dd>
          </div>
        )}
        <div><dt>Added</dt><dd>{formatDate(record.createdAt)}</dd></div>
      </dl>
      <div className="admin-registry-card__actions" aria-label={`Actions for ${record.fullName}`}>
        <button type="button" onClick={onView} aria-label={`View ${record.fullName}`}>
          <Eye size={16} /> View
        </button>
        {record.role === "student" && (
          <button
            type="button"
            onClick={onResetStudentPassword}
            disabled={passwordResetPending}
          >
            <LockKeyhole size={16} /> Reset password
          </button>
        )}
        {!active && (
          <button
            type="button"
            onClick={onVerify}
            disabled={disabled}
            aria-busy={busy}
            aria-label={`Verify ${record.fullName}`}
          >
            {busy ? <LoadingSpinner /> : <Check size={16} />} Verify
          </button>
        )}
        <button
          className="is-danger"
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-busy={busy}
          aria-label={`Delete ${record.fullName}`}
        >
          {busy ? <LoadingSpinner /> : <Trash2 size={16} />} Remove
        </button>
      </div>
    </article>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

function IdentityCard({ record, qrCode = "", printable = false }) {
  const initials =
    record.fullName
      ?.split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ID"

  return (
    <div className={`admin-print-area ${printable ? "is-printable" : ""}`}>
      <article className="admin-id-card">
        {record.passport ? (
          <img className="admin-id-card__photo" src={record.passport} alt="" />
        ) : (
          <span className="admin-id-card__photo admin-id-card__initials">
            {initials}
          </span>
        )}
        <div className="admin-id-card__details">
          <strong>{record.fullName || "Identity name"}</strong>
          <span className="admin-id-card__role">
            {(record.role || "student").replace("-", " ").toUpperCase()}
          </span>
          <p>
            REF: <b>{record.designation || "Designation"}</b>
          </p>
          <p className="admin-id-card__pin">
            PIN: <b>{record.accessPin || "####"}</b>
          </p>
          {qrCode && (
            <img
              className="admin-id-card__qr"
              src={qrCode}
              alt={`QR code for access PIN ${record.accessPin}`}
            />
          )}
        </div>
      </article>
    </div>
  )
}
