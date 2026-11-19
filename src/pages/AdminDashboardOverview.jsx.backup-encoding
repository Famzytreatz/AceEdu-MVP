import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  GraduationCap,
  IdCard,
  LockKeyhole,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { getFinanceData } from "../data/api"

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-NG")
}

function formatMoney(value, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0))
  } catch {
    return `${currency} ${formatNumber(value)}`
  }
}

function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "â€”"
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? "â€”"
    : new Intl.DateTimeFormat("en-NG", options).format(date)
}

function timeAgo(value) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return "Recently"
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getInitials(value = "") {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function MetricCard({ Icon, label, value, detail, tone, loading, locked, error }) {
  return (
    <article className={`ace-metric-card is-${tone}`}>
      <div className="ace-metric-card__top">
        <span className="ace-metric-card__icon">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="ace-metric-card__label">{label}</span>
      </div>
      <strong className="ace-metric-card__value">
        {loading ? (
          <span className="ace-skeleton ace-skeleton--metric" aria-hidden="true" />
        ) : error ? (
          "â€”"
        ) : locked ? (
          <span className="ace-locked-value"><LockKeyhole size={15} /> Premium</span>
        ) : (
          value
        )}
      </strong>
      <div className="ace-metric-card__foot">
        <span>{detail}</span>
      </div>
      <span className="ace-metric-card__glow" aria-hidden="true" />
    </article>
  )
}

function EnrollmentTrend({ points }) {
  const width = 620
  const height = 220
  const padding = { top: 14, right: 18, bottom: 34, left: 34 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maximum = Math.max(4, ...points.map((point) => Number(point.total) || 0))
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - ((Number(point.total) || 0) / maximum) * chartHeight,
  }))

  const linePath = coordinates.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = coordinates[index - 1]
    const middleX = (previous.x + point.x) / 2
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`
  }, "")
  const baseline = padding.top + chartHeight
  const areaPath = coordinates.length
    ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${baseline} L ${coordinates[0].x} ${baseline} Z`
    : ""
  const total = points.reduce((sum, point) => sum + (Number(point.total) || 0), 0)

  return (
    <div className="ace-trend-chart">
      <div className="ace-trend-chart__summary">
        <div>
          <span>New student registrations</span>
          <strong>{formatNumber(total)}</strong>
        </div>
        <small>Last six months</small>
      </div>
      <svg
        className="ace-trend-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Student registrations over the last six months: ${points.map((point) => `${point.month}: ${point.total}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="ace-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#287cff" stopOpacity=".36" />
            <stop offset="100%" stopColor="#287cff" stopOpacity=".015" />
          </linearGradient>
          <linearGradient id="ace-trend-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b8dff" />
            <stop offset="100%" stopColor="#8b70ff" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((tick) => {
          const y = padding.top + (chartHeight / 3) * tick
          const value = Math.round(maximum * (1 - tick / 3))
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="ace-chart-gridline" />
              <text x={padding.left - 9} y={y + 4} textAnchor="end" className="ace-chart-axis-label">{value}</text>
            </g>
          )
        })}
        <path d={areaPath} fill="url(#ace-trend-area)" />
        <path d={linePath} fill="none" stroke="url(#ace-trend-line)" strokeWidth="3.2" strokeLinecap="round" />
        {coordinates.map((point) => (
          <g key={`${point.month}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="7" fill="#468dff" opacity=".18" />
            <circle cx={point.x} cy={point.y} r="3.7" className="ace-chart-point" />
            <text x={point.x} y={height - 8} textAnchor="middle" className="ace-chart-month">{point.month}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ClassDistribution({ items }) {
  const colors = ["#13c7ee", "#16d5b5", "#a16cff", "#ff914d", "#e15cae", "#557dff", "#9acb55"]
  const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  let cursor = 0
  const segments = items.map((item, index) => {
    const start = cursor
    cursor += total ? ((Number(item.total) || 0) / total) * 100 : 0
    return `${colors[index % colors.length]} ${start}% ${cursor}%`
  })
  const donutStyle = {
    background: total
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#29466d 0% 100%)",
  }

  return (
    <div className="ace-class-distribution">
      <div className="ace-donut" style={donutStyle} role="img" aria-label={`${formatNumber(total)} students distributed across ${items.length} classes`}>
        <div className="ace-donut__centre">
          <strong>{formatNumber(total)}</strong>
          <span>Total students</span>
        </div>
      </div>
      <ul className="ace-class-legend">
        {items.map((item, index) => (
          <li key={item.className}>
            <span className="ace-class-legend__name">
              <i style={{ background: colors[index % colors.length] }} />
              {item.className}
            </span>
            <strong>{formatNumber(item.total)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyState({ Icon = Activity, title, description }) {
  return (
    <div className="ace-empty-state">
      <span><Icon size={21} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function SchoolAccessCard({
  school,
  entitlement,
  entitlementLoading,
  entitlementError,
  premiumAccessActive,
  registrationId,
  verificationPending,
  verificationMessage,
  onRegistrationIdChange,
  onVerificationRequest,
  onRefreshEntitlement,
}) {
  const status = entitlementLoading
    ? "Checking school accessâ€¦"
    : premiumAccessActive && entitlement?.trialActive
      ? `Premium trial Â· ends ${formatDate(entitlement.trialEndsAt)}`
      : premiumAccessActive && entitlement?.plan === "premium"
        ? "Premium plan active"
        : entitlement?.trialPreviouslyGranted
          ? "Trial ended Â· MVP access active"
          : entitlement?.verificationStatus === "pending"
            ? "School verification pending"
            : entitlement?.verificationStatus === "review_required"
              ? "Additional identity review required"
              : entitlement?.verificationStatus === "verified"
                ? "School verified Â· MVP access active"
                : entitlement?.verificationStatus === "rejected"
                  ? "Verification needs another review"
                  : "MVP plan Â· default access"

  const showVerificationForm =
    !entitlementLoading &&
    !entitlementError &&
    !entitlement?.trialPreviouslyGranted &&
    !["pending", "review_required", "verified"].includes(entitlement?.verificationStatus)

  return (
    <section className="ace-panel ace-access-panel">
      <div className="ace-panel-heading">
        <div>
          <span className="ace-panel-heading__icon is-green"><ShieldCheck size={17} /></span>
          <div>
            <h2>School access</h2>
            <p>Subscription and school identity</p>
          </div>
        </div>
        <button className="ace-icon-button" type="button" onClick={onRefreshEntitlement} disabled={entitlementLoading} title="Refresh school access" aria-label="Refresh school access">
          <RefreshCw size={15} className={entitlementLoading ? "ace-spinning" : ""} />
        </button>
      </div>
      <div className="ace-access-status">
        <span className={premiumAccessActive ? "is-active" : ""} />
        <strong>{status}</strong>
      </div>
      <div className="ace-school-code">
        <span>AceEdu school ID</span>
        <code>{school.id || "Unavailable"}</code>
      </div>
      {school.slug ? (
        <a className="ace-school-entry" href={`/s/${encodeURIComponent(school.slug)}`}>
          Open school sign-in <ArrowUpRight size={14} />
        </a>
      ) : (
        <p className="ace-muted-note">The school sign-in link is not configured yet.</p>
      )}
      {entitlementError && <p className="ace-inline-error" role="alert">{entitlementError}</p>}
      {verificationMessage && <p className="ace-inline-success" role="status">{verificationMessage}</p>}
      {showVerificationForm && (
        <details className="ace-verification-details">
          <summary>Request school verification</summary>
          <form onSubmit={onVerificationRequest}>
            <label htmlFor="ace-school-registration-id">Official registration ID</label>
            <input
              id="ace-school-registration-id"
              autoComplete="off"
              maxLength={80}
              minLength={2}
              required
              value={registrationId}
              onChange={(event) => onRegistrationIdChange(event.target.value)}
              placeholder="Education authority ID"
              disabled={verificationPending}
            />
            <button className="ace-small-primary" type="submit" disabled={verificationPending || registrationId.trim().length < 2}>
              {verificationPending ? "Submittingâ€¦" : "Submit verification request"}
            </button>
            <small>Approval is reviewed by an authorized operator. Submitting a request does not activate Premium.</small>
          </form>
        </details>
      )}
      {!entitlementLoading && entitlement?.trialEndsAt && !entitlement?.trialActive && (
        <p className="ace-muted-note">The trial period has ended. Your school data remains available on the MVP plan.</p>
      )}
    </section>
  )
}

export default function AdminDashboardOverview({
  school,
  dashboard,
  dashboardLoading,
  dashboardError,
  onRetry,
  premiumAccessActive,
  onStartEnrollment,
  onOpenView,
  onExport,
  exportingRegistry,
  entitlement,
  entitlementLoading,
  entitlementError,
  registrationId,
  verificationPending,
  verificationMessage,
  onRegistrationIdChange,
  onVerificationRequest,
  onRefreshEntitlement,
}) {
  const [finance, setFinance] = useState({ status: "locked", total: 0, paid: 0, currency: "NGN", invoices: 0, mixed: false })
  const now = new Date()
  const greeting = now.getHours() < 12 ? "Good Morning" : now.getHours() < 17 ? "Good Afternoon" : "Good Evening"
  const dateLabel = formatDate(now, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
  const timeLabel = now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })

  useEffect(() => {
    if (!premiumAccessActive) {
      setFinance({ status: "locked", total: 0, paid: 0, currency: "NGN", invoices: 0, mixed: false })
      return undefined
    }

    let active = true
    setFinance((current) => ({ ...current, status: "loading" }))

    getFinanceData()
      .then((result) => {
        if (!active) return
        const invoices = Array.isArray(result?.invoices) ? result.invoices : []
        const currencies = [...new Set(invoices.map((invoice) => String(invoice.currency || "NGN").toUpperCase()))]
        const total = invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0)
        const paid = invoices.reduce((sum, invoice) => sum + (Number(invoice.paid) || 0), 0)
        setFinance({
          status: "ready",
          total,
          paid,
          currency: currencies[0] || "NGN",
          invoices: invoices.length,
          mixed: currencies.length > 1,
        })
      })
      .catch((error) => {
        if (active) setFinance({ status: "error", message: error?.message || "Finance data is unavailable." })
      })

    return () => {
      active = false
    }
  }, [premiumAccessActive])

  const metrics = dashboard?.metrics || {}
  const students = Number(metrics.students) || 0
  const staff = (Number(metrics.teachingStaff) || 0) + (Number(metrics.administrativeStaff) || 0)
  const totalRecords = students + staff
  const activity = Array.isArray(dashboard?.recentActivity) ? dashboard.recentActivity : []
  const registrations = activity.filter((item) => item.type !== "verified" && item.role === "student").slice(0, 5)
  const classDistribution = Array.isArray(dashboard?.classDistribution) ? dashboard.classDistribution : []
  const trend = Array.isArray(dashboard?.studentTrend) ? dashboard.studentTrend : []
  const financeValue = finance.mixed
    ? "Multiple"
    : finance.status === "ready"
      ? formatMoney(finance.total, finance.currency)
      : "â€”"
  const financeDetail = finance.status === "locked"
    ? "Available with Premium"
    : finance.status === "loading"
      ? "Loading invoice totalsâ€¦"
      : finance.status === "error"
        ? "Finance data unavailable"
        : finance.mixed
          ? `${finance.invoices} invoices Â· mixed currencies`
          : `${finance.invoices} issued invoices Â· ${formatMoney(finance.paid, finance.currency)} collected`

  const currentSchoolType = school.schoolType || "School workspace"
  const activityCount = useMemo(() => activity.length, [activity])

  return (
    <section className="ace-dashboard" aria-label="School dashboard" aria-busy={dashboardLoading}>
      {dashboardError && (
        <div className="ace-dashboard-error" role="alert">
          <span>Dashboard data could not be loaded: {dashboardError}</span>
          <button type="button" onClick={onRetry} disabled={dashboardLoading}>
            {dashboardLoading ? "Retryingâ€¦" : "Try again"}
          </button>
        </div>
      )}

      <div className="ace-dashboard__primary">
        <section className="ace-hero">
          <div className="ace-hero__copy">
            <span className="ace-live-label"><i /> SCHOOL OVERVIEW</span>
            <h2>{greeting}, {school.adminName?.trim().split(/\s+/)[0] || "Admin"} <span aria-hidden="true">ðŸ‘‹</span></h2>
            <p>Hereâ€™s whatâ€™s happening at <strong>{school.schoolName}</strong> today.</p>
            <div className="ace-hero__meta">
              <span><CalendarDays size={15} /> {dateLabel}</span>
              <i />
              <span><Clock3 size={15} /> {timeLabel}</span>
              <i />
              <span><GraduationCap size={15} /> {currentSchoolType}</span>
            </div>
          </div>
          <div className="ace-hero__quote">
            <strong>â€œBetter systems.<br />Brighter futures.â€</strong>
            <span>â€” AceEdu</span>
          </div>
          <span className="ace-hero__orb" aria-hidden="true" />
        </section>

        <section className="ace-metrics-grid" aria-label="School statistics">
          <MetricCard
            Icon={GraduationCap}
            label="Total Students"
            value={formatNumber(students)}
            detail="Student records in your school"
            tone="blue"
            loading={dashboardLoading}
            error={Boolean(dashboardError)}
          />
          <MetricCard
            Icon={Users}
            label="Total Staff"
            value={formatNumber(staff)}
            detail={`${formatNumber(metrics.teachingStaff)} teaching Â· ${formatNumber(metrics.administrativeStaff)} admin`}
            tone="violet"
            loading={dashboardLoading}
            error={Boolean(dashboardError)}
          />
          <MetricCard
            Icon={CircleDollarSign}
            label="Total Fees Billed"
            value={financeValue}
            detail={financeDetail}
            tone="green"
            loading={finance.status === "loading"}
            locked={finance.status === "locked"}
            error={finance.status === "error"}
          />
          <MetricCard
            Icon={FileText}
            label="Total Records"
            value={formatNumber(totalRecords)}
            detail="Students and staff combined"
            tone="amber"
            loading={dashboardLoading}
            error={Boolean(dashboardError)}
          />
        </section>

        <div className="ace-analytics-grid">
          <section className="ace-panel ace-chart-panel" aria-busy={dashboardLoading}>
            <div className="ace-panel-heading">
              <div>
                <span className="ace-panel-heading__icon is-blue"><Activity size={17} /></span>
                <div>
                  <h2>Enrollment Overview</h2>
                  <p>Student registration trend for the last 6 months</p>
                </div>
              </div>
              <span className="ace-period-label">LAST 6 MONTHS <ChevronRight size={13} /></span>
            </div>
            {dashboardLoading ? (
              <div className="ace-chart-loading"><span className="ace-skeleton" /><span className="ace-skeleton" /><span className="ace-skeleton" /></div>
            ) : trend.some((item) => Number(item.total) > 0) ? (
              <EnrollmentTrend points={trend} />
            ) : (
              <EmptyState Icon={Activity} title="No enrollment history yet" description="New student registrations will appear here as records are added." />
            )}
          </section>

          <section className="ace-panel ace-chart-panel ace-class-panel" aria-busy={dashboardLoading}>
            <div className="ace-panel-heading">
              <div>
                <span className="ace-panel-heading__icon is-violet"><BookOpen size={17} /></span>
                <div>
                  <h2>Class Distribution</h2>
                  <p>Current students grouped by class</p>
                </div>
              </div>
            </div>
            {dashboardLoading ? (
              <div className="ace-donut-loading"><span /></div>
            ) : classDistribution.length ? (
              <ClassDistribution items={classDistribution} />
            ) : (
              <EmptyState Icon={BookOpen} title="No class groups yet" description="Student class groups will appear here once records are assigned." />
            )}
          </section>
        </div>

        <div className="ace-lower-grid">
          <section className="ace-panel ace-records-panel">
            <div className="ace-panel-heading">
              <div>
                <span className="ace-panel-heading__icon is-blue"><IdCard size={17} /></span>
                <div>
                  <h2>Recent Enrollments</h2>
                  <p>Latest student registrations in your school</p>
                </div>
              </div>
              <button className="ace-text-action" type="button" onClick={() => onOpenView("registry")}>View registry <ArrowUpRight size={14} /></button>
            </div>
            <div className="ace-table-wrap">
              <table className="ace-table">
                <thead>
                  <tr><th>Student</th><th>Class</th><th>Date added</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {registrations.map((item, index) => (
                    <tr key={`${item.fullName}-${item.occurredAt}-${index}`}>
                      <td>
                        <span className="ace-table-person">
                          <i>{getInitials(item.fullName)}</i>
                          <strong>{item.fullName}</strong>
                        </span>
                      </td>
                      <td>{item.designation || "Student"}</td>
                      <td>{formatDate(item.occurredAt)}</td>
                      <td><span className="ace-status is-registered"><i /> Registered</span></td>
                    </tr>
                  ))}
                  {!dashboardLoading && !registrations.length && (
                    <tr><td colSpan="4" className="ace-table-empty">No new student registrations in the latest activity window.</td></tr>
                  )}
                  {dashboardLoading && Array.from({ length: 4 }, (_, index) => (
                    <tr key={`loading-${index}`}><td colSpan="4"><span className="ace-skeleton ace-skeleton--row" /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ace-panel ace-calendar-panel">
            <div className="ace-panel-heading">
              <div>
                <span className="ace-panel-heading__icon is-amber"><CalendarDays size={17} /></span>
                <div>
                  <h2>Upcoming Events</h2>
                  <p>School calendar and important dates</p>
                </div>
              </div>
            </div>
            <EmptyState Icon={CalendarDays} title="No upcoming events" description="There are no scheduled school events available in the dashboard yet." />
            <div className="ace-calendar-note"><Clock3 size={14} /> Event scheduling is not connected yet.</div>
          </section>
        </div>
      </div>

      <aside className="ace-dashboard__rail">
        <section className="ace-panel ace-quick-panel">
          <div className="ace-panel-heading">
            <div>
              <div>
                <h2>Quick Actions</h2>
                <p>Get things done faster</p>
              </div>
            </div>
            <ArrowUpRight size={18} className="ace-heading-arrow" />
          </div>
          <div className="ace-action-grid">
            <button type="button" onClick={() => onStartEnrollment("student")}>
              <span className="ace-action-icon is-blue"><GraduationCap size={19} /></span>
              <span>Add Student</span>
              <ChevronRight size={15} />
            </button>
            <button type="button" onClick={() => onStartEnrollment("teacher")}>
              <span className="ace-action-icon is-violet"><UserPlus size={19} /></span>
              <span>Add Staff</span>
              <ChevronRight size={15} />
            </button>
            <button type="button" onClick={() => onOpenView("financialManagement")} disabled={!premiumAccessActive} title={!premiumAccessActive ? "Requires an active Premium entitlement" : "Open financial management"}>
              <span className="ace-action-icon is-green"><CircleDollarSign size={19} /></span>
              <span>Record Payment{!premiumAccessActive && <small>Premium</small>}</span>
              {!premiumAccessActive ? <LockKeyhole size={14} /> : <ChevronRight size={15} />}
            </button>
            <button type="button" onClick={() => onOpenView("advancedReports")} disabled={!premiumAccessActive} title={!premiumAccessActive ? "Requires an active Premium entitlement" : "Open reports and analytics"}>
              <span className="ace-action-icon is-amber"><FileText size={19} /></span>
              <span>Generate Report{!premiumAccessActive && <small>Premium</small>}</span>
              {!premiumAccessActive ? <LockKeyhole size={14} /> : <ChevronRight size={15} />}
            </button>
            <button type="button" onClick={onExport} disabled={exportingRegistry}>
              <span className="ace-action-icon is-blue"><ArrowDownToLine size={19} /></span>
              <span>{exportingRegistry ? "Preparingâ€¦" : "Download Registry"}</span>
              <ChevronRight size={15} />
            </button>
            <button type="button" onClick={() => onOpenView("settings")}>
              <span className="ace-action-icon is-slate"><Settings size={19} /></span>
              <span>System Settings</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </section>

        <section className="ace-panel ace-activity-panel">
          <div className="ace-panel-heading">
            <div>
              <div>
                <h2>Recent Activity</h2>
                <p>Latest recorded changes</p>
              </div>
            </div>
            <button className="ace-text-action" type="button" onClick={() => onOpenView("registry")}>View all</button>
          </div>
          <div className="ace-activity-list">
            {activity.slice(0, 6).map((item, index) => {
              const verified = item.type === "verified"
              const isStudent = item.role === "student"
              return (
                <article className="ace-activity-item" key={`${item.fullName}-${item.occurredAt}-${index}`}>
                  <span className={`ace-activity-icon ${verified ? "is-green" : isStudent ? "is-blue" : "is-violet"}`}>
                    {verified ? <CheckCircle2 size={17} /> : isStudent ? <GraduationCap size={17} /> : <Users size={17} />}
                  </span>
                  <span className="ace-activity-copy">
                    <strong>{verified ? "Record verified" : isStudent ? "New student enrolled" : "Staff account created"}</strong>
                    <small>{item.fullName}{item.designation ? ` Â· ${item.designation}` : ""}</small>
                  </span>
                  <time dateTime={item.occurredAt}>{timeAgo(item.occurredAt)}</time>
                </article>
              )
            })}
            {!dashboardLoading && !activityCount && (
              <EmptyState Icon={Activity} title="No activity yet" description="Registrations and verifications will appear here." />
            )}
            {dashboardLoading && <div className="ace-activity-loading"><span /><span /><span /></div>}
          </div>
        </section>

        <SchoolAccessCard
          school={school}
          entitlement={entitlement}
          entitlementLoading={entitlementLoading}
          entitlementError={entitlementError}
          premiumAccessActive={premiumAccessActive}
          registrationId={registrationId}
          verificationPending={verificationPending}
          verificationMessage={verificationMessage}
          onRegistrationIdChange={onRegistrationIdChange}
          onVerificationRequest={onVerificationRequest}
          onRefreshEntitlement={onRefreshEntitlement}
        />
      </aside>
    </section>
  )
}


