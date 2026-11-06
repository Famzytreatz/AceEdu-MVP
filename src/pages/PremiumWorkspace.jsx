import { useCallback, useEffect, useMemo, useState } from "react"

import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  Megaphone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react"

import {
  createFeeInvoice,
  createFeeSchedule,
  createSchoolAnnouncement,
  deleteSchoolAnnouncement,
  getAcademicSetup,
  getAllActiveStudents,
  getAllStudents,
  getDashboard,
  getFinanceData,
  getSchoolAnnouncements,
  getSchoolParents,
  getClassPerformance,
  recordFeePayment,
  resetParentPortalPassword,
  updateParentStudents,
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"

function useResource(loader, dependencies = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [...dependencies, revision])

  return { data, loading, error, refresh, setData }
}

function WorkspaceHeading({ eyebrow, title, description, actions }) {
  return (
    <header className="premium-workspace__heading">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions}
    </header>
  )
}

function LoadingPanel({ children = "Loading school records…" }) {
  return (
    <div className="premium-workspace__loading" role="status">
      <LoadingSpinner /> {children}
    </div>
  )
}

function ErrorPanel({ error, onRetry }) {
  return error ? (
    <div className="admin-alert admin-alert--error" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button className="admin-outline-button" type="button" onClick={onRetry}>
          <RefreshCw size={15} /> Retry
        </button>
      )}
    </div>
  ) : null
}

function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`
  }
}

function dateLabel(value) {
  if (!value) return "No date"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? "No date"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
}

function FinanceWorkspace() {
  const finance = useResource(getFinanceData)
  const studentsResource = useResource(getAllActiveStudents)
  const academicResource = useResource(getAcademicSetup)
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    amount: "",
    currency: "NGN",
    dueOn: "",
    classId: "",
    academicTermId: "",
  })
  const [invoiceForm, setInvoiceForm] = useState({
    feeScheduleId: "",
    studentId: "",
  })
  const [paymentTarget, setPaymentTarget] = useState("")
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    paidOn: new Date().toISOString().slice(0, 10),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [receipt, setReceipt] = useState(null)

  const data = finance.data || { schedules: [], invoices: [] }
  const academic = academicResource.data || {
    classes: [],
    terms: [],
    classRosters: [],
  }
  const scheduleClass = academic.classes.find(
    (item) => item.id === scheduleForm.classId,
  )
  const scheduleTerms = scheduleClass
    ? academic.terms.filter(
        (term) => term.academicYearId === scheduleClass.academicYearId,
      )
    : []
  const selectedInvoiceSchedule = activeSchedules.find(
    (schedule) => schedule.id === invoiceForm.feeScheduleId,
  )
  const studentsInSelectedClass = new Set(
    academic.classRosters
      .filter(
        (roster) =>
          roster.classId === selectedInvoiceSchedule?.classId && roster.isActive,
      )
      .map((roster) => roster.studentId),
  )
  const invoiceStudents = (studentsResource.data || []).filter((student) =>
    studentsInSelectedClass.has(String(student._id)),
  )
  const activeSchedules = data.schedules.filter((schedule) => schedule.active)
  const outstanding = data.invoices.filter((invoice) => invoice.balance > 0)
  const outstandingTotal = outstanding.reduce(
    (sum, invoice) => sum + invoice.balance,
    0,
  )
  const paidTotal = data.invoices.reduce((sum, invoice) => sum + invoice.paid, 0)

  async function submitSchedule(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await createFeeSchedule({
        ...scheduleForm,
        amount: Number(scheduleForm.amount),
        dueOn: scheduleForm.dueOn || null,
      })
      setScheduleForm((current) => ({ ...current, name: "", amount: "" }))
      setNotice("Fee schedule created.")
      finance.refresh()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitInvoice(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await createFeeInvoice(invoiceForm)
      setNotice("Student invoice issued.")
      finance.refresh()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitPayment(event) {
    event.preventDefault()
    const invoice = data.invoices.find((item) => item.id === paymentTarget)
    if (!invoice) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await recordFeePayment(paymentTarget, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
        paidOn: paymentForm.paidOn || null,
      })
      setNotice(`Payment recorded for ${invoice.studentName}.`)
      setPaymentTarget("")
      setPaymentForm((current) => ({ ...current, amount: "", reference: "" }))
      finance.refresh()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="premium-workspace" aria-label="Financial management">
      <WorkspaceHeading
        eyebrow="SCHOOL FINANCE · MANUAL LEDGER"
        title="Financial management"
        description="Issue student charges, record offline payments, and print an auditable receipt. No online payment processing."
      />
      <ErrorPanel
        error={
          error ||
          finance.error ||
          studentsResource.error ||
          academicResource.error
        }
        onRetry={() => {
          finance.refresh()
          studentsResource.refresh()
          academicResource.refresh()
        }}
      />
      {notice && (
        <div className="admin-alert admin-alert--success" role="status">
          <Check size={17} /> {notice}
        </div>
      )}
      <div className="premium-workspace__metrics">
        <article className="premium-workspace__metric premium-workspace__metric--primary">
          <span><CircleDollarSign size={17} /> Outstanding balance</span>
          <strong>
            {data.invoices.length
              ? money(
                  outstandingTotal,
                  outstanding[0]?.currency || data.invoices[0]?.currency || "NGN",
                )
              : "—"}
          </strong>
          <small>{outstanding.length} unpaid or part-paid invoices</small>
        </article>
        <article className="premium-workspace__metric">
          <span>Payments recorded</span>
          <strong>{data.invoices.length ? paidTotal.toLocaleString() : "—"}</strong>
          <small>{data.invoices.length} issued invoices</small>
        </article>
        <article className="premium-workspace__metric">
          <span>Fee schedules</span>
          <strong>{data.schedules.length}</strong>
          <small>{activeSchedules.length} active for new invoices</small>
        </article>
      </div>

      <div className="premium-workspace__split">
        <form className="admin-panel premium-workspace__form" onSubmit={submitSchedule}>
          <div className="premium-workspace__section-heading">
            <span className="premium-workspace__icon"><Plus size={18} /></span>
            <div><h3>Set a fee schedule</h3><p>Create a reusable charge for this school.</p></div>
          </div>
          <label>Fee name<input value={scheduleForm.name} maxLength={120} required onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} placeholder="e.g. Term tuition" /></label>
          <label>Class
            <select value={scheduleForm.classId} required onChange={(event) => setScheduleForm({ ...scheduleForm, classId: event.target.value, academicTermId: "" })}>
              <option value="">Select a class</option>
              {academic.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Academic term
            <select value={scheduleForm.academicTermId} required disabled={!scheduleClass} onChange={(event) => setScheduleForm({ ...scheduleForm, academicTermId: event.target.value })}>
              <option value="">Select a term</option>
              {scheduleTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </label>
          <div className="premium-workspace__form-row">
            <label>Amount<input type="number" min="0.01" step="0.01" max="1000000000" value={scheduleForm.amount} required onChange={(event) => setScheduleForm({ ...scheduleForm, amount: event.target.value })} /></label>
            <label>Currency<input value={scheduleForm.currency} maxLength={3} required onChange={(event) => setScheduleForm({ ...scheduleForm, currency: event.target.value.toUpperCase() })} /></label>
          </div>
          <label>Due date<input type="date" value={scheduleForm.dueOn} onChange={(event) => setScheduleForm({ ...scheduleForm, dueOn: event.target.value })} /></label>
          <button className="admin-primary-button" disabled={busy || !academic.classes.length}><Plus size={16} /> {busy ? "Saving…" : "Create schedule"}</button>
        </form>

        <form className="admin-panel premium-workspace__form" onSubmit={submitInvoice}>
          <div className="premium-workspace__section-heading">
            <span className="premium-workspace__icon is-violet"><FileText size={18} /></span>
            <div><h3>Issue an invoice</h3><p>Charge one active student from an existing schedule.</p></div>
          </div>
          <label>Fee schedule
            <select value={invoiceForm.feeScheduleId} required onChange={(event) => setInvoiceForm({ feeScheduleId: event.target.value, studentId: "" })}>
              <option value="">Select a schedule</option>
              {activeSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {schedule.className} · {schedule.termName} · {money(schedule.amount, schedule.currency)}</option>)}
            </select>
          </label>
          <label>Student
            <select value={invoiceForm.studentId} required onChange={(event) => setInvoiceForm({ ...invoiceForm, studentId: event.target.value })}>
              <option value="">Select an active student</option>
              {invoiceStudents.map((student) => <option key={student._id} value={student._id}>{student.fullName} · {student.designation || "Student"}</option>)}
            </select>
          </label>
          <p className="premium-workspace__hint">
            {selectedInvoiceSchedule && !invoiceStudents.length
              ? "No active students are assigned to this schedule’s class."
              : "The charge is assigned to the selected student in the schedule’s class and term."}
          </p>
          <button className="admin-primary-button" disabled={busy || !activeSchedules.length || !invoiceStudents.length}><FileText size={16} /> {busy ? "Issuing…" : "Issue invoice"}</button>
        </form>
      </div>

      <section className="admin-panel premium-workspace__table-panel">
        <div className="premium-workspace__section-heading">
          <div><h3>Student ledger</h3><p>Balances and payment history by invoice.</p></div>
          <button className="admin-outline-button" type="button" onClick={finance.refresh} disabled={finance.loading}><RefreshCw size={15} /> Refresh</button>
        </div>
        {finance.loading ? <LoadingPanel>Loading the school ledger…</LoadingPanel> : data.invoices.length ? (
          <div className="premium-workspace__table-wrap">
            <table className="premium-workspace__table">
              <thead><tr><th>Student / charge</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead>
              <tbody>{data.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><strong>{invoice.studentName}</strong><small>{invoice.feeName}</small></td>
                  <td>{dateLabel(invoice.dueOn)}</td>
                  <td>{money(invoice.amount, invoice.currency)}</td>
                  <td>{money(invoice.paid, invoice.currency)}</td>
                  <td><strong className={invoice.balance ? "is-due" : "is-settled"}>{money(invoice.balance, invoice.currency)}</strong></td>
                  <td className="premium-workspace__actions">
                    {invoice.balance > 0 && <button type="button" onClick={() => { setPaymentTarget(invoice.id); setPaymentForm((current) => ({ ...current, amount: String(invoice.balance) })) }}>Record payment</button>}
                    <button type="button" aria-label={`Print receipt for ${invoice.studentName}`} onClick={() => setReceipt(invoice)}>Receipt</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="premium-workspace__empty">No invoices yet. Start by creating a fee schedule and issuing a student invoice.</p>}
      </section>

      {paymentTarget && (
        <div className="premium-workspace__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPaymentTarget("")}>
          <form className="admin-panel premium-workspace__dialog" onSubmit={submitPayment}>
            <div className="premium-workspace__section-heading"><div><h3>Record manual payment</h3><p>{data.invoices.find((item) => item.id === paymentTarget)?.studentName}</p></div><button type="button" onClick={() => setPaymentTarget("")} aria-label="Close">×</button></div>
            <label>Amount<input type="number" min="0.01" max={data.invoices.find((item) => item.id === paymentTarget)?.balance || 0} step="0.01" value={paymentForm.amount} required onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
            <label>Method<select value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
            <label>Reference (optional)<input maxLength={100} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} /></label>
            <label>Payment date<input type="date" value={paymentForm.paidOn} onChange={(event) => setPaymentForm({ ...paymentForm, paidOn: event.target.value })} /></label>
            <button className="admin-primary-button" disabled={busy}><Check size={16} /> {busy ? "Recording…" : "Record payment"}</button>
          </form>
        </div>
      )}

      {receipt && (
        <div className="premium-workspace__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReceipt(null)}>
          <article className="admin-panel premium-workspace__dialog premium-finance__receipt">
            <div className="premium-workspace__section-heading"><div><p className="admin-eyebrow">PAYMENT RECEIPT</p><h3>{receipt.studentName}</h3><p>{receipt.feeName}</p></div><button type="button" onClick={() => setReceipt(null)} aria-label="Close">×</button></div>
            <p><span>Invoice total</span><strong>{money(receipt.amount, receipt.currency)}</strong></p>
            <p><span>Paid to date</span><strong>{money(receipt.paid, receipt.currency)}</strong></p>
            <p><span>Balance</span><strong>{money(receipt.balance, receipt.currency)}</strong></p>
            <h4>Payment history</h4>
            {receipt.payments.length ? receipt.payments.map((payment) => (
              <p key={payment.id}><span>{dateLabel(payment.paidOn)} · {payment.method.replace("_", " ")}{payment.reference ? ` · ${payment.reference}` : ""}</span><strong>{money(payment.amount, receipt.currency)}</strong></p>
            )) : <p className="premium-workspace__hint">No payments have been recorded.</p>}
            <button className="admin-primary-button premium-finance__print" type="button" onClick={() => window.print()}><Printer size={16} /> Print receipt</button>
          </article>
        </div>
      )}
    </section>
  )
}

function ParentWorkspace({ school }) {
  const parentsResource = useResource(getSchoolParents)
  const studentsResource = useResource(getAllStudents)
  const announcementsResource = useResource(getSchoolAnnouncements)
  const [tab, setTab] = useState("accounts")
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", type: "announcement", audience: "all", eventDate: "" })
  const [temporaryPassword, setTemporaryPassword] = useState("")
  const [editingParent, setEditingParent] = useState(null)
  const [editingStudentIds, setEditingStudentIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const parents = parentsResource.data || []
  const announcements = announcementsResource.data || []

  async function resetPassword(parent) {
    if (!window.confirm(`Create a new parent setup code for ${parent.fullName}?`)) return
    setBusy(true)
    setError("")
    setTemporaryPassword("")
    try {
      const result = await resetParentPortalPassword(parent.id)
      setTemporaryPassword(result.setupCode || "")
      setNotice(
        result.sent
          ? `A new setup code was sent to ${parent.fullName} by SMS.`
          : `SMS could not be sent. Share the one-time setup code with ${parent.fullName} privately.`,
      )
      parentsResource.refresh()
    } catch (resetError) {
      setError(resetError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveParentStudents(event) {
    event.preventDefault()
    if (!editingParent || !editingStudentIds.length) return
    setBusy(true)
    setError("")
    try {
      await updateParentStudents(editingParent.id, editingStudentIds)
      setNotice(`Linked students updated for ${editingParent.fullName}.`)
      setEditingParent(null)
      parentsResource.refresh()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await createSchoolAnnouncement({
        ...announcementForm,
        eventDate: announcementForm.type === "event" ? announcementForm.eventDate : null,
      })
      setAnnouncementForm({ title: "", body: "", type: "announcement", audience: "all", eventDate: "" })
      setNotice("School feed update published.")
      announcementsResource.refresh()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeAnnouncement(announcement) {
    if (!window.confirm(`Remove "${announcement.title}" from the school feed?`)) return
    setError("")
    try {
      await deleteSchoolAnnouncement(announcement.id)
      setNotice("School feed update removed.")
      announcementsResource.refresh()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <section className="premium-workspace" aria-label="Parent portal management">
      <WorkspaceHeading
        eyebrow="FAMILY ACCESS · SHARED SCHOOL FEED"
        title="Parent portal"
        description="Parent accounts are created from guardian details during student registration. Matching phone numbers join siblings to one family account; parents see only linked children’s attendance, published results and class updates—not financial records."
        actions={school.slug && <a className="admin-outline-button" href={`/s/${encodeURIComponent(school.slug)}/portal`}>Open shared portal sign-in</a>}
      />
      <ErrorPanel error={error || parentsResource.error || studentsResource.error || announcementsResource.error} onRetry={() => { parentsResource.refresh(); studentsResource.refresh(); announcementsResource.refresh() }} />
      {notice && <div className="admin-alert admin-alert--success" role="status"><Check size={17} /> {notice}</div>}
      {temporaryPassword && <div className="premium-workspace__credential" role="status"><ShieldCheck size={18} /><span><strong>One-time setup code</strong><code>{temporaryPassword}</code><small>Copy and share this privately. The parent will be asked to change it.</small></span></div>}
      <div className="premium-workspace__tabs" role="tablist" aria-label="Parent portal tools">
        <button type="button" role="tab" aria-selected={tab === "accounts"} className={tab === "accounts" ? "is-active" : ""} onClick={() => setTab("accounts")}><Users size={16} /> Parent accounts <span>{parents.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === "feed"} className={tab === "feed" ? "is-active" : ""} onClick={() => setTab("feed")}><Megaphone size={16} /> School feed <span>{announcements.length}</span></button>
      </div>
      {tab === "accounts" ? (
        <>
          <div className="premium-workspace__split">
            <section className="admin-panel premium-workspace__form">
              <div className="premium-workspace__section-heading"><span className="premium-workspace__icon"><Users size={18} /></span><div><h3>Automatic family setup</h3><p>No separate parent registration step.</p></div></div>
              <p>When registering a student, enter the guardian’s name and phone number. AceEdu creates the parent portal and sends a unique setup code by SMS when Termii is configured. If messaging is unavailable, the code is shown to the school admin to share privately. Students registered with the same phone number join one family account.</p>
            </section>
            <section className="admin-panel premium-workspace__form premium-workspace__security-note">
              <ShieldCheck size={24} /><h3>Verified, revocable access</h3><p>Parents receive a unique, expiring setup code at their registered guardian phone, then choose a password. Sibling access is linked to that same phone and verified within the school.</p><p>Student attendance, published assessments and class posts are available in the portal. Fee data and private messaging are not part of parent access.</p>
            </section>
          </div>
          <section className="admin-panel premium-workspace__table-panel">
            <div className="premium-workspace__section-heading"><div><h3>Parent accounts</h3><p>{parents.length} accounts · linked students are shown per family</p></div><button className="admin-outline-button" type="button" onClick={parentsResource.refresh}><RefreshCw size={15} /> Refresh</button></div>
            {parentsResource.loading ? <LoadingPanel>Loading parent accounts…</LoadingPanel> : parents.length ? <div className="premium-workspace__table-wrap"><table className="premium-workspace__table"><thead><tr><th>Parent</th><th>Phone</th><th>Family</th><th>Linked students</th><th>Access</th></tr></thead><tbody>{parents.map((parent) => <tr key={parent.id}><td><strong>{parent.fullName}</strong></td><td>{parent.phone}</td><td><strong>{parent.isFamily ? "Family" : "Single student"}</strong></td><td>{parent.students.map((student) => student.fullName).join(", ") || "No linked students"}</td><td className="premium-workspace__actions"><span>{parent.mustChangePassword ? "Change password required" : "Active"}</span><button type="button" disabled={busy} onClick={() => { setEditingParent(parent); setEditingStudentIds(parent.students.map((student) => student.id)) }}><Users size={14} /> Edit links</button><button type="button" disabled={busy} onClick={() => void resetPassword(parent)}><RotateCcw size={14} /> Reset password</button></td></tr>)}</tbody></table></div> : <p className="premium-workspace__empty">No parent accounts have been created for this school.</p>}
          </section>
          {editingParent && (
            <div className="premium-workspace__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingParent(null)}>
              <form className="admin-panel premium-workspace__dialog" onSubmit={saveParentStudents}>
                <div className="premium-workspace__section-heading">
                  <div><h3>Edit linked students</h3><p>{editingParent.fullName} · access is limited to these records</p></div>
                  <button type="button" onClick={() => setEditingParent(null)} aria-label="Close">×</button>
                </div>
                <fieldset className="premium-workspace__student-picker">
                  <legend>Linked students</legend>
                  {(studentsResource.data || []).map((student) => (
                    <label key={student._id}>
                      <input
                        type="checkbox"
                        checked={editingStudentIds.includes(String(student._id))}
                        onChange={(event) => setEditingStudentIds((current) =>
                          event.target.checked
                            ? [...current, String(student._id)]
                            : current.filter((id) => id !== String(student._id)),
                        )}
                      />
                      <span>{student.fullName}<small>{student.designation || "Class not assigned"}</small></span>
                    </label>
                  ))}
                </fieldset>
                <button className="admin-primary-button" disabled={busy || !editingStudentIds.length}>
                  <Check size={16} /> {busy ? "Saving links…" : "Save linked students"}
                </button>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="premium-workspace__split">
          <form className="admin-panel premium-workspace__form" onSubmit={publishAnnouncement}>
            <div className="premium-workspace__section-heading"><span className="premium-workspace__icon is-violet"><Send size={18} /></span><div><h3>Publish to the school feed</h3><p>Share announcements, events or newsletters in-app.</p></div></div>
            <label>Title<input maxLength={160} required value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} /></label>
            <label>Message<textarea rows={5} maxLength={5000} required value={announcementForm.body} onChange={(event) => setAnnouncementForm({ ...announcementForm, body: event.target.value })} /></label>
            <div className="premium-workspace__form-row"><label>Type<select value={announcementForm.type} onChange={(event) => setAnnouncementForm({ ...announcementForm, type: event.target.value })}><option value="announcement">Announcement</option><option value="event">Event</option><option value="newsletter">Newsletter</option></select></label><label>Audience<select value={announcementForm.audience} onChange={(event) => setAnnouncementForm({ ...announcementForm, audience: event.target.value })}><option value="all">Everyone</option><option value="parents">Parents</option><option value="students">Students</option><option value="teachers">Teachers</option></select></label></div>
            {announcementForm.type === "event" && <label>Event date<input type="date" required value={announcementForm.eventDate} onChange={(event) => setAnnouncementForm({ ...announcementForm, eventDate: event.target.value })} /></label>}
            <button className="admin-primary-button" disabled={busy}><Send size={16} /> {busy ? "Publishing…" : "Publish update"}</button>
          </form>
          <section className="premium-workspace__feed-list" aria-label="Published school feed">
            <div className="premium-workspace__section-heading"><div><h3>Published updates</h3><p>Visible to the selected audience in the school portal.</p></div></div>
            {announcementsResource.loading ? <LoadingPanel>Loading school feed…</LoadingPanel> : announcements.length ? announcements.map((item) => <article className="admin-panel premium-workspace__feed-item" key={item.id}><span className="premium-workspace__feed-icon"><Bell size={17} /></span><div><div className="premium-workspace__feed-meta"><span>{item.type}</span><span>{item.audience}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div><h3>{item.title}</h3><p>{item.body}</p>{item.eventDate && <small><CalendarDays size={13} /> {dateLabel(item.eventDate)}</small>}</div><button type="button" aria-label={`Delete ${item.title}`} onClick={() => void removeAnnouncement(item)}><Trash2 size={16} /></button></article>) : <p className="premium-workspace__empty">No school updates have been published yet.</p>}
          </section>
        </div>
      )}
    </section>
  )
}

function ReportsWorkspace() {
  const report = useResource(async () => {
    const [dashboard, setup] = await Promise.all([getDashboard(), getAcademicSetup()])
    const results = await Promise.all(
      setup.classes.map(async (schoolClass) => ({
        schoolClass,
        performance: await getClassPerformance(schoolClass.id),
      })),
    )
    return { dashboard, setup, results }
  })
  const data = report.data
  const distribution = data?.dashboard.classDistribution || []
  const maxStudents = Math.max(1, ...distribution.map((item) => item.total))
  const attendanceTotals = useMemo(() => {
    const summary = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
    for (const { performance } of data?.results || []) {
      for (const status of ["present", "absent", "late", "excused"]) {
        summary[status] += Number(performance.metrics.attendance?.[status]) || 0
        summary.total += Number(performance.metrics.attendance?.[status]) || 0
      }
    }
    return summary
  }, [data])

  return (
    <section className="premium-workspace" aria-label="Reports and analytics">
      <WorkspaceHeading eyebrow="LIVE SCHOOL DATA" title="Reports & analytics" description="Explore current enrollment, class distribution, attendance records and academic performance from your school’s saved records." />
      <ErrorPanel error={report.error} onRetry={report.refresh} />
      {report.loading ? <LoadingPanel>Building reports from school records…</LoadingPanel> : data && (
        <>
          <div className="premium-workspace__metrics">
            <article className="premium-workspace__metric premium-workspace__metric--primary"><span><Users size={17} /> Students enrolled</span><strong>{data.dashboard.metrics.students}</strong><small>Current school registry</small></article>
            <article className="premium-workspace__metric"><span><Activity size={17} /> Attendance entries</span><strong>{attendanceTotals.total.toLocaleString()}</strong><small>{attendanceTotals.present} present · {attendanceTotals.absent} absent · {attendanceTotals.late} late</small></article>
            <article className="premium-workspace__metric"><span><CalendarDays size={17} /> Academic classes</span><strong>{data.setup.classes.length}</strong><small>{data.setup.academicYears.length} configured sessions</small></article>
          </div>
          <div className="premium-workspace__split">
            <section className="admin-panel premium-workspace__report-panel">
              <div className="premium-workspace__section-heading"><div><h3>Students by class</h3><p>Current records grouped by registered class.</p></div></div>
              {distribution.length ? <div className="premium-workspace__bars">{distribution.map((item) => <div key={item.className}><span>{item.className}</span><div><i style={{ width: `${Math.max(3, (item.total / maxStudents) * 100)}%` }} /></div><strong>{item.total}</strong></div>)}</div> : <p className="premium-workspace__empty">There are no class distribution records yet.</p>}
            </section>
            <section className="admin-panel premium-workspace__report-panel">
              <div className="premium-workspace__section-heading"><div><h3>Enrollment, six months</h3><p>New student entries recorded each month.</p></div></div>
              {data.dashboard.studentTrend?.length ? <div className="premium-workspace__bars premium-workspace__bars--trend">{data.dashboard.studentTrend.map((item) => <div key={item.month}><span>{item.month}</span><div><i style={{ width: `${Math.max(3, (item.total / Math.max(1, ...data.dashboard.studentTrend.map((point) => point.total))) * 100)}%` }} /></div><strong>{item.total}</strong></div>)}</div> : <p className="premium-workspace__empty">No enrollment history is available yet.</p>}
            </section>
          </div>
          <section className="admin-panel premium-workspace__table-panel">
            <div className="premium-workspace__section-heading"><div><h3>Class performance</h3><p>Published and recorded assessment summaries by class.</p></div></div>
            {data.results.length ? <div className="premium-workspace__table-wrap"><table className="premium-workspace__table"><thead><tr><th>Class</th><th>Students</th><th>Assessments</th><th>Results recorded</th><th>Average</th></tr></thead><tbody>{data.results.map(({ schoolClass, performance }) => <tr key={schoolClass.id}><td><strong>{schoolClass.name}</strong></td><td>{performance.metrics.studentCount}</td><td>{performance.metrics.assessmentCount}</td><td>{performance.metrics.assessedStudentCount}</td><td>{performance.metrics.classAverage == null ? "—" : `${performance.metrics.classAverage}%`}</td></tr>)}</tbody></table></div> : <p className="premium-workspace__empty">Configure classes and assessments to see performance reports.</p>}
          </section>
        </>
      )}
    </section>
  )
}

export default function PremiumWorkspace({ mode, school }) {
  if (mode === "financialManagement") return <FinanceWorkspace />
  if (mode === "parentPortal") return <ParentWorkspace school={school} />
  return <ReportsWorkspace />
}
