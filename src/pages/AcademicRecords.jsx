import { useEffect, useState } from "react"

import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  GraduationCap,
  Medal,
  TrendingUp,
  Users,
} from "lucide-react"

import {
  getAcademicSetup,
  getAcademicYearRecords,
  getClassPerformance,
  getStudentAcademicHistory,
} from "../data/api"

import LoadingSpinner from "../components/ui/LoadingSpinner"

import "./PremiumOperations.css"

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

function formatRecordDate(value) {
  if (!value) return "—"

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)

  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString(undefined, {
    month: "short",

    day: "numeric",

    year: "numeric",
  })
}

function StudentAvatar({ name, src, className = "" }) {
  const [failed, setFailed] = useState(false)

  const initials = (name || "?")

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part[0])

    .join("")

    .toUpperCase()

  return src && !failed ? (
    <img
      className={`premium-records__avatar ${className}`}
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`premium-records__avatar is-initials ${className}`}>
      {initials}
    </span>
  )
}

function BackButton({ children, onClick }) {
  return (
    <button type="button" className="premium-records__back" onClick={onClick}>
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </button>
  )
}

function ViewHeading({ eyebrow, title, description, actions }) {
  return (
    <header className="premium-operations__heading premium-records__view-heading">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && (
        <div className="premium-records__view-actions">{actions}</div>
      )}
    </header>
  )
}

function Metric({ label, value, detail }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function Breadcrumbs({ pages, onNavigate }) {
  return (
    <nav
      className="premium-records__breadcrumbs"
      aria-label="Record navigation"
    >
      {pages.map((page, index) => (
        <span key={`${page.label}-${index}`}>
          {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
          {index === pages.length - 1 ? (
            <strong aria-current="page">{page.label}</strong>
          ) : (
            <button type="button" onClick={() => onNavigate(index)}>
              {page.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}

function RecordsShell({ children, breadcrumbs, onNavigate }) {
  return (
    <section
      className="premium-operations premium-records"
      aria-label="Academic records"
    >
      {breadcrumbs && (
        <Breadcrumbs pages={breadcrumbs} onNavigate={onNavigate} />
      )}
      {children}
    </section>
  )
}

function SessionSelectionView({
  years,

  onSelect,

  onOpenSettings,
}) {
  return (
    <RecordsShell>
      <ViewHeading
        eyebrow="PREMIUM · SCHOOL OPERATIONS"
        title="Academic records"
        description="Select an academic session to explore its classes, results, and attendance."
      />
      {years.length ? (
        <section
          className="premium-records__section"
          aria-labelledby="premium-records-sessions-title"
        >
          <div className="premium-records__section-heading">
            <div>
              <h3 id="premium-records-sessions-title">Academic sessions</h3>
              <p>Current and past school years</p>
            </div>
            <CalendarDays size={21} aria-hidden="true" />
          </div>
          <div className="premium-records__session-grid">
            {years.map((year) => (
              <button
                type="button"
                className="premium-records__session-card"
                key={year.id}
                onClick={() => onSelect(year)}
              >
                <span className="premium-records__session-icon">
                  <CalendarDays size={19} aria-hidden="true" />
                </span>
                <span>
                  <strong>{year.name}</strong>
                  <small>
                    {formatRecordDate(year.startsOn)} –{" "}
                    {formatRecordDate(year.endsOn)}
                  </small>
                </span>
                {year.isCurrent && (
                  <em className="premium-records__current">Current</em>
                )}
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="admin-panel premium-records__empty-state">
          <CalendarDays size={26} aria-hidden="true" />
          <h3>No academic sessions yet</h3>
          <p>
            Academic sessions are managed in Settings. Existing session records
            will appear here as classes and academic activity are recorded.
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
      )}
    </RecordsShell>
  )
}

function SessionClassesView({
  session,

  records,

  error,

  loading,

  onBack,

  onSelectClass,
}) {
  const classes = records?.classes || []

  return (
    <RecordsShell
      breadcrumbs={[
        { label: "Academic records", onSelect: onBack },

        { label: session.name },
      ]}
      onNavigate={(index) => index === 0 && onBack()}
    >
      <ViewHeading
        eyebrow="ACADEMIC SESSION"
        title={session.name}
        description={`${formatRecordDate(session.startsOn)} – ${formatRecordDate(session.endsOn)} · Select a class to open its analysis.`}
      />
      <BackButton onClick={onBack}>All sessions</BackButton>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? (
        <LoadingState>Loading session classes…</LoadingState>
      ) : classes.length ? (
        <section className="premium-records__section">
          <div className="premium-records__section-heading">
            <div>
              <h3>Classes in {session.name}</h3>
              <p>{classes.length} session classes</p>
            </div>
            <GraduationCap size={21} aria-hidden="true" />
          </div>
          <div className="premium-records__class-grid">
            {classes.map(({ schoolClass, metrics }) => (
              <button
                type="button"
                className="premium-records__class-card"
                key={schoolClass.id}
                onClick={() => onSelectClass(schoolClass)}
              >
                <span className="premium-records__class-icon">
                  <GraduationCap size={20} aria-hidden="true" />
                </span>
                <span className="premium-records__class-info">
                  <strong>{schoolClass.name}</strong>
                  <small>
                    <Users size={13} aria-hidden="true" />
                    {metrics.studentCount} students
                    <span aria-hidden="true">·</span>
                    {metrics.assessmentCount} recorded results
                  </small>
                  {metrics.academicHubActivityCount > 0 && (
                    <small>
                      {metrics.academicHubActivityCount} Academic Hub posts
                    </small>
                  )}
                  <small>
                    Class average:{" "}
                    {metrics.classAverage === null
                      ? "No scored results"
                      : `${metrics.classAverage}%`}
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="admin-panel premium-records__empty-state">
          <GraduationCap size={25} aria-hidden="true" />
          <h3>No classes in this session</h3>
          <p>There are no classes recorded for this academic session yet.</p>
        </div>
      )}
      <p className="premium-records__footnote">
        Student counts are from this session’s saved roster, not the current
        class assignment.
      </p>
    </RecordsShell>
  )
}

function ClassAnalysisView({
  session,

  schoolClass,

  records,

  loading,

  error,

  onBack,

  onSelectStudent,
}) {
  const topStudents =
    records?.students.filter((student) => student.rank && student.rank <= 3) ||
    []

  const distributionMax = Math.max(
    1,

    ...(records?.performanceDistribution || []).map((item) => item.count),
  )

  return (
    <RecordsShell
      breadcrumbs={[
        { label: "Academic records", onSelect: () => onBack("sessions") },

        { label: session.name, onSelect: () => onBack("classes") },

        { label: schoolClass.name },
      ]}
      onNavigate={(index) =>
        index === 0 ? onBack("sessions") : index === 1 && onBack("classes")
      }
    >
      <ViewHeading
        eyebrow={`${session.name} · CLASS ANALYSIS`}
        title={schoolClass.name}
        description="Session results from student-platform exams and teacher-recorded scores, plus attendance and Academic Hub activity."
      />
      <BackButton onClick={() => onBack("classes")}>
        All {session.name} classes
      </BackButton>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? (
        <LoadingState>Loading class analysis…</LoadingState>
      ) : records ? (
        <>
          <div className="premium-records__metrics">
            <Metric
              label="Class average"
              value={
                records.metrics.classAverage === null
                  ? "—"
                  : `${records.metrics.classAverage}%`
              }
              detail={`${records.metrics.assessedStudentCount} students with recorded scores`}
            />
            <Metric
              label="Highest student average"
              value={
                records.metrics.highestAverage === null
                  ? "—"
                  : `${records.metrics.highestAverage}%`
              }
              detail={records.metrics.highestStudent || "No scored results"}
            />
            <Metric
              label="Lowest student average"
              value={
                records.metrics.lowestAverage === null
                  ? "—"
                  : `${records.metrics.lowestAverage}%`
              }
              detail={records.metrics.lowestStudent || "No scored results"}
            />
            <Metric
              label="Attendance rate"
              value={
                records.metrics.attendance.rate === null
                  ? "—"
                  : `${records.metrics.attendance.rate}%`
              }
              detail={`${records.metrics.attendance.present} present · ${records.metrics.attendance.absent} absent · ${records.metrics.attendance.late} late`}
            />
          </div>

          <p className="premium-records__method">
            Student averages and rankings use each student’s best submitted
            score per student-platform exam plus teacher-recorded scores,
            divided by total possible points. The class average is the mean of
            students with recorded scores. Tied averages share a rank; excused
            attendance marks are excluded from the attendance percentage.
          </p>

          <section className="premium-records__section premium-records__analysis">
            <div className="premium-records__section-heading">
              <div>
                <h3>
                  <Award size={18} /> Top performers
                </h3>
                <p>Highest session averages · ties share positions</p>
              </div>
            </div>
            {topStudents.length ? (
              <div className="premium-records__podium">
                {topStudents.map((student) => (
                  <button
                    type="button"
                    className={`premium-records__podium-card rank-${student.rank}`}
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                  >
                    <span className="premium-records__podium-avatar">
                      <StudentAvatar
                        name={student.fullName}
                        src={student.passport}
                      />
                    </span>
                    <span className="premium-records__rank">
                      {student.rank === 1 ? (
                        <Medal size={14} aria-hidden="true" />
                      ) : (
                        `#${student.rank}`
                      )}
                    </span>
                    <strong>{student.fullName}</strong>
                    <span>{student.averagePercentage}% average</span>
                    <small>{student.assessmentCount} recorded results</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="premium-operations__empty">
                Rankings will appear after students submit platform exams or
                teachers record scores.
              </p>
            )}
          </section>

          <div className="premium-records__analysis-grid">
            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <BookOpen size={17} /> Subject performance
                  </h3>
                  <p>Weighted points across recorded scores and exams</p>
                </div>
              </div>
              {records.subjectPerformance.length ? (
                <div className="premium-records__analysis-list">
                  {records.subjectPerformance.map((subject) => (
                    <article key={subject.subjectId}>
                      <span>{subject.subject}</span>
                      <div
                        className="premium-records__bar"
                        role="img"
                        aria-label={`${subject.subject}: ${
                          subject.averagePercentage === null
                            ? "no scores recorded"
                            : `${subject.averagePercentage}%`
                        }`}
                      >
                        <span
                          style={{
                            width: `${subject.averagePercentage || 0}%`,
                          }}
                        />
                      </div>
                      <strong>
                        {subject.averagePercentage === null
                          ? "No scores"
                          : `${subject.averagePercentage}%`}
                      </strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  No subject scores recorded for this class.
                </p>
              )}
            </section>

            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <ChartNoAxesCombined size={17} /> Performance distribution
                  </h3>
                  <p>Students grouped by overall average</p>
                </div>
              </div>
              {records.metrics.assessedStudentCount ? (
                <div className="premium-records__distribution">
                  {records.performanceDistribution.map((bucket) => (
                    <div key={bucket.label}>
                      <span>{bucket.label}</span>
                      <div className="premium-records__bar">
                        <span
                          style={{
                            width: `${(bucket.count / distributionMax) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{bucket.count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  Distribution appears after assessment scores are recorded.
                </p>
              )}
            </section>

            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <TrendingUp size={17} /> Term trends
                  </h3>
                  <p>Mean student average and attendance by term</p>
                </div>
              </div>
              {records.termPerformance.some(
                (term) =>
                  term.averagePercentage !== null || term.attendance.marked > 0,
              ) ? (
                <div className="premium-records__trend-list">
                  {records.termPerformance.map((term) => (
                    <article key={term.termId}>
                      <strong>{term.termName}</strong>
                      <span>
                        Average{" "}
                        {term.averagePercentage === null
                          ? "—"
                          : `${term.averagePercentage}%`}
                      </span>
                      <span>
                        Attendance{" "}
                        {term.attendance.rate === null
                          ? "—"
                          : `${term.attendance.rate}%`}
                      </span>
                      <small>
                        {term.attendance.absent} absences ·{" "}
                        {term.attendance.late} late
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  No term performance or attendance has been recorded yet.
                </p>
              )}
            </section>

            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <CalendarDays size={17} /> Attendance analysis
                  </h3>
                  <p>Counts across saved session attendance marks</p>
                </div>
              </div>
              <div className="premium-records__attendance-summary">
                {[
                  ["Present", records.metrics.attendance.present],

                  ["Absent", records.metrics.attendance.absent],

                  ["Late", records.metrics.attendance.late],

                  ["Excused", records.metrics.attendance.excused],
                ].map(([label, count]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <CalendarDays size={17} /> Attendance by date
                  </h3>
                  <p>Saved attendance sessions in this academic year</p>
                </div>
              </div>
              {records.attendanceTrend.length ? (
                <div className="premium-records__trend-list">
                  {records.attendanceTrend.map((day) => (
                    <article key={day.sessionId}>
                      <strong>{formatRecordDate(day.date)}</strong>
                      <span>
                        {day.rate === null
                          ? "No marks"
                          : `${day.rate}% attended`}
                      </span>
                      <small>
                        {day.present} present · {day.absent} absent · {day.late}{" "}
                        late · {day.excused} excused
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  No attendance sessions are recorded for this class.
                </p>
              )}
            </section>
          </div>

          <section className="premium-records__section">
            <div className="premium-records__section-heading">
              <div>
                <h3>Academic Hub activity</h3>
                <p>
                  Most recent assignments and posts published for this class
                </p>
              </div>
              <BookOpen size={19} aria-hidden="true" />
            </div>
            {records.academicHubActivity.length ? (
              <div className="premium-records__trend-list">
                {records.academicHubActivity.map((activity) => (
                  <article key={activity.id}>
                    <strong>{activity.title}</strong>
                    <span>
                      {activity.type.replaceAll("_", " ")}
                      {activity.subject ? ` · ${activity.subject}` : ""}
                    </span>
                    <small>
                      Posted by {activity.author} ·{" "}
                      {formatRecordDate(activity.createdAt)}
                      {activity.deadline
                        ? ` · Due ${formatRecordDate(activity.deadline)}`
                        : ""}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="premium-operations__empty">
                No Academic Hub posts were published to this class.
              </p>
            )}
            <p className="premium-records__footnote">
              This list shows up to 100 recent class posts. Academic Hub does
              not currently store per-student assignment submissions or
              completion.
            </p>
          </section>

          <section className="premium-records__section">
            <div className="premium-records__section-heading">
              <div>
                <h3>Students in {schoolClass.name}</h3>
                <p>
                  {records.metrics.studentCount} historical session members ·
                  open a student to follow their academic journey
                </p>
              </div>
              <Users size={19} aria-hidden="true" />
            </div>
            {records.students.length ? (
              <div className="premium-records__table-wrap">
                <table className="premium-records__table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Student</th>
                      <th>Average</th>
                      <th>Attendance</th>
                      <th>Present / absent / late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.students.map((student) => (
                      <tr key={student.id}>
                        <td>
                          {student.rank ? (
                            <span
                              className={`premium-records__rank-badge ${
                                student.rank <= 3 ? "is-top" : ""
                              }`}
                            >
                              #{student.rank}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <th scope="row">
                          <button
                            type="button"
                            className="premium-records__student-cell"
                            onClick={() => onSelectStudent(student)}
                          >
                            <StudentAvatar
                              name={student.fullName}
                              src={student.passport}
                              className="is-small"
                            />
                            <span>
                              <strong>{student.fullName}</strong>
                              <small>ID {student.studentId}</small>
                            </span>
                          </button>
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
                        <td>
                          {student.attendance.present} /{" "}
                          {student.attendance.absent} /{" "}
                          {student.attendance.late}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="premium-operations__empty">
                No saved roster or historic student records are available for
                this class yet.
              </p>
            )}
          </section>
        </>
      ) : null}
    </RecordsShell>
  )
}

function StudentProfileView({ history, loading, error, onBack }) {
  const student = history?.student

  const sessions = history?.history || []

  const scoredTerms = sessions.flatMap((session) =>
    session.student.assessmentHistory.map((result) => ({
      ...result,

      sessionName: session.academicYear.name,

      className: session.schoolClass.name,

      startsOn: session.academicYear.startsOn,
    })),
  )

  const subjectStats = new Map()

  for (const result of scoredTerms) {
    const key = result.subject

    const current = subjectStats.get(key) || { earned: 0, possible: 0 }

    current.earned += result.score

    current.possible += result.maximumScore

    subjectStats.set(key, current)
  }

  const subjects = [...subjectStats.entries()]

    .map(([name, values]) => ({
      name,

      average: values.possible
        ? Math.round((values.earned / values.possible) * 1000) / 10
        : null,
    }))

    .sort((a, b) => b.average - a.average)

  const sessionTrendByYear = new Map()

  for (const session of sessions) {
    const yearId = session.academicYear.id

    if (!sessionTrendByYear.has(yearId)) {
      sessionTrendByYear.set(yearId, {
        academicYear: session.academicYear,

        classes: [],

        earned: 0,

        possible: 0,
      })
    }

    const entry = sessionTrendByYear.get(yearId)

    entry.classes.push(session.schoolClass.name)

    for (const result of session.student.assessmentHistory) {
      entry.earned += result.score

      entry.possible += result.maximumScore
    }
  }

  const sessionTrend = [...sessionTrendByYear.values()]

    .map((session) => ({
      ...session,

      average: session.possible
        ? Math.round((session.earned / session.possible) * 1000) / 10
        : null,
    }))

    .sort((a, b) =>
      a.academicYear.startsOn.localeCompare(b.academicYear.startsOn),
    )

  const scoredSessionAverages = sessionTrend.filter(
    (session) => session.average !== null,
  )

  const change =
    scoredSessionAverages.length > 1
      ? Math.round(
          (scoredSessionAverages.at(-1).average -
            scoredSessionAverages.at(-2).average) *
            10,
        ) / 10
      : null

  return (
    <RecordsShell
      breadcrumbs={[
        { label: "Academic records", onSelect: () => onBack("sessions") },

        { label: history?.selectedSessionName || "Academic journey" },

        { label: history?.selectedClassName || "Class analysis" },

        { label: student?.fullName || "Student profile" },
      ]}
      onNavigate={(index) =>
        index === 0
          ? onBack("sessions")
          : index === 1
            ? onBack("classes")
            : index === 2 && onBack("class")
      }
    >
      <ViewHeading
        eyebrow="STUDENT ACADEMIC PROFILE"
        title={student?.fullName || "Student profile"}
        description="Academic progress and attendance across recorded sessions."
      />
      <BackButton onClick={() => onBack("class")}>
        Return to class analysis
      </BackButton>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? (
        <LoadingState>Loading student’s academic journey…</LoadingState>
      ) : student ? (
        <>
          <section className="premium-records__section premium-records__profile">
            <StudentAvatar name={student.fullName} src={student.passport} />
            <div>
              <p>{student.designation || "Student"}</p>
              <h3>{student.fullName}</h3>
              <span>Student ID: {student.studentId}</span>
              {student.dateOfBirth && (
                <span>
                  Date of birth: {formatRecordDate(student.dateOfBirth)}
                </span>
              )}
              {student.phone && <span>Phone: {student.phone}</span>}
              <span>Status: {student.status}</span>
            </div>
          </section>

          <div className="premium-records__metrics">
            <Metric
              label="Recorded sessions"
              value={new Set(sessions.map((item) => item.academicYear.id)).size}
              detail={`${sessions.length} class-session memberships`}
            />
            <Metric
              label="Overall average"
              value={
                scoredTerms.length
                  ? `${
                      Math.round(
                        (scoredTerms.reduce(
                          (sum, item) => sum + item.score,
                          0,
                        ) /
                          scoredTerms.reduce(
                            (sum, item) => sum + item.maximumScore,

                            0,
                          )) *
                          1000,
                      ) / 10
                    }%`
                  : "—"
              }
              detail={`${scoredTerms.length} recorded assessment results`}
            />
            <Metric
              label="Recent session trend"
              value={
                change === null ? "—" : `${change > 0 ? "+" : ""}${change} pts`
              }
              detail={
                change === null
                  ? "Need results in two sessions to compare"
                  : change > 0
                    ? "Improved from prior recorded session"
                    : change < 0
                      ? "Lower than prior recorded session"
                      : "Same average as prior recorded session"
              }
            />
          </div>

          <section className="premium-records__section">
            <div className="premium-records__section-heading">
              <div>
                <h3>
                  <TrendingUp size={17} /> Academic journey
                </h3>
                <p>Class history, term results, and class position</p>
              </div>
            </div>
            {sessions.length ? (
              <div className="premium-records__journey">
                {sessions.map((session) => (
                  <article
                    className="premium-records__journey-session"
                    key={`${session.academicYear.id}-${session.schoolClass.id}`}
                  >
                    <div className="premium-records__journey-heading">
                      <span className="premium-records__journey-dot" />
                      <div>
                        <strong>{session.academicYear.name}</strong>
                        <span>{session.schoolClass.name}</span>
                      </div>
                      <b>
                        {session.student.averagePercentage === null
                          ? "No results"
                          : `${session.student.averagePercentage}%`}
                      </b>
                      <em>
                        {session.student.rank
                          ? `Position #${session.student.rank}`
                          : "Unranked"}
                      </em>
                    </div>
                    {session.student.assessmentHistory.length ? (
                      <div className="premium-records__term-results">
                        {groupBy(
                          session.student.assessmentHistory,

                          (result) => result.termName,
                        ).map(([termName, items]) => {
                          const earned = items.reduce(
                            (sum, item) => sum + item.score,

                            0,
                          )

                          const maximum = items.reduce(
                            (sum, item) => sum + item.maximumScore,

                            0,
                          )

                          const average = maximum
                            ? Math.round((earned / maximum) * 1000) / 10
                            : null

                          return (
                            <div key={termName}>
                              <strong>
                                {termName}
                                {average === null ? "" : ` · ${average}%`}
                              </strong>
                              {items.map((item, index) => (
                                <span key={`${item.assessmentId}-${index}`}>
                                  {item.subject}: {item.score}/
                                  {item.maximumScore}
                                  {item.source ? ` · ${item.source}` : ""}
                                  {item.dueOn
                                    ? ` · ${formatRecordDate(item.dueOn)}`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="premium-operations__empty">
                        No scores or exam results were recorded in this session.
                      </p>
                    )}
                    <div className="premium-records__history-attendance">
                      <span>
                        Attendance{" "}
                        {session.student.attendance.rate === null
                          ? "—"
                          : `${session.student.attendance.rate}%`}
                      </span>
                      <span>{session.student.attendance.present} present</span>
                      <span>{session.student.attendance.absent} absent</span>
                      <span>{session.student.attendance.late} late</span>
                    </div>
                    {session.student.attendanceHistory.length > 0 && (
                      <div className="premium-records__attendance-days">
                        {session.student.attendanceHistory.map(
                          (item, index) => (
                            <span key={`${item.date}-${index}`}>
                              {formatRecordDate(item.date)} · {item.status}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="premium-operations__empty">
                No historical class membership is available for this student.
              </p>
            )}
          </section>

          <div className="premium-records__analysis-grid">
            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <BookOpen size={17} /> Subject strengths
                  </h3>
                  <p>Weighted recorded scores across all sessions</p>
                </div>
              </div>
              {subjects.length ? (
                <div className="premium-records__analysis-list">
                  {subjects.map((subject) => (
                    <article key={subject.name}>
                      <span>{subject.name}</span>
                      <div className="premium-records__bar">
                        <span style={{ width: `${subject.average}%` }} />
                      </div>
                      <strong>{subject.average}%</strong>
                    </article>
                  ))}
                  {subjects.length > 1 && (
                    <p className="premium-records__footnote">
                      Strongest: {subjects[0].name} · Focus area:{" "}
                      {subjects.at(-1).name}
                    </p>
                  )}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  Subject comparisons appear after results are recorded.
                </p>
              )}
            </section>

            <section className="premium-records__section">
              <div className="premium-records__section-heading">
                <div>
                  <h3>
                    <CalendarDays size={17} /> Attendance journey
                  </h3>
                  <p>Recorded marks per academic session</p>
                </div>
              </div>
              {sessions.some((session) => session.student.attendance.marked) ? (
                <div className="premium-records__trend-list">
                  {sessions.map((session) => (
                    <article
                      key={`attendance-${session.academicYear.id}-${session.schoolClass.id}`}
                    >
                      <strong>{session.academicYear.name}</strong>
                      <span>{session.schoolClass.name}</span>
                      <span>
                        {session.student.attendance.rate === null
                          ? "—"
                          : `${session.student.attendance.rate}%`}
                      </span>
                      <small>
                        {session.student.attendance.present} present ·{" "}
                        {session.student.attendance.absent} absent ·{" "}
                        {session.student.attendance.late} late
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="premium-operations__empty">
                  No attendance records available across these sessions.
                </p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </RecordsShell>
  )
}

function groupBy(items, getKey) {
  const groups = new Map()

  for (const item of items) {
    const key = getKey(item)

    if (!groups.has(key)) groups.set(key, [])

    groups.get(key).push(item)
  }

  return [...groups.entries()]
}

export default function AcademicRecords({ onOpenSettings }) {
  const [setup, setSetup] = useState(null)

  const [setupLoading, setSetupLoading] = useState(true)

  const [setupError, setSetupError] = useState("")

  const [stack, setStack] = useState([{ type: "sessions" }])

  const [sessionRecords, setSessionRecords] = useState(null)

  const [classRecords, setClassRecords] = useState(null)

  const [studentHistory, setStudentHistory] = useState(null)

  const [loadingView, setLoadingView] = useState(false)

  const [error, setError] = useState("")

  const current = stack.at(-1)

  async function refreshSetup(showLoading = false) {
    if (showLoading) setSetupLoading(true)

    setSetupError("")

    try {
      setSetup(await getAcademicSetup())
    } catch (loadError) {
      setSetupError(loadError.message)
    } finally {
      setSetupLoading(false)
    }
  }

  useEffect(() => {
    void refreshSetup(true)
  }, [])

  useEffect(() => {
    if (current.type !== "classes") return undefined

    let active = true

    setLoadingView(true)

    setError("")

    getAcademicYearRecords(current.session.id)

      .then((result) => {
        if (active) setSessionRecords(result)
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoadingView(false)
      })

    return () => {
      active = false
    }
  }, [current])

  useEffect(() => {
    if (current.type !== "class") return undefined

    let active = true

    setLoadingView(true)

    setError("")

    getClassPerformance(current.schoolClass.id)

      .then((result) => {
        if (active) setClassRecords(result)
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoadingView(false)
      })

    return () => {
      active = false
    }
  }, [current])

  useEffect(() => {
    if (current.type !== "student") return undefined

    let active = true

    setLoadingView(true)

    setError("")

    getStudentAcademicHistory(current.student.id)

      .then((result) => {
        if (active) setStudentHistory(result)
      })

      .catch((loadError) => {
        if (active) setError(loadError.message)
      })

      .finally(() => {
        if (active) setLoadingView(false)
      })

    return () => {
      active = false
    }
  }, [current])

  function push(page) {
    setError("")
    setLoadingView(
      page.type === "classes" ||
        page.type === "class" ||
        page.type === "student",
    )
    if (page.type === "classes") setSessionRecords(null)
    if (page.type === "class") setClassRecords(null)
    if (page.type === "student") setStudentHistory(null)
    setStack((pages) => [...pages, page])
  }

  function backTo(index) {
    setError("")
    const destination = stack[index]
    setLoadingView(
      destination?.type === "classes" ||
        destination?.type === "class" ||
        destination?.type === "student",
    )
    setStack((pages) => pages.slice(0, index + 1))
  }

  if (setupLoading) return <LoadingState />

  if (!setup) {
    return (
      <RecordsShell>
        <ViewHeading
          eyebrow="PREMIUM · SCHOOL OPERATIONS"
          title="Academic records"
          description="Academic session and student records."
        />
        <ErrorMessage>
          {setupError || "Academic setup could not be loaded."}
        </ErrorMessage>
      </RecordsShell>
    )
  }

  if (current.type === "sessions") {
    return (
      <SessionSelectionView
        years={setup.academicYears}
        onSelect={(session) => push({ type: "classes", session })}
        onOpenSettings={onOpenSettings}
      />
    )
  }

  if (current.type === "classes") {
    return (
      <SessionClassesView
        session={current.session}
        records={sessionRecords}
        loading={loadingView}
        error={error}
        onBack={() => backTo(0)}
        onSelectClass={(schoolClass) =>
          push({ type: "class", session: current.session, schoolClass })
        }
      />
    )
  }

  if (current.type === "class") {
    return (
      <ClassAnalysisView
        session={current.session}
        schoolClass={current.schoolClass}
        records={classRecords}
        loading={loadingView}
        error={error}
        onBack={(destination) =>
          backTo(destination === "sessions" ? 0 : stack.length - 2)
        }
        onSelectStudent={(student) =>
          push({
            type: "student",

            session: current.session,

            schoolClass: current.schoolClass,

            student,
          })
        }
      />
    )
  }

  if (current.type === "student") {
    return (
      <StudentProfileView
        history={
          studentHistory
            ? {
                ...studentHistory,

                selectedSessionName: current.session.name,

                selectedClassName: current.schoolClass.name,
              }
            : null
        }
        loading={loadingView}
        error={error}
        onBack={(destination) =>
          backTo(
            destination === "sessions"
              ? 0
              : destination === "classes"
                ? 1
                : stack.length - 2,
          )
        }
      />
    )
  }

  return (
    <RecordsShell>
      <ViewHeading
        eyebrow="PREMIUM · SCHOOL OPERATIONS"
        title="Academic records"
      />
      <ErrorMessage>{setupError}</ErrorMessage>
      {onOpenSettings && (
        <button
          type="button"
          className="admin-primary-button"
          onClick={onOpenSettings}
        >
          Open Settings
        </button>
      )}
    </RecordsShell>
  )
}
