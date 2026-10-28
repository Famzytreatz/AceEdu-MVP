import { useCallback, useEffect, useRef, useState } from "react"

import {
  Activity,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"

import {
  approveSchoolVerificationRequest,
  getCurrentPlatformOperator,
  getActivePremiumSchools,
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
          <p>
            {request.country} · {request.state} · {request.city}
          </p>
          <h2>{request.schoolName}</h2>
        </div>
        <span className={`platform-request__status is-${request.status}`}>
          {request.status === "review_required" ? "Review required" : "Pending"}
        </span>
      </div>
      <p className="platform-request__meta">
        Requested{" "}
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(request.createdAt),
        )}
        {request.reviewReason === "trial_previously_granted" &&
          " · Trial already granted to this identity"}
        {request.reviewReason === "registration_id_already_linked" &&
          " · Registration ID is linked to another account"}
      </p>
      <p className="platform-request__registration">
        Official school registration ID:{" "}
        <strong>{request.officialRegistrationId}</strong>
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
        <label htmlFor={`reject-reason-${request.id}`}>
          Reason if declining
        </label>
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
              [
                "trial_previously_granted",
                "registration_id_already_linked",
              ].includes(
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

  const [premiumSchools, setPremiumSchools] = useState([])

  const [loadingPremiumSchools, setLoadingPremiumSchools] = useState(false)

  const [premiumSchoolsError, setPremiumSchoolsError] = useState("")

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

  const loadPremiumSchools = useCallback(async () => {
    setLoadingPremiumSchools(true)
    try {
      const result = await getActivePremiumSchools()
      setPremiumSchools(result.schools)
      setPremiumSchoolsError("")
    } catch (loadError) {
      setPremiumSchoolsError(loadError.message)
    } finally {
      setLoadingPremiumSchools(false)
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
    if (operator) {
      void loadRequests()
      void loadPremiumSchools()
    }
  }, [operator, loadPremiumSchools, loadRequests])

  useEffect(() => {
    if (!operator) return undefined

    const refreshPlatformData = () => {
      if (document.visibilityState !== "visible") return
      void loadRequests()
      void loadPremiumSchools()
    }

    document.addEventListener("visibilitychange", refreshPlatformData)
    return () =>
      document.removeEventListener("visibilitychange", refreshPlatformData)
  }, [operator, loadPremiumSchools, loadRequests])

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

    if (
      !window.confirm(
        "Approve this school and begin its one-time 90-day Premium trial now?",
      )
    )
      return

    actionLock.current = true

    setBusyId(requestId)

    setError("")

    setNotice("")

    try {
      await approveSchoolVerificationRequest(requestId)

      setNotice("School verified. Its one-time 90-day trial has started.")

      await Promise.all([loadRequests(), loadPremiumSchools()])
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
      setPremiumSchools([])
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  return (
    <main
      className={`platform-console${
        operator ? " platform-console--authenticated" : ""
      }`}
    >
      <header className="platform-header">
        <a className="platform-brand" href="/" aria-label="AceEdu home">
          <span>
            <ShieldCheck size={20} />
          </span>
          <strong>
            AceEdu <small>PLATFORM OPERATIONS</small>
          </strong>
        </a>
        {operator && (
          <div className="platform-header__operator">
            <span>{operator.email}</span>
            <button
              className="platform-button platform-button--quiet"
              type="button"
              onClick={logout}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
        {!operator && !initializing && (
          <span className="platform-header__secure">
            <span /> Secure operator access
          </span>
        )}
      </header>

      <section
        className={`platform-content${
          !initializing && !operator ? " platform-content--login" : ""
        }`}
      >
        {initializing ? (
          <div className="platform-loading" role="status" aria-live="polite">
            <LoadingSpinner /> Verifying operator session…
          </div>
        ) : !operator ? (
          <div className="platform-login-layout">
            <section
              className="platform-login-intro"
              aria-label="Platform operations overview"
            >
              <span className="platform-login-intro__orb" aria-hidden="true">
                <Sparkles size={22} />
              </span>
              <p className="platform-eyebrow">THE OPERATIONS LAYER</p>
              <h1>One clear view of every school decision.</h1>
              <p className="platform-login-intro__copy">
                Review school identities with confidence and keep the path to
                trusted access moving.
              </p>
              <div className="platform-login-feature">
                <span>
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <strong>Protected by design</strong>
                  <small>Access reserved for provisioned operators</small>
                </div>
              </div>
              <div className="platform-login-feature">
                <span>
                  <Activity size={17} />
                </span>
                <div>
                  <strong>Focused review queue</strong>
                  <small>Verify details before a Premium trial begins</small>
                </div>
              </div>
              <div className="platform-login-intro__signal">
                <i /> ACEEDU PLATFORM SYSTEMS <span>•</span> SECURE SESSION
              </div>
            </section>

            <form
              className="platform-login"
              onSubmit={submitLogin}
              aria-busy={loginPending}
            >
              <span className="platform-login__icon">
                <ShieldCheck size={22} />
              </span>
              <p className="platform-eyebrow">RESTRICTED ACCESS</p>
              <h2>Operator sign in</h2>
              <p>Use your provisioned platform operator account to continue.</p>
              {error && (
                <p className="platform-message is-error" role="alert">
                  {error}
                </p>
              )}
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
              <button
                className="platform-button platform-button--approve"
                type="submit"
                disabled={loginPending}
              >
                {loginPending ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {loginPending ? "Signing in…" : "Sign in securely"}
              </button>
              <p className="platform-login__footnote">
                <ShieldCheck size={13} /> Your operator session is encrypted and
                private.
              </p>
            </form>
          </div>
        ) : (
          <>
            <div className="platform-title">
              <div>
                <p className="platform-eyebrow">SCHOOL VERIFICATION</p>
                <h1>Review school requests</h1>
                <p>
                  Verify school identities before starting a one-time 90-day
                  Premium trial.
                </p>
              </div>
              <div className="platform-title__actions">
                <span className="platform-live-status">
                  <i /> OPERATOR ACTIVE
                </span>
                <button
                  className="platform-button platform-button--quiet"
                  type="button"
                  onClick={() => {
                    void loadRequests()
                    void loadPremiumSchools()
                  }}
                  disabled={loadingRequests || loadingPremiumSchools}
                >
                  <RefreshCw
                    size={16}
                    className={loadingRequests || loadingPremiumSchools ? "is-spinning" : ""}
                  />{" "}
                  Refresh
                </button>
              </div>
            </div>
            {!loadingRequests && !error && (
              <div
                className="platform-queue-summary"
                aria-label="Verification queue summary"
              >
                <div className="platform-summary-card">
                  <span className="platform-summary-card__icon">
                    <Clock3 size={17} />
                  </span>
                  <div>
                    <strong>
                      {
                        requests.filter(
                          (request) => request.status === "pending",
                        ).length
                      }
                    </strong>
                    <span>Awaiting review</span>
                  </div>
                </div>
                <div className="platform-summary-card platform-summary-card--review">
                  <span className="platform-summary-card__icon">
                    <ShieldCheck size={17} />
                  </span>
                  <div>
                    <strong>
                      {
                        requests.filter(
                          (request) => request.status === "review_required",
                        ).length
                      }
                    </strong>
                    <span>Needs extra review</span>
                  </div>
                </div>
                <div className="platform-summary-card platform-summary-card--premium">
                  <span className="platform-summary-card__icon">
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <strong>{premiumSchools.length}</strong>
                    <span>Active Premium schools</span>
                  </div>
                </div>
                <div className="platform-summary-note">
                  <span className="platform-summary-note__dot" />
                  <span>
                    Approval starts one 90-day Premium trial per verified school
                    identity.
                  </span>
                </div>
              </div>
            )}
            <section className="platform-premium-schools" aria-labelledby="platform-premium-title">
              <div className="platform-section-heading">
                <div>
                  <p className="platform-eyebrow">ENTITLEMENT MONITOR</p>
                  <h2 id="platform-premium-title">Schools with active Premium access</h2>
                  <p>Schools on an active 90-day trial or Premium plan.</p>
                </div>
                <span className="platform-premium-count">
                  {premiumSchools.length} {premiumSchools.length === 1 ? "school" : "schools"}
                </span>
              </div>
              {premiumSchoolsError && (
                <p className="platform-message is-error" role="alert">
                  Could not load active Premium schools: {premiumSchoolsError}
                </p>
              )}
              {loadingPremiumSchools ? (
                <div className="platform-loading" role="status" aria-live="polite">
                  <LoadingSpinner /> Loading active Premium schools…
                </div>
              ) : premiumSchoolsError ? null : premiumSchools.length === 0 ? (
                <div className="platform-premium-empty">
                  <Building2 size={21} />
                  <strong>No schools currently have active Premium access</strong>
                  <span>Approved, unexpired trials will appear here automatically.</span>
                </div>
              ) : (
                <div className="platform-premium-list">
                  {premiumSchools.map((school) => (
                    <article
                      className="platform-premium-school"
                      key={school.schoolId}
                    >
                      <span className="platform-premium-school__icon">
                        <Building2 size={18} />
                      </span>
                      <div className="platform-premium-school__identity">
                        <strong>{school.schoolName}</strong>
                        <span>{[school.city, school.state, school.country].filter(Boolean).join(" · ")}</span>
                        <small>AceEdu school ID: {school.schoolId}</small>
                      </div>
                      <span className={`platform-premium-school__access is-${school.accessType}`}>
                        <Sparkles size={14} />
                        {school.accessType === "trial" ? "90-day trial" : "Premium plan"}
                      </span>
                      <span className="platform-premium-school__dates">
                        <CalendarDays size={14} />
                        {school.accessType === "trial" && school.trialEndsAt
                          ? `Ends ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(school.trialEndsAt))}`
                          : school.trialStartedAt
                            ? `Started ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(school.trialStartedAt))}`
                            : "Active"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {error && (
              <p className="platform-message is-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="platform-message" role="status" aria-live="polite">
                {notice}
              </p>
            )}
            {loadingRequests ? (
              <div
                className="platform-loading"
                role="status"
                aria-live="polite"
              >
                <LoadingSpinner /> Loading verification queue…
              </div>
            ) : requests.length === 0 && error ? null : requests.length === 0 ? (
              <div className="platform-empty">
                <span className="platform-empty__icon">
                  <ShieldCheck size={25} />
                </span>
                <span className="platform-eyebrow">QUEUE CLEAR</span>
                <strong>No requests awaiting review</strong>
                <p>
                  New school verification requests will appear here when
                  submitted.
                </p>
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
