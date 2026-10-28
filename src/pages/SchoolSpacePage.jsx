import { AlertCircle, Building2, LoaderCircle, LogOut, RefreshCw } from "lucide-react"
import Button from "../components/ui/Button"
import Modal from "../components/ui/Modal"
import "./SchoolSpacePage.css"

function keepSchoolSpaceOpen() {}

export default function SchoolSpacePage({
  school,
  notFound,
  error,
  signedInElsewhere,
  onLogin,
  onLogout,
  onRetry,
}) {
  return (
    <div className="school-space">
      <div className="school-space__glow school-space__glow--one" aria-hidden="true" />
      <div className="school-space__glow school-space__glow--two" aria-hidden="true" />
      <header className="school-space__brand">
        <span className="school-space__mark"><Building2 size={22} aria-hidden="true" /></span>
        <span>AceEdu <b>School Spaces</b></span>
      </header>

      <main className="school-space__main">
        {school && (
          <section className="school-space__identity" aria-label="School identity">
            {school.logoUrl
              ? <img className="school-space__logo" src={school.logoUrl} alt={`${school.schoolName} logo`} />
              : <span className="school-space__logo school-space__logo--default"><Building2 size={30} aria-hidden="true" /></span>}
            <p className="school-space__eyebrow">SECURE SCHOOL ENTRY</p>
            <h1>{school.schoolName}</h1>
            <p className="school-space__description">
              Sign in to the existing administrator account for this school.
            </p>
          </section>
        )}

        {signedInElsewhere && (
          <section className="school-space__message" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <h2>Another school account is active</h2>
              <p>Sign out of the current school before entering {school.schoolName}.</p>
              <Button variant="secondary" onClick={onLogout}>
                <LogOut size={16} aria-hidden="true" /> Sign out
              </Button>
            </div>
          </section>
        )}

        {error && (
          <section className="school-space__message" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <h2>School space unavailable</h2>
              <p>{error}</p>
              <Button variant="secondary" onClick={onRetry}>
                <RefreshCw size={16} aria-hidden="true" /> Try again
              </Button>
            </div>
          </section>
        )}

        {notFound && (
          <section className="school-space__message" role="status">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <h2>School space not found</h2>
              <p>This address does not match a registered school.</p>
              <a href="/">Return to AceEdu</a>
            </div>
          </section>
        )}

        {!school && !notFound && !error && (
          <p className="school-space__loading" role="status">
            <LoaderCircle size={18} aria-hidden="true" /> Resolving school identity…
          </p>
        )}
      </main>

      <footer className="school-space__footer">
        <span>Identity is verified by AceEdu’s secure school account service.</span>
        <span>School access is controlled by your existing account.</span>
      </footer>

      {school && !signedInElsewhere && (
        <Modal
          mode="login"
          onClose={keepSchoolSpaceOpen}
          onLogin={onLogin}
          schoolContext={school}
          dismissible={false}
        />
      )}
    </div>
  )
}
