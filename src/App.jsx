
import { lazy, Suspense, useEffect, useState } from "react"
import HomePage from "./pages/HomePage"
import { getCurrentSchool, loginSchool, logoutSchool, registerSchool } from "./data/api"
import PageLoader from "./components/ui/PageLoader"
import PlatformConsole from "./pages/PlatformConsole"

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"))

function readSavedTheme() {
  try {
    return window.localStorage.getItem("aceedu-admin-theme") === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export default function App() {
  const platformRoute = window.location.pathname.replace(/\/+$/, "") === "/platform"
  const [school, setSchool] = useState(null)
  const [checkingSession, setCheckingSession] = useState(!platformRoute)
  const [backendError, setBackendError] = useState("")
  const [theme] = useState(readSavedTheme)

  useEffect(() => {
    if (platformRoute) return undefined
    let active = true
    let retryTimer
    let retryAttempt = 0
    const retryDelays = [500, 1000, 2000, 4000, 8000]

    async function checkSession() {
      let retryScheduled = false
      try {
        const currentSchool = await getCurrentSchool()
        if (active) {
          setSchool(currentSchool)
          setBackendError("")
        }
      } catch (error) {
        if (active) {
          const message = error.message || ""
          const unavailable = /failed to fetch|fetch failed|HTTP 5\d\d/i.test(message)
          if (unavailable && retryAttempt < retryDelays.length) {
            retryScheduled = true
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
        if (active && !retryScheduled) setCheckingSession(false)
      }
    }

    void checkSession()
    return () => {
      active = false
      window.clearTimeout(retryTimer)
    }
  }, [platformRoute])

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

  const application = platformRoute ? (
    <PlatformConsole />
  ) : checkingSession ? null : school ? (
      <Suspense
        fallback={<PageLoader message="Loading your school workspace…" theme={theme} />}
      >
        <AdminDashboard school={school} onLogout={handleLogout} />
      </Suspense>
  ) : (
    <HomePage
      onRegister={handleRegister}
      onLogin={handleLogin}
      backendError={backendError}
    />
  )

  return (
    <>
      {application}
      <PageLoader
        message={backendError || "Checking your AceEdu account…"}
        theme={theme}
        visible={checkingSession}
      />
    </>
  )
}
