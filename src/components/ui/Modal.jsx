import { useEffect, useId, useState } from "react"
import { CheckCircle2, X } from "lucide-react"
import Button from "./Button"
import "./Modal.css"

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

export default function Modal({ mode, onClose }) {
  const [submitted, setSubmitted] = useState(false)
  const titleId = useId()
  const content = modalCopy[mode]

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

  if (!mode) return null

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
