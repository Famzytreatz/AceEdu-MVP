import { useEffect, useState } from "react"
import {
  assignStudentsToClass,
  createAcademicYear,
  createSchoolClass,
  createSchoolSubject,
  getAcademicSetup,
  setCurrentAcademicYear,
} from "../data/api"
import { BookOpen, CalendarDays, GraduationCap, Users } from "lucide-react"
import LoadingSpinner from "../components/ui/LoadingSpinner"
import "./PremiumAcademicSetup.css"

const emptyYear = { name: "", startsOn: "", endsOn: "", termCount: "3" }

export default function PremiumAcademicSetup() {
  const [data, setData] = useState({
    academicYears: [],
    terms: [],
    classes: [],
    subjects: [],
    students: [],
    teachers: [],
  })
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [yearForm, setYearForm] = useState(emptyYear)
  const [classForm, setClassForm] = useState({
    academicYearId: "",
    name: "",
    classTeacherId: "",
  })
  const [subjectForm, setSubjectForm] = useState({
    classId: "",
    name: "",
    teacherId: "",
  })
  const [rosterClassId, setRosterClassId] = useState("")
  const [studentIds, setStudentIds] = useState([])

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const result = await getAcademicSetup()
      setData(result)
      setClassForm((current) => ({
        ...current,
        academicYearId:
          current.academicYearId ||
          result.academicYears.find((year) => year.isCurrent)?.id ||
          result.academicYears[0]?.id ||
          "",
      }))
      setSubjectForm((current) => ({
        ...current,
        classId: current.classId || result.classes[0]?.id || "",
      }))
      setRosterClassId((current) => current || result.classes[0]?.id || "")
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const roster = data.students
      .filter((student) => student.classId === rosterClassId && student.status === "Active")
      .map((student) => student.id)
    setStudentIds(roster)
  }, [rosterClassId, data.students])

  async function submit(action, successMessage) {
    setPending(true)
    setError("")
    setNotice("")
    try {
      await action()
      setNotice(successMessage)
      await refresh()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setPending(false)
    }
  }

  const selectedRoster = new Set(studentIds)

  if (loading && data.academicYears.length === 0 && data.classes.length === 0) {
    return (
      <div className="premium-academic__loading" role="status">
        <LoadingSpinner /> Loading academic setup…
      </div>
    )
  }

  return (
    <section className="premium-academic" aria-labelledby="premium-academic-title">
      <header className="premium-academic__heading">
        <div>
          <p className="admin-eyebrow">PREMIUM · ACADEMIC FOUNDATION</p>
          <h2 id="premium-academic-title">Academic setup</h2>
          <p>Configure your school year, terms, classes, subjects, and student rosters.</p>
        </div>
        <button
          type="button"
          className="admin-outline-button"
          onClick={() => void refresh()}
          disabled={loading || pending}
        >
          Refresh setup
        </button>
      </header>

      {error && <p className="premium-academic__message is-error" role="alert">{error}</p>}
      {notice && <p className="premium-academic__message" role="status">{notice}</p>}
      {loading && <p className="premium-academic__updating" role="status">Refreshing saved setup…</p>}

      <div className="premium-academic__grid">
        <form
          className="admin-panel premium-academic__panel"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(
              async () => {
                await createAcademicYear({
                  ...yearForm,
                  termCount: Number(yearForm.termCount),
                })
                setYearForm(emptyYear)
              },
              "Academic year and configured terms created.",
            )
          }}
        >
          <h3><CalendarDays size={18} /> School year and terms</h3>
          <label htmlFor="academic-year-name">Academic year name</label>
          <input
            id="academic-year-name"
            required
            maxLength={80}
            placeholder="2026–2027"
            value={yearForm.name}
            onChange={(event) => setYearForm({ ...yearForm, name: event.target.value })}
          />
          <div className="premium-academic__dates">
            <label>
              Starts
              <input
                type="date"
                required
                value={yearForm.startsOn}
                onChange={(event) => setYearForm({ ...yearForm, startsOn: event.target.value })}
              />
            </label>
            <label>
              Ends
              <input
                type="date"
                required
                value={yearForm.endsOn}
                onChange={(event) => setYearForm({ ...yearForm, endsOn: event.target.value })}
              />
            </label>
          </div>
          <label htmlFor="academic-term-count">Number of terms</label>
          <input
            id="academic-term-count"
            type="number"
            min="1"
            max="12"
            required
            value={yearForm.termCount}
            onChange={(event) => setYearForm({ ...yearForm, termCount: event.target.value })}
          />
          <p className="premium-academic__hint">Term dates are divided evenly across the school-year date range.</p>
          <button className="admin-primary-button" type="submit" disabled={pending}>
            Create school year
          </button>
        </form>

        <form
          className="admin-panel premium-academic__panel"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(async () => {
              await createSchoolClass({
                ...classForm,
                classTeacherId: classForm.classTeacherId || null,
              })
              setClassForm((current) => ({ ...current, name: "" }))
            }, "Class created.")
          }}
        >
          <h3><GraduationCap size={18} /> Classes</h3>
          <label htmlFor="class-year">Academic year</label>
          <select
            id="class-year"
            required
            value={classForm.academicYearId}
            onChange={(event) => setClassForm({ ...classForm, academicYearId: event.target.value })}
          >
            <option value="">Select a year</option>
            {data.academicYears.map((year) => (
              <option value={year.id} key={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>
            ))}
          </select>
          <label htmlFor="class-name">Class name</label>
          <input
            id="class-name"
            required
            maxLength={80}
            placeholder="JSS 1"
            value={classForm.name}
            onChange={(event) => setClassForm({ ...classForm, name: event.target.value })}
          />
          <label htmlFor="class-teacher">Class teacher <span>(optional)</span></label>
          <select
            id="class-teacher"
            value={classForm.classTeacherId}
            onChange={(event) => setClassForm({ ...classForm, classTeacherId: event.target.value })}
          >
            <option value="">Unassigned</option>
            {data.teachers.map((teacher) => (
              <option value={teacher.id} key={teacher.id}>{teacher.fullName}</option>
            ))}
          </select>
          <button className="admin-primary-button" type="submit" disabled={pending || !data.academicYears.length}>
            Create class
          </button>
        </form>

        <form
          className="admin-panel premium-academic__panel"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(async () => {
              await createSchoolSubject(subjectForm.classId, {
                name: subjectForm.name,
                teacherId: subjectForm.teacherId || null,
              })
              setSubjectForm((current) => ({ ...current, name: "" }))
            }, "Subject added to the class.")
          }}
        >
          <h3><BookOpen size={18} /> Subjects</h3>
          <label htmlFor="subject-class">Class</label>
          <select
            id="subject-class"
            required
            value={subjectForm.classId}
            onChange={(event) => setSubjectForm({ ...subjectForm, classId: event.target.value })}
          >
            <option value="">Select a class</option>
            {data.classes.map((schoolClass) => (
              <option value={schoolClass.id} key={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
          <label htmlFor="subject-name">Subject name</label>
          <input
            id="subject-name"
            required
            maxLength={100}
            placeholder="Mathematics"
            value={subjectForm.name}
            onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })}
          />
          <label htmlFor="subject-teacher">Teacher <span>(optional)</span></label>
          <select
            id="subject-teacher"
            value={subjectForm.teacherId}
            onChange={(event) => setSubjectForm({ ...subjectForm, teacherId: event.target.value })}
          >
            <option value="">Unassigned</option>
            {data.teachers.map((teacher) => (
              <option value={teacher.id} key={teacher.id}>{teacher.fullName}</option>
            ))}
          </select>
          <button className="admin-primary-button" type="submit" disabled={pending || !data.classes.length}>
            Add subject
          </button>
        </form>

        <form
          className="admin-panel premium-academic__panel premium-academic__roster"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(async () => {
              await assignStudentsToClass(rosterClassId, studentIds)
            }, "Student roster saved.")
          }}
        >
          <h3><Users size={18} /> Student rosters</h3>
          <label htmlFor="roster-class">Class</label>
          <select
            id="roster-class"
            required
            value={rosterClassId}
            onChange={(event) => setRosterClassId(event.target.value)}
          >
            <option value="">Select a class</option>
            {data.classes.map((schoolClass) => (
              <option value={schoolClass.id} key={schoolClass.id}>{schoolClass.name}</option>
            ))}
          </select>
          <div className="premium-academic__student-list">
            {data.students.length === 0 ? (
              <p>No student records are available yet.</p>
            ) : data.students.map((student) => (
              <label className="premium-academic__student" key={student.id}>
                <input
                  type="checkbox"
                  checked={selectedRoster.has(student.id)}
                  disabled={student.status !== "Active" || pending || !rosterClassId}
                  onChange={(event) => {
                    setStudentIds((current) =>
                      event.target.checked
                        ? [...current, student.id]
                        : current.filter((id) => id !== student.id),
                    )
                  }}
                />
                <span>{student.fullName}</span>
                <small>{student.status === "Active" ? student.designation || "No class" : "Pending verification"}</small>
              </label>
            ))}
          </div>
          <p className="premium-academic__hint">Saving replaces this class roster. Students moved here are removed from their previous class.</p>
          <button className="admin-primary-button" type="submit" disabled={pending || !rosterClassId}>
            Save roster ({studentIds.length})
          </button>
        </form>
      </div>

      <section className="admin-panel premium-academic__saved">
        <div className="premium-academic__saved-heading">
          <div>
            <h3>Saved academic structure</h3>
            <p>{data.academicYears.length} years · {data.classes.length} classes · {data.subjects.length} subjects</p>
          </div>
        </div>
        {data.academicYears.map((year) => (
          <article className="premium-academic__year" key={year.id}>
            <div>
              <strong>{year.name}</strong>
              <span>{year.startsOn} — {year.endsOn} · {year.termCount} terms</span>
            </div>
            {!year.isCurrent && (
              <button
                type="button"
                className="admin-outline-button"
                disabled={pending}
                onClick={() => void submit(
                  () => setCurrentAcademicYear(year.id),
                  `${year.name} is now the current academic year.`,
                )}
              >
                Set current
              </button>
            )}
            {year.isCurrent && <span className="premium-academic__current">Current year</span>}
            <div className="premium-academic__terms">
              {data.terms.filter((term) => term.academicYearId === year.id).map((term) => (
                <span key={term.id}>{term.name}: {term.startsOn} – {term.endsOn}</span>
              ))}
            </div>
          </article>
        ))}
        {data.classes.map((schoolClass) => (
          <article className="premium-academic__class" key={schoolClass.id}>
            <strong>{schoolClass.name}</strong>
            <span>{data.academicYears.find((year) => year.id === schoolClass.academicYearId)?.name}</span>
            <span>{data.subjects.filter((subject) => subject.classId === schoolClass.id).map((subject) => subject.name).join(", ") || "No subjects yet"}</span>
            <span>{data.students.filter((student) => student.classId === schoolClass.id).length} students</span>
          </article>
        ))}
        {!data.academicYears.length && !data.classes.length && (
          <p className="premium-academic__empty">No academic years or classes have been created yet.</p>
        )}
      </section>
    </section>
  )
}
