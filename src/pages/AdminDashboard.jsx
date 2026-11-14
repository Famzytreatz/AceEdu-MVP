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
  resetPortalMemberPassword,
  saveSchoolShortName,
  verifyEnrollment,
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"
import PremiumOperations from "./PremiumOperations"
import PremiumWorkspace from "./PremiumWorkspace"
import SchoolCurriculumSetup from "./SchoolCurriculumSetup"
import SchoolSettings from "./SchoolSettings"

import "./AdminDashboard.css"
import "./PremiumWorkspace.css"
import AdminDashboardOverview from "./AdminDashboardOverview"
import "./AdminDashboardRedesign.css"

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
  {
    id: "financialManagement",
    label: "Financial management",
    Icon: CircleDollarSign,
  },
  {
    id: "advancedReports",
    label: "Reports & analytics",
    Icon: ChartNoAxesCombined,
  },
  { id: "parentPortal", label: "Parent portal", Icon: UserRound },
  { id: "studentPortal", label: "Student portal", Icon: GraduationCap },
  { id: "teacherPortal", label: "Teacher portal", Icon: Users },
]

const implementedPremiumViews = new Set([
  "academicRecords",
  "attendance",
  "examinations",
  "financialManagement",
  "advancedReports",
  "parentPortal",
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

  guardianName: "",

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

function suggestedSchoolShortName(schoolName) {
  const words = schoolName.trim().split(/\s+/).filter(Boolean)
  const initials = words
    .map((word) => word[0])
    .join("")
    .toUpperCase()
  if (initials.length >= 3) return initials.slice(0, 3)
  return schoolName
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase()
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
    const savedTheme = window.localStorage.getItem("aceedu-admin-theme")
    return savedTheme === "light" ? "light" : "dark"
  } catch {
    return "dark"
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

  const [createdParentPortal, setCreatedParentPortal] = useState(null)

  const [qrCode, setQrCode] = useState("")

  const [selectedRecord, setSelectedRecord] = useState(null)

  const [passwordResetPending, setPasswordResetPending] = useState(false)

  const [passwordResetResult, setPasswordResetResult] = useState(null)

  const [profileOpen, setProfileOpen] = useState(false)

  const [shortNamePromptRole, setShortNamePromptRole] = useState("")

  const [shortNameDraft, setShortNameDraft] = useState("")

  const [shortNamePending, setShortNamePending] = useState(false)

  const [shortNameError, setShortNameError] = useState("")

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
    if (!selectedRecord && !profileOpen && !shortNamePromptRole)
      return undefined

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setSelectedRecord(null)
        setPasswordResetResult(null)
        setProfileOpen(false)
        cancelSchoolShortNamePrompt()
      }
    }

    window.addEventListener("keydown", closeOnEscape)

    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [profileOpen, selectedRecord, shortNamePending, shortNamePromptRole])

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

          role:
            activeView === "students"
              ? "student"
              : activeView === "staff"
                ? "staff"
                : "",
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
    setCreatedParentPortal(null)

    try {
      const result = await createEnrollment(form)

      setCreatedEnrollment(result.enrollment)
      setCreatedParentPortal(result.parentPortal || null)

      setSuccess(
        `${result.enrollment.fullName} was added to ${school.schoolName}'s registry. Access code: ${result.enrollment.accessPin}`,
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

  function openEnrollment(role) {
    setForm({ ...emptyForm, role })
    setCreatedEnrollment(null)
    setActiveView("enrollment")
    setError("")
    setSuccess("")
  }

  function startEnrollment(role) {
    if (!school.shortName) {
      setShortNamePromptRole(role)
      setShortNameDraft(suggestedSchoolShortName(school.schoolName))
      setShortNameError("")
      return
    }

    openEnrollment(role)
  }

  async function handleSchoolShortNameSubmit(event) {
    event.preventDefault()
    if (shortNamePending) return

    setShortNamePending(true)
    setShortNameError("")
    try {
      const result = await saveSchoolShortName(shortNameDraft)
      onSchoolUpdated({ ...school, ...result.school })
      setShortNamePromptRole("")
      openEnrollment(shortNamePromptRole)
    } catch (saveError) {
      setShortNameError(saveError.message)
    } finally {
      setShortNamePending(false)
    }
  }

  function cancelSchoolShortNamePrompt() {
    if (shortNamePending) return
    setShortNamePromptRole("")
    setShortNameError("")
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

  async function handlePortalPasswordReset(record) {
    if (passwordResetLock.current) return

    if (
      !window.confirm(
        `Reset ${record.fullName}'s portal password? A one-time login code will be shown once and must be changed before portal access.`,
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
      const result = await resetPortalMemberPassword(record._id)
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
      setSuccess(
        `A one-time portal login code was generated for ${record.fullName}.`,
      )
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
    form.assignedClasses
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  const teacherSubjectOptions = [
    ...new Set(
      classLevels
        .filter(
          (level) => level.isActive && selectedTeacherClasses.has(level.name),
        )
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
        <a className="admin-brand" href="#top" aria-label="Aces Academy admin home">
  <span className="admin-brand__mark" aria-hidden="true">
    <span className="admin-brand__letter">A</span>
  </span>
  <span>
    <strong>Aces Academy</strong>
    <small>Manage · Educate · Grow</small>
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
              aria-label={
                label === "Students"
                  ? "Student management"
                  : label === "Staff"
                    ? "Staff management"
                    : label
              }
              onClick={() => {
                if (id === "enrollment") {
                  startEnrollment("student")
                  return
                }
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
        <nav
          className="admin-nav admin-nav--premium"
          aria-label="Premium features"
        >
          {premiumNavigation.map(({ id, label, Icon }) => {
            const featureImplemented = implementedPremiumViews.has(id)
            const featureEnabled =
              !entitlementLoading && premiumAccessActive && featureImplemented
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
                      ? `${label} is loading or unavailable.`
                      : `${label} requires an active Premium entitlement and is not available yet.`
                }
                onClick={() => setActiveView(id)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {featureEnabled ? (
                  <Check
                    className="admin-nav__lock"
                    size={14}
                    aria-hidden="true"
                  />
                ) : (
                  <LockKeyhole
                    className="admin-nav__lock"
                    size={13}
                    aria-hidden="true"
                  />
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
          <strong>
            {premiumAccessActive
              ? "Premium access is active"
              : "Unlock more for your school"}
          </strong>
          <p>
            {premiumAccessActive
              ? "Your school's academic, finance, reporting, family and portal workflows are ready."
              : "Explore the Premium roadmap and upcoming school workflows."}
          </p>
          <button
            type="button"
            onClick={() =>
              document.getElementById("premium-preview")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
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
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            aria-label={`Switch to ${
              theme === "dark" ? "light" : "dark"
            } theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <Sun size={17} aria-hidden="true" />
            ) : (
              <Moon size={17} aria-hidden="true" />
            )}
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
              {school.adminName
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
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
              <LoaderCircle
                size={17}
                className="admin-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut size={17} aria-hidden="true" />
            )}
            {logoutPending ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">
                {activeView === "dashboard"
                  ? "SCHOOL OVERVIEW"
                  : school.schoolName}
              </p>
              <h1>
                {activeView === "dashboard"
                  ? `Welcome back, ${school.adminName.split(/\s+/)[0]}`
                  : title}
              </h1>
              <p className="admin-page-heading__description">
                {activeView === "dashboard" &&
                  `Your ${school.schoolName} workspace, at a glance.`}
                {activeView === "enrollment" &&
                  "Create and manage student and staff registry entries."}
                {activeView === "settings" &&
                  "Manage the school structure and preferences for your workspace."}
                {activeView === "classes" &&
                  "Organize class levels, subject options, and student approvals."}
                {activeView === "academicRecords" &&
                  "Review historical academic sessions, class performance, and student progress."}
                {activeView === "attendance" &&
                  "Record daily attendance by class and review saved registers."}
                {activeView === "examinations" &&
                  "Create class assessments, enter scores, and publish results."}
                {activeView === "financialManagement" &&
                  "Manage fee schedules, student invoices, manual payments, and printable receipts."}
                {activeView === "advancedReports" &&
                  "Explore enrollment, attendance, and academic performance from live school records."}
                {activeView === "parentPortal" &&
                  "Manage linked parent accounts and publish updates to the shared school feed."}
                {(activeView === "studentPortal" ||
                  activeView === "teacherPortal") &&
                  "Share the school-specific portal sign-in with your community."}
                {(activeView === "registry" ||
                  activeView === "students" ||
                  activeView === "staff") &&
                  (activeView === "students"
                    ? "Manage student identities and enrollment records for your school."
                    : activeView === "staff"
                      ? "Manage teaching and administrative staff in your school."
                      : "Search, verify, and manage records belonging to your school.")}
              </p>
            </div>
            {![
              "enrollment",
              "settings",
              "classes",
              "academicRecords",
              "attendance",
              "examinations",
              "financialManagement",
              "advancedReports",
              "parentPortal",
              "studentPortal",
              "teacherPortal",
            ].includes(activeView) && (
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
  <AdminDashboardOverview
    school={school}
    dashboard={dashboard}
    dashboardLoading={dashboardLoading}
    dashboardError={dashboardError}
    onRetry={() => void loadDashboard()}
    premiumAccessActive={premiumAccessActive}
    onStartEnrollment={startEnrollment}
    onOpenView={setActiveView}
    onExport={handleExport}
    exportingRegistry={exportingRegistry}
    entitlement={entitlement}
    entitlementLoading={entitlementLoading}
    entitlementError={entitlementError}
    registrationId={registrationId}
    verificationPending={verificationPending}
    verificationMessage={verificationMessage}
    onRegistrationIdChange={setRegistrationId}
    onVerificationRequest={handleVerificationRequest}
    onRefreshEntitlement={() => void loadEntitlement()}
  />
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
                  Each record and generated access code is scoped to{" "}
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
                              Class options could not be loaded:{" "}
                              {curriculumError}
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
                            Guardian name
                            <input
                              value={form.guardianName}
                              maxLength={160}
                              required
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  guardianName: event.target.value,
                                }))
                              }
                              placeholder="Parent or guardian full name"
                            />
                          </label>
                          <label>
                            Guardian phone
                            <input
                              type="tel"
                              value={form.guardianPhone}
                              maxLength={30}
                              required
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  guardianPhone: event.target.value,
                                }))
                              }
                              placeholder="Guardian contact number"
                            />
                            <small>
                              A parent portal is created automatically. Siblings
                              with this phone join the same family account.
                            </small>
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
                            {classLevels
                              .filter((level) => level.isActive)
                              .map((level) => (
                                <label key={level.id}>
                                  <input
                                    type="checkbox"
                                    checked={selectedTeacherClasses.has(
                                      level.name,
                                    )}
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
                            {teacherSubjectOptions.length ? (
                              teacherSubjectOptions.map((subject) => (
                                <label key={subject}>
                                  <input
                                    type="checkbox"
                                    checked={form.subjects
                                      .split(",")
                                      .map((item) => item.trim())
                                      .includes(subject)}
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
                              ))
                            ) : (
                              <small>
                                Select teaching classes that already have
                                subject options configured.
                              </small>
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
                    {createdParentPortal &&
                      createdEnrollment.role === "student" && (
                        <div className="admin-enrollment-note" role="status">
                          <Users size={20} aria-hidden="true" />
                          {createdParentPortal.status === "linked" ? (
                            <>
                              <h2>
                                {createdParentPortal.isFamily
                                  ? "Family portal linked"
                                  : "Parent portal created"}
                              </h2>
                              <p>
                                {createdParentPortal.studentCount} student
                                {createdParentPortal.studentCount === 1
                                  ? ""
                                  : "s"}{" "}
                                linked to {createdEnrollment.guardianName} at{" "}
                                {createdEnrollment.guardianPhone}.
                                {createdParentPortal.setupCode
                                  ? " A unique setup code is ready to share. It expires in 24 hours and must be changed after sign-in."
                                  : " The existing parent account and its current sign-in were kept."}
                              </p>
                              {createdParentPortal.setupCode && (
                                <>
                                  <p>
                                    <strong>One-time setup code: </strong>
                                    <code>{createdParentPortal.setupCode}</code>
                                  </p>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <h2>Parent portal needs attention</h2>
                              <p>
                                {createdParentPortal.status ===
                                "parent_unavailable"
                                  ? "A parent account already uses this phone but is disabled. The student was registered; review the existing parent account before linking."
                                  : createdParentPortal.status ===
                                      "premium_required"
                                    ? "The student was registered, but automatic family access requires the Parent Portal Premium entitlement."
                                    : createdParentPortal.status ===
                                        "entitlement_check_failed"
                                      ? "The student was registered, but AceEdu could not verify the Parent Portal entitlement. Retry after checking the school account."
                                      : "The student was registered, but family portal linking failed. Review the parent account and linked students before retrying."}
                              </p>
                            </>
                          )}
                        </div>
                      )}
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
              premiumAccessActive={premiumAccessActive}
              premiumLoading={entitlementLoading}
            />
          )}
          {activeView === "attendance" && (
            <PremiumOperations mode="attendance" />
          )}
          {activeView === "academicRecords" && (
            <PremiumOperations
              mode="academicRecords"
              onOpenSettings={() => setActiveView("settings")}
            />
          )}
          {activeView === "examinations" && (
            <PremiumOperations mode="examinations" />
          )}
          {activeView === "financialManagement" && (
            <PremiumWorkspace mode="financialManagement" school={school} />
          )}
          {activeView === "advancedReports" && (
            <PremiumWorkspace mode="advancedReports" school={school} />
          )}
          {activeView === "parentPortal" && (
            <PremiumWorkspace mode="parentPortal" school={school} />
          )}
          {(activeView === "studentPortal" ||
            activeView === "teacherPortal") && (
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
                    <h2>
                      {activeView === "studentPortal"
                        ? "Student portal"
                        : "Teacher portal"}
                    </h2>
                    <p>
                      Share one school-specific sign-in address with students
                      and teachers.
                    </p>
                  </div>
                </div>
              </div>
              <div className="admin-portal-access__link">
                {school.slug ? (
                  <>
                    <code>
                      {window.location.origin}/s/
                      {encodeURIComponent(school.slug)}/portal
                    </code>
                    <a
                      className="admin-primary-button"
                      href={`/s/${encodeURIComponent(school.slug)}/portal`}
                    >
                      Open shared sign-in <ArrowUpRight size={15} />
                    </a>
                  </>
                ) : (
                  <span>
                    School URL is unavailable until a school identity is
                    configured.
                  </span>
                )}
              </div>
              <p className="admin-portal-access__hint">
                Access requires an active enrollment in this school and the
                member’s existing school-issued sign-in credentials. Premium
                access is checked by the server.
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
                  placeholder="Search by name, role, or access code"
                  aria-label="Search registry by name, role, or access code"
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
                <button
                  className="admin-search__button"
                  type="submit"
                  disabled={registryLoading}
                >
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
                  <LoaderCircle size={15} className="admin-spin" /> Updating
                  registry…
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
                      <th>Access code</th>
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
                    {!registryLoading &&
                      !registryError &&
                      records.length === 0 && (
                        <tr>
                          <td colSpan="8" className="admin-empty">
                            <span className="admin-empty__icon">
                              <Users size={20} />
                            </span>
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
                            {!appliedQuery &&
                              !registryStatus &&
                              activeView !== "staff" && (
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
                              record.status === "Active"
                                ? "is-active"
                                : "is-pending"
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
                    <span>
                      Adjust your filters or add a record to this school.
                    </span>
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
      {shortNamePromptRole && (
        <div
          className="admin-modal-backdrop admin-short-name-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelSchoolShortNamePrompt()
            }
          }}
        >
          <section
            className="admin-modal admin-short-name-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-short-name-title"
          >
            <header className="admin-modal__header">
              <div>
                <span className="admin-panel__icon">
                  <IdCard size={19} aria-hidden="true" />
                </span>
                <h2 id="admin-short-name-title">Create your school code</h2>
              </div>
              <button
                className="admin-modal__close"
                type="button"
                onClick={cancelSchoolShortNamePrompt}
                aria-label="Cancel adding a school member"
                disabled={shortNamePending}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <form
              className="admin-short-name-form"
              onSubmit={handleSchoolShortNameSubmit}
            >
              <p>
                Before adding a{" "}
                {shortNamePromptRole === "student" ? "student" : "staff member"}
                , choose a unique three-letter code for {school.schoolName}. It
                will appear at the start of every access code.
              </p>
              <label htmlFor="admin-school-short-name">
                School short name
                <input
                  id="admin-school-short-name"
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={3}
                  minLength={3}
                  pattern="[A-Za-z]{3}"
                  placeholder="EIS"
                  value={shortNameDraft}
                  onChange={(event) => {
                    setShortNameDraft(
                      event.target.value.replace(/[^a-z]/gi, "").toUpperCase(),
                    )
                    setShortNameError("")
                  }}
                  aria-describedby="admin-school-short-name-hint"
                  required
                  disabled={shortNamePending}
                />
              </label>
              <small
                className="admin-short-name-hint"
                id="admin-school-short-name-hint"
              >
                Use exactly three letters, for example EIS for Eliud
                International School.
              </small>
              {shortNameDraft.length === 3 && (
                <div className="admin-short-name-preview" aria-live="polite">
                  <span>ACCESS CODE PREVIEW</span>
                  <code>{shortNameDraft}-23456</code>
                </div>
              )}
              {shortNameError && (
                <p className="admin-alert admin-alert--error" role="alert">
                  {shortNameError}
                </p>
              )}
              <div className="admin-short-name-actions">
                <button
                  className="admin-outline-button"
                  type="button"
                  onClick={cancelSchoolShortNamePrompt}
                  disabled={shortNamePending}
                >
                  Cancel
                </button>
                <button
                  className="admin-primary-button"
                  type="submit"
                  disabled={
                    shortNamePending || !/^[A-Z]{3}$/.test(shortNameDraft)
                  }
                >
                  {shortNamePending ? "Saving code…" : "Save and continue"}
                  {!shortNamePending && (
                    <ArrowUpRight size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
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
                {["student", "teacher"].includes(selectedRecord.role) && (
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
                <Detail label="Access code" value={selectedRecord.accessPin} />
              </dl>
            </div>
            {["student", "teacher"].includes(selectedRecord.role) && (
              <div style={{ padding: "0 1.5rem 1.5rem" }}>
                <button
                  className="admin-outline-button"
                  type="button"
                  disabled={passwordResetPending}
                  onClick={() => handlePortalPasswordReset(selectedRecord)}
                >
                  {passwordResetPending ? (
                    <LoaderCircle size={16} className="admin-spin" />
                  ) : (
                    <LockKeyhole size={16} />
                  )}
                  {passwordResetPending
                    ? "Resetting password…"
                    : `Reset ${selectedRecord.role} password`}
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
                    One-time login code (shown once):{" "}
                    <code>{passwordResetResult.temporaryPassword}</code>
                    <br />
                    Share it securely with the {selectedRecord.role}. They must
                    choose a new password before accessing portal features.
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
      <button type="button" onClick={onRetry} title={error}>
        Retry
      </button>
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
    x:
      padding.left +
      (points.length === 1
        ? chartWidth / 2
        : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (point.total / maximum) * chartHeight,
  }))
  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const area = `${line} L ${coordinates.at(-1).x} ${padding.top + chartHeight} L ${coordinates[0].x} ${padding.top + chartHeight} Z`

  return (
    <div className="admin-trend-chart">
      <div className="admin-trend-chart__summary">
        <span>New student records</span>
        <strong>
          {points.reduce((sum, point) => sum + point.total, 0).toLocaleString()}
        </strong>
        <small>Across the periods shown</small>
      </div>
      <svg
        className="admin-trend-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Student registrations for the last six months: ${points.map((point) => `${point.month} ${point.total}`).join(", ")}`}
      >
        <defs>
          <linearGradient
            id="admin-trend-fill"
            x1="280"
            y1="15"
            x2="280"
            y2="158"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#4384FF" stopOpacity=".22" />
            <stop offset="1" stopColor="#4384FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="admin-trend-line"
            x1="16"
            y1="20"
            x2="544"
            y2="155"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#397DFF" />
            <stop offset="1" stopColor="#7765E8" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((lineIndex) => {
          const y = padding.top + (chartHeight / 2) * lineIndex
          return (
            <line
              key={lineIndex}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              className="admin-trend-chart__gridline"
            />
          )
        })}
        <path d={area} fill="url(#admin-trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="url(#admin-trend-line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordinates.map((point) => (
          <g key={point.month}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              className="admin-trend-chart__point"
            />
            <text
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="admin-trend-chart__label"
            >
              {point.month}
            </text>
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
          <span className="admin-class-distribution__label">
            {item.className}
          </span>
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
      <span aria-hidden="true">
        <Activity size={18} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function RegistrySkeletonRows() {
  return Array.from({ length: 4 }, (_, row) => (
    <tr
      className="admin-table-skeleton"
      key={`loading-${row}`}
      aria-hidden="true"
    >
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
      <span
        className="admin-registry-card-skeleton__avatar"
        aria-hidden="true"
      />
      <span className="admin-registry-card-skeleton__line" aria-hidden="true" />
      <span
        className="admin-registry-card-skeleton__line is-short"
        aria-hidden="true"
      />
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
        <div>
          <dt>Class / designation</dt>
          <dd>{record.designation || "—"}</dd>
        </div>
        <div>
          <dt>Access code</dt>
          <dd>
            <code className="admin-pin">{record.accessPin}</code>
          </dd>
        </div>
        {record.role === "student" && (
          <div>
            <dt>Portal password</dt>
            <dd>{record.hasPortalPassword ? "Set" : "Not set"}</dd>
          </div>
        )}
        <div>
          <dt>Added</dt>
          <dd>{formatDate(record.createdAt)}</dd>
        </div>
      </dl>
      <div
        className="admin-registry-card__actions"
        aria-label={`Actions for ${record.fullName}`}
      >
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${record.fullName}`}
        >
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
              alt={`QR code for access code ${record.accessPin}`}
            />
          )}
        </div>
      </article>
    </div>
  )
}
