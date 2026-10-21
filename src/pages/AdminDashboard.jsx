import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  ArrowDownToLine,
  Check,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
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

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
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
  const [form, setForm] = useState({ fullName: "", role: "student", designation: "" })

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

  const loadRegistry = useCallback(async ({ append = false, search = appliedQuery, cursor = null } = {}) => {
    setRegistryLoading(true)
    try {
      const result = await getEnrollments({
        query: search,
        cursor: append ? cursor : null,
      })
      setRecords((current) => append ? [...current, ...result.items] : result.items)
      setNextCursor(result.nextCursor)
      setError("")
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setRegistryLoading(false)
    }
  }, [appliedQuery])

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
    try {
      const result = await createEnrollment(form)
      setSuccess(`${result.enrollment.fullName} was added to ${school.schoolName}'s registry.`)
      setForm({ fullName: "", role: "student", designation: "" })
      await loadDashboard()
      if (activeView === "registry") await loadRegistry({ search: appliedQuery })
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  async function handleVerify(record) {
    setBusyId(record._id)
    setError("")
    setSuccess("")
    try {
      await verifyEnrollment(record._id)
      setRecords((current) => current.map((entry) =>
        entry._id === record._id ? { ...entry, status: "Active" } : entry,
      ))
      setSuccess(`${record.fullName} is now verified.`)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId("")
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Remove ${record.fullName} from this school's registry?`)) return
    setBusyId(record._id)
    setError("")
    setSuccess("")
    try {
      await deleteEnrollment(record._id)
      setRecords((current) => current.filter((entry) => entry._id !== record._id))
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
          <span className="admin-brand__mark"><GraduationCap size={23} aria-hidden="true" /></span>
          <span><strong>AceEdu</strong><small>SCHOOL ADMIN</small></span>
        </a>

        <div className="admin-sidebar__label">Workspace</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ id, label, Icon }) => (
            <button
              className={`admin-nav__item ${activeView === id ? "is-active" : ""}`}
              key={id}
              type="button"
              onClick={() => { setActiveView(id); setError(""); setSuccess("") }}
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
            {school.adminName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="admin-profile__identity">
            <strong>{school.adminName}</strong>
            <span>{school.adminRole}</span>
          </div>
          <button className="admin-profile__logout" type="button" onClick={handleLogout} disabled={logoutPending} aria-label="Sign out">
            {logoutPending ? <LoaderCircle size={18} className="admin-spin" /> : <LogOut size={18} />}
          </button>
        </div>
      </aside>

      <main className="admin-main" id="top">
        <header className="admin-topbar">
          <div className="admin-topbar__context">
            <span>School workspace</span><ChevronDown size={14} aria-hidden="true" />
          </div>
          <div className="admin-topbar__account">
            <span className="admin-online-dot" />
            <span>{school.schoolName}</span>
          </div>
          <button className="admin-topbar__logout" type="button" onClick={handleLogout} disabled={logoutPending}>
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">{school.schoolName}</p>
              <h1>{activeView === "dashboard" ? "Welcome back" : title}</h1>
              <p className="admin-page-heading__description">
                {activeView === "dashboard" && "Here is an overview of your school workspace."}
                {activeView === "enrollment" && "Create and manage student and staff registry entries."}
                {activeView === "registry" && "Search, verify, and manage records belonging to your school."}
              </p>
            </div>
            {activeView !== "enrollment" && (
              <button className="admin-primary-button" type="button" onClick={() => { setActiveView("enrollment"); setSuccess(""); setError("") }}>
                <Plus size={18} aria-hidden="true" /> Add enrollment
              </button>
            )}
          </div>

          {error && (
            <div className="admin-alert admin-alert--error" role="alert">
              <AlertCircleIcon />
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button>
            </div>
          )}
          {success && (
            <div className="admin-alert admin-alert--success" role="status">
              <Check size={18} aria-hidden="true" /><span>{success}</span>
              <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message"><X size={17} /></button>
            </div>
          )}

          {activeView === "dashboard" && (
            <section aria-label="School dashboard">
              <div className="admin-stats-grid">
                <StatCard Icon={GraduationCap} label="Total students" value={dashboard?.metrics.students} loading={dashboardLoading} tone="blue" />
                <StatCard Icon={Users} label="Total staff" value={dashboard?.metrics.staff} loading={dashboardLoading} tone="gold" />
                <StatCard Icon={ShieldCheck} label="Registry entries" value={dashboard?.metrics.total} loading={dashboardLoading} tone="violet" />
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel admin-school-card">
                  <div className="admin-panel__heading">
                    <div><span className="admin-panel__icon"><GraduationCap size={19} /></span><h2>School profile</h2></div>
                  </div>
                  <dl className="admin-school-details">
                    <Detail label="School name" value={school.schoolName} />
                    <Detail label="School type" value={school.schoolType} />
                    <Detail label="Location" value={[school.city, school.state, school.country].filter(Boolean).join(", ")} />
                    <Detail label="Address" value={school.address} />
                    <Detail label="School contact" value={`${school.schoolEmail} · ${school.schoolPhone}`} />
                  </dl>
                </section>
                <section className="admin-panel admin-account-card">
                  <span className="admin-account-card__icon"><Activity size={20} /></span>
                  <p className="admin-eyebrow">ACCOUNT ADMINISTRATOR</p>
                  <h2>{school.adminName}</h2>
                  <p>{school.adminRole}</p>
                  <div className="admin-account-card__contact">
                    <span>{school.adminEmail}</span>
                    <span>{school.adminPhone}</span>
                  </div>
                  <span className="admin-account-card__status"><span className="admin-online-dot" /> Account active</span>
                </section>
              </div>
              <section className="admin-panel admin-quick-actions">
                <div><span className="admin-panel__icon"><Activity size={19} /></span><div><h2>Manage your school</h2><p>Enroll people, review records, and export your registry.</p></div></div>
                <button type="button" className="admin-outline-button" onClick={() => setActiveView("registry")}>Open master registry</button>
              </section>
            </section>
          )}

          {activeView === "enrollment" && (
            <div className="admin-enrollment-layout">
              <section className="admin-panel admin-enrollment-panel">
                <div className="admin-panel__heading">
                  <div><span className="admin-panel__icon"><Plus size={19} /></span><h2>New registry entry</h2></div>
                  <span className="admin-private-label"><ShieldCheck size={15} /> School only</span>
                </div>
                <p className="admin-panel__description">Each record and generated access PIN is scoped to {school.schoolName}.</p>
                <form className="admin-enrollment-form" onSubmit={handleEnrollmentSubmit}>
                  <label>Account role
                    <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                      <option value="student">Student</option>
                      <option value="teacher">Faculty / Teacher</option>
                      <option value="sub-admin">Sub-admin</option>
                      <option value="school-admin">School admin</option>
                    </select>
                  </label>
                  <label>Full name
                    <input value={form.fullName} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Enter full name" required />
                  </label>
                  <label>{form.role === "student" ? "Class" : "Designation"}
                    <input value={form.designation} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} placeholder={form.role === "student" ? "e.g. Year 7" : "e.g. Mathematics teacher"} required />
                  </label>
                  <button className="admin-primary-button" type="submit"><Plus size={18} /> Create registry entry</button>
                </form>
              </section>
              <aside className="admin-enrollment-note">
                <ShieldCheck size={24} aria-hidden="true" />
                <h2>Private school records</h2>
                <p>New records are assigned to the signed-in school's secure workspace. Other schools cannot access this registry.</p>
              </aside>
            </div>
          )}

          {activeView === "registry" && (
            <section className="admin-panel admin-registry-panel" aria-label="Master registry">
              <div className="admin-registry-toolbar">
                <div className="admin-panel__heading">
                  <div><span className="admin-panel__icon"><Users size={19} /></span><h2>Master registry</h2></div>
                  <span className="admin-count-badge">{records.length}{nextCursor ? "+" : ""} records</span>
                </div>
                <button className="admin-outline-button" type="button" onClick={handleExport}><ArrowDownToLine size={17} /> Export CSV</button>
              </div>
              <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); setNextCursor(null) }}>
                <Search size={18} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or access PIN" aria-label="Search registry" />
                <button className="admin-search__button" type="submit">Search</button>
              </form>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Class / designation</th><th>Access PIN</th><th>Status</th><th>Added</th><th><span className="admin-visually-hidden">Actions</span></th></tr></thead>
                  <tbody>
                    {registryLoading && records.length === 0 && <tr><td colSpan="7" className="admin-empty"><LoaderCircle size={21} className="admin-spin" /> Loading school records…</td></tr>}
                    {!registryLoading && records.length === 0 && <tr><td colSpan="7" className="admin-empty">No records found for this school.</td></tr>}
                    {records.map((record) => (
                      <tr key={record._id}>
                        <td><div className="admin-table-name"><span className="admin-table-avatar">{record.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><strong>{record.fullName}</strong></div></td>
                        <td><span className="admin-role-badge">{record.role}</span></td>
                        <td>{record.designation}</td>
                        <td><code className="admin-pin">{record.accessPin}</code></td>
                        <td><span className={`admin-status ${record.status === "Active" ? "is-active" : ""}`}><span />{record.status}</span></td>
                        <td>{formatDate(record.createdAt)}</td>
                        <td><div className="admin-row-actions">
                          {record.status !== "Active" && <button type="button" onClick={() => handleVerify(record)} disabled={busyId === record._id} aria-label={`Verify ${record.fullName}`} title="Verify entry"><Check size={16} /></button>}
                          <button className="is-danger" type="button" onClick={() => handleDelete(record)} disabled={busyId === record._id} aria-label={`Delete ${record.fullName}`} title="Delete entry">{busyId === record._id ? <LoaderCircle size={16} className="admin-spin" /> : <Trash2 size={16} />}</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextCursor && <div className="admin-load-more"><button className="admin-outline-button" type="button" disabled={registryLoading} onClick={() => loadRegistry({ append: true, cursor: nextCursor })}>{registryLoading ? "Loading…" : "Load more records"}</button></div>}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function AlertCircleIcon() {
  return <span className="admin-alert__symbol" aria-hidden="true">!</span>
}

function StatCard({ Icon, label, value, loading, tone }) {
  return (
    <article className="admin-panel admin-stat-card">
      <span className={`admin-stat-card__icon is-${tone}`}><Icon size={21} aria-hidden="true" /></span>
      <div><p>{label}</p><strong>{loading ? <LoaderCircle size={23} className="admin-spin" aria-label="Loading" /> : value ?? 0}</strong></div>
      <span className="admin-stat-card__tag">ALL TIME</span>
    </article>
  )
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>
}
