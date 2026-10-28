
import { useEffect, useId, useRef, useState } from "react"
import { AlertCircle, Building2, CheckCircle2, Eye, EyeOff, X } from "lucide-react"
import Button from "./Button"
import "./Modal.css"

const initialSchool = {
  schoolName: "",
  schoolType: "",
  country: "Nigeria",
  state: "",
  city: "",
  address: "",
  schoolEmail: "",
  schoolPhone: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminRole: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
}

const initialDemo = {
  schoolName: "",
  schoolType: "",
  state: "",
  city: "",
  studentCount: "",
  contactName: "",
  email: "",
  phone: "",
  role: "",
  format: "Online",
  interests: [],
  message: "",
  consent: false,
}

const titles = {
  login: {
    title: "Welcome back",
    description: "Sign in to your existing AceEdu account.",
  },
  started: {
    title: "Register your school",
    description: "Set up your school profile and create the first administrator account.",
  },
  demo: {
    title: "Book an AceEdu demo",
    description: "Tell us a little about your school. Our team can follow up to arrange a demonstration.",
  },
}

const schoolTypes = ["Nursery/Primary", "Secondary", "Combined", "Other"]
const adminRoles = ["Proprietor", "Principal", "School Administrator", "Other"]
const demoInterests = [
  "Student records",
  "Attendance",
  "Fees",
  "Examinations and results",
  "Teacher management",
  "Parent communication",
  "Reporting",
]

function Field({ label, name, type = "text", required = false, value, onChange, placeholder, autoComplete, children, ...props }) {
  return (
    <label className="modal__field" htmlFor={`field-${name}`}>
      <span>{label}{required && <span className="modal__required"> *</span>}</span>
      {children || (
        <input
          id={`field-${name}`}
          name={name}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          {...props}
        />
      )}
    </label>
  )
}

function SelectField({ label, name, value, onChange, options, required = false, placeholder = "Select an option" }) {
  return (
    <Field label={label} name={name} required={required}>
      <select id={`field-${name}`} name={name} value={value} onChange={onChange} required={required}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  )
}

function PasswordField({ label, name, value, onChange, visible, onToggle, required = true, autoComplete }) {
  return (
    <Field label={label} name={name} type={visible ? "text" : "password"} value={value}
      onChange={onChange} required={required} autoComplete={autoComplete} minLength={8}
      placeholder="At least 8 characters">
      <span className="modal__password-wrap">
        <input
          id={`field-${name}`}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          minLength={8}
          autoComplete={autoComplete}
          placeholder="At least 8 characters"
        />
        <button type="button" className="modal__password-toggle" onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </Field>
  )
}

export default function Modal({
  mode,
  onClose,
  onOpenModal,
  onRegister,
  onLogin,
  schoolContext,
  dismissible = true,
}) {
  const titleId = useId()
  const [step, setStep] = useState(1)
  const [school, setSchool] = useState(initialSchool)
  const [demo, setDemo] = useState(initialDemo)
  const [login, setLogin] = useState({ email: "", password: "", remember: false })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [notice, setNotice] = useState("")
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!mode) return undefined
    const handleKeyDown = (event) => {
      if (dismissible && event.key === "Escape" && !submitLock.current) onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mode, onClose, dismissible])

  useEffect(() => {
    setStep(1)
    setSchool(initialSchool)
    setDemo(initialDemo)
    setLogin({ email: "", password: "", remember: false })
    setShowPassword(false)
    setShowConfirmPassword(false)
    setNotice("")
    setNoticeIsError(false)
    setIsSubmitting(false)
    submitLock.current = false
    setErrors({})
  }, [mode])

  if (!mode || !titles[mode]) return null
  const content = mode === "login" && schoolContext
    ? {
        title: `Sign in to ${schoolContext.schoolName}`,
        description: "Use your existing school administrator account to continue.",
      }
    : titles[mode]

  const updateSchool = (event) => {
    const { name, value, type, checked } = event.target
    setSchool((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "schoolEmail" && current.adminEmail === current.schoolEmail
        ? { adminEmail: value } : {}),
    }))
    setErrors((current) => ({ ...current, [name]: "" }))
    setNotice("")
    setNoticeIsError(false)
  }

  const updateDemo = (event) => {
    const { name, value, type, checked } = event.target
    setDemo((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }))
    setErrors((current) => ({ ...current, [name]: "" }))
    setNotice("")
    setNoticeIsError(false)
  }

  const updateLogin = (event) => {
    const { name, value, type, checked } = event.target
    setLogin((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }))
    setErrors((current) => ({ ...current, [name]: "" }))
    setNotice("")
    setNoticeIsError(false)
  }

  function validateSchoolStep() {
    const nextErrors = {}
    const requiredByStep = step === 1
      ? ["schoolName", "schoolType", "country", "state", "city", "address", "schoolEmail", "schoolPhone"]
      : step === 2
        ? ["adminName", "adminEmail", "adminPhone", "adminRole"]
        : ["password", "confirmPassword"]
    requiredByStep.forEach((name) => {
      if (!String(school[name] ?? "").trim()) nextErrors[name] = "This field is required."
    })
    const emailFields = ["schoolEmail", "adminEmail"].filter((name) => requiredByStep.includes(name))
    emailFields.forEach((name) => {
      if (school[name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school[name])) {
        nextErrors[name] = "Enter a valid email address."
      }
    })
    if (step === 3) {
      if (school.password.length < 8) nextErrors.password = "Use at least 8 characters."
      if (school.password !== school.confirmPassword) nextErrors.confirmPassword = "Passwords do not match."
      if (!school.acceptTerms) nextErrors.acceptTerms = "You must accept the terms to continue."
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSchoolNext(event) {
    event.preventDefault()
    if (!validateSchoolStep()) return
    setNotice("")
    setErrors({})
    setStep((current) => Math.min(current + 1, 4))
  }

  async function handleSchoolSubmit(event) {
    event.preventDefault()
    if (submitLock.current) return
    if (!validateSchoolStep()) return
    submitLock.current = true
    setIsSubmitting(true)
    try {
      if (!onRegister) throw new Error("School registration is not available right now.")
      await onRegister(school)
      onClose()
    } catch (error) {
      setNotice(error.message || "School registration could not be completed.")
      setNoticeIsError(true)
    } finally {
      submitLock.current = false
      setIsSubmitting(false)
    }
  }

  function handleDemoSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    ;["schoolName", "schoolType", "state", "city", "contactName", "email", "phone", "role"].forEach((name) => {
      if (!String(demo[name] ?? "").trim()) nextErrors[name] = "This field is required."
    })
    if (demo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demo.email)) nextErrors.email = "Enter a valid email address."
    if (!demo.consent) nextErrors.consent = "Please confirm you agree to be contacted about this request."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setNotice("Your demo request form is complete, but it has not been sent. The AceEdu demo-request backend is not connected yet, so our team has not received your details.")
    setNoticeIsError(false)
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    if (submitLock.current) return
    const nextErrors = {}
    if (!login.email.trim()) nextErrors.email = "Enter your email address."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login.email)) nextErrors.email = "Enter a valid email address."
    if (!login.password) nextErrors.password = "Enter your password."
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) {
      submitLock.current = true
      setIsSubmitting(true)
      try {
        if (!onLogin) throw new Error("Login is not available right now.")
        await onLogin(
          schoolContext ? { ...login, schoolSlug: schoolContext.slug } : login,
        )
        onClose()
      } catch (error) {
        setNotice(error.message || "Login could not be completed.")
        setNoticeIsError(true)
      } finally {
        submitLock.current = false
        setIsSubmitting(false)
      }
    }
  }

  const handleBackdropMouseDown = (event) => {
    if (dismissible && event.target === event.currentTarget && !submitLock.current) onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section className={`modal ${mode === "started" ? "modal--wide" : ""}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${titleId}-description`}>
        {dismissible && (
          <button className="modal__close" type="button" onClick={() => { if (!submitLock.current) onClose() }} disabled={isSubmitting} aria-label="Close dialog">
            <X size={22} aria-hidden="true" />
          </button>
        )}

        <div className="modal__heading">
          {mode === "login" && schoolContext && (
            <div className="modal__school-brand">
              {schoolContext.logoUrl
                ? <img src={schoolContext.logoUrl} alt={`${schoolContext.schoolName} logo`} />
                : <Building2 aria-hidden="true" />}
              <span>
                <small>School administrator access</small>
                <strong>{schoolContext.schoolName}</strong>
              </span>
            </div>
          )}
          <h2 id={titleId}>{content.title}</h2>
          <p id={`${titleId}-description`}>{content.description}</p>
        </div>

        {mode === "login" && (
          <form className="modal__form" onSubmit={handleLoginSubmit} noValidate aria-busy={isSubmitting}>
            <fieldset className="modal__fieldset" disabled={isSubmitting}>
            <Field label="Email address" name="email" type="email" value={login.email} onChange={updateLogin}
              required placeholder="you@school.com" autoComplete="email" />
            {errors.email && <p className="modal__error">{errors.email}</p>}
            <PasswordField label="Password" name="password" value={login.password} onChange={updateLogin}
              visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="current-password" />
            {errors.password && <p className="modal__error">{errors.password}</p>}
            <div className="modal__inline-row">
              <label className="modal__checkbox"><input type="checkbox" name="remember" checked={login.remember} onChange={updateLogin} /> Remember me</label>
              <button type="button" className="modal__text-button"
                onClick={() => setNotice("Password recovery is not available yet because AceEdu authentication is not connected.")}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="modal__submit" loading={isSubmitting} loadingLabel="Signing you in...">Login</Button>
            {schoolContext
              ? <p className="modal__switch">Need an account? Contact your school administrator.</p>
              : <p className="modal__switch">Registering a new school? <button type="button" className="modal__text-button" onClick={() => onOpenModal?.("started")}>Use Get Started on the page to register.</button></p>}
            </fieldset>
          </form>
        )}

        {mode === "started" && (
          <>
            <ol className="modal__progress" aria-label="School registration progress">
              {["School", "Administrator", "Security", "Review"].map((label, index) => (
                <li key={label} className={step >= index + 1 ? "is-active" : ""} aria-current={step === index + 1 ? "step" : undefined}>
                  <span>{index + 1}</span><small>{label}</small>
                </li>
              ))}
            </ol>
            {step < 4 ? (
              <form className="modal__form" onSubmit={handleSchoolNext} noValidate>
                {step === 1 && (
                  <div className="modal__grid">
                    <Field label="School name" name="schoolName" value={school.schoolName} onChange={updateSchool} required placeholder="e.g. Bright Future Academy" />
                    <SelectField label="School type" name="schoolType" value={school.schoolType} onChange={updateSchool} options={schoolTypes} required />
                    <Field label="Country" name="country" value={school.country} onChange={updateSchool} required />
                    <Field label="State" name="state" value={school.state} onChange={updateSchool} required placeholder="e.g. Lagos" />
                    <Field label="City or town" name="city" value={school.city} onChange={updateSchool} required />
                    <Field label="School address" name="address" value={school.address} onChange={updateSchool} required placeholder="Street address" />
                    <Field label="School email" name="schoolEmail" type="email" value={school.schoolEmail} onChange={updateSchool} required placeholder="school@example.com" autoComplete="organization" />
                    <Field label="School phone number" name="schoolPhone" type="tel" value={school.schoolPhone} onChange={updateSchool} required placeholder="+234..." autoComplete="tel" />
                  </div>
                )}
                {step === 2 && (
                  <div className="modal__grid">
                    <Field label="Administrator full name" name="adminName" value={school.adminName} onChange={updateSchool} required autoComplete="name" placeholder="Your full name" />
                    <Field label="Administrator email" name="adminEmail" type="email" value={school.adminEmail} onChange={updateSchool} required autoComplete="email" placeholder="you@school.com" />
                    <label className="modal__checkbox modal__checkbox--wide">
                      <input type="checkbox" checked={school.adminEmail === school.schoolEmail && Boolean(school.schoolEmail)}
                        onChange={(event) => setSchool((current) => ({ ...current, adminEmail: event.target.checked ? current.schoolEmail : "" }))} />
                      Use the school email for the administrator account
                    </label>
                    <Field label="Administrator phone number" name="adminPhone" type="tel" value={school.adminPhone} onChange={updateSchool} required placeholder="+234..." autoComplete="tel" />
                    <SelectField label="Role or position" name="adminRole" value={school.adminRole} onChange={updateSchool} options={adminRoles} required />
                  </div>
                )}
                {step === 3 && (
                  <div className="modal__grid">
                    <PasswordField label="Create password" name="password" value={school.password} onChange={updateSchool}
                      visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
                    <PasswordField label="Confirm password" name="confirmPassword" value={school.confirmPassword} onChange={updateSchool}
                      visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} autoComplete="new-password" />
                    <p className="modal__hint modal__full">Use at least 8 characters. Do not reuse a password from another account.</p>
                    <label className="modal__checkbox modal__full">
                      <input type="checkbox" name="acceptTerms" checked={school.acceptTerms} onChange={updateSchool} required />
                      I agree to the Terms of Service and Privacy Policy.
                    </label>
                    {errors.password && <p className="modal__error modal__full">{errors.password}</p>}
                    {errors.confirmPassword && <p className="modal__error modal__full">{errors.confirmPassword}</p>}
                    {errors.acceptTerms && <p className="modal__error modal__full">{errors.acceptTerms}</p>}
                  </div>
                )}
                {step === 1 && ["schoolName", "schoolType", "country", "state", "city", "address", "schoolEmail", "schoolPhone"].some((name) => errors[name]) &&
                  <p className="modal__error">Please complete all required fields and check the email address.</p>}
                {step === 2 && ["adminName", "adminEmail", "adminPhone", "adminRole"].some((name) => errors[name]) &&
                  <p className="modal__error">Please complete all required fields and check the email address.</p>}
                <div className="modal__actions">
                  {step > 1 && <Button variant="secondary" type="button" onClick={() => { setErrors({}); setStep((value) => value - 1) }}>Back</Button>}
                  <Button type="submit" className="modal__submit">{step === 3 ? "Review details" : "Continue"}</Button>
                </div>
              </form>
            ) : (
              <form className="modal__form" onSubmit={handleSchoolSubmit} aria-busy={isSubmitting}>
                <fieldset className="modal__fieldset" disabled={isSubmitting}>
                <div className="modal__review">
                  <h3>School information</h3>
                  <p><strong>School:</strong> {school.schoolName}</p>
                  <p><strong>Type:</strong> {school.schoolType}</p>
                  <p><strong>Location:</strong> {[school.city, school.state, school.country].filter(Boolean).join(", ")}</p>
                  <p><strong>Address:</strong> {school.address}</p>
                  <p><strong>School contact:</strong> {school.schoolEmail} · {school.schoolPhone}</p>
                  <h3>Administrator</h3>
                  <p><strong>Name:</strong> {school.adminName}</p>
                  <p><strong>Email:</strong> {school.adminEmail}</p>
                  <p><strong>Role:</strong> {school.adminRole}</p>
                </div>
                <p className="modal__hint">Review your details before continuing. Your school account is created securely when you register.</p>
                <div className="modal__actions">
                  <Button variant="secondary" type="button" onClick={() => { setNotice(""); setStep(3) }}>Back</Button>
                  <Button type="submit" className="modal__submit" loading={isSubmitting} loadingLabel="Registering school...">
                    Register School
                  </Button>
                </div>
                </fieldset>
              </form>
            )}
          </>
        )}

        {mode === "demo" && (
          <form className="modal__form" onSubmit={handleDemoSubmit} noValidate>
            <div className="modal__section-title">School details</div>
            <div className="modal__grid">
              <Field label="School name" name="schoolName" value={demo.schoolName} onChange={updateDemo} required placeholder="School name" />
              <SelectField label="School type" name="schoolType" value={demo.schoolType} onChange={updateDemo} options={schoolTypes} required />
              <Field label="State" name="state" value={demo.state} onChange={updateDemo} required placeholder="e.g. Abuja FCT" />
              <Field label="City or town" name="city" value={demo.city} onChange={updateDemo} required />
              <SelectField label="Number of students (optional)" name="studentCount" value={demo.studentCount} onChange={updateDemo}
                options={["Under 100", "100–300", "301–700", "701–1,500", "Over 1,500"]} placeholder="Choose a range" />
            </div>
            <div className="modal__section-title">Your contact details</div>
            <div className="modal__grid">
              <Field label="Full name" name="contactName" value={demo.contactName} onChange={updateDemo} required autoComplete="name" />
              <Field label="Work email" name="email" type="email" value={demo.email} onChange={updateDemo} required autoComplete="email" />
              <Field label="Phone number" name="phone" type="tel" value={demo.phone} onChange={updateDemo} required autoComplete="tel" placeholder="+234..." />
              <SelectField label="Your position" name="role" value={demo.role} onChange={updateDemo} options={adminRoles} required />
            </div>
            <div className="modal__section-title">Demo preferences</div>
            <div className="modal__grid">
              <SelectField label="Preferred format" name="format" value={demo.format} onChange={updateDemo} options={["Online", "In-person"]} required />
              <Field label="Additional message (optional)" name="message" value={demo.message} onChange={updateDemo} placeholder="What would you like to see?" />
            </div>
            <fieldset className="modal__interests">
              <legend>Areas of interest (optional)</legend>
              <div className="modal__interest-grid">
                {demoInterests.map((interest) => (
                  <label className="modal__checkbox" key={interest}>
                    <input type="checkbox" checked={demo.interests.includes(interest)}
                      onChange={(event) => setDemo((current) => ({ ...current, interests: event.target.checked
                        ? [...current.interests, interest] : current.interests.filter((item) => item !== interest) }))} />
                    {interest}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="modal__checkbox">
              <input type="checkbox" name="consent" checked={demo.consent} onChange={updateDemo} required />
              I agree to be contacted by AceEdu about this demo request.
            </label>
            {errors.email && <p className="modal__error">{errors.email}</p>}
            {errors.consent && <p className="modal__error">{errors.consent}</p>}
            {Object.keys(errors).some((name) => name !== "email" && name !== "consent") && <p className="modal__error">Please complete all required fields.</p>}
            <Button type="submit" className="modal__submit">Request a Demo</Button>
          </form>
        )}

        {notice && (
          <div className={`modal__notice ${noticeIsError ? "modal__notice--error" : ""}`} role={noticeIsError ? "alert" : "status"} aria-live={noticeIsError ? "assertive" : "polite"}>
            {noticeIsError
              ? <AlertCircle size={20} aria-hidden="true" />
              : <CheckCircle2 size={20} aria-hidden="true" />}
            <p>{notice}</p>
            <button type="button" className="modal__text-button" onClick={() => { setNotice(""); setNoticeIsError(false) }}>Dismiss</button>
          </div>
        )}
      </section>
    </div>
  )
}
