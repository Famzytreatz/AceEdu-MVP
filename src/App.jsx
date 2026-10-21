
import { useEffect, useState } from "react"
import AdminDashboard from "./pages/AdminDashboard"
import HomePage from "./pages/HomePage"
import { getCurrentSchool, loginSchool, logoutSchool, registerSchool } from "./data/api"

export default function App() {
  const [school, setSchool] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [backendError, setBackendError] = useState("")

  useEffect(() => {
    let active = true
    let retryTimer
    let retryAttempt = 0
    const retryDelays = [500, 1000, 2000, 4000, 8000]

    async function checkSession() {
      try {
        const currentSchool = await getCurrentSchool()
        if (active) {
          setSchool(currentSchool)
          setBackendError("")
        }
      } catch (error) {
        if (active) {
          const message = error.message || ""
          const unavailable = /failed to fetch|fetch failed|HTTP 502|HTTP 503|HTTP 504/i.test(message)
          if (unavailable && retryAttempt < retryDelays.length) {
            setBackendError("Account services are starting. Reconnecting automatically…")
            retryTimer = window.setTimeout(() => {
              retryAttempt += 1
              void checkSession()
            }, retryDelays[retryAttempt])
          } else {
            setBackendError(
              unavailable
                ? "Account services could not be reached. Check the Supabase configuration and make sure the AceEdu API is running."
                : message,
            )
          }
        }
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    void checkSession()
    return () => {
      active = false
      window.clearTimeout(retryTimer)
    }
  }, [])

  async function handleRegister(values) {
    const createdSchool = await registerSchool(values)
    setBackendError("")
    setSchool(createdSchool)
  }

  async function handleLogin(values) {
    const signedInSchool = await loginSchool(values)
    setBackendError("")
    setSchool(signedInSchool)
  }

  async function handleLogout() {
    await logoutSchool()
    setSchool(null)
  }

  if (checkingSession) {
    return (
      <main className="app-loading" aria-live="polite">
        <span className="app-loading__spinner" aria-hidden="true" />
        <p>Checking your AceEdu account…</p>
      </main>
    )
  }

  if (school) return <AdminDashboard school={school} onLogout={handleLogout} />
  return (
    <HomePage
      onRegister={handleRegister}
      onLogin={handleLogin}
      backendError={backendError}
    />
  )
}
