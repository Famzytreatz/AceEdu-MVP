import { useEffect, useState } from "react"

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  GraduationCap,
  Info,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import {
  createAcademicYear,
  getAcademicSetup,
  setCurrentAcademicYear,
  updateSchoolType,
} from "../data/api"

import "./SchoolSettings.css"

const schoolTypes = ["Primary", "Secondary", "Combined", "Other"]

const emptyCalendarForm = {
  name: "",
  startsOn: "",
  endsOn: "",
  termCount: "3",
}

function formatCalendarDate(value) {
  if (!value) return "Date not set"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

function getNextCalendarDate(value) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export default function SchoolSettings({
  school,
  onSchoolUpdated,
  onCurriculumUpdated,
  premiumAccessActive,
  premiumLoading,
}) {
  const [schoolType, setSchoolType] = useState(school.schoolType)

  const [pending, setPending] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const [calendar, setCalendar] = useState({ academicYears: [], terms: [] })

  const [calendarLoading, setCalendarLoading] = useState(false)

  const [calendarPending, setCalendarPending] = useState(false)

  const [calendarError, setCalendarError] = useState("")

  const [calendarNotice, setCalendarNotice] = useState("")

  const [showCalendarForm, setShowCalendarForm] = useState(false)

  const [calendarForm, setCalendarForm] = useState(emptyCalendarForm)

  async function refreshCalendar() {
    setCalendarLoading(true)
    setCalendarError("")
    try {
      const result = await getAcademicSetup()
      setCalendar({
        academicYears: result.academicYears,
        terms: result.terms,
      })
      return true
    } catch (loadError) {
      setCalendarError(loadError.message)
      return false
    } finally {
      setCalendarLoading(false)
    }
  }

  useEffect(() => {
    setSchoolType(school.schoolType)
  }, [school.schoolType])

  useEffect(() => {
    if (premiumAccessActive && !premiumLoading) void refreshCalendar()
  }, [premiumAccessActive, premiumLoading])

  async function saveSchoolType(event) {
    event.preventDefault()

    if (pending || schoolType === school.schoolType) return

    setPending(true)

    setError("")

    setNotice("")

    try {
      const result = await updateSchoolType(schoolType)

      onSchoolUpdated?.({ ...school, schoolType: result.schoolType })

      onCurriculumUpdated(result.classLevels)

      setNotice(
        "School type saved. Existing student records and classes were kept.",
      )
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setPending(false)
    }
  }

  async function saveCalendar(event) {
    event.preventDefault()
    if (calendarPending) return
    setCalendarPending(true)
    setCalendarError("")
    setCalendarNotice("")
    try {
      await createAcademicYear({
        ...calendarForm,
        termCount: Number(calendarForm.termCount),
      })
      setCalendarForm(emptyCalendarForm)
      setShowCalendarForm(false)
      if (await refreshCalendar()) {
        setCalendarNotice("Academic year and term dates saved.")
      }
    } catch (saveError) {
      setCalendarError(saveError.message)
    } finally {
      setCalendarPending(false)
    }
  }

  async function makeCurrentYear(year) {
    if (calendarPending || year.isCurrent) return
    setCalendarPending(true)
    setCalendarError("")
    setCalendarNotice("")
    try {
      await setCurrentAcademicYear(year.id)
      if (await refreshCalendar()) {
        setCalendarNotice(`${year.name} is now the current academic year.`)
      }
    } catch (saveError) {
      setCalendarError(saveError.message)
    } finally {
      setCalendarPending(false)
    }
  }

  return (
    <section
      className="school-settings-page"
      aria-labelledby="school-settings-title"
    >
      {error && (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="school-settings__notice" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </p>
      )}
      <section
        className="school-settings__hero"
        aria-label="School configuration"
      >
        <span className="school-settings__hero-orbit school-settings__hero-orbit--one" />
        <span className="school-settings__hero-orbit school-settings__hero-orbit--two" />
        <div className="school-settings__hero-copy">
          <span className="school-settings__hero-icon">
            <School size={23} aria-hidden="true" />
          </span>
          <div>
            <p className="school-settings__eyebrow">WORKSPACE PREFERENCES</p>
            <h2 id="school-settings-title">Make this workspace yours</h2>
            <p>
              Set the school structure that shapes your classes and curriculum.
            </p>
          </div>
        </div>
        <div className="school-settings__hero-school">
          <span className="school-settings__hero-school-icon">
            <GraduationCap size={18} aria-hidden="true" />
          </span>
          <span>
            <small>{school.schoolName}</small>
            <strong>{school.schoolType} school</strong>
          </span>
          <Sparkles size={16} aria-hidden="true" />
        </div>
      </section>

      <div className="school-settings__layout">
        <section
          className="school-settings__card school-settings__configuration"
          aria-labelledby="school-type-title"
        >
          <div className="school-settings__card-heading">
            <span className="school-settings__card-icon">
              <GraduationCap size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="school-settings__eyebrow">SCHOOL PROFILE</p>
              <h3 id="school-type-title">Education structure</h3>
              <p>Choose the type that best describes your school.</p>
            </div>
          </div>

          <form className="school-settings__form" onSubmit={saveSchoolType}>
            <label htmlFor="school-type-setting">School type</label>
            <select
              id="school-type-setting"
              value={schoolType}
              onChange={(event) => {
                setSchoolType(event.target.value)

                setNotice("")

                setError("")
              }}
              disabled={pending}
            >
              {schoolTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
            <p className="school-settings__field-hint">
              Primary includes Kindergarten through Primary 5, with Primary 6
              available as an optional class. Secondary includes JSS 1 through
              SSS 3. Combined includes both structures.
            </p>
            <div className="school-settings__form-footer">
              <span>
                <ShieldCheck size={15} aria-hidden="true" />
                Your existing school records are safe
              </span>
              <button
                className="admin-primary-button school-settings__save"
                type="submit"
                disabled={pending || schoolType === school.schoolType}
              >
                {pending ? "Saving…" : "Save changes"}
                {!pending && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </section>

        <aside
          className="school-settings__card school-settings__guidance"
          aria-labelledby="school-settings-guide"
        >
          <div className="school-settings__guidance-title">
            <span className="school-settings__info-icon">
              <Info size={17} aria-hidden="true" />
            </span>
            <h3 id="school-settings-guide">What this setting changes</h3>
          </div>
          <p>
            Your selection keeps your workspace aligned with the way your school
            is organized.
          </p>
          <ul>
            <li>
              <span>
                <Check size={13} aria-hidden="true" />
              </span>
              Class levels and curriculum setup
            </li>
            <li>
              <span>
                <Check size={13} aria-hidden="true" />
              </span>
              Student records and approvals stay intact
            </li>
            <li>
              <span>
                <Check size={13} aria-hidden="true" />
              </span>
              Existing classes and subjects are preserved
            </li>
          </ul>
          <div className="school-settings__tip">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Only your school workspace is affected by this change.</span>
          </div>
        </aside>
      </div>

      <section
        className="school-settings__card school-settings__calendar"
        aria-labelledby="school-calendar-title"
      >
        <div className="school-settings__calendar-heading">
          <div className="school-settings__card-heading">
            <span className="school-settings__card-icon is-calendar">
              <CalendarDays size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="school-settings__eyebrow">OPTIONAL SETUP</p>
              <h3 id="school-calendar-title">Academic year calendar</h3>
              <p>
                Set your school-year dates and let AceEdu arrange the terms.
              </p>
            </div>
          </div>
          {premiumAccessActive && !premiumLoading && (
            <button
              type="button"
              className="admin-outline-button school-settings__calendar-toggle"
              onClick={() => {
                setShowCalendarForm((current) => !current)
                setCalendarError("")
                setCalendarNotice("")
              }}
              aria-expanded={showCalendarForm}
              aria-controls="school-calendar-form"
              disabled={calendarLoading || calendarPending}
            >
              {showCalendarForm
                ? "Close"
                : calendar.academicYears.length
                  ? "Add school year"
                  : "Set up calendar"}
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={showCalendarForm ? "is-open" : ""}
              />
            </button>
          )}
        </div>

        {premiumLoading ? (
          <p className="school-settings__calendar-state" role="status">
            Checking calendar availability…
          </p>
        ) : !premiumAccessActive ? (
          <div className="school-settings__calendar-locked">
            <span>
              <LockKeyhole size={17} aria-hidden="true" />
            </span>
            <p>
              Academic calendar setup is part of Premium. Your school can still
              use the standard classes and subjects setup.
            </p>
          </div>
        ) : (
          <>
            {calendarError && (
              <p className="admin-alert admin-alert--error" role="alert">
                {calendarError}
              </p>
            )}
            {calendarNotice && (
              <p className="school-settings__notice" role="status">
                <Check size={17} aria-hidden="true" />
                {calendarNotice}
              </p>
            )}
            {calendarLoading ? (
              <p className="school-settings__calendar-state" role="status">
                Loading your school calendar…
              </p>
            ) : calendar.academicYears.length ? (
              <div className="school-settings__years">
                {calendar.academicYears.map((year) => {
                  const yearTerms = calendar.terms
                    .filter((term) => term.academicYearId === year.id)
                    .sort(
                      (first, second) => first.termNumber - second.termNumber,
                    )
                  return (
                    <article
                      className={`school-settings__year ${
                        year.isCurrent ? "is-current" : ""
                      }`}
                      key={year.id}
                    >
                      <div className="school-settings__year-heading">
                        <div>
                          <span className="school-settings__year-label">
                            {year.isCurrent
                              ? "CURRENT SCHOOL YEAR"
                              : "SCHOOL YEAR"}
                          </span>
                          <h4>{year.name}</h4>
                          <p>
                            {formatCalendarDate(year.startsOn)} –{" "}
                            {formatCalendarDate(year.endsOn)}
                          </p>
                        </div>
                        {year.isCurrent ? (
                          <span className="school-settings__current-badge">
                            <Check size={13} aria-hidden="true" />
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="admin-outline-button school-settings__make-current"
                            onClick={() => void makeCurrentYear(year)}
                            disabled={calendarPending}
                          >
                            Make current
                          </button>
                        )}
                      </div>
                      <div
                        className="school-settings__terms"
                        aria-label={`${year.name} terms`}
                      >
                        {yearTerms.map((term) => (
                          <div className="school-settings__term" key={term.id}>
                            <span>TERM {term.termNumber}</span>
                            <strong>{term.name}</strong>
                            <small>
                              {formatCalendarDate(term.startsOn)} –{" "}
                              {formatCalendarDate(term.endsOn)}
                            </small>
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : calendarError ? null : (
              <p className="school-settings__calendar-empty">
                No academic calendar yet. Add a school year to get started.
              </p>
            )}

            {showCalendarForm && (
              <form
                className="school-settings__calendar-form"
                id="school-calendar-form"
                onSubmit={saveCalendar}
              >
                <div className="school-settings__calendar-form-heading">
                  <div>
                    <h4>New academic year</h4>
                    <p>
                      Terms are created automatically from the dates you choose.
                    </p>
                  </div>
                </div>
                <label>
                  Academic year name
                  <input
                    required
                    maxLength={80}
                    placeholder="2026–2027"
                    value={calendarForm.name}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={calendarPending}
                  />
                </label>
                <label>
                  Starts
                  <input
                    type="date"
                    required
                    value={calendarForm.startsOn}
                    onChange={(event) => {
                      const startsOn = event.target.value
                      setCalendarForm((current) => ({
                        ...current,
                        startsOn,
                        endsOn:
                          current.endsOn && current.endsOn <= startsOn
                            ? ""
                            : current.endsOn,
                      }))
                    }}
                    disabled={calendarPending}
                  />
                </label>
                <label>
                  Ends
                  <input
                    type="date"
                    required
                    min={getNextCalendarDate(calendarForm.startsOn)}
                    value={calendarForm.endsOn}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        endsOn: event.target.value,
                      }))
                    }
                    disabled={calendarPending}
                  />
                </label>
                <label>
                  Number of terms
                  <select
                    value={calendarForm.termCount}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        termCount: event.target.value,
                      }))
                    }
                    disabled={calendarPending}
                  >
                    <option value="2">2 terms</option>
                    <option value="3">3 terms</option>
                    <option value="4">4 terms</option>
                  </select>
                </label>
                <p className="school-settings__calendar-hint">
                  Term dates are divided evenly across the school-year dates.
                  You can change the current year at any time.
                </p>
                <button
                  className="admin-primary-button"
                  type="submit"
                  disabled={calendarPending}
                >
                  {calendarPending ? "Saving calendar…" : "Save academic year"}
                  {!calendarPending && (
                    <ArrowRight size={16} aria-hidden="true" />
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </section>
  )
}
