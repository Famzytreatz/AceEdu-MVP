import { useCallback, useEffect, useRef, useState } from "react"
import { Check, LogOut, RefreshCw, ShieldCheck, X } from "lucide-react"
import {
  approveSchoolVerificationRequest,
  getCurrentPlatformOperator,
  getVerificationRequests,
  loginPlatformOperator,
  logoutPlatformOperator,
  rejectSchoolVerificationRequest,
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"
import "./PlatformConsole.css"

function VerificationRequest({ request, busy, onApprove, onReject }) {
  const [reason, setReason] = useState("")

  return (
    <article className="platform-request">
      <div className="platform-request__heading">
        <div>
          <p>{request.country} · {request.state} · {request.city}</p>
          <h2>{request.schoolName}</h2>
        </div>
        <span className={`platform-request__status is-${request.status}`}>
          {request.status === "review_required" ? "Review required" : "Pending"}
        </span>
      </div>
      <p className="platform-request__meta">
        Requested {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(request.createdAt))}
        {request.reviewReason === "trial_previously_granted" && " · Trial already granted to this identity"}
        {request.reviewReason === "registration_id_already_linked" && " · Registration ID is linked to another account"}
      </p>
      <p className="platform-request__registration">
        Official school registration ID: <strong>{request.officialRegistrationId}</strong>
      </p>
      {request.possibleMatches.length > 0 && (
        <div className="platform-request__matches">
          <strong>Possible identity matches — review before approval</strong>
          {request.possibleMatches.map((match, index) => (
            <p key={`${match.schoolName}-${index}`}>
              {match.schoolName}
              {match.sameRegistrationIdentity
                ? " · Same official registration ID"
                : ` · ${match.status.replaceAll("_", " ")}`}
            </p>
          ))}
        </div>
      )}
      <form
        className="platform-request__review"
        onSubmit={(event) => {
          event.preventDefault()
          onReject(request.id, reason)
        }}
      >
        <label htmlFor={`reject-reason-${request.id}`}>Reason if declining</label>
        <textarea
          id={`reject-reason-${request.id}`}
          maxLength={500}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
        />
        <div className="platform-request__actions">
          <button
            type="button"
            className="platform-button platform-button--approve"
            onClick={() => onApprove(request.id)}
            disabled={
              busy ||
              ["trial_previously_granted", "registration_id_already_linked"].includes(
                request.reviewReason,
              )
            }
          >
            {busy ? <LoadingSpinner size="small" /> : <Check size={16} />}
            Approve 90-day trial
          </button>
          <button
            type="submit"
            className="platform-button platform-button--reject"
            disabled={busy || reason.trim().length === 0}
          >
            <X size={16} />
            Decline
          </button>
        </div>
      </form>
    </article>
  )
}

export default function PlatformConsole() {
  const [operator, setOperator] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState("")
  const [loginPending, setLoginPending] = useState(false)
  const loginLock = useRef(false)
  const actionLock = useRef(false)

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const result = await getVerificationRequests()
      setRequests(result.requests)
      setError("")
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getCurrentPlatformOperator()
      .then((current) => {
        if (active) setOperator(current)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setInitializing(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (operator) void loadRequests()
  }, [operator, loadRequests])

  async function submitLogin(event) {
    event.preventDefault()
    if (loginLock.current) return
    loginLock.current = true
    setLoginPending(true)
    setError("")
    try {
      setOperator(await loginPlatformOperator({ email, password }))
      setPassword("")
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      loginLock.current = false
      setLoginPending(false)
    }
  }

  async function approve(requestId) {
    if (actionLock.current) return
    if (!window.confirm("Approve this school and begin its one-time 90-day Premium trial now?")) return
    actionLock.current = true
    setBusyId(requestId)
    setError("")
    setNotice("")
    try {
      await approveSchoolVerificationRequest(requestId)
      setNotice("School verified. Its one-time 90-day trial has started.")
      await loadRequests()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      actionLock.current = false
      setBusyId("")
    }
  }

  async function reject(requestId, reason) {
    if (actionLock.current) return
    actionLock.current = true
    setBusyId(requestId)
    setError("")
    setNotice("")
    try {
      await rejectSchoolVerificationRequest(requestId, reason)
      setNotice("Verification request declined. No trial was activated.")
      await loadRequests()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      actionLock.current = false
      setBusyId("")
    }
  }

  async function logout() {
    setError("")
    try {
      await logoutPlatformOperator()
      setOperator(null)
      setRequests([])
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  return (
    <main className="platform-console">
      <header className="platform-header">
        <a className="platform-brand" href="/" aria-label="AceEdu home">
          <span><ShieldCheck size={20} /></span>
          <strong>AceEdu <small>PLATFORM OPERATIONS</small></strong>
        </a>
        {operator && (
          <div className="platform-header__operator">
            <span>{operator.email}</span>
            <button className="platform-button platform-button--quiet" type="button" onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </header>

      <section className="platform-content">
        {initializing ? (
          <div className="platform-loading" role="status" aria-live="polite">
            <LoadingSpinner /> Verifying operator session…
          </div>
        ) : !operator ? (
          <form className="platform-login" onSubmit={submitLogin} aria-busy={loginPending}>
            <span className="platform-login__icon"><ShieldCheck size={22} /></span>
            <p className="platform-eyebrow">RESTRICTED ACCESS</p>
            <h1>Platform operator sign in</h1>
            <p>Only provisioned AceEdu platform operators can review school verification.</p>
            {error && <p className="platform-message is-error" role="alert">{error}</p>}
            <label htmlFor="platform-email">Operator email</label>
            <input
              id="platform-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loginPending}
            />
            <label htmlFor="platform-password">Password</label>
            <input
              id="platform-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loginPending}
            />
            <button className="platform-button platform-button--approve" type="submit" disabled={loginPending}>
              {loginPending ? <LoadingSpinner size="small" /> : <ShieldCheck size={16} />}
              {loginPending ? "Signing in…" : "Sign in securely"}
            </button>
          </form>
        ) : (
          <>
            <div className="platform-title">
              <div>
                <p className="platform-eyebrow">SCHOOL VERIFICATION</p>
                <h1>Review school requests</h1>
                <p>Verify the school identity before starting its one-time 90-day trial.</p>
              </div>
              <button
                className="platform-button platform-button--quiet"
                type="button"
                onClick={() => void loadRequests()}
                disabled={loadingRequests}
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            {error && <p className="platform-message is-error" role="alert">{error}</p>}
            {notice && <p className="platform-message" role="status" aria-live="polite">{notice}</p>}
            {loadingRequests ? (
              <div className="platform-loading" role="status" aria-live="polite">
                <LoadingSpinner /> Loading verification queue…
              </div>
            ) : requests.length === 0 ? (
              <div className="platform-empty">
                <ShieldCheck size={24} />
                <strong>No requests awaiting review</strong>
                <p>New school verification requests will appear here.</p>
              </div>
            ) : (
              <div className="platform-request-list">
                {requests.map((request) => (
                  <VerificationRequest
                    key={request.id}
                    request={request}
                    busy={busyId === request.id}
                    onApprove={approve}
                    onReject={reject}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
