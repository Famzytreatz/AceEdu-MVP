import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  LayoutDashboard,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react"
import {
  createFeeInvoice,
  createFeeSchedule,
  getAcademicSetup,
  getAllActiveStudents,
  getFinanceData,
  recordFeePayment,
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"
import "./FinanceWorkspaceRedesigned.css"

const NAV_ITEMS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "billing", label: "Invoices & billing", Icon: FileText },
  { id: "fees", label: "Fee structures", Icon: CalendarDays },
  { id: "collections", label: "Collections", Icon: Wallet },
  { id: "accounts", label: "Student accounts", Icon: Users },
  { id: "reports", label: "Reports", Icon: Activity },
]

function useFinanceResource(loader) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

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
        if (active) setError(loadError.message || "Could not load finance records.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loader, revision])

  return {
    data,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  }
}

function todayISO() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

function money(value, currency = "NGN") {
  const amount = Number(value) || 0
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`
  }
}

function dateLabel(value, options = {}) {
  if (!value) return "—"
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: options.year === false ? undefined : "numeric",
  })
}

function invoiceStatus(invoice) {
  const balance = Number(invoice.balance) || 0
  const paid = Number(invoice.paid) || 0
  if (balance <= 0) return "paid"
  if (invoice.dueOn && invoice.dueOn < todayISO()) return "overdue"
  return paid > 0 ? "partial" : "unpaid"
}

function statusLabel(status) {
  return ({
    paid: "Paid",
    overdue: "Overdue",
    partial: "Part-paid",
    unpaid: "Unpaid",
  })[status] || status
}

function MetricCard({ label, value, detail, Icon, tone = "blue" }) {
  return (
    <article className={`ace-finance__metric is-${tone}`}>
      <div className="ace-finance__metric-top">
        <span>{label}</span>
        <span className="ace-finance__metric-icon"><Icon size={18} /></span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="ace-finance__section-heading">
      <div>
        {eyebrow && <span className="ace-finance__eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ title, detail, action }) {
  return (
    <div className="ace-finance__empty">
      <span><FileText size={20} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  )
}

export default function FinanceWorkspaceRedesigned({ school }) {
  const financeLoader = useMemo(() => getFinanceData, [])
  const studentsLoader = useMemo(() => getAllActiveStudents, [])
  const academicLoader = useMemo(() => getAcademicSetup, [])
  const finance = useFinanceResource(financeLoader)
  const studentsResource = useFinanceResource(studentsLoader)
  const academicResource = useFinanceResource(academicLoader)

  const [activeTab, setActiveTab] = useState("overview")
  const [currencyFilter, setCurrencyFilter] = useState("NGN")
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all")
  const [accountSearch, setAccountSearch] = useState("")
  const [selectedScheduleId, setSelectedScheduleId] = useState("")
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [paymentTarget, setPaymentTarget] = useState("")
  const [receipt, setReceipt] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    amount: "",
    currency: "NGN",
    dueOn: "",
    classId: "",
    academicTermId: "",
  })
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "bank_transfer",
    reference: "",
    paidOn: todayISO(),
  })

  const data = finance.data || { schedules: [], invoices: [] }
  const academic = academicResource.data || { classes: [], terms: [], classRosters: [] }
  const students = studentsResource.data || []
  const schedules = data.schedules || []
  const invoices = data.invoices || []
  const activeSchedules = schedules.filter((schedule) => schedule.active)

  const currencies = [...new Set([
    ...invoices.map((item) => item.currency || "NGN"),
    ...schedules.map((item) => item.currency || "NGN"),
  ])].sort()
  const activeCurrency = currencies.includes(currencyFilter)
    ? currencyFilter
    : currencies[0] || "NGN"

  const currencyInvoices = invoices.filter(
    (invoice) => (invoice.currency || "NGN") === activeCurrency,
  )
  const billedTotal = currencyInvoices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const collectedTotal = currencyInvoices.reduce((sum, item) => sum + (Number(item.paid) || 0), 0)
  const outstandingInvoices = currencyInvoices.filter((item) => Number(item.balance) > 0)
  const outstandingTotal = outstandingInvoices.reduce((sum, item) => sum + (Number(item.balance) || 0), 0)
  const overdueInvoices = outstandingInvoices.filter((item) => invoiceStatus(item) === "overdue")
  const overdueTotal = overdueInvoices.reduce((sum, item) => sum + (Number(item.balance) || 0), 0)
  const collectionRate = billedTotal > 0 ? Math.round((collectedTotal / billedTotal) * 100) : 0

  const payments = invoices.flatMap((invoice) =>
    (invoice.payments || []).map((payment) => ({
      ...payment,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      studentName: invoice.studentName,
      feeName: invoice.feeName,
      currency: invoice.currency || "NGN",
    })),
  ).sort((a, b) => new Date(b.paidOn || b.createdAt) - new Date(a.paidOn || a.createdAt))
  const currencyPayments = payments.filter((payment) => payment.currency === activeCurrency)

  const selectedSchedule = activeSchedules.find((item) => item.id === selectedScheduleId)
  const classRosterIds = new Set(
    academic.classRosters
      .filter((item) => item.classId === selectedSchedule?.classId && item.isActive)
      .map((item) => String(item.studentId)),
  )
  const billingStudents = students.filter((student) => classRosterIds.has(String(student._id)))
  const selectedBillingStudents = billingStudents.filter((student) => selectedStudentIds.includes(String(student._id)))

  const scheduleClass = academic.classes.find((item) => item.id === scheduleForm.classId)
  const scheduleTerms = scheduleClass
    ? academic.terms.filter((term) => term.academicYearId === scheduleClass.academicYearId)
    : []

  const visibleInvoices = currencyInvoices.filter((invoice) => {
    const status = invoiceStatus(invoice)
    const matchesStatus = invoiceStatusFilter === "all" || status === invoiceStatusFilter
    const query = invoiceSearch.trim().toLowerCase()
    const matchesQuery = !query || [invoice.studentName, invoice.feeName, invoice.className]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
    return matchesStatus && matchesQuery
  })

  const accountRows = useMemo(() => {
    const grouped = new Map()
    for (const invoice of invoices) {
      const studentId = String(invoice.studentId)
      const currency = invoice.currency || "NGN"
      const key = `${studentId}::${currency}`
      const current = grouped.get(key) || {
        studentId,
        studentName: invoice.studentName || "Student record unavailable",
        currency,
        invoices: 0,
        billed: 0,
        paid: 0,
        balance: 0,
      }
      current.invoices += 1
      current.billed += Number(invoice.amount) || 0
      current.paid += Number(invoice.paid) || 0
      current.balance += Number(invoice.balance) || 0
      grouped.set(key, current)
    }
    return [...grouped.values()].sort((a, b) => a.studentName.localeCompare(b.studentName))
  }, [invoices])

  const visibleAccounts = accountRows.filter((account) => {
    const query = accountSearch.trim().toLowerCase()
    return account.currency === activeCurrency && (!query || account.studentName.toLowerCase().includes(query))
  })

  const monthlyCollections = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`
      return {
        key,
        label: monthDate.toLocaleDateString("en-NG", { month: "short" }),
        total: 0,
      }
    })
    const byKey = new Map(months.map((month) => [month.key, month]))
    for (const payment of currencyPayments) {
      const key = String(payment.paidOn || payment.createdAt || "").slice(0, 7)
      const month = byKey.get(key)
      if (month) month.total += Number(payment.amount) || 0
    }
    return months
  }, [currencyPayments])

  const maxMonthlyCollection = Math.max(1, ...monthlyCollections.map((item) => item.total))
  const selectedPaymentInvoice = invoices.find((item) => item.id === paymentTarget)
  const globalError = error || finance.error || studentsResource.error || academicResource.error

  function refreshAll() {
    finance.refresh()
    studentsResource.refresh()
    academicResource.refresh()
  }

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
      setNotice("Fee structure created successfully.")
      finance.refresh()
      setActiveTab("fees")
    } catch (saveError) {
      setError(saveError.message || "Could not create this fee structure.")
    } finally {
      setBusy(false)
    }
  }

  async function issueInvoices(event) {
    event.preventDefault()
    if (!selectedSchedule || !selectedStudentIds.length) return
    setBusy(true)
    setError("")
    setNotice("")
    let created = 0
    const failures = []
    try {
      // Use the existing school-scoped invoice endpoint. Small batches avoid
      // overwhelming the API while still supporting class-wide billing.
      for (let index = 0; index < selectedStudentIds.length; index += 6) {
        const batch = selectedStudentIds.slice(index, index + 6)
        const results = await Promise.allSettled(
          batch.map((studentId) => createFeeInvoice({
            feeScheduleId: selectedSchedule.id,
            studentId,
          })),
        )
        results.forEach((result, position) => {
          if (result.status === "fulfilled") created += 1
          else failures.push({ studentId: batch[position], message: result.reason?.message || "Invoice could not be issued." })
        })
      }
      setNotice(
        failures.length
          ? `${created} invoice(s) issued. ${failures.length} could not be issued (possibly already billed); review the invoice list.`
          : `${created} invoice(s) issued successfully.`,
      )
      setSelectedStudentIds([])
      finance.refresh()
      setActiveTab("billing")
    } finally {
      setBusy(false)
    }
  }

  async function submitPayment(event) {
    event.preventDefault()
    if (!selectedPaymentInvoice) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await recordFeePayment(selectedPaymentInvoice.id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
        paidOn: paymentForm.paidOn || null,
      })
      setNotice(`Payment recorded for ${selectedPaymentInvoice.studentName}.`)
      setPaymentTarget("")
      setPaymentForm((current) => ({ ...current, amount: "", reference: "" }))
      finance.refresh()
    } catch (saveError) {
      setError(saveError.message || "Payment could not be recorded.")
    } finally {
      setBusy(false)
    }
  }

  function openPayment(invoice) {
    setPaymentTarget(invoice.id)
    setPaymentForm((current) => ({ ...current, amount: String(invoice.balance), reference: "" }))
  }

  function toggleStudent(studentId) {
    setSelectedStudentIds((current) => current.includes(String(studentId))
      ? current.filter((id) => id !== String(studentId))
      : [...current, String(studentId)])
  }

  function openBilling() {
    setSelectedScheduleId(activeSchedules[0]?.id || "")
    setSelectedStudentIds([])
    setActiveTab("billing")
  }

  function downloadCsv() {
    const rows = [
      ["Student", "Fee", "Invoice amount", "Paid", "Balance", "Due date", "Status"],
      ...visibleInvoices.map((invoice) => [
        invoice.studentName,
        invoice.feeName,
        invoice.amount,
        invoice.paid,
        invoice.balance,
        invoice.dueOn || "",
        statusLabel(invoiceStatus(invoice)),
      ]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `acedu-finance-${todayISO()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="ace-finance" aria-label="Financial management">
      <header className="ace-finance__header">
        <div>
          <span className="ace-finance__eyebrow">FINANCE OPERATIONS</span>
          <h2>Financial management</h2>
          <p>{school?.schoolName || "Your school"} · Track billing, collections and student balances in one place.</p>
        </div>
        <div className="ace-finance__header-actions">
          <label className="ace-finance__currency">
            <span>Currency view</span>
            <select value={activeCurrency} onChange={(event) => setCurrencyFilter(event.target.value)}>
              {(currencies.length ? currencies : ["NGN"]).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <button className="ace-finance__icon-button" type="button" onClick={refreshAll} disabled={finance.loading || studentsResource.loading || academicResource.loading} aria-label="Refresh finance data" title="Refresh data">
            <RefreshCw size={16} className={finance.loading ? "is-spinning" : ""} />
          </button>
          <button className="ace-finance__primary" type="button" onClick={openBilling}><Plus size={16} /> Create billing</button>
        </div>
      </header>

      <nav className="ace-finance__nav" aria-label="Finance sections">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {globalError && (
        <div className="ace-finance__alert is-error" role="alert">
          <AlertCircle size={17} /><span>{globalError}</span>
          <button type="button" onClick={refreshAll}>Retry</button>
        </div>
      )}
      {notice && (
        <div className="ace-finance__alert is-success" role="status">
          <CheckCircle2 size={17} /><span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="ace-finance__view">
          <div className="ace-finance__overview-top">
            <div className="ace-finance__intro">
              <div className="ace-finance__live"><span /> FINANCIAL SNAPSHOT</div>
              <h3>Know where your school stands.</h3>
              <p>Current invoice and payment records, grouped by {activeCurrency}.</p>
            </div>
            <div className="ace-finance__collection-rate">
              <span>Collection rate</span>
              <strong>{collectionRate}%</strong>
              <div><i style={{ width: `${collectionRate}%` }} /></div>
              <small>{money(collectedTotal, activeCurrency)} collected of {money(billedTotal, activeCurrency)} billed</small>
            </div>
          </div>

          <div className="ace-finance__metrics">
            <MetricCard label="Total billed" value={finance.loading && !finance.data ? "—" : money(billedTotal, activeCurrency)} detail={`${currencyInvoices.length} issued invoices`} Icon={FileText} tone="blue" />
            <MetricCard label="Collected" value={finance.loading && !finance.data ? "—" : money(collectedTotal, activeCurrency)} detail={`${currencyPayments.length} payment entries`} Icon={ArrowDownLeft} tone="green" />
            <MetricCard label="Outstanding" value={finance.loading && !finance.data ? "—" : money(outstandingTotal, activeCurrency)} detail={`${outstandingInvoices.length} open accounts`} Icon={Wallet} tone="amber" />
            <MetricCard label="Overdue" value={finance.loading && !finance.data ? "—" : money(overdueTotal, activeCurrency)} detail={`${overdueInvoices.length} past due`} Icon={Clock3} tone="rose" />
          </div>

          <div className="ace-finance__overview-grid">
            <section className="ace-finance__panel ace-finance__chart-panel">
              <SectionHeading eyebrow="CASH FLOW" title="Collections over time" detail="Recorded payments over the last six months." />
              {monthlyCollections.some((month) => month.total > 0) ? (
                <div className="ace-finance__bar-chart">
                  <div className="ace-finance__chart-y"><span>{money(maxMonthlyCollection, activeCurrency)}</span><span>{money(maxMonthlyCollection / 2, activeCurrency)}</span><span>{money(0, activeCurrency)}</span></div>
                  <div className="ace-finance__chart-bars">
                    {monthlyCollections.map((month) => (
                      <div className="ace-finance__chart-column" key={month.key}>
                        <div className="ace-finance__chart-track"><i style={{ height: `${month.total ? Math.max(4, (month.total / maxMonthlyCollection) * 100) : 0}%` }} title={money(month.total, activeCurrency)} /></div>
                        <span>{month.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState title="No collections yet" detail="Recorded payments will build your collection trend here." />}
            </section>

            <section className="ace-finance__panel ace-finance__attention-panel">
              <SectionHeading eyebrow="NEEDS ATTENTION" title="Outstanding accounts" detail="Invoices that still need follow-up." action={<button className="ace-finance__text-button" type="button" onClick={() => { setInvoiceStatusFilter("overdue"); setActiveTab("billing") }}>View overdue <ArrowUpRight size={14} /></button>} />
              {outstandingInvoices.length ? (
                <div className="ace-finance__attention-list">
                  {outstandingInvoices.slice(0, 5).map((invoice) => (
                    <div className="ace-finance__attention-row" key={invoice.id}>
                      <span className="ace-finance__avatar">{(invoice.studentName || "S").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                      <span className="ace-finance__attention-person"><strong>{invoice.studentName}</strong><small>{invoice.feeName} · Due {dateLabel(invoice.dueOn, { year: false })}</small></span>
                      <span className="ace-finance__attention-balance"><strong>{money(invoice.balance, invoice.currency)}</strong><small className={`ace-finance__status is-${invoiceStatus(invoice)}`}>{statusLabel(invoiceStatus(invoice))}</small></span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="All accounts are settled" detail="There are no outstanding invoices in this currency." />}
            </section>
          </div>

          <section className="ace-finance__panel ace-finance__table-panel">
            <SectionHeading eyebrow="LATEST ACTIVITY" title="Recent collections" detail="Latest payments recorded against student invoices." action={<button className="ace-finance__text-button" type="button" onClick={() => setActiveTab("collections")}>All collections <ArrowUpRight size={14} /></button>} />
            <PaymentTable payments={currencyPayments.slice(0, 6)} onReceipt={(payment) => setReceipt(invoices.find((item) => item.id === payment.invoiceId) || null)} />
          </section>

          <section className="ace-finance__online-note">
            <span><ShieldCheck size={21} /></span>
            <div><strong>Online payment processing</strong><p>Gateway checkout is not connected yet. Manual collections remain available; online payments will only be marked paid after server-side provider verification and settlement matching.</p></div>
            <span className="ace-finance__setup-state">Setup required</span>
          </section>
        </div>
      )}

      {activeTab === "fees" && (
        <div className="ace-finance__view">
          <SectionHeading eyebrow="CHARGES & STRUCTURES" title="Fee structures" detail="Create reusable charges for a class and academic term. Use a separate structure for each fee component." />
          <div className="ace-finance__two-column">
            <form className="ace-finance__panel ace-finance__form" onSubmit={submitSchedule}>
              <div className="ace-finance__form-title"><span><Plus size={17} /></span><div><strong>Create fee structure</strong><small>Define the charge before billing students.</small></div></div>
              <label>Fee name<input value={scheduleForm.name} maxLength={120} required placeholder="e.g. First term tuition" onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} /></label>
              <div className="ace-finance__form-row">
                <label>Class<select value={scheduleForm.classId} required onChange={(event) => setScheduleForm({ ...scheduleForm, classId: event.target.value, academicTermId: "" })}><option value="">Select class</option>{academic.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Academic term<select value={scheduleForm.academicTermId} required disabled={!scheduleClass} onChange={(event) => setScheduleForm({ ...scheduleForm, academicTermId: event.target.value })}><option value="">Select term</option>{scheduleTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
              </div>
              <div className="ace-finance__form-row">
                <label>Charge amount<input type="number" min="0.01" max="1000000000" step="0.01" required value={scheduleForm.amount} placeholder="0.00" onChange={(event) => setScheduleForm({ ...scheduleForm, amount: event.target.value })} /></label>
                <label>Currency<select value={scheduleForm.currency} onChange={(event) => setScheduleForm({ ...scheduleForm, currency: event.target.value })}><option value="NGN">NGN — Naira</option><option value="USD">USD — US Dollar</option><option value="GBP">GBP — Pound Sterling</option><option value="EUR">EUR — Euro</option></select></label>
              </div>
              <label>Payment due date<input type="date" value={scheduleForm.dueOn} onChange={(event) => setScheduleForm({ ...scheduleForm, dueOn: event.target.value })} /></label>
              <button className="ace-finance__primary" type="submit" disabled={busy || !academic.classes.length}>{busy ? <LoadingSpinner /> : <Plus size={16} />} Create fee structure</button>
              <p className="ace-finance__form-note">Fee structures are reusable. Creating one does not charge students until you create invoices.</p>
            </form>
            <section className="ace-finance__panel ace-finance__schedule-panel">
              <SectionHeading eyebrow="CONFIGURED CHARGES" title="Existing fee structures" detail={`${schedules.length} fee structures saved for this school.`} />
              {finance.loading ? <div className="ace-finance__loading"><LoadingSpinner /> Loading fee structures…</div> : schedules.length ? (
                <div className="ace-finance__schedule-list">{schedules.map((schedule) => (
                  <article className="ace-finance__schedule-item" key={schedule.id}>
                    <span className="ace-finance__schedule-icon"><FileCheck2 size={17} /></span>
                    <div><strong>{schedule.name}</strong><small>{schedule.className} · {schedule.termName}</small><small>Due {dateLabel(schedule.dueOn)}</small></div>
                    <strong className="ace-finance__schedule-amount">{money(schedule.amount, schedule.currency)}</strong>
                  </article>
                ))}</div>
              ) : <EmptyState title="No fee structures yet" detail="Create your first fee structure to begin billing." />}
            </section>
          </div>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="ace-finance__view">
          <SectionHeading eyebrow="INVOICE OPERATIONS" title="Invoices & billing" detail="Issue charges to a full class or selected students, then track every balance from one invoice register." action={<button className="ace-finance__secondary" type="button" onClick={downloadCsv}><Download size={15} /> Export register</button>} />
          <div className="ace-finance__panel ace-finance__billing-builder">
            <div className="ace-finance__builder-header"><span className="ace-finance__step">01</span><div><strong>Build a billing run</strong><small>Select the fee structure and students to invoice.</small></div></div>
            <form onSubmit={issueInvoices}>
              <label>Fee structure<select value={selectedScheduleId} required onChange={(event) => { setSelectedScheduleId(event.target.value); setSelectedStudentIds([]) }}><option value="">Choose a fee structure</option>{activeSchedules.map((schedule) => <option value={schedule.id} key={schedule.id}>{schedule.name} · {schedule.className} · {schedule.termName} · {money(schedule.amount, schedule.currency)}</option>)}</select></label>
              {selectedSchedule && <div className="ace-finance__billing-summary"><span><Users size={16} /> {selectedSchedule.className}</span><span><CalendarDays size={16} /> {selectedSchedule.termName}</span><strong>{money(selectedSchedule.amount, selectedSchedule.currency)} per student</strong></div>}
              <div className="ace-finance__student-select-heading"><div><strong>Students to bill</strong><small>{selectedStudentIds.length} of {billingStudents.length} selected</small></div><button type="button" className="ace-finance__text-button" disabled={!billingStudents.length} onClick={() => setSelectedStudentIds(selectedStudentIds.length === billingStudents.length ? [] : billingStudents.map((student) => String(student._id)))}>{selectedStudentIds.length === billingStudents.length && billingStudents.length ? "Clear selection" : "Select entire class"}</button></div>
              {selectedSchedule ? billingStudents.length ? (
                <div className="ace-finance__student-grid">{billingStudents.map((student) => (
                  <label className={selectedStudentIds.includes(String(student._id)) ? "is-selected" : ""} key={student._id}><input type="checkbox" checked={selectedStudentIds.includes(String(student._id))} onChange={() => toggleStudent(student._id)} /><span className="ace-finance__avatar">{(student.fullName || "S").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{student.fullName}</strong><small>{student.designation || selectedSchedule.className}</small></span></label>
                ))}</div>
              ) : <EmptyState title="No active roster members" detail="This class has no active student assignments. Assign students to the class first." /> : <p className="ace-finance__helper">Choose a fee structure to load the matching active class roster.</p>}
              <div className="ace-finance__builder-footer"><span>{selectedBillingStudents.length ? `Estimated invoices: ${selectedBillingStudents.length} · ${money(selectedBillingStudents.length * Number(selectedSchedule?.amount || 0), selectedSchedule?.currency || activeCurrency)}` : "No students selected"}</span><button className="ace-finance__primary" disabled={busy || !selectedSchedule || !selectedStudentIds.length}>{busy ? <LoadingSpinner /> : <FileText size={16} />} Issue {selectedStudentIds.length || ""} invoice{selectedStudentIds.length === 1 ? "" : "s"}</button></div>
            </form>
          </div>

          <section className="ace-finance__panel ace-finance__table-panel">
            <SectionHeading eyebrow="SCHOOL LEDGER" title="Invoice register" detail={`${visibleInvoices.length} matching invoices in ${activeCurrency}.`} />
            <div className="ace-finance__table-tools"><label className="ace-finance__search"><Search size={16} /><input value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} placeholder="Search student or fee…" /></label><label className="ace-finance__filter"><Filter size={14} /><select value={invoiceStatusFilter} onChange={(event) => setInvoiceStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="unpaid">Unpaid</option><option value="partial">Part-paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></select></label></div>
            {finance.loading ? <div className="ace-finance__loading"><LoadingSpinner /> Loading invoices…</div> : visibleInvoices.length ? (
              <InvoiceTable invoices={visibleInvoices} onPayment={openPayment} onReceipt={setReceipt} />
            ) : <EmptyState title="No invoices match this view" detail="Try a different filter or create a new billing run." />}
          </section>
        </div>
      )}

      {activeTab === "collections" && (
        <div className="ace-finance__view">
          <SectionHeading eyebrow="PAYMENT OPERATIONS" title="Collections" detail="Review money received and record school-counter or bank-transfer payments against an invoice." />
          <div className="ace-finance__metrics ace-finance__metrics--three">
            <MetricCard label="Collected" value={money(collectedTotal, activeCurrency)} detail="Payments posted to invoices" Icon={ArrowDownLeft} tone="green" />
            <MetricCard label="Transactions" value={currencyPayments.length.toLocaleString()} detail="Individual payment entries" Icon={Activity} tone="blue" />
            <MetricCard label="Awaiting collection" value={outstandingInvoices.length.toLocaleString()} detail="Open invoices" Icon={Clock3} tone="amber" />
          </div>
          <section className="ace-finance__panel ace-finance__table-panel">
            <SectionHeading eyebrow="PAYMENT LEDGER" title="Payment history" detail="Every entry shown here is already recorded against an invoice." />
            {finance.loading ? <div className="ace-finance__loading"><LoadingSpinner /> Loading payments…</div> : currencyPayments.length ? <PaymentTable payments={currencyPayments} onReceipt={(payment) => setReceipt(invoices.find((item) => item.id === payment.invoiceId) || null)} /> : <EmptyState title="No payments recorded" detail="Once a payment is recorded against an invoice, it will appear here." />}
          </section>
          <section className="ace-finance__online-note"><span><ShieldCheck size={21} /></span><div><strong>Online payments require gateway setup</strong><p>Do not mark a transfer or checkout screenshot as paid. A future gateway connection will verify the transaction server-side before posting it into this ledger.</p></div><span className="ace-finance__setup-state">Not connected</span></section>
        </div>
      )}

      {activeTab === "accounts" && (
        <div className="ace-finance__view">
          <SectionHeading eyebrow="INDIVIDUAL FINANCIAL RECORDS" title="Student accounts" detail="A consolidated view of each student's billed amount, payments and remaining balance." />
          <section className="ace-finance__panel ace-finance__table-panel">
            <div className="ace-finance__table-tools"><label className="ace-finance__search"><Search size={16} /><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Find a student…" /></label><span className="ace-finance__muted-count">{visibleAccounts.length} accounts</span></div>
            {visibleAccounts.length ? (
              <div className="ace-finance__table-wrap"><table className="ace-finance__table"><thead><tr><th>Student</th><th>Invoices</th><th>Total billed</th><th>Paid</th><th>Balance</th><th>Account state</th></tr></thead><tbody>{visibleAccounts.map((account) => <tr key={account.studentId}><td><strong>{account.studentName}</strong><small>Student account</small></td><td>{account.invoices}</td><td>{money(account.billed, account.currency)}</td><td>{money(account.paid, account.currency)}</td><td><strong className={account.balance > 0 ? "is-due" : "is-settled"}>{money(account.balance, account.currency)}</strong></td><td><span className={`ace-finance__status ${account.balance > 0 ? "is-unpaid" : "is-paid"}`}>{account.balance > 0 ? "Balance due" : "Settled"}</span></td></tr>)}</tbody></table></div>
            ) : <EmptyState title="No student fee accounts" detail="Student accounts appear here after invoices have been issued." />}
          </section>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="ace-finance__view">
          <SectionHeading eyebrow="FINANCIAL INTELLIGENCE" title="Reports & analytics" detail={`A summary of recorded ${activeCurrency} billing and collections. Export the filtered invoice register for further analysis.`} action={<button className="ace-finance__secondary" type="button" onClick={downloadCsv}><Download size={15} /> Export CSV</button>} />
          <div className="ace-finance__metrics">
            <MetricCard label="Collection rate" value={`${collectionRate}%`} detail="Collected / billed" Icon={Activity} tone="green" />
            <MetricCard label="Outstanding accounts" value={outstandingInvoices.length.toLocaleString()} detail="Invoices with balance" Icon={Users} tone="amber" />
            <MetricCard label="Overdue accounts" value={overdueInvoices.length.toLocaleString()} detail="Past due date" Icon={Clock3} tone="rose" />
            <MetricCard label="Fee structures" value={schedules.filter((item) => item.currency === activeCurrency).length.toLocaleString()} detail="Configured charges" Icon={CalendarDays} tone="blue" />
          </div>
          <section className="ace-finance__panel ace-finance__chart-panel">
            <SectionHeading eyebrow="COLLECTION TREND" title="Monthly collections" detail="Payment records grouped by payment date." />
            <div className="ace-finance__report-bars">{monthlyCollections.map((item) => <div key={item.key}><span>{item.label}</span><div><i style={{ width: `${item.total ? Math.max(2, item.total / maxMonthlyCollection * 100) : 0}%` }} /></div><strong>{money(item.total, activeCurrency)}</strong></div>)}</div>
          </section>
          <section className="ace-finance__panel ace-finance__table-panel">
            <SectionHeading eyebrow="RISK REVIEW" title="Overdue invoices" detail="Invoices with an outstanding balance and a due date before today." />
            {overdueInvoices.length ? <InvoiceTable invoices={overdueInvoices} onPayment={openPayment} onReceipt={setReceipt} /> : <EmptyState title="No overdue invoices" detail="There are no overdue balances in this currency." />}
          </section>
        </div>
      )}

      {paymentTarget && selectedPaymentInvoice && (
        <div className="ace-finance__modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPaymentTarget("")}>
          <form className="ace-finance__modal" onSubmit={submitPayment}>
            <div className="ace-finance__modal-heading"><div><span className="ace-finance__eyebrow">MANUAL COLLECTION</span><h3>Record a payment</h3><p>{selectedPaymentInvoice.studentName} · {selectedPaymentInvoice.feeName}</p></div><button type="button" className="ace-finance__icon-button" onClick={() => setPaymentTarget("")} aria-label="Close"><X size={17} /></button></div>
            <div className="ace-finance__balance-callout"><span>Remaining balance</span><strong>{money(selectedPaymentInvoice.balance, selectedPaymentInvoice.currency)}</strong></div>
            <label>Amount received<input type="number" min="0.01" max={selectedPaymentInvoice.balance} step="0.01" required value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
            <label>Payment channel<select value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}><option value="cash">Cash at school</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other / POS recorded externally</option></select></label>
            <label>Transaction reference<input maxLength={100} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} placeholder="Optional bank or receipt reference" /></label>
            <label>Date received<input type="date" required value={paymentForm.paidOn} onChange={(event) => setPaymentForm({ ...paymentForm, paidOn: event.target.value })} /></label>
            <p className="ace-finance__form-note">This records a payment already received by the school. Online checkout payments must be verified by the payment provider before posting.</p>
            <div className="ace-finance__modal-actions"><button className="ace-finance__secondary" type="button" onClick={() => setPaymentTarget("")}>Cancel</button><button className="ace-finance__primary" disabled={busy}>{busy ? <LoadingSpinner /> : <Check size={16} />} Save payment</button></div>
          </form>
        </div>
      )}

      {receipt && (
        <div className="ace-finance__modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReceipt(null)}>
          <article className="ace-finance__modal ace-finance__receipt">
            <div className="ace-finance__receipt-brand"><span className="ace-finance__receipt-mark">A</span><div><strong>{school?.schoolName || "School"}</strong><small>OFFICIAL FEE STATEMENT</small></div></div>
            <div className="ace-finance__modal-heading"><div><span className="ace-finance__eyebrow">STUDENT ACCOUNT STATEMENT</span><h3>{receipt.studentName}</h3><p>{receipt.feeName}</p></div><button type="button" className="ace-finance__icon-button ace-finance__no-print" onClick={() => setReceipt(null)} aria-label="Close"><X size={17} /></button></div>
            <div className="ace-finance__receipt-summary"><div><span>Invoice amount</span><strong>{money(receipt.amount, receipt.currency)}</strong></div><div><span>Paid to date</span><strong>{money(receipt.paid, receipt.currency)}</strong></div><div><span>Outstanding</span><strong>{money(receipt.balance, receipt.currency)}</strong></div></div>
            <h4>Payment history</h4>
            {(receipt.payments || []).length ? (receipt.payments.map((payment) => <div className="ace-finance__receipt-payment" key={payment.id}><span>{dateLabel(payment.paidOn)} · {(payment.method || "").replaceAll("_", " ")}{payment.reference ? ` · ${payment.reference}` : ""}</span><strong>{money(payment.amount, receipt.currency)}</strong></div>)) : <p className="ace-finance__form-note">No payment has been recorded for this invoice.</p>}
            <div className="ace-finance__modal-actions ace-finance__no-print"><button className="ace-finance__secondary" type="button" onClick={() => setReceipt(null)}>Close</button><button className="ace-finance__primary" type="button" onClick={() => window.print()}><Printer size={16} /> Print statement</button></div>
          </article>
        </div>
      )}
    </section>
  )
}

function InvoiceTable({ invoices, onPayment, onReceipt }) {
  return (
    <div className="ace-finance__table-wrap">
      <table className="ace-finance__table">
        <thead><tr><th>Student / charge</th><th>Due date</th><th>Billed</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{invoices.map((invoice) => {
          const status = invoiceStatus(invoice)
          return <tr key={invoice.id}>
            <td><strong>{invoice.studentName}</strong><small>{invoice.feeName} · {invoice.className || "School fee"}</small></td>
            <td>{dateLabel(invoice.dueOn)}</td>
            <td>{money(invoice.amount, invoice.currency)}</td>
            <td>{money(invoice.paid, invoice.currency)}</td>
            <td><strong className={invoice.balance > 0 ? "is-due" : "is-settled"}>{money(invoice.balance, invoice.currency)}</strong></td>
            <td><span className={`ace-finance__status is-${status}`}>{statusLabel(status)}</span></td>
            <td><div className="ace-finance__row-actions">{invoice.balance > 0 && <button type="button" onClick={() => onPayment(invoice)} title="Record payment"><Banknote size={15} /> Pay</button>}<button type="button" onClick={() => onReceipt(invoice)} title="View statement"><FileText size={15} /></button></div></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  )
}

function PaymentTable({ payments, onReceipt }) {
  if (!payments.length) return <EmptyState title="No payment entries" detail="Payments recorded against student invoices will appear here." />
  return (
    <div className="ace-finance__table-wrap">
      <table className="ace-finance__table">
        <thead><tr><th>Student</th><th>Fee</th><th>Payment date</th><th>Method</th><th>Reference</th><th>Amount</th><th /></tr></thead>
        <tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.studentName}</strong><small>Invoice #{payment.invoiceId}</small></td><td>{payment.feeName}</td><td>{dateLabel(payment.paidOn)}</td><td><span className="ace-finance__method">{(payment.method || "").replaceAll("_", " ")}</span></td><td>{payment.reference || "—"}</td><td><strong>{money(payment.amount, payment.currency)}</strong></td><td><button className="ace-finance__table-icon" type="button" onClick={() => onReceipt(payment)} aria-label={`View statement for ${payment.studentName}`}><FileText size={15} /></button></td></tr>)}</tbody>
      </table>
    </div>
  )
}
