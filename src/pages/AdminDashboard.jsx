import { useCallback, useEffect, useState } from "react"

import {
  Activity,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Eye,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  UserRound,
  X,
} from "lucide-react"

import {
  createEnrollment,
  deleteEnrollment,
  downloadRegistry,
  getDashboard,
  getEnrollments,
  verifyEnrollment,
} from "../data/api"

import "./AdminDashboard.css"

const navigation = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },

  { id: "enrollment", label: "Enrollment", Icon: Plus },

  { id: "registry", label: "Master Registry", Icon: Users },
]

const studentClasses = ["SSS 1", "SSS 2", "SSS 3", "JSS 1", "JSS 2", "JSS 3"]

const emptyForm = {
  fullName: "",

  role: "student",

  designation: "",

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

export default function AdminDashboard({ school, onLogout }) {
  const [activeView, setActiveView] = useState("dashboard")

  const [dashboard, setDashboard] = useState(null)

  const [records, setRecords] = useState([])

  const [nextCursor, setNextCursor] = useState(null)

  const [query, setQuery] = useState("")

  const [appliedQuery, setAppliedQuery] = useState("")

  const [registryLoading, setRegistryLoading] = useState(false)

  const [dashboardLoading, setDashboardLoading] = useState(true)

  const [busyId, setBusyId] = useState("")

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  const [logoutPending, setLogoutPending] = useState(false)

  const [form, setForm] = useState(emptyForm)

  const [createdEnrollment, setCreatedEnrollment] = useState(null)

  const [qrCode, setQrCode] = useState("")

  const [selectedRecord, setSelectedRecord] = useState(null)

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

      setError("")
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  const loadRegistry = useCallback(
    async ({ append = false, search = appliedQuery, cursor = null } = {}) => {
      setRegistryLoading(true)

      try {
        const result = await getEnrollments({
          query: search,

          cursor: append ? cursor : null,
        })

        setRecords((current) =>
          append ? [...current, ...result.items] : result.items,
        )

        setNextCursor(result.nextCursor)

        setError("")
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setRegistryLoading(false)
      }
    },
    [appliedQuery],
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (activeView === "registry") void loadRegistry({ search: appliedQuery })
  }, [activeView, appliedQuery, loadRegistry])

  async function handleEnrollmentSubmit(event) {
    event.preventDefault()

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

      if (activeView === "registry")
        await loadRegistry({ search: appliedQuery })
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  async function handlePassportChange(event) {
    const file = event.target.files?.[0]

    if (!file) return

    setError("")

    try {
      const passport = await optimizePassport(file)

      setForm((current) => ({ ...current, passport }))
    } catch (photoError) {
      setError(photoError.message)

      event.target.value = ""
    }
  }

  function handleRoleChange(role) {
    setCreatedEnrollment(null)

    setForm((current) => ({
      ...current,

      role,

      designation: "",

      assignedClasses: role === "teacher" ? current.assignedClasses : "",

      subjects: role === "teacher" ? current.subjects : "",

      dob: role === "student" ? current.dob : "",

      guardianPhone: role === "student" ? current.guardianPhone : "",

      phone: role === "student" ? "" : current.phone,

      password: role === "student" ? "" : current.password,
    }))
  }

  async function handleVerify(record) {
    setBusyId(record._id)

    setError("")

    setSuccess("")

    try {
      await verifyEnrollment(record._id)

      setRecords((current) =>
        current.map((entry) =>
          entry._id === record._id ? { ...entry, status: "Active" } : entry,
        ),
      )

      setSuccess(`${record.fullName} is now verified.`)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId("")
    }
  }

  async function handleDelete(record) {
    if (
      !window.confirm(`Remove ${record.fullName} from this school's registry?`)
    )
      return

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
    }
  }

  async function handleExport() {
    setError("")

    try {
      await downloadRegistry()
    } catch (exportError) {
      setError(exportError.message)
    }
  }

  async function handleLogout() {
    setLogoutPending(true)

    setError("")

    try {
      await onLogout()
    } catch (logoutError) {
      setError(logoutError.message)

      setLogoutPending(false)
    }
  }

  const title = navigation.find((item) => item.id === activeView)?.label

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#top" aria-label="AceEdu admin home">
          <span className="admin-brand__mark">
            <GraduationCap size={23} aria-hidden="true" />
          </span>
          <span>
            <strong>AceEdu</strong>
            <small>SCHOOL ADMIN</small>
          </span>
        </a>

        <div className="admin-sidebar__label">Workspace</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ id, label, Icon }) => (
            <button
              className={`admin-nav__item ${
                activeView === id ? "is-active" : ""
              }`}
              key={id}
              type="button"
              onClick={() => {
                setActiveView(id)
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

        <div className="admin-sidebar__spacer" />
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
          <div className="admin-topbar__context">
            <span>School workspace</span>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
          <div className="admin-topbar__account">
            <span className="admin-online-dot" />
            <span>{school.schoolName}</span>
          </div>
          <button
            className="admin-topbar__profile"
            type="button"
            onClick={() => setProfileOpen(true)}
          >
            <UserRound size={16} aria-hidden="true" /> Profile
          </button>
          <button
            className="admin-topbar__logout"
            type="button"
            onClick={handleLogout}
            disabled={logoutPending}
          >
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">{school.schoolName}</p>
              <h1>{activeView === "dashboard" ? "Welcome back" : title}</h1>
              <p className="admin-page-heading__description">
                {activeView === "dashboard" &&
                  "Here is an overview of your school workspace."}
                {activeView === "enrollment" &&
                  "Create and manage student and staff registry entries."}
                {activeView === "registry" &&
                  "Search, verify, and manage records belonging to your school."}
              </p>
            </div>
            {activeView !== "enrollment" && (
              <button
                className="admin-primary-button"
                type="button"
                onClick={() => {
                  setActiveView("enrollment")
                  setSuccess("")
                  setError("")
                }}
              >
                <Plus size={18} aria-hidden="true" /> Add enrollment
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
            <section aria-label="School dashboard">
              <div className="admin-stats-grid">
                <StatCard
                  Icon={GraduationCap}
                  label="Total students"
                  value={dashboard?.metrics.students}
                  loading={dashboardLoading}
                  tone="blue"
                />
                <StatCard
                  Icon={Users}
                  label="Total staff"
                  value={dashboard?.metrics.staff}
                  loading={dashboardLoading}
                  tone="gold"
                />
                <StatCard
                  Icon={ShieldCheck}
                  label="Total access keys"
                  value={dashboard?.metrics.total}
                  loading={dashboardLoading}
                  tone="violet"
                />
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel admin-school-card">
                  <div className="admin-panel__heading">
                    <div>
                      <span className="admin-panel__icon">
                        <GraduationCap size={19} />
                      </span>
                      <h2>School profile</h2>
                    </div>
                  </div>
                  <dl className="admin-school-details">
                    <Detail label="School name" value={school.schoolName} />
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
                <section className="admin-panel admin-account-card">
                  <span className="admin-account-card__icon">
                    <Activity size={20} />
                  </span>
                  <p className="admin-eyebrow">ACCOUNT ADMINISTRATOR</p>
                  <h2>{school.adminName}</h2>
                  <p>{school.adminRole}</p>
                  <div className="admin-account-card__contact">
                    <span>{school.adminEmail}</span>
                    <span>{school.adminPhone}</span>
                  </div>
                  <span className="admin-account-card__status">
                    <span className="admin-online-dot" /> Account active
                  </span>
                </section>
              </div>
              <section className="admin-panel admin-quick-actions">
                <div>
                  <span className="admin-panel__icon">
                    <Activity size={19} />
                  </span>
                  <div>
                    <h2>Manage your school</h2>
                    <p>
                      Enroll people, review records, and export your registry.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-outline-button"
                  onClick={() => setActiveView("registry")}
                >
                  Open master registry
                </button>
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
                        Target class
                        <select
                          value={
                            studentClasses.includes(form.designation)
                              ? form.designation
                              : form.designation
                                ? "custom"
                                : ""
                          }
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              designation:
                                event.target.value === "custom"
                                  ? "Custom"
                                  : event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Select class…</option>
                          <optgroup label="Senior secondary">
                            {studentClasses.slice(0, 3).map((className) => (
                              <option value={className} key={className}>
                                {className}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Junior secondary">
                            {studentClasses.slice(3).map((className) => (
                              <option value={className} key={className}>
                                {className}
                              </option>
                            ))}
                          </optgroup>
                          <option value="custom">Other / custom class</option>
                        </select>
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
                    {form.role === "student" &&
                      (form.designation === "Custom" ||
                        (!studentClasses.includes(form.designation) &&
                          form.designation !== "")) && (
                        <label>
                          Custom class
                          <input
                            value={
                              form.designation === "Custom"
                                ? ""
                                : form.designation
                            }
                            maxLength={120}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                designation: event.target.value,
                              }))
                            }
                            placeholder="Enter class or year"
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
                        <label>
                          Teaching classes
                          <input
                            value={form.assignedClasses}
                            maxLength={500}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                assignedClasses: event.target.value,
                              }))
                            }
                            placeholder="e.g. SSS 1, SSS 3"
                          />
                        </label>
                        <label>
                          Department / subject
                          <input
                            value={form.subjects}
                            maxLength={300}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                subjects: event.target.value,
                              }))
                            }
                            placeholder="e.g. Physics, Mathematics"
                          />
                        </label>
                      </>
                    )}
                    <label className="admin-photo-field">
                      Identity passport
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePassportChange}
                      />
                      <small>JPEG, PNG, or WebP · maximum 5 MB</small>
                    </label>
                    <div className="admin-enrollment-submit">
                      <button className="admin-primary-button" type="submit">
                        <Plus size={18} /> Create identity
                      </button>
                    </div>
                  </div>
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

          {activeView === "registry" && (
            <section
              className="admin-panel admin-registry-panel"
              aria-label="Master registry"
            >
              <div className="admin-registry-toolbar">
                <div className="admin-panel__heading">
                  <div>
                    <span className="admin-panel__icon">
                      <Users size={19} />
                    </span>
                    <h2>Master registry</h2>
                  </div>
                  <span className="admin-count-badge">
                    {records.length}
                    {nextCursor ? "+" : ""} records
                  </span>
                </div>
                <button
                  className="admin-outline-button"
                  type="button"
                  onClick={handleExport}
                >
                  <ArrowDownToLine size={17} /> Export CSV
                </button>
              </div>
              <form
                className="admin-search"
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
                <button className="admin-search__button" type="submit">
                  Search
                </button>
              </form>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Class / designation</th>
                      <th>Access PIN</th>
                      <th>Status</th>
                      <th>Added</th>
                      <th>
                        <span className="admin-visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {registryLoading && records.length === 0 && (
                      <tr>
                        <td colSpan="7" className="admin-empty">
                          <LoaderCircle size={21} className="admin-spin" />{" "}
                          Loading school records…
                        </td>
                      </tr>
                    )}
                    {!registryLoading && records.length === 0 && (
                      <tr>
                        <td colSpan="7" className="admin-empty">
                          No records found for this school.
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
                          <span
                            className={`admin-status ${
                              record.status === "Active" ? "is-active" : ""
                            }`}
                          >
                            <span />
                            {record.status}
                          </span>
                        </td>
                        <td>{formatDate(record.createdAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              aria-label={`View ${record.fullName}`}
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            {record.status !== "Active" && (
                              <button
                                type="button"
                                onClick={() => handleVerify(record)}
                                disabled={busyId === record._id}
                                aria-label={`Verify ${record.fullName}`}
                                title="Verify entry"
                              >
                                <Check size={16} />
                              </button>
                            )}
                            <button
                              className="is-danger"
                              type="button"
                              onClick={() => handleDelete(record)}
                              disabled={busyId === record._id}
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
            if (event.target === event.currentTarget) setSelectedRecord(null)
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
                onClick={() => setSelectedRecord(null)}
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

function StatCard({ Icon, label, value, loading, tone }) {
  return (
    <article className="admin-panel admin-stat-card">
      <span className={`admin-stat-card__icon is-${tone}`}>
        <Icon size={21} aria-hidden="true" />
      </span>
      <div>
        <p>{label}</p>
        <strong>
          {loading ? (
            <LoaderCircle
              size={23}
              className="admin-spin"
              aria-label="Loading"
            />
          ) : (
            (value ?? 0)
          )}
        </strong>
      </div>
      <span className="admin-stat-card__tag">ALL TIME</span>
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
