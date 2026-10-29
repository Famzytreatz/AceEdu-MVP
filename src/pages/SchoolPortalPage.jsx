import { useEffect, useMemo, useRef, useState } from "react"

import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Link2,
  LoaderCircle,
  LogOut,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react"

import {
  createTeacherClassroomPost,
  createTeacherPortalExam,
  deleteTeacherClassroomPost,
  getPortalMember,
  getStudentClassroom,
  getStudentPortalDashboard,
  getStudentPortalExams,
  saveStudentPortalExamDraft,
  getTeacherClassroom,
  getTeacherAttendance,
  getTeacherPortalExamResults,
  getTeacherPortalExams,
  getTeacherPortalDashboard,
  loginPortal,
  logoutPortal,
  saveTeacherAttendance,
  startStudentPortalExam,
  submitStudentPortalExam,
} from "../data/api"

import Button from "../components/ui/Button"

import "./SchoolPortalPage.css"

function localDateValue() {
  const date = new Date()

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)

    .toISOString()

    .slice(0, 10)
}

function Loading({ children }) {
  return (
    <p className="school-portal__loading" role="status">
      <LoaderCircle size={18} aria-hidden="true" /> {children}
    </p>
  )
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1])
    reader.onerror = () =>
      reject(new Error("The selected attachment could not be read."))
    reader.readAsDataURL(file)
  })
}

function IdentityCard({ member, schoolClass, schoolName }) {
  return (
    <section className="school-portal__identity-card">
      <div className="school-portal__identity-card-brand">
        <span>{schoolName}</span>
        <strong>OFFICIAL SCHOOL ID</strong>
      </div>
      {member.passport ? (
        <img src={member.passport} alt="" />
      ) : (
        <span className="school-portal__identity-card-avatar">
          {member.fullName
            ?.split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </span>
      )}
      <div>
        <small>
          {member.role === "teacher" ? "FACULTY MEMBER" : "STUDENT"}
        </small>
        <h2>{member.fullName}</h2>
        <p>{member.designation || schoolClass?.name || "School member"}</p>
        {schoolClass?.name && <span>{schoolClass.name}</span>}
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        aria-label="Print school identity card"
      >
        Print ID
      </button>
    </section>
  )
}

function StudentPortalTools() {
  const [classroom, setClassroom] = useState(null)
  const [exams, setExams] = useState([])
  const [activeExam, setActiveExam] = useState(null)
  const activeExamRef = useRef(null)
  const [answers, setAnswers] = useState({})
  const answersRef = useRef(answers)
  const [examResult, setExamResult] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const finishing = useRef(false)

  function updateActiveExam(exam) {
    activeExamRef.current = exam
    setActiveExam(exam)
  }

  async function load() {
    setLoading(true)
    setError("")
    const [classroomResult, examsResult] = await Promise.allSettled([
      getStudentClassroom(),
      getStudentPortalExams(),
    ])
    if (classroomResult.status === "fulfilled")
      setClassroom(classroomResult.value)
    if (examsResult.status === "fulfilled") {
      setExams(examsResult.value.exams)
      const active = examsResult.value.exams.find(
        (exam) => exam.activeAttemptId,
      )
      if (active && !activeExamRef.current) {
        try {
          const attempt = await startStudentPortalExam(active.id)
          const restoredAnswers = Object.fromEntries(
            (attempt.answers || []).map((answer) => [
              answer.questionIndex,
              answer.selectedOptionIndex,
            ]),
          )
          setAnswers(restoredAnswers)
          answersRef.current = restoredAnswers
          updateActiveExam({
            ...attempt.exam,
            attemptId: attempt.attemptId,
            startedAt: attempt.startedAt,
          })
        } catch (resumeError) {
          setError(resumeError.message)
        }
      }
    }
    const failures = [classroomResult, examsResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason.message)
    if (failures.length) setError(failures.join(" "))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!activeExam) return undefined
    const tick = () => {
      const end =
        new Date(activeExam.startedAt).getTime() +
        activeExam.durationMinutes * 60_000
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemainingSeconds(next)
      if (!next) finishExam("timed_out")
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [activeExam])

  useEffect(() => {
    if (!activeExam || !Object.keys(answers).length) return undefined
    let active = true
    const timer = window.setTimeout(() => {
      saveStudentPortalExamDraft(activeExam.id, {
        attemptId: activeExam.attemptId,
        answers: Object.entries(answers).map(
          ([questionIndex, selectedOptionIndex]) => ({
            questionIndex: Number(questionIndex),
            selectedOptionIndex,
          }),
        ),
      }).catch((saveError) => {
        if (active) setError(saveError.message)
      })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeExam, answers])

  async function beginExam(examId) {
    setBusy(true)
    setError("")
    setExamResult(null)
    try {
      const attempt = await startStudentPortalExam(examId)
      const restoredAnswers = Object.fromEntries(
        (attempt.answers || []).map((answer) => [
          answer.questionIndex,
          answer.selectedOptionIndex,
        ]),
      )
      setAnswers(restoredAnswers)
      answersRef.current = restoredAnswers
      updateActiveExam({
        ...attempt.exam,
        attemptId: attempt.attemptId,
        startedAt: attempt.startedAt,
      })
    } catch (startError) {
      setError(startError.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function finishExam(submissionType = "manual") {
    if (!activeExam || finishing.current) return
    finishing.current = true
    setBusy(true)
    setError("")
    try {
      const result = await submitStudentPortalExam(activeExam.id, {
        attemptId: activeExam.attemptId,
        submissionType,
        answers: Object.entries(answersRef.current).map(
          ([questionIndex, selectedOptionIndex]) => ({
            questionIndex: Number(questionIndex),
            selectedOptionIndex,
          }),
        ),
      })
      setExamResult(result)
      updateActiveExam(null)
      await load()
    } catch (submitError) {
      setError(submitError.message)
      if (submitError.status === 409) updateActiveExam(null)
    } finally {
      finishing.current = false
      setBusy(false)
    }
  }

  return (
    <div className="school-portal__workspace">
      {error && (
        <p className="school-portal__error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <Loading>Loading your classroom and exams…</Loading>
      ) : (
        <>
          <section className="school-portal__panel school-portal__classroom">
            <div className="school-portal__panel-heading">
              <div>
                <BookOpenCheck size={18} />
                <h2>Classroom</h2>
              </div>
              <span>
                {classroom?.schoolClass?.name || "Your learning space"}
              </span>
            </div>
            {classroom ? (
              <>
                <div className="school-portal__classroom-tabs">
                  <span>Class stream</span>
                  <span>{classroom.students.length} classmates</span>
                </div>
                {classroom.posts.length ? (
                  <div className="school-portal__feed">
                    {classroom.posts.map((post) => (
                      <article
                        className="school-portal__feed-item"
                        key={post.id}
                      >
                        <div className="school-portal__feed-icon">
                          <FileText size={17} />
                        </div>
                        <div className="school-portal__feed-content">
                          <div className="school-portal__feed-meta">
                            <strong>{post.author}</strong>
                            <span>{post.type.replace("_", " ")}</span>
                            <time>
                              {new Date(post.createdAt).toLocaleDateString()}
                            </time>
                          </div>
                          <h3>{post.title}</h3>
                          {post.subject && <small>{post.subject}</small>}
                          {post.contentBody && <p>{post.contentBody}</p>}
                          {post.deadline && (
                            <p className="school-portal__due">
                              <Clock3 size={14} /> Due {post.deadline}
                            </p>
                          )}
                          {post.meetingUrl && (
                            <a
                              className="school-portal__resource-link"
                              href={post.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Link2 size={15} /> Join live class
                            </a>
                          )}
                          {post.attachmentUrl && (
                            <a
                              className="school-portal__resource-link"
                              href={post.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Paperclip size={15} />{" "}
                              {post.attachmentName || "Open attachment"}
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="school-portal__empty">
                    Your teacher's lessons, announcements and resources will
                    appear here.
                  </p>
                )}
                <div className="school-portal__roster">
                  <h3>
                    <Users size={16} /> People
                  </h3>
                  {classroom.teachers.map((teacher) => (
                    <span key={teacher.id}>
                      {teacher.fullName}
                      <small>Teacher</small>
                    </span>
                  ))}
                  {classroom.students.map((student) => (
                    <span key={student.id}>
                      {student.fullName}
                      <small>Student</small>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="school-portal__empty">
                Your class space will appear after the school assigns you to a
                class.
              </p>
            )}
          </section>

          <section className="school-portal__panel school-portal__exam-panel">
            <div className="school-portal__panel-heading">
              <div>
                <GraduationCap size={18} />
                <h2>Examination hall</h2>
              </div>
              <span>{exams.length} available</span>
            </div>
            {examResult && (
              <div className="school-portal__exam-result" role="status">
                <strong>Submission received</strong>
                <span>
                  {examResult.score} / {examResult.totalQuestions} correct
                </span>
              </div>
            )}
            {activeExam ? (
              <div className="school-portal__exam-room">
                <div className="school-portal__exam-room-heading">
                  <div>
                    <small>EXAM IN PROGRESS</small>
                    <h3>{activeExam.title}</h3>
                  </div>
                  <strong>
                    <Clock3 size={16} /> {Math.floor(remainingSeconds / 60)}:
                    {String(remainingSeconds % 60).padStart(2, "0")}
                  </strong>
                </div>
                {activeExam.questions.map((question, index) => (
                  <fieldset
                    key={`${activeExam.id}-${index}`}
                    className="school-portal__question"
                  >
                    <legend>
                      {index + 1}. {question.questionText}
                    </legend>
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex}>
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={answers[index] === optionIndex}
                          onChange={() => {
                            const nextAnswers = {
                              ...answersRef.current,
                              [index]: optionIndex,
                            }
                            answersRef.current = nextAnswers
                            setAnswers(nextAnswers)
                          }}
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <Button
                  onClick={() => finishExam()}
                  loading={busy}
                  loadingLabel="Submitting answers…"
                >
                  Submit exam
                </Button>
              </div>
            ) : exams.length ? (
              <div className="school-portal__exam-list">
                {exams.map((exam) => (
                  <article key={exam.id}>
                    <span className="school-portal__exam-icon">
                      <FileText size={18} />
                    </span>
                    <div>
                      <h3>{exam.title}</h3>
                      <p>
                        {exam.subjectName || "General"} ·{" "}
                        {exam.questions.length} questions ·{" "}
                        {exam.durationMinutes} min
                      </p>
                      <small>
                        {exam.attemptsRemaining} attempt
                        {exam.attemptsRemaining === 1 ? "" : "s"} remaining
                      </small>
                    </div>
                    <Button
                      disabled={busy || exam.status !== "available"}
                      onClick={() => beginExam(exam.id)}
                    >
                      {exam.status === "available"
                        ? "Start exam"
                        : exam.status === "expired"
                          ? "Closed"
                          : "Completed"}
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="school-portal__empty">
                Published exams will appear here when your teachers assign them.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StudentDashboard({ member, dashboard, school }) {
  const attendance = dashboard.attendance

  const attendanceRate = attendance.total
    ? Math.round(
        ((attendance.present + attendance.late) / attendance.total) * 100,
      )
    : null

  return (
    <div className="school-portal__content">
      <section className="school-portal__welcome">
        <div>
          <p className="school-portal__eyebrow">STUDENT PORTAL</p>
          <h1>Welcome, {dashboard.profile.fullName}</h1>
          <p>
            {dashboard.schoolClass
              ? `${dashboard.schoolClass.name}${
                  dashboard.schoolClass.academicYear
                    ? ` · ${dashboard.schoolClass.academicYear}`
                    : ""
                }`
              : "Your school administrator has not assigned you to a class yet."}
          </p>
        </div>
        <span className="school-portal__identity">
          <ShieldCheck size={17} /> Verified student
        </span>
      </section>

      <IdentityCard
        member={member}
        schoolClass={dashboard.schoolClass}
        schoolName={school.schoolName}
      />

      <div className="school-portal__stats">
        <article className="school-portal__stat">
          <span>
            <BookOpen size={18} />
          </span>
          <small>Subjects</small>
          <strong>{dashboard.subjects.length}</strong>
        </article>
        <article className="school-portal__stat">
          <span>
            <CalendarCheck size={18} />
          </span>
          <small>Attendance</small>
          <strong>
            {attendanceRate === null ? "—" : `${attendanceRate}%`}
          </strong>
        </article>
        <article className="school-portal__stat">
          <span>
            <GraduationCap size={18} />
          </span>
          <small>Published results</small>
          <strong>{dashboard.assessments.length}</strong>
        </article>
      </div>

      <div className="school-portal__columns">
        <section className="school-portal__panel">
          <div className="school-portal__panel-heading">
            <div>
              <BookOpen size={18} />
              <h2>My subjects</h2>
            </div>
          </div>
          {dashboard.subjects.length ? (
            <ul className="school-portal__subject-list">
              {dashboard.subjects.map((subject) => (
                <li key={subject.id}>{subject.name}</li>
              ))}
            </ul>
          ) : (
            <p className="school-portal__empty">
              Subjects will appear here when they are set up for your class.
            </p>
          )}
        </section>

        <section className="school-portal__panel">
          <div className="school-portal__panel-heading">
            <div>
              <CalendarCheck size={18} />
              <h2>Attendance summary</h2>
            </div>
          </div>
          <p className="school-portal__attendance-rate">
            {attendanceRate === null ? "No records yet" : `${attendanceRate}%`}
          </p>
          <p className="school-portal__muted">
            Based on {attendance.total} of the latest 180 recorded sessions.
          </p>
          <div className="school-portal__attendance-breakdown">
            <span>
              Present <b>{attendance.present}</b>
            </span>
            <span>
              Late <b>{attendance.late}</b>
            </span>
            <span>
              Absent <b>{attendance.absent}</b>
            </span>
            <span>
              Excused <b>{attendance.excused}</b>
            </span>
          </div>
        </section>
      </div>

      <section className="school-portal__panel school-portal__results">
        <div className="school-portal__panel-heading">
          <div>
            <GraduationCap size={18} />
            <h2>Results vault</h2>
          </div>
          <span>Published academic records</span>
        </div>
        {dashboard.assessments.length ? (
          <div className="school-portal__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Subject</th>
                  <th>Due</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <strong>{assessment.title}</strong>
                      <small>{assessment.type}</small>
                    </td>
                    <td>{assessment.subject}</td>
                    <td>{assessment.dueOn || "—"}</td>
                    <td>
                      {assessment.score === null
                        ? "Pending"
                        : `${assessment.score} / ${assessment.maximumScore}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="school-portal__empty">
            Published assessments and results will appear here.
          </p>
        )}
      </section>
      <p className="school-portal__account-note">
        Signed in as {member.fullName}. Your school account controls this
        record.
      </p>
      <StudentPortalTools />
    </div>
  )
}

function TeacherClassroomTools({ member, schoolClass }) {
  const [classroom, setClassroom] = useState(null)
  const [exams, setExams] = useState([])
  const [results, setResults] = useState(null)
  const [postType, setPostType] = useState("notice")
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")
  const [deadline, setDeadline] = useState("")
  const [meetingUrl, setMeetingUrl] = useState("")
  const [attachment, setAttachment] = useState(null)
  const [examTitle, setExamTitle] = useState("")
  const [examSubjectId, setExamSubjectId] = useState("")
  const [examTermId, setExamTermId] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("30")
  const [attemptsAllowed, setAttemptsAllowed] = useState("1")
  const [validityMinutes, setValidityMinutes] = useState("1440")
  const [questions, setQuestions] = useState([
    {
      questionText: "",
      options: ["", "", "", ""],
      correctAnswerIndex: 0,
    },
  ])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadClassroom() {
    if (!schoolClass) return
    setLoading(true)
    setError("")
    const [classroomResult, examsResult] = await Promise.allSettled([
      getTeacherClassroom(schoolClass.id),
      getTeacherPortalExams(),
    ])
    if (classroomResult.status === "fulfilled")
      setClassroom(classroomResult.value)
    if (examsResult.status === "fulfilled") setExams(examsResult.value.exams)
    const failures = [classroomResult, examsResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason.message)
    if (failures.length) setError(failures.join(" "))
    setLoading(false)
  }

  useEffect(() => {
    loadClassroom()
  }, [schoolClass?.id])

  async function publishPost(event) {
    event.preventDefault()
    if (!schoolClass || busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const attachmentValue = attachment
        ? {
            name: attachment.name,
            mimeType: attachment.type,
            dataBase64: await readFileAsBase64(attachment),
          }
        : null
      await createTeacherClassroomPost({
        classId: schoolClass.id,
        subjectId: postSubjectId || null,
        type: postType,
        title: postTitle,
        contentBody: postContent,
        deadline: postType === "assignment" ? deadline : null,
        meetingUrl: meetingUrl.trim() || null,
        attachment: attachmentValue,
      })
      setPostTitle("")
      setPostContent("")
      setDeadline("")
      setMeetingUrl("")
      setAttachment(null)
      setPostSubjectId("")
      setNotice("Your classroom post is now available to the class.")
      await loadClassroom()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  const [postSubjectId, setPostSubjectId] = useState("")

  async function removePost(postId) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await deleteTeacherClassroomPost(postId)
      setNotice("Classroom post deleted.")
      await loadClassroom()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  function updateQuestion(index, property, value) {
    setQuestions((current) =>
      current.map((question, itemIndex) =>
        itemIndex === index ? { ...question, [property]: value } : question,
      ),
    )
  }

  function updateOption(questionIndex, optionIndex, value) {
    setQuestions((current) =>
      current.map((question, itemIndex) =>
        itemIndex === questionIndex
          ? {
              ...question,
              options: question.options.map((option, index) =>
                index === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    )
  }

  async function publishExam(event) {
    event.preventDefault()
    if (!schoolClass || busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await createTeacherPortalExam({
        classId: schoolClass.id,
        subjectId: examSubjectId || null,
        termId: examTermId,
        title: examTitle,
        durationMinutes: Number(durationMinutes),
        attemptsAllowed: Number(attemptsAllowed),
        validityMinutes: Number(validityMinutes),
        questions,
      })
      setExamTitle("")
      setQuestions([
        { questionText: "", options: ["", "", "", ""], correctAnswerIndex: 0 },
      ])
      setNotice("Exam published to the selected class.")
      await loadClassroom()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  async function showResults(examId) {
    setError("")
    try {
      setResults(await getTeacherPortalExamResults(examId))
    } catch (resultsError) {
      setError(resultsError.message)
    }
  }

  if (!schoolClass) return null

  return (
    <div className="school-portal__workspace">
      {error && (
        <p className="school-portal__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="school-portal__notice" role="status">
          <CheckCircle2 size={16} /> {notice}
        </p>
      )}
      {loading ? (
        <Loading>Loading class space…</Loading>
      ) : (
        <>
          <section className="school-portal__panel school-portal__classroom">
            <div className="school-portal__panel-heading">
              <div>
                <BookOpenCheck size={18} />
                <h2>Classroom stream</h2>
              </div>
              <span>{schoolClass.name}</span>
            </div>
            <div className="school-portal__classroom-columns">
              <form className="school-portal__composer" onSubmit={publishPost}>
                <div className="school-portal__panel-heading">
                  <div>
                    <Plus size={17} />
                    <h3>Create a post</h3>
                  </div>
                </div>
                <label>
                  Post type
                  <select
                    value={postType}
                    onChange={(event) => setPostType(event.target.value)}
                  >
                    <option value="notice">Announcement</option>
                    <option value="lesson">Lesson</option>
                    <option value="assignment">Assignment</option>
                    <option value="material">Learning material</option>
                    <option value="live_class">Live class</option>
                  </select>
                </label>
                <label>
                  Subject
                  <select
                    value={postSubjectId}
                    onChange={(event) => setPostSubjectId(event.target.value)}
                  >
                    <option value="">General class post</option>
                    {schoolClass.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Title
                  <input
                    value={postTitle}
                    onChange={(event) => setPostTitle(event.target.value)}
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  Instructions or message
                  <textarea
                    value={postContent}
                    onChange={(event) => setPostContent(event.target.value)}
                    maxLength={12000}
                    rows={4}
                  />
                </label>
                {postType === "assignment" && (
                  <label>
                    Due date
                    <input
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      required
                    />
                  </label>
                )}
                <label>
                  Live lesson link (HTTPS)
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(event) => setMeetingUrl(event.target.value)}
                    placeholder="https://"
                  />
                </label>
                <label className="school-portal__file-input">
                  Attach a PDF or image
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      if (file && file.size > 5 * 1024 * 1024) {
                        setError("Attachments must be no larger than 5 MB.")
                        event.target.value = ""
                        return
                      }
                      setError("")
                      setAttachment(file)
                    }}
                  />
                </label>
                {attachment && (
                  <small className="school-portal__attachment-name">
                    <Paperclip size={14} /> {attachment.name}
                  </small>
                )}
                <Button type="submit" loading={busy} loadingLabel="Publishing…">
                  Publish to class
                </Button>
              </form>

              <div className="school-portal__feed">
                {classroom?.posts?.length ? (
                  classroom.posts.map((post) => (
                    <article className="school-portal__feed-item" key={post.id}>
                      <div className="school-portal__feed-icon">
                        <FileText size={17} />
                      </div>
                      <div className="school-portal__feed-content">
                        <div className="school-portal__feed-meta">
                          <strong>{post.author}</strong>
                          <span>{post.type.replace("_", " ")}</span>
                          <time>
                            {new Date(post.createdAt).toLocaleDateString()}
                          </time>
                        </div>
                        <h3>{post.title}</h3>
                        {post.subject && <small>{post.subject}</small>}
                        {post.contentBody && <p>{post.contentBody}</p>}
                        {post.deadline && (
                          <p className="school-portal__due">
                            <Clock3 size={14} /> Due {post.deadline}
                          </p>
                        )}
                        {post.meetingUrl && (
                          <a
                            className="school-portal__resource-link"
                            href={post.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Link2 size={15} /> Join live class
                          </a>
                        )}
                        {post.attachmentUrl && (
                          <a
                            className="school-portal__resource-link"
                            href={post.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip size={15} />{" "}
                            {post.attachmentName || "Open attachment"}
                          </a>
                        )}
                        {post.authorId === member.id && (
                          <button
                            className="school-portal__text-button"
                            type="button"
                            disabled={busy}
                            onClick={() => removePost(post.id)}
                          >
                            <Trash2 size={14} /> Delete post
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="school-portal__empty">
                    No classroom posts yet. Publish a first lesson, announcement
                    or assignment.
                  </p>
                )}
              </div>
            </div>
            <div className="school-portal__roster">
              <h3>
                <Users size={16} /> Class people
              </h3>
              {classroom?.teachers.map((teacher) => (
                <span key={teacher.id}>
                  {teacher.fullName}
                  <small>Teacher</small>
                </span>
              ))}
              {classroom?.students.map((student) => (
                <span key={student.id}>
                  {student.fullName}
                  <small>Student</small>
                </span>
              ))}
            </div>
          </section>

          <section className="school-portal__panel school-portal__exam-panel">
            <div className="school-portal__panel-heading">
              <div>
                <GraduationCap size={18} />
                <h2>Exam studio</h2>
              </div>
              <span>Build and review class assessments</span>
            </div>
            <div className="school-portal__classroom-columns">
              <form className="school-portal__composer" onSubmit={publishExam}>
                <div className="school-portal__panel-heading">
                  <div>
                    <Plus size={17} />
                    <h3>New exam</h3>
                  </div>
                </div>
                <label>
                  Exam title
                  <input
                    value={examTitle}
                    onChange={(event) => setExamTitle(event.target.value)}
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  Subject
                  <select
                    value={examSubjectId}
                    onChange={(event) => setExamSubjectId(event.target.value)}
                  >
                    <option value="">General</option>
                    {schoolClass.subjects.map((subject) => (
                      <option value={subject.id} key={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Academic term
                  <select
                    value={examTermId}
                    onChange={(event) => setExamTermId(event.target.value)}
                    required
                  >
                    <option value="">Choose a term</option>
                    {schoolClass.terms.map((term) => (
                      <option value={term.id} key={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="school-portal__exam-settings">
                  <label>
                    Duration (minutes)
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={durationMinutes}
                      onChange={(event) =>
                        setDurationMinutes(event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    Attempts
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={attemptsAllowed}
                      onChange={(event) =>
                        setAttemptsAllowed(event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    Available (minutes)
                    <input
                      type="number"
                      min="1"
                      max="525600"
                      value={validityMinutes}
                      onChange={(event) =>
                        setValidityMinutes(event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
                {questions.map((question, questionIndex) => (
                  <fieldset
                    className="school-portal__question-builder"
                    key={questionIndex}
                  >
                    <legend>Question {questionIndex + 1}</legend>
                    <label>
                      Prompt
                      <textarea
                        value={question.questionText}
                        onChange={(event) =>
                          updateQuestion(
                            questionIndex,
                            "questionText",
                            event.target.value,
                          )
                        }
                        maxLength={1200}
                        required
                      />
                    </label>
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex}>
                        Option {String.fromCharCode(65 + optionIndex)}
                        <input
                          value={option}
                          onChange={(event) =>
                            updateOption(
                              questionIndex,
                              optionIndex,
                              event.target.value,
                            )
                          }
                          maxLength={300}
                          required
                        />
                      </label>
                    ))}
                    <label>
                      Correct answer
                      <select
                        value={question.correctAnswerIndex}
                        onChange={(event) =>
                          updateQuestion(
                            questionIndex,
                            "correctAnswerIndex",
                            Number(event.target.value),
                          )
                        }
                      >
                        {question.options.map((_, optionIndex) => (
                          <option key={optionIndex} value={optionIndex}>
                            Option {String.fromCharCode(65 + optionIndex)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {questions.length > 1 && (
                      <button
                        className="school-portal__text-button"
                        type="button"
                        onClick={() =>
                          setQuestions((current) =>
                            current.filter(
                              (_, index) => index !== questionIndex,
                            ),
                          )
                        }
                      >
                        <Trash2 size={14} /> Remove question
                      </button>
                    )}
                  </fieldset>
                ))}
                <button
                  className="school-portal__text-button"
                  type="button"
                  disabled={questions.length >= 100}
                  onClick={() =>
                    setQuestions((current) => [
                      ...current,
                      {
                        questionText: "",
                        options: ["", "", "", ""],
                        correctAnswerIndex: 0,
                      },
                    ])
                  }
                >
                  <Plus size={14} /> Add question
                </button>
                <Button
                  type="submit"
                  loading={busy}
                  loadingLabel="Publishing exam…"
                  disabled={!schoolClass.terms.length}
                >
                  Publish exam
                </Button>
                {!schoolClass.terms.length && (
                  <small>
                    Configure an academic term before publishing an exam.
                  </small>
                )}
              </form>

              <div className="school-portal__exam-list">
                {exams
                  .filter((exam) => exam.classId === schoolClass.id)
                  .map((exam) => (
                    <article key={exam.id}>
                      <span className="school-portal__exam-icon">
                        <FileText size={18} />
                      </span>
                      <div>
                        <h3>{exam.title}</h3>
                        <p>
                          {exam.subjectName || "General"} ·{" "}
                          {exam.questions.length} questions
                        </p>
                        <small>View submissions and scores</small>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => showResults(exam.id)}
                      >
                        Results
                      </Button>
                    </article>
                  ))}
                {!exams.some((exam) => exam.classId === schoolClass.id) && (
                  <p className="school-portal__empty">
                    Exams you publish to this class will appear here.
                  </p>
                )}
                {results && (
                  <section className="school-portal__results-card">
                    <h3>{results.title} · Results</h3>
                    <p>
                      {results.className} · {results.totalQuestions} questions
                    </p>
                    {results.results.length ? (
                      results.results.map((result, index) => (
                        <div key={`${result.fullName}-${index}`}>
                          <strong>{result.fullName}</strong>
                          <span>
                            {result.score}/{result.totalQuestions} ·{" "}
                            {result.percentage}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="school-portal__empty">
                        No submissions yet.
                      </p>
                    )}
                  </section>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function TeacherDashboard({ dashboard, member, school, onReload }) {
  const [classId, setClassId] = useState("")

  const [termId, setTermId] = useState("")

  const [date, setDate] = useState(localDateValue)

  const [entries, setEntries] = useState([])

  const [attendanceLoading, setAttendanceLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const selectedClass = dashboard.classes.find((item) => item.id === classId)

  function termForDate(schoolClass, selectedDate) {
    return schoolClass.terms.find(
      (term) => selectedDate >= term.startsOn && selectedDate <= term.endsOn,
    )
  }

  useEffect(() => {
    if (!classId && dashboard.classes.length) {
      const schoolClass = dashboard.classes[0]

      setClassId(schoolClass.id)

      setTermId(termForDate(schoolClass, date)?.id || "")
    }
  }, [dashboard.classes, classId, date])

  useEffect(() => {
    if (!selectedClass || !date) {
      setEntries([])

      return undefined
    }

    let active = true

    setAttendanceLoading(true)

    setError("")

    getTeacherAttendance(selectedClass.id, date)

      .then((saved) => {
        if (!active) return

        const savedEntries = new Map(
          saved.entries.map((entry) => [entry.studentId, entry]),
        )

        setEntries(
          selectedClass.students.map((student) => ({
            studentId: student.id,

            fullName: student.fullName,

            status: savedEntries.get(student.id)?.status || "",

            note: savedEntries.get(student.id)?.note || "",
          })),
        )

        const matchingTerm = termForDate(selectedClass, date)
        setTermId(saved.session?.termId || matchingTerm?.id || "")
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setAttendanceLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedClass, date])

  function updateEntry(studentId, status) {
    setEntries((current) =>
      current.map((entry) =>
        entry.studentId === studentId ? { ...entry, status } : entry,
      ),
    )
  }

  async function saveAttendance(event) {
    event.preventDefault()

    if (!selectedClass || !termId || saving) return

    setSaving(true)

    setError("")

    setNotice("")

    try {
      const result = await saveTeacherAttendance({
        classId: selectedClass.id,

        termId,

        date,

        entries: entries.map(({ studentId, status, note }) => ({
          studentId,
          status,
          note,
        })),
      })

      setNotice(
        `Attendance saved for ${result.savedCount} student${
          result.savedCount === 1 ? "" : "s"
        }.`,
      )
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="school-portal__content">
      <section className="school-portal__welcome">
        <div>
          <p className="school-portal__eyebrow">TEACHER PORTAL</p>
          <h1>Welcome, {dashboard.profile.fullName}</h1>
          <p>Manage your assigned classes and record class attendance.</p>
        </div>
        <span className="school-portal__identity">
          <ShieldCheck size={17} /> Verified teacher
        </span>
      </section>

      <IdentityCard member={member} schoolName={school.schoolName} />

      <section className="school-portal__panel">
        <div className="school-portal__panel-heading">
          <div>
            <Users size={18} />
            <h2>Assigned classes</h2>
          </div>
          <span>
            {dashboard.classes.length} class
            {dashboard.classes.length === 1 ? "" : "es"}
          </span>
        </div>
        {dashboard.classes.length ? (
          <div className="school-portal__class-grid">
            {dashboard.classes.map((schoolClass) => (
              <button
                type="button"
                key={schoolClass.id}
                className={`school-portal__class-card${
                  schoolClass.id === classId ? " is-active" : ""
                }`}
                onClick={() => {
                  setClassId(schoolClass.id)

                  setTermId(termForDate(schoolClass, date)?.id || "")

                  setNotice("")
                }}
              >
                <strong>{schoolClass.name}</strong>
                <span>
                  {schoolClass.academicYear || "Academic year not configured"}
                </span>
                <small>
                  {schoolClass.students.length} active students ·{" "}
                  {schoolClass.subjects.length} subject
                  {schoolClass.subjects.length === 1 ? "" : "s"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="school-portal__empty">
            No academic classes are assigned yet. Ask your school administrator
            to assign you as a class or subject teacher.
          </p>
        )}
      </section>

      {selectedClass && (
        <section className="school-portal__panel">
          <div className="school-portal__panel-heading">
            <div>
              <CalendarCheck size={18} />
              <h2>Class attendance</h2>
            </div>
            <button
              type="button"
              className="school-portal__icon-button"
              onClick={onReload}
              aria-label="Refresh class data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="school-portal__controls">
            <label>
              Academic term
              <select
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
                disabled={!selectedClass.terms.length}
              >
                <option value="">Select a term</option>
                {selectedClass.terms.map((term) => (
                  <option value={term.id} key={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  const nextDate = event.target.value
                  setDate(nextDate)
                  setTermId(termForDate(selectedClass, nextDate)?.id || "")
                }}
              />
            </label>
          </div>
          {error && (
            <p className="school-portal__error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="school-portal__notice" role="status">
              <CheckCircle2 size={16} /> {notice}
            </p>
          )}
          {attendanceLoading ? (
            <Loading>Loading class attendance…</Loading>
          ) : entries.length ? (
            <form onSubmit={saveAttendance}>
              <div className="school-portal__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Attendance status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.studentId}>
                        <td>{entry.fullName}</td>
                        <td>
                          <select
                            required
                            value={entry.status}
                            onChange={(event) =>
                              updateEntry(entry.studentId, event.target.value)
                            }
                          >
                            <option value="">Select status</option>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="school-portal__form-actions">
                <span>{entries.length} active students</span>
                <Button
                  type="submit"
                  loading={saving}
                  loadingLabel="Saving attendance..."
                  disabled={
                    !termId ||
                    !entries.length ||
                    entries.some((entry) => !entry.status)
                  }
                >
                  Save attendance
                </Button>
              </div>
            </form>
          ) : (
            <p className="school-portal__empty">
              {selectedClass.terms.length
                ? "There are no active students in this class roster."
                : "An academic term must be configured before attendance can be recorded."}
            </p>
          )}
        </section>
      )}
      <TeacherClassroomTools member={member} schoolClass={selectedClass} />
    </div>
  )
}

export default function SchoolPortalPage({
  school,
  role,
  notFound,
  error: schoolError,
  onRetry,
}) {
  const [member, setMember] = useState(null)

  const [dashboard, setDashboard] = useState(null)

  const [checking, setChecking] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  const [accessPin, setAccessPin] = useState("")

  const [password, setPassword] = useState("")

  const [pageError, setPageError] = useState("")

  const [premiumRequired, setPremiumRequired] = useState(false)

  const [loadKey, setLoadKey] = useState(0)

  const roleLabel =
    (member?.role || role) === "student"
      ? "Student"
      : (member?.role || role) === "teacher"
        ? "Teacher"
        : "School member"

  async function loadDashboard(currentMember) {
    if (!currentMember?.premiumAccess) {
      setPremiumRequired(true)

      setDashboard(null)

      return
    }

    try {
      const result =
        currentMember.role === "student"
          ? await getStudentPortalDashboard()
          : await getTeacherPortalDashboard()

      setDashboard(result)

      setPremiumRequired(false)
    } catch (loadError) {
      setPageError(loadError.message)

      setPremiumRequired(loadError.code === "PREMIUM_REQUIRED")
    }
  }

  useEffect(() => {
    let active = true

    setChecking(true)

    setPageError("")

    getPortalMember()

      .then(async (currentMember) => {
        if (!active) return

        setMember(currentMember)

        if (currentMember) await loadDashboard(currentMember)
      })

      .catch((loadError) => {
        if (active) setPageError(loadError.message)
      })

      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [role, school?.slug, loadKey])

  const mismatch = Boolean(
    member &&
      ((role && member.role !== role) || member.school.slug !== school?.slug),
  )

  async function handleLogin(event) {
    event.preventDefault()

    if (submitting) return

    setSubmitting(true)

    setPageError("")

    try {
      const result = await loginPortal({
        schoolSlug: school.slug,

        accessPin,

        ...(password ? { password } : {}),
      })

      window.location.assign(
        `/s/${encodeURIComponent(school.slug)}/${result.member.role}`,
      )
    } catch (loginError) {
      setPageError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)

    setPageError("")

    try {
      await logoutPortal()

      setMember(null)

      setDashboard(null)

      setPremiumRequired(false)

      setLoadKey((current) => current + 1)
    } catch (logoutError) {
      setPageError(logoutError.message)
    } finally {
      setLoggingOut(false)
    }
  }

  const profileInitials = useMemo(
    () =>
      member?.fullName
        ?.split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "",

    [member?.fullName],
  )

  if (schoolError || notFound || !school) {
    return (
      <main className="school-portal school-portal--entry">
        <div className="school-portal__entry-card">
          <span className="school-portal__brand-mark">
            <Building2 size={23} />
          </span>
          <p className="school-portal__eyebrow">ACEEDU SCHOOL SPACES</p>
          <h1>
            {notFound ? "School space not found" : "School portal unavailable"}
          </h1>
          <p>
            {notFound
              ? "This address does not match a registered school."
              : schoolError || "The school identity could not be resolved."}
          </p>
          {schoolError && (
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw size={16} /> Try again
            </Button>
          )}
          <a href="/">Return to AceEdu</a>
        </div>
      </main>
    )
  }

  // Preserve the original EIS Student and Teacher portal design after AceEdu
  // has verified the existing session, school identity, Premium entitlement,
  // and role-specific dashboard API.
  if (
    !checking &&
    member &&
    !mismatch &&
    dashboard &&
    !premiumRequired &&
    ["student", "teacher"].includes(member.role)
  ) {
    const isStudent = member.role === "student"
    const legacyPortalPath = isStudent
      ? "/eis-portals/student/student-dashboard.html"
      : "/eis-portals/teacher/teacher.html"
    const portalUrl = `${legacyPortalPath}?schoolSlug=${encodeURIComponent(member.school.slug)}`

    return (
      <iframe
        key={`${member.school.slug}:${member.role}`}
        title={`${isStudent ? "Student" : "Teacher"} portal for ${school.schoolName}`}
        src={portalUrl}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
          zIndex: 9999,
          background: "#0a192f",
        }}
      />
    )
  }

  return (
    <main
      className="school-portal"
      data-portal-role={member?.role || role || "portal"}
    >
      <div
        className="school-portal__glow school-portal__glow--one"
        aria-hidden="true"
      />
      <div
        className="school-portal__glow school-portal__glow--two"
        aria-hidden="true"
      />
      <header className="school-portal__header">
        <a
          className="school-portal__brand"
          href={`/s/${encodeURIComponent(school.slug)}`}
        >
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="" />
          ) : (
            <span>
              <Building2 size={19} />
            </span>
          )}
          <span>
            <b>{school.schoolName}</b>
            <small>AceEdu School Space</small>
          </span>
        </a>
        {member && !mismatch && (
          <div className="school-portal__user">
            <span className="school-portal__avatar">{profileInitials}</span>
            <span>
              {member.fullName}
              <small>{roleLabel} access</small>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
            >
              {loggingOut ? <LoaderCircle size={17} /> : <LogOut size={17} />}
            </button>
          </div>
        )}
      </header>

      <div className="school-portal__main">
        {checking ? (
          <Loading>Verifying your school portal session…</Loading>
        ) : mismatch ? (
          <section className="school-portal__entry-card" role="alert">
            <ShieldCheck size={25} />
            <h1>Another portal account is active</h1>
            <p>
              This session belongs to {member.school.schoolName} as a{" "}
              {member.role}. Sign out before using this school portal.
            </p>
            {pageError && <p className="school-portal__error">{pageError}</p>}
            <Button
              onClick={handleLogout}
              loading={loggingOut}
              loadingLabel="Signing out..."
            >
              Sign out
            </Button>
          </section>
        ) : member ? (
          <>
            {pageError && (
              <p
                className="school-portal__error school-portal__global-error"
                role="alert"
              >
                {pageError}
              </p>
            )}
            {premiumRequired ? (
              <section className="school-portal__premium">
                <span>
                  <ShieldCheck size={25} />
                </span>
                <p className="school-portal__eyebrow">PREMIUM ACCESS</p>
                <h1>{roleLabel} portal access is not active</h1>
                <p>
                  This portal requires an active AceEdu Premium entitlement for{" "}
                  {school.schoolName}. Contact your school administrator.
                </p>
              </section>
            ) : dashboard ? (
              member.role === "student" ? (
                <StudentDashboard
                  member={member}
                  dashboard={dashboard}
                  school={school}
                />
              ) : (
                <TeacherDashboard
                  dashboard={dashboard}
                  member={member}
                  school={school}
                  onReload={() => setLoadKey((current) => current + 1)}
                />
              )
            ) : pageError ? (
              <section className="school-portal__entry-card" role="alert">
                <ShieldCheck size={25} />
                <h1>School records could not be loaded</h1>
                <p>{pageError}</p>
                <Button
                  variant="secondary"
                  onClick={() => setLoadKey((current) => current + 1)}
                >
                  <RefreshCw size={16} /> Retry
                </Button>
              </section>
            ) : (
              <Loading>Loading your school records…</Loading>
            )}
          </>
        ) : (
          <section className="school-portal__login">
            <a
              className="school-portal__back"
              href={`/s/${encodeURIComponent(school.slug)}`}
            >
              <ArrowLeft size={15} /> School administrator sign-in
            </a>
            <span className="school-portal__role-icon">
              <ShieldCheck size={27} aria-hidden="true" />
            </span>
            <p className="school-portal__eyebrow">SECURE SCHOOL MEMBER ENTRY</p>
            <h1>School portal</h1>
            <p className="school-portal__login-description">
              Sign in to <strong>{school.schoolName}</strong>. AceEdu identifies
              your student or teacher account from your school-issued PIN.
            </p>
            {pageError && (
              <p className="school-portal__error" role="alert">
                {pageError}
              </p>
            )}
            <form onSubmit={handleLogin} className="school-portal__login-form">
              <label>
                Personal access PIN
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="username"
                  value={accessPin}
                  onChange={(event) =>
                    setAccessPin(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  required
                  aria-describedby="portal-pin-help"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby="portal-pin-help"
                />
              </label>
              <small id="portal-pin-help">
                Enter a password if your school issued one. Teacher accounts
                require a password.
              </small>
              <Button
                type="submit"
                loading={submitting}
                loadingLabel="Verifying account..."
              >
                Sign in securely
              </Button>
            </form>
            <p className="school-portal__support">
              Need access? Contact your school administrator.
            </p>
          </section>
        )}
      </div>

      <footer className="school-portal__footer">
        <span>
          <ShieldCheck size={14} /> Your identity and school access are verified
          securely.
        </span>
        <span>
          <a href={`/s/${encodeURIComponent(school.slug)}`}>School sign-in</a>
        </span>
      </footer>
    </main>
  )
}
