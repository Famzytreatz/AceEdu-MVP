
import { useEffect, useId, useState } from "react"
import { CheckCircle2, X } from "lucide-react"
import Button from "./Button"
import "./Modal.css"

// Copy is selected by modal mode so the same form component can serve different actions.
const modalCopy = {
  started: {
    title: "Get started with AceEdu",
    body: "Tell us about your school. This demo form is ready to connect to your future onboarding service.",
    submit: "Request access",
  },
  demo: {
    title: "Book an AceEdu demo",
    body: "Choose a convenient contact method and our team can follow up when backend services are connected.",
    submit: "Request a demo",
  },
  login: {
    title: "Welcome back",
    body: "Authentication is not connected yet. This form demonstrates the intended sign-in experience.",
    submit: "Continue",
  },
}

// Modal receives its mode and close callback from HomePage.
export default function Modal({ mode, onClose }) {
  // Local UI state switches the form to a confirmation message after submission.
  const [submitted, setSubmitted] = useState(false)
  // useId creates a unique id used to connect the dialog to its accessible title.
  const titleId = useId()
  const content = modalCopy[mode]

  // While open, Escape closes the modal and the body class prevents background scrolling.
  useEffect(() => {
    if (!mode) return undefined
    const onKeyDown = (event) => event.key === "Escape" && onClose()
    document.addEventListener("keydown", onKeyDown)
    document.body.classList.add("modal-open")
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.classList.remove("modal-open")
    }
  }, [mode, onClose])

  // No mode means there is no active dialog, so render nothing.
  if (!mode) return null

  // Prevent a real page reload; this demo currently shows local success rather than sending data to a server.
  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal__close"
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={22} aria-hidden="true" />
        </button>
        {/* After submit, show confirmation; otherwise show the form for the selected modal mode. */}
      {submitted ? (
          <div className="modal__success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <h2 id={titleId}>Thanks for your interest</h2>
            <p>
              This request is stored only in the current screen. Connect an API
              to submit it to AceEdu.
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <h2 id={titleId}>{content.title}</h2>
            <p>{content.body}</p>
            <form className="modal__form" onSubmit={handleSubmit}>
              {mode !== "login" && (
                <label>
                  School name
                  <input
                    name="school"
                    type="text"
                    autoFocus
                    required
                    placeholder="Your school"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoFocus={mode === "login"}
                  required
                  placeholder="you@school.com"
                />
              </label>
              {mode === "login" && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength="6"
                  />
                </label>
              )}
              <Button type="submit">{content.submit}</Button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

