import { useEffect, useMemo, useState } from "react"

import {
  createClassAssessment,
  getAcademicSetup,
  getAttendance,
  getClassAssessments,
  saveAssessmentResults,
  saveAttendance,
} from "../data/api"

import { BookOpen, ClipboardList, Save } from "lucide-react"

import LoadingSpinner from "../components/ui/LoadingSpinner"

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

function useAcademicSetup() {
  const [setup, setSetup] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

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
  }, [])

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

function AcademicRecordsView() {
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
          <h2 id="premium-records-title">Academic records</h2>
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

export default function PremiumOperations({ mode }) {
  return mode === "attendance" ? <AttendanceView /> : <AcademicRecordsView />
}
