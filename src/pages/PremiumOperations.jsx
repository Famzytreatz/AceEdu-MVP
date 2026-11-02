import { useEffect, useMemo, useState } from "react"

import {
  createClassAssessment,
  getAcademicSetup,
  getAttendance,
  getClassAssessments,
  getClassPerformance,
  getClassStudentRecords,
  saveAssessmentResults,
  saveAttendance,
} from "../data/api"

import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Save,
  Users,
} from "lucide-react"

import LoadingSpinner from "../components/ui/LoadingSpinner"
import PremiumAcademicSetup from "./PremiumAcademicSetup"

import "./PremiumOperations.css"

const attendanceStatuses = [
  ["present", "Present"],

  ["absent", "Absent"],

  ["late", "Late"],

  ["excused", "Excused"],
]

function localDateValue() {
  const date = new Date()

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return localDate.toISOString().slice(0, 10)
}

function termsForClass(setup, classId) {
  const schoolClass = setup.classes.find((item) => item.id === classId)

  return schoolClass
    ? setup.terms.filter(
        (term) => term.academicYearId === schoolClass.academicYearId,
      )
    : []
}

function initialTerm(setup, classId, date = localDateValue()) {
  const terms = termsForClass(setup, classId)

  return (
    terms.find((term) => term.startsOn <= date && date <= term.endsOn)?.id ||
    terms[0]?.id ||
    ""
  )
}

function useAcademicSetup(refreshKey = 0) {
  const [setup, setSetup] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    setError("")

    getAcademicSetup()

      .then((result) => {
        if (active) setSetup(result)
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [refreshKey])

  return { setup, loading, error }
}

function AcademicSelectors({ setup, classId, setClassId, termId, setTermId }) {
  const terms = termsForClass(setup, classId)

  return (
    <div className="premium-operations__selectors">
      <label>
        Class
        <select
          required
          value={classId}
          onChange={(event) => {
            const nextClassId = event.target.value

            setClassId(nextClassId)

            setTermId(initialTerm(setup, nextClassId))
          }}
        >
          <option value="">Select a class</option>
          {setup.classes.map((schoolClass) => (
            <option value={schoolClass.id} key={schoolClass.id}>
              {schoolClass.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Academic term
        <select
          required
          value={termId}
          onChange={(event) => setTermId(event.target.value)}
          disabled={!terms.length}
        >
          <option value="">Select a term</option>
          {terms.map((term) => (
            <option value={term.id} key={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function LoadingState({ children = "Loading academic data…" }) {
  return (
    <div className="premium-operations__loading" role="status">
      <LoadingSpinner /> {children}
    </div>
  )
}

function ErrorMessage({ children }) {
  return children ? (
    <p className="premium-operations__message is-error" role="alert">
      {children}
    </p>
  ) : null
}

function AttendanceView() {
  const { setup, loading, error: setupError } = useAcademicSetup()

  const [classId, setClassId] = useState("")

  const [termId, setTermId] = useState("")

  const [date, setDate] = useState(localDateValue)

  const [entries, setEntries] = useState([])

  const [loadingAttendance, setLoadingAttendance] = useState(false)

  const [pending, setPending] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!setup || !setup.classes.length || classId) return

    const schoolClass =
      setup.classes.find(
        (item) =>
          setup.academicYears.find((year) => year.id === item.academicYearId)
            ?.isCurrent,
      ) || setup.classes[0]

    setClassId(schoolClass.id)

    setTermId(initialTerm(setup, schoolClass.id))
  }, [setup, classId])

  const students = useMemo(
    () =>
      setup?.students.filter(
        (student) => student.classId === classId && student.status === "Active",
      ) || [],
    [setup, classId],
  )
  const attendanceTerms = useMemo(
    () => (setup ? termsForClass(setup, classId) : []),
    [setup, classId],
  )

  useEffect(() => {
    if (!setup || !classId || !date) return undefined

    let active = true

    setLoadingAttendance(true)

    setError("")

    getAttendance(classId, date)

      .then((saved) => {
        if (!active) return

        const byStudent = new Map(
          saved.entries.map((entry) => [entry.studentId, entry]),
        )

        setEntries(
          students.map((student) => {
            const entry = byStudent.get(student.id)

            return {
              studentId: student.id,

              status: entry?.status || "",

              note: entry?.note || "",
            }
          }),
        )

        if (saved.session?.termId) setTermId(saved.session.termId)
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoadingAttendance(false)
      })

    return () => {
      active = false
    }
  }, [setup, classId, date, students])

  async function submit(event) {
    event.preventDefault()

    setPending(true)

    setError("")

    setNotice("")

    try {
      const result = await saveAttendance({ classId, termId, date, entries })

      setNotice(`Attendance saved for ${result.savedCount} students.`)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />

  if (!setup)
    return (
      <ErrorMessage>
        {setupError || "Academic setup could not be loaded."}
      </ErrorMessage>
    )

  return (
    <section
      className="premium-operations"
      aria-labelledby="premium-attendance-title"
    >
      <header className="premium-operations__heading">
        <div>
          <p className="admin-eyebrow">PREMIUM · SCHOOL OPERATIONS</p>
          <h2 id="premium-attendance-title">Attendance</h2>
          <p>Record and update daily attendance for an active class roster.</p>
        </div>
      </header>
      {setupError && <ErrorMessage>{setupError}</ErrorMessage>}
      <ErrorMessage>{error}</ErrorMessage>
      {notice && (
        <p className="premium-operations__message" role="status">
          {notice}
        </p>
      )}
      <form className="admin-panel premium-operations__panel" onSubmit={submit}>
        <div className="premium-operations__selectors premium-operations__selectors--attendance">
          <label>
            Class
            <select
              required
              value={classId}
              onChange={(event) => {
                const nextClassId = event.target.value
                setClassId(nextClassId)
                setTermId(initialTerm(setup, nextClassId, date))
              }}
            >
              <option value="">Select a class</option>
              {setup.classes.map((schoolClass) => (
                <option value={schoolClass.id} key={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Academic term
            <select
              required
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
              disabled={!attendanceTerms.length}
            >
              <option value="">Select a term</option>
              {attendanceTerms.map((term) => (
                <option value={term.id} key={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attendance date
            <input
              type="date"
              required
              value={date}
              onChange={(event) => {
                const nextDate = event.target.value

                setDate(nextDate)

                setTermId(initialTerm(setup, classId, nextDate))
              }}
            />
          </label>
        </div>
        {loadingAttendance ? (
          <LoadingState>Loading saved attendance…</LoadingState>
        ) : students.length === 0 ? (
          <p className="premium-operations__empty">
            Add and assign active students in Academic Setup before recording
            attendance.
          </p>
        ) : (
          <>
            <div className="premium-operations__table-wrap">
              <table className="premium-operations__table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Note (optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const entry = entries.find(
                      (item) => item.studentId === student.id,
                    )

                    return (
                      <tr key={student.id}>
                        <th scope="row">{student.fullName}</th>
                        <td>
                          <select
                            required
                            aria-label={`${student.fullName} attendance`}
                            value={entry?.status || ""}
                            onChange={(event) =>
                              setEntries((current) =>
                                current.map((item) =>
                                  item.studentId === student.id
                                    ? { ...item, status: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="">Choose status</option>
                            {attendanceStatuses.map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            maxLength={300}
                            aria-label={`${student.fullName} attendance note`}
                            value={entry?.note || ""}
                            onChange={(event) =>
                              setEntries((current) =>
                                current.map((item) =>
                                  item.studentId === student.id
                                    ? { ...item, note: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="admin-primary-button"
              type="submit"
              disabled={pending || !termId}
            >
              <Save size={16} />{" "}
              {pending ? "Saving attendance…" : "Save attendance"}
            </button>
          </>
        )}
      </form>
    </section>
  )
}

function formatRecordDate(value) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function AcademicRecordsView({ onOpenSettings }) {
  const [setupRefreshKey, setSetupRefreshKey] = useState(0)
  const [classSetupOpen, setClassSetupOpen] = useState(false)
  const { setup, loading, error: setupError } =
    useAcademicSetup(setupRefreshKey)
  const [yearId, setYearId] = useState("")
  const [classId, setClassId] = useState("")
  const [classRecords, setClassRecords] = useState(null)
  const [studentId, setStudentId] = useState("")
  const [studentRecords, setStudentRecords] = useState(null)
  const [loadingClass, setLoadingClass] = useState(false)
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [error, setError] = useState("")
  const [assessmentToolsOpen, setAssessmentToolsOpen] = useState(false)

  useEffect(() => {
    if (!setup || yearId) return
    setYearId(
      setup.academicYears.find((year) => year.isCurrent)?.id ||
        setup.academicYears[0]?.id ||
        "",
    )
  }, [setup, yearId])

  const selectedYear = setup?.academicYears.find((year) => year.id === yearId)
  const yearClasses =
    setup?.classes.filter((schoolClass) => schoolClass.academicYearId === yearId) ||
    []
  useEffect(() => {
    if (!classId) {
      setClassRecords(null)
      return undefined
    }

    let active = true
    setLoadingClass(true)
    setError("")
    getClassPerformance(classId)
      .then((result) => {
        if (active) setClassRecords(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoadingClass(false)
      })

    return () => {
      active = false
    }
  }, [classId, setupRefreshKey])

  useEffect(() => {
    if (!classId || !studentId) {
      setStudentRecords(null)
      return undefined
    }

    let active = true
    setLoadingStudent(true)
    setError("")
    getClassStudentRecords(classId, studentId)
      .then((result) => {
        if (active) setStudentRecords(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoadingStudent(false)
      })

    return () => {
      active = false
    }
  }, [classId, studentId, setupRefreshKey])

  function chooseYear(nextYearId) {
    setYearId(nextYearId)
    setClassId("")
    setClassRecords(null)
    setStudentId("")
    setStudentRecords(null)
  }

  function chooseClass(nextClassId) {
    setClassId(nextClassId)
    setClassRecords(null)
    setStudentId("")
    setStudentRecords(null)
    setError("")
  }

  if (loading) return <LoadingState />
  if (!setup) {
    return (
      <ErrorMessage>
        {setupError || "Academic setup could not be loaded."}
      </ErrorMessage>
    )
  }

  const rankedStudents =
    classRecords?.students.filter(
      (student) => student.rank && student.rank <= 3,
    ) || []

  return (
    <section
      className="premium-operations premium-records"
      aria-labelledby="premium-records-title"
    >
      <header className="premium-operations__heading">
        <div>
          <p className="admin-eyebrow">PREMIUM · SCHOOL OPERATIONS</p>
          <h2 id="premium-records-title">Academic records</h2>
          <p>
            Choose a school session to explore class performance, attendance,
            and each student’s history.
          </p>
        </div>
      </header>

      {setupError && <ErrorMessage>{setupError}</ErrorMessage>}
      <ErrorMessage>{error}</ErrorMessage>

      {!setup.academicYears.length ? (
        <div className="admin-panel premium-records__empty-state">
          <CalendarDays size={26} aria-hidden="true" />
          <h3>Create your first academic session</h3>
          <p>
            Academic sessions and term dates are managed in Settings. Once a
            session is created, its classes and records will appear here.
          </p>
          {onOpenSettings && (
            <button
              type="button"
              className="admin-primary-button"
              onClick={onOpenSettings}
            >
              Open Settings
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="premium-records__session">
            <div className="premium-records__session-copy">
              <span className="premium-records__session-icon">
                <CalendarDays size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>Academic session</strong>
                <span>
                  {selectedYear?.isCurrent
                    ? "Current session"
                    : "Past session records"}
                </span>
              </div>
            </div>
            <select
              aria-label="Choose academic session"
              value={yearId}
              onChange={(event) => chooseYear(event.target.value)}
            >
              {setup.academicYears.map((year) => (
                <option value={year.id} key={year.id}>
                  {year.name}
                  {year.isCurrent ? " · Current" : ""}
                </option>
              ))}
            </select>
          </div>

          {!classId ? (
            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>Classes</h3>
                  <p>
                    {selectedYear
                      ? `${selectedYear.name} · ${yearClasses.length} ${
                          yearClasses.length === 1 ? "class" : "classes"
                        }`
                      : "Select a session to browse its classes."}
                  </p>
                </div>
                <GraduationCap size={21} aria-hidden="true" />
              </div>
              {yearClasses.length ? (
                <div className="premium-records__class-grid">
                  {yearClasses.map((schoolClass) => {
                    const rosterCount = setup.classRosters.filter(
                      (entry) => entry.classId === schoolClass.id,
                    ).length
                    const subjectCount = setup.subjects.filter(
                      (subject) => subject.classId === schoolClass.id,
                    ).length
                    return (
                      <button
                        type="button"
                        className="premium-records__class-card"
                        key={schoolClass.id}
                        onClick={() => chooseClass(schoolClass.id)}
                      >
                        <span className="premium-records__class-icon">
                          <GraduationCap size={20} aria-hidden="true" />
                        </span>
                        <span className="premium-records__class-info">
                          <strong>{schoolClass.name}</strong>
                          <small>
                            <Users size={13} aria-hidden="true" />
                            {rosterCount} students
                            <span aria-hidden="true">·</span>
                            {subjectCount} subjects
                          </small>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="premium-records__empty-state is-compact">
                  <GraduationCap size={24} aria-hidden="true" />
                  <h3>No classes in this session yet</h3>
                  <p>
                    Add a class and assign its roster below to start tracking
                    records for this session.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="premium-records__section">
              <button
                type="button"
                className="premium-records__back"
                onClick={() => {
                  setClassId("")
                  setClassRecords(null)
                  setStudentId("")
                  setStudentRecords(null)
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                All classes
              </button>

              {loadingClass ? (
                <LoadingState>Loading class records…</LoadingState>
              ) : classRecords ? (
                studentId ? (
                  <div className="premium-records__student-detail">
                    <button
                      type="button"
                      className="premium-records__back"
                      onClick={() => {
                        setStudentId("")
                        setStudentRecords(null)
                      }}
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                      {classRecords.schoolClass.name} students
                    </button>
                    {loadingStudent ? (
                      <LoadingState>Loading student history…</LoadingState>
                    ) : studentRecords ? (
                      <>
                        <div className="premium-records__student-heading">
                          <span className="premium-records__student-avatar">
                            {studentRecords.student.fullName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div>
                            <p>{classRecords.academicYear.name} · {classRecords.schoolClass.name}</p>
                            <h3>{studentRecords.student.fullName}</h3>
                            <span>{studentRecords.student.designation || "Student record"}</span>
                          </div>
                        </div>
                        <div className="premium-records__metrics">
                          <article>
                            <span>Overall average</span>
                            <strong>
                              {studentRecords.student.averagePercentage === null
                                ? "—"
                                : `${studentRecords.student.averagePercentage}%`}
                            </strong>
                            <small>
                              {studentRecords.student.assessmentCount} graded
                              assessments
                            </small>
                          </article>
                          <article>
                            <span>Attendance rate</span>
                            <strong>
                              {studentRecords.student.attendance.rate === null
                                ? "—"
                                : `${studentRecords.student.attendance.rate}%`}
                            </strong>
                            <small>
                              {studentRecords.student.attendance.marked} marked
                              sessions · {studentRecords.student.attendance.excused} excused
                            </small>
                          </article>
                          <article>
                            <span>Class rank</span>
                            <strong>
                              {studentRecords.student.rank
                                ? `#${studentRecords.student.rank}`
                                : "—"}
                            </strong>
                            <small>Based on graded results</small>
                          </article>
                        </div>

                        <div className="premium-records__history-grid">
                          <section className="admin-panel premium-records__history">
                            <h4><BookOpen size={16} /> Assessment history</h4>
                            {studentRecords.student.assessmentHistory.length ? (
                              <div className="premium-records__history-list">
                                {studentRecords.student.assessmentHistory.map(
                                  (item, index) => (
                                    <article key={`${item.assessmentId}-${index}`}>
                                      <div>
                                        <strong>{item.title}</strong>
                                        <span>{item.subject} · {item.termName}</span>
                                      </div>
                                      <b>{item.score} / {item.maximumScore}</b>
                                    </article>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="premium-operations__empty">
                                No graded assessments recorded for this student
                                in this session.
                              </p>
                            )}
                          </section>
                          <section className="admin-panel premium-records__history">
                            <h4><CalendarDays size={16} /> Attendance history</h4>
                            {studentRecords.student.attendanceHistory.length ? (
                              <div className="premium-records__history-list">
                                {studentRecords.student.attendanceHistory.map(
                                  (item, index) => (
                                    <article key={`${item.date}-${index}`}>
                                      <div>
                                        <strong>{formatRecordDate(item.date)}</strong>
                                        <span>{item.termName}</span>
                                      </div>
                                      <b className={`premium-records__status is-${item.status}`}>
                                        {item.status}
                                      </b>
                                    </article>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="premium-operations__empty">
                                No attendance records recorded for this student
                                in this session.
                              </p>
                            )}
                          </section>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="premium-records__class-heading">
                      <div>
                        <p>{classRecords.academicYear.name}</p>
                        <h3>{classRecords.schoolClass.name}</h3>
                      </div>
                      <span>
                        <Users size={15} aria-hidden="true" />
                        {classRecords.metrics.studentCount} students
                      </span>
                    </div>
                    <div className="premium-records__metrics">
                      <article>
                        <span>Class average</span>
                        <strong>
                          {classRecords.metrics.classAverage === null
                            ? "—"
                            : `${classRecords.metrics.classAverage}%`}
                        </strong>
                        <small>
                          {classRecords.metrics.assessedStudentCount} students
                          with graded results
                        </small>
                      </article>
                      <article>
                        <span>Attendance rate</span>
                        <strong>
                          {classRecords.metrics.attendance.rate === null
                            ? "—"
                            : `${classRecords.metrics.attendance.rate}%`}
                        </strong>
                        <small>
                          {classRecords.metrics.attendance.marked} marked
                          sessions · {classRecords.metrics.attendance.excused} excused
                        </small>
                      </article>
                      <article>
                        <span>Assessments</span>
                        <strong>{classRecords.metrics.assessmentCount}</strong>
                        <small>Created in this session</small>
                      </article>
                    </div>
                    <p className="premium-records__method">
                      Student averages use total points earned divided by
                      possible points across graded assessments; the class
                      average is the mean of those student averages.
                      Attendance counts present and late marks as attended;
                      excused marks are excluded. Tied scores share a rank.
                    </p>

                    <section className="premium-records__top">
                      <div className="premium-records__section-heading">
                        <div>
                          <h4><Award size={17} /> Top performers</h4>
                          <p>Highest overall results in this class session</p>
                        </div>
                      </div>
                      {rankedStudents.length ? (
                        <div className="premium-records__podium">
                          {rankedStudents.map((student) => (
                            <button
                              type="button"
                              className={`premium-records__podium-card rank-${student.rank}`}
                              key={student.id}
                              onClick={() => setStudentId(student.id)}
                            >
                              <span className="premium-records__rank">
                                #{student.rank}
                              </span>
                              <strong>{student.fullName}</strong>
                              <span>{student.averagePercentage}% average</span>
                              <small>
                                {student.assessmentCount} graded assessments
                              </small>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="premium-operations__empty">
                          Top performers will appear when assessment results
                          have been recorded.
                        </p>
                      )}
                    </section>

                    <section className="premium-records__student-list">
                      <div className="premium-records__section-heading">
                        <div>
                          <h4>Student records</h4>
                          <p>Open a student to review their session history.</p>
                        </div>
                      </div>
                      {classRecords.students.length ? (
                        <div className="premium-records__table-wrap">
                          <table className="premium-records__table">
                            <thead>
                              <tr>
                                <th>Rank</th>
                                <th>Student</th>
                                <th>Average</th>
                                <th>Attendance</th>
                                <th>Assessments</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {classRecords.students.map((student) => (
                                <tr key={student.id}>
                                  <td>
                                    {student.rank ? (
                                      <span
                                        className={`premium-records__rank-badge ${
                                          student.rank <= 3 ? "is-top" : ""
                                        }`}
                                      >
                                        {student.rank <= 3 && (
                                          <Award size={13} aria-hidden="true" />
                                        )}
                                        #{student.rank}
                                      </span>
                                    ) : "—"}
                                  </td>
                                  <th scope="row">
                                    <button
                                      type="button"
                                      className="premium-records__student-link"
                                      onClick={() => setStudentId(student.id)}
                                    >
                                      {student.fullName}
                                    </button>
                                    <small>{student.designation || "Student"}</small>
                                  </th>
                                  <td>
                                    {student.averagePercentage === null
                                      ? "Not graded"
                                      : `${student.averagePercentage}%`}
                                  </td>
                                  <td>
                                    {student.attendance.rate === null
                                      ? "No marks"
                                      : `${student.attendance.rate}%`}
                                  </td>
                                  <td>{student.assessmentCount}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="premium-records__view"
                                      onClick={() => setStudentId(student.id)}
                                    >
                                      View <ChevronRight size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="premium-operations__empty">
                          This class has no saved roster or historical student
                          records yet.
                        </p>
                      )}
                    </section>
                  </>
                )
              ) : null}
            </section>
          )}

          <details
            className="premium-records__tools"
            open={classSetupOpen}
            onToggle={(event) => setClassSetupOpen(event.currentTarget.open)}
          >
            <summary>
              <Users size={17} aria-hidden="true" />
              Manage classes, subjects, and student rosters
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            {classSetupOpen && (
              <PremiumAcademicSetup
                classOnly
                academicYearId={yearId}
                onSaved={() => setSetupRefreshKey((current) => current + 1)}
              />
            )}
          </details>

          <details
            className="premium-records__tools"
            open={assessmentToolsOpen}
            onToggle={(event) =>
              setAssessmentToolsOpen(event.currentTarget.open)
            }
          >
            <summary>
              <ClipboardList size={17} aria-hidden="true" />
              Manage assessments and enter scores
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            {assessmentToolsOpen && <AssessmentEntryView />}
          </details>
        </>
      )}
    </section>
  )
}

function AssessmentEntryView() {
  const { setup, loading, error: setupError } = useAcademicSetup()

  const [classId, setClassId] = useState("")

  const [termId, setTermId] = useState("")

  const [assessments, setAssessments] = useState([])

  const [students, setStudents] = useState([])

  const [assessmentId, setAssessmentId] = useState("")

  const [scores, setScores] = useState({})

  const [form, setForm] = useState({
    subjectId: "",

    title: "",

    type: "assignment",

    maximumScore: "100",

    dueOn: "",
  })

  const [loadingRecords, setLoadingRecords] = useState(false)

  const [pending, setPending] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!setup || !setup.classes.length || classId) return

    const schoolClass =
      setup.classes.find(
        (item) =>
          setup.academicYears.find((year) => year.id === item.academicYearId)
            ?.isCurrent,
      ) || setup.classes[0]

    setClassId(schoolClass.id)

    setTermId(initialTerm(setup, schoolClass.id))

    setForm((current) => ({
      ...current,

      subjectId:
        setup.subjects.find((subject) => subject.classId === schoolClass.id)
          ?.id || "",
    }))
  }, [setup, classId])

  const subjects = useMemo(
    () =>
      setup?.subjects.filter((subject) => subject.classId === classId) || [],

    [setup, classId],
  )

  const availableTerms = useMemo(
    () => (setup ? termsForClass(setup, classId) : []),
    [setup, classId],
  )

  const selectedAssessment = assessments.find(
    (assessment) => assessment.id === assessmentId,
  )

  useEffect(() => {
    if (!setup || !classId || !termId) {
      setAssessments([])

      setStudents([])

      setAssessmentId("")

      return undefined
    }

    let active = true

    setLoadingRecords(true)

    setError("")

    getClassAssessments(classId, termId)

      .then((result) => {
        if (!active) return

        setAssessments(result.assessments)

        setStudents(result.students)

        setAssessmentId((current) =>
          result.assessments.some((assessment) => assessment.id === current)
            ? current
            : result.assessments[0]?.id || "",
        )
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoadingRecords(false)
      })

    return () => {
      active = false
    }
  }, [setup, classId, termId])

  useEffect(() => {
    if (!selectedAssessment) {
      setScores({})

      return
    }

    const saved = new Map(
      selectedAssessment.results.map((result) => [result.studentId, result]),
    )

    setScores(
      Object.fromEntries(
        students.map((student) => {
          const result = saved.get(student.id)

          return [
            student.id,
            {
              score: result ? String(result.score) : "",

              feedback: result?.feedback || "",
            },
          ]
        }),
      ),
    )
  }, [selectedAssessment, students])

  async function createAssessment(event) {
    event.preventDefault()

    setPending(true)

    setError("")

    setNotice("")

    try {
      const result = await createClassAssessment({
        ...form,

        classId,

        termId,

        maximumScore: Number(form.maximumScore),

        dueOn: form.dueOn || null,
      })

      setAssessments((current) => [result.assessment, ...current])

      setAssessmentId(result.assessment.id)

      setNotice("Assessment created.")

      setForm((current) => ({ ...current, title: "", dueOn: "" }))
    } catch (createError) {
      setError(createError.message)
    } finally {
      setPending(false)
    }
  }

  async function submitResults(event) {
    event.preventDefault()

    if (!selectedAssessment) return

    setPending(true)

    setError("")

    setNotice("")

    try {
      const results = Object.entries(scores)

        .filter(([, value]) => value.score !== "")

        .map(([studentId, value]) => ({
          studentId,

          score: Number(value.score),

          feedback: value.feedback,
        }))

      const saved = await saveAssessmentResults(selectedAssessment.id, results)

      setNotice(
        `Saved ${saved.savedCount} student result${
          saved.savedCount === 1 ? "" : "s"
        }.`,
      )

      const refreshed = await getClassAssessments(classId, termId)

      setAssessments(refreshed.assessments)

      setStudents(refreshed.students)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />

  if (!setup)
    return (
      <ErrorMessage>
        {setupError || "Academic setup could not be loaded."}
      </ErrorMessage>
    )

  return (
    <section
      className="premium-operations"
      aria-labelledby="premium-records-title"
    >
      <header className="premium-operations__heading">
        <div>
          <p className="admin-eyebrow">PREMIUM · SCHOOL OPERATIONS</p>
          <h2 id="premium-records-title">Assessment entry</h2>
          <p>Create class assessments and save student scores with feedback.</p>
        </div>
      </header>
      {setupError && <ErrorMessage>{setupError}</ErrorMessage>}
      <ErrorMessage>{error}</ErrorMessage>
      {notice && (
        <p className="premium-operations__message" role="status">
          {notice}
        </p>
      )}
      <AcademicSelectors
        setup={setup}
        classId={classId}
        setClassId={(nextClassId) => {
          setClassId(nextClassId)

          setTermId(initialTerm(setup, nextClassId))

          setForm((current) => ({
            ...current,

            subjectId:
              setup.subjects.find((subject) => subject.classId === nextClassId)
                ?.id || "",
          }))
        }}
        termId={termId}
        setTermId={setTermId}
      />
      <form
        className="admin-panel premium-operations__panel"
        onSubmit={createAssessment}
      >
        <h3>
          <BookOpen size={18} /> Create an assessment
        </h3>
        <div className="premium-operations__form-grid">
          <label>
            Subject
            <select
              required
              value={form.subjectId}
              onChange={(event) =>
                setForm({ ...form, subjectId: event.target.value })
              }
              disabled={!subjects.length}
            >
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option value={subject.id} key={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assessment title
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="Mid-term mathematics test"
            />
          </label>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value })
              }
            >
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz</option>
              <option value="test">Test</option>
              <option value="examination">Examination</option>
            </select>
          </label>
          <label>
            Maximum score
            <input
              required
              type="number"
              min="0.01"
              max="99999.99"
              step="0.01"
              value={form.maximumScore}
              onChange={(event) =>
                setForm({ ...form, maximumScore: event.target.value })
              }
            />
          </label>
          <label>
            Due date (optional)
            <input
              type="date"
              value={form.dueOn}
              onChange={(event) =>
                setForm({ ...form, dueOn: event.target.value })
              }
              min={availableTerms.find((term) => term.id === termId)?.startsOn}
              max={availableTerms.find((term) => term.id === termId)?.endsOn}
            />
          </label>
        </div>
        <button
          className="admin-primary-button"
          type="submit"
          disabled={pending || !classId || !termId || !form.subjectId}
        >
          <ClipboardList size={16} />{" "}
          {pending ? "Creating…" : "Create assessment"}
        </button>
      </form>

      <section className="admin-panel premium-operations__panel">
        <h3>
          <ClipboardList size={18} /> Assessments and results
        </h3>
        {loadingRecords ? (
          <LoadingState>Loading assessments…</LoadingState>
        ) : assessments.length === 0 ? (
          <p className="premium-operations__empty">
            No assessments for this class and term yet.
          </p>
        ) : (
          <label>
            Assessment
            <select
              value={assessmentId}
              onChange={(event) => setAssessmentId(event.target.value)}
            >
              {assessments.map((assessment) => (
                <option value={assessment.id} key={assessment.id}>
                  {assessment.title} · {assessment.subjectName} · max{" "}
                  {assessment.maximumScore}
                </option>
              ))}
            </select>
          </label>
        )}
        {selectedAssessment && (
          <form onSubmit={submitResults}>
            {students.length === 0 ? (
              <p className="premium-operations__empty">
                Assign active students to this class in Academic Setup before
                entering results.
              </p>
            ) : (
              <>
                <div className="premium-operations__table-wrap">
                  <table className="premium-operations__table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Score / {selectedAssessment.maximumScore}</th>
                        <th>Feedback (optional)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <th scope="row">{student.fullName}</th>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={selectedAssessment.maximumScore}
                              step="0.01"
                              aria-label={`${student.fullName} score`}
                              value={scores[student.id]?.score || ""}
                              onChange={(event) =>
                                setScores((current) => ({
                                  ...current,

                                  [student.id]: {
                                    ...current[student.id],
                                    score: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              maxLength={1000}
                              aria-label={`${student.fullName} feedback`}
                              value={scores[student.id]?.feedback || ""}
                              onChange={(event) =>
                                setScores((current) => ({
                                  ...current,

                                  [student.id]: {
                                    ...current[student.id],
                                    feedback: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="premium-operations__hint">
                  Leave a score blank to keep that student ungraded. Saving
                  updates entered scores without deleting other saved results.
                </p>
                <button
                  className="admin-primary-button"
                  type="submit"
                  disabled={pending}
                >
                  <Save size={16} />{" "}
                  {pending ? "Saving results…" : "Save results"}
                </button>
              </>
            )}
          </form>
        )}
      </section>
    </section>
  )
}

export default function PremiumOperations({ mode, onOpenSettings }) {
  return mode === "attendance" ? (
    <AttendanceView />
  ) : (
    <AcademicRecordsView onOpenSettings={onOpenSettings} />
  )
}
