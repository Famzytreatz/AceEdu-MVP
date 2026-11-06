import { supabase } from "../supabase.js"
import {
  bestExamAttempts,
  rankStudents,
  summarizeAttendance,
} from "../academic-records.js"

async function findClassAndTerm(schoolId, classId, termId) {
  const [classResult, termResult] = await Promise.all([
    supabase

      .from("school_classes")

      .select("id,academic_year_id")

      .eq("school_id", schoolId)

      .eq("id", classId)

      .maybeSingle(),

    supabase

      .from("academic_terms")

      .select("id,academic_year_id,starts_on,ends_on")

      .eq("school_id", schoolId)

      .eq("id", termId)

      .maybeSingle(),
  ])

  if (classResult.error) throw classResult.error

  if (termResult.error) throw termResult.error

  if (
    !classResult.data ||
    !termResult.data ||
    String(classResult.data.academic_year_id) !==
      String(termResult.data.academic_year_id)
  ) {
    return null
  }

  return { schoolClass: classResult.data, term: termResult.data }
}

async function getActiveClassStudents(schoolId, classId) {
  const { data, error } = await supabase

    .from("enrollments")

    .select("id,full_name,designation")

    .eq("school_id", schoolId)

    .eq("class_id", classId)

    .eq("role", "student")

    .eq("status", "Active")

    .order("full_name")

    .limit(501)

  if (error) throw error

  if (data.length > 500) {
    throw new Error(
      "This class has more than 500 active students. Contact support to record attendance safely.",
    )
  }

  return data.map((row) => ({
    id: String(row.id),

    fullName: row.full_name,

    designation: row.designation,
  }))
}

export async function getAttendanceSession(schoolId, classId, date) {
  const { data: session, error: sessionError } = await supabase

    .from("attendance_sessions")

    .select("id,class_id,academic_term_id,session_date")

    .eq("school_id", schoolId)

    .eq("class_id", classId)

    .eq("session_date", date)

    .maybeSingle()

  if (sessionError) throw sessionError

  if (!session) return { session: null, entries: [] }

  const { data: records, error: recordsError } = await supabase

    .from("attendance_records")

    .select("student_id,status,note")

    .eq("school_id", schoolId)

    .eq("attendance_session_id", session.id)

  if (recordsError) throw recordsError

  return {
    session: {
      id: String(session.id),

      classId: String(session.class_id),

      termId: String(session.academic_term_id),

      date: session.session_date,
    },

    entries: records.map((record) => ({
      studentId: String(record.student_id),

      status: record.status,

      note: record.note,
    })),
  }
}

export async function saveAttendanceSession(
  schoolId,
  { classId, termId, date, entries },
) {
  const { data, error } = await supabase.rpc("save_school_attendance", {
    target_school_id: schoolId,

    target_class_id: classId,

    target_term_id: termId,

    target_date: date,

    attendance_entries: entries.map((entry) => ({
      student_id: entry.studentId,

      status: entry.status,

      note: entry.note,
    })),
  })

  if (error) {
    if (error.code === "P0002") return null

    throw error
  }

  return {
    sessionId: String(data.sessionId),

    savedCount: data.savedCount,
  }
}

export async function getClassAssessments(schoolId, classId, termId) {
  const context = await findClassAndTerm(schoolId, classId, termId)

  if (!context) return null

  const { data: assessments, error: assessmentsError } = await supabase

    .from("academic_assessments")

    .select(
      "id,class_id,subject_id,academic_term_id,title,assessment_type,maximum_score,due_on",
    )

    .eq("school_id", schoolId)

    .eq("class_id", classId)

    .eq("academic_term_id", termId)

    .order("created_at", { ascending: false })

  if (assessmentsError) throw assessmentsError

  if (!assessments.length)
    return {
      assessments: [],
      students: await getActiveClassStudents(schoolId, classId),
    }

  const assessmentIds = assessments.map((assessment) => assessment.id)

  const [subjectsResult, resultsResult, students] = await Promise.all([
    supabase

      .from("school_subjects")

      .select("id,name")

      .eq("school_id", schoolId)

      .in("id", [
        ...new Set(assessments.map((assessment) => assessment.subject_id)),
      ]),

    supabase

      .from("assessment_results")

      .select("assessment_id,student_id,score,feedback")

      .eq("school_id", schoolId)

      .in("assessment_id", assessmentIds),

    getActiveClassStudents(schoolId, classId),
  ])

  if (subjectsResult.error) throw subjectsResult.error

  if (resultsResult.error) throw resultsResult.error

  const subjectNames = new Map(
    subjectsResult.data.map((subject) => [String(subject.id), subject.name]),
  )

  const resultsByAssessment = new Map()

  for (const result of resultsResult.data) {
    const key = String(result.assessment_id)

    if (!resultsByAssessment.has(key)) resultsByAssessment.set(key, [])

    resultsByAssessment.get(key).push({
      studentId: String(result.student_id),

      score: Number(result.score),

      feedback: result.feedback,
    })
  }

  return {
    assessments: assessments.map((assessment) => ({
      id: String(assessment.id),

      classId: String(assessment.class_id),

      subjectId: String(assessment.subject_id),

      subjectName: subjectNames.get(String(assessment.subject_id)) || "Subject",

      termId: String(assessment.academic_term_id),

      title: assessment.title,

      type: assessment.assessment_type,

      maximumScore: Number(assessment.maximum_score),

      dueOn: assessment.due_on,

      results: resultsByAssessment.get(String(assessment.id)) || [],
    })),

    students,
  }
}

export async function createClassAssessment(schoolId, values) {
  const context = await findClassAndTerm(
    schoolId,
    values.classId,
    values.termId,
  )

  if (
    !context ||
    (values.dueOn &&
      (values.dueOn < context.term.starts_on ||
        values.dueOn > context.term.ends_on))
  ) {
    if (
      context &&
      values.dueOn &&
      (values.dueOn < context.term.starts_on ||
        values.dueOn > context.term.ends_on)
    ) {
      throw Object.assign(
        new Error(
          "Assessment due date must be within the selected academic term.",
        ),

        { code: "22023" },
      )
    }

    return null
  }

  const { data: subject, error: subjectError } = await supabase

    .from("school_subjects")

    .select("id")

    .eq("school_id", schoolId)

    .eq("class_id", values.classId)

    .eq("id", values.subjectId)

    .maybeSingle()

  if (subjectError) throw subjectError

  if (!subject) return null

  const { data, error } = await supabase

    .from("academic_assessments")

    .insert({
      school_id: schoolId,

      class_id: values.classId,

      subject_id: values.subjectId,

      academic_term_id: values.termId,

      title: values.title,

      assessment_type: values.type,

      maximum_score: values.maximumScore,

      due_on: values.dueOn,
    })

    .select(
      "id,class_id,subject_id,academic_term_id,title,assessment_type,maximum_score,due_on",
    )

    .single()

  if (error) throw error

  return {
    id: String(data.id),

    classId: String(data.class_id),

    subjectId: String(data.subject_id),

    termId: String(data.academic_term_id),

    title: data.title,

    type: data.assessment_type,

    maximumScore: Number(data.maximum_score),

    dueOn: data.due_on,
  }
}

export async function saveAssessmentResults(schoolId, assessmentId, results) {
  const { data, error } = await supabase.rpc("save_school_assessment_results", {
    target_school_id: schoolId,

    target_assessment_id: assessmentId,

    assessment_results: results.map((result) => ({
      student_id: result.studentId,

      score: result.score,

      feedback: result.feedback,
    })),
  })

  if (error) {
    if (error.code === "P0002") return null

    throw error
  }

  return { savedCount: data }
}

async function fetchAllRows(makeQuery) {
  const rows = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery()
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

async function getClassRecordData(
  schoolId,
  classId,
  { includeActivity = false } = {},
) {
  const { data: schoolClass, error: classError } = await supabase
    .from("school_classes")
    .select("id,academic_year_id,name")
    .eq("school_id", schoolId)
    .eq("id", classId)
    .maybeSingle()

  if (classError) throw classError
  if (!schoolClass) return null

  const [
    { data: year, error: yearError },
    { data: terms, error: termsError },
    { data: roster, error: rosterError },
  ] = await Promise.all([
    supabase
      .from("academic_years")
      .select("id,name,starts_on,ends_on,is_current")
      .eq("school_id", schoolId)
      .eq("id", schoolClass.academic_year_id)
      .maybeSingle(),
    supabase
      .from("academic_terms")
      .select("id,name,term_number,starts_on,ends_on")
      .eq("school_id", schoolId)
      .eq("academic_year_id", schoolClass.academic_year_id)
      .order("term_number"),
    supabase
      .from("school_class_students")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("class_id", classId),
  ])
  if (yearError) throw yearError
  if (termsError) throw termsError
  if (rosterError) throw rosterError
  if (!year) return null
  const classroomPosts = includeActivity
    ? await fetchAllRows(() =>
        supabase
          .from("school_classroom_posts")
          .select("id,author_id,subject_id,post_type,title,deadline,created_at")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      )
    : []

  const termIds = terms.map((term) => term.id)
  let assessments = []
  let sessions = []
  let portalExams = []
  if (termIds.length) {
    const [assessmentResult, sessionResult, portalExamResult] = await Promise.all([
      fetchAllRows(() =>
        supabase
          .from("academic_assessments")
          .select(
            "id,subject_id,academic_term_id,title,assessment_type,maximum_score,due_on",
          )
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .in("academic_term_id", termIds)
          .order("id"),
      ),
      fetchAllRows(() =>
        supabase
          .from("attendance_sessions")
          .select("id,academic_term_id,session_date")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .in("academic_term_id", termIds)
          .order("id"),
      ),
      fetchAllRows(() =>
        supabase
          .from("school_portal_exams")
          .select(
            "id,subject_id,academic_term_id,title,questions,created_at",
          )
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("is_published", true)
          .in("academic_term_id", termIds)
          .order("id"),
      ),
    ])
    assessments = assessmentResult
    sessions = sessionResult
    portalExams = portalExamResult
  }

  const assessmentIds = assessments.map((assessment) => assessment.id)
  const sessionIds = sessions.map((session) => session.id)
  const portalExamIds = portalExams.map((exam) => exam.id)
  const [results, attendanceRecords, portalAttempts] = await Promise.all([
    assessmentIds.length
      ? fetchAllRows(() =>
          supabase
            .from("assessment_results")
            .select("assessment_id,student_id,score")
            .eq("school_id", schoolId)
            .in("assessment_id", assessmentIds)
            .order("id"),
        )
      : [],
    sessionIds.length
      ? fetchAllRows(() =>
          supabase
            .from("attendance_records")
            .select("id,attendance_session_id,student_id,status,note")
            .eq("school_id", schoolId)
            .in("attendance_session_id", sessionIds)
            .order("id"),
        )
      : [],
    portalExamIds.length
        ? fetchAllRows(() =>
            supabase
              .from("school_portal_exam_attempts")
              .select("exam_id,student_id,score,status,end_time")
              .eq("school_id", schoolId)
              .eq("status", "submitted")
              .in("exam_id", portalExamIds)
              .order("id"),
          )
        : [],
  ])
  const portalResults = bestExamAttempts(portalExams, portalAttempts)

  const studentIds = [
    ...new Set([
      ...roster.map((item) => String(item.student_id)),
      ...results.map((item) => String(item.student_id)),
      ...portalResults.map((item) => item.studentId),
      ...attendanceRecords.map((item) => String(item.student_id)),
    ]),
  ]
  const authorIds = [
    ...new Set(classroomPosts.map((post) => String(post.author_id))),
  ]
  const [studentsResult, subjectsResult] = await Promise.all([
    studentIds.length
      ? supabase
          .from("enrollments")
          .select("id,full_name,designation,status,passport,dob,phone")
          .eq("school_id", schoolId)
          .eq("role", "student")
          .in("id", studentIds)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("school_subjects")
      .select("id,name")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .order("name"),
  ])
  if (studentsResult.error) throw studentsResult.error
  if (subjectsResult.error) throw subjectsResult.error
  const authorsResult = authorIds.length
    ? await supabase
        .from("enrollments")
        .select("id,full_name")
        .eq("school_id", schoolId)
        .in("id", authorIds)
    : { data: [], error: null }
  if (authorsResult.error) throw authorsResult.error

  const termById = new Map(terms.map((term) => [String(term.id), term]))
  const subjectById = new Map(
    subjectsResult.data.map((subject) => [String(subject.id), subject.name]),
  )
  const assessmentById = new Map(
    assessments.map((assessment) => [String(assessment.id), assessment]),
  )
  const sessionById = new Map(
    sessions.map((session) => [String(session.id), session]),
  )
  const authorById = new Map(
    authorsResult.data.map((author) => [
      String(author.id),
      author.full_name,
    ]),
  )
  const scoredRecords = results.flatMap((result) => {
    const assessment = assessmentById.get(String(result.assessment_id))
    if (!assessment) return []
    return [
      {
        assessmentId: String(assessment.id),
        studentId: String(result.student_id),
        title: assessment.title,
        type: assessment.assessment_type,
        source: "Teacher-recorded",
        subjectId: String(assessment.subject_id),
        termId: String(assessment.academic_term_id),
        maximumScore: Number(assessment.maximum_score),
        score: Number(result.score),
        dueOn: assessment.due_on,
      },
    ]
  })
  for (const result of portalResults) {
    const exam = portalExams.find(
      (item) => String(item.id) === result.examId,
    )
    if (!exam) continue
    scoredRecords.push({
      assessmentId: `portal-${result.examId}`,
      studentId: result.studentId,
      title: exam.title,
      type: "exam",
      source: "Student platform exam",
      subjectId: exam.subject_id ? String(exam.subject_id) : null,
      termId: String(exam.academic_term_id),
      maximumScore: result.maximumScore,
      score: result.score,
      dueOn: result.submittedAt?.slice(0, 10) || exam.created_at.slice(0, 10),
    })
  }
  const resultsByStudent = new Map()
  for (const result of scoredRecords) {
    const key = result.studentId
    if (!resultsByStudent.has(key)) resultsByStudent.set(key, [])
    resultsByStudent.get(key).push({
      assessmentId: result.assessmentId,
      title: result.title,
      type: result.type,
      source: result.source,
      subject:
        subjectById.get(String(result.subjectId)) || "Subject",
      termId: result.termId,
      termName: termById.get(result.termId)?.name || "Term",
      termNumber: termById.get(result.termId)?.term_number || 0,
      maximumScore: result.maximumScore,
      score: result.score,
      dueOn: result.dueOn,
    })
  }
  const attendanceByStudent = new Map()
  for (const record of attendanceRecords) {
    const key = String(record.student_id)
    if (!attendanceByStudent.has(key)) attendanceByStudent.set(key, [])
    const session = sessionById.get(String(record.attendance_session_id))
    if (!session) continue
    attendanceByStudent.get(key).push({
      date: session.session_date,
      termId: String(session.academic_term_id),
      termName:
        termById.get(String(session.academic_term_id))?.name || "Term",
      termNumber:
        termById.get(String(session.academic_term_id))?.term_number || 0,
      status: record.status,
      note: record.note,
    })
  }

  const studentSummaries = studentsResult.data.map((student) => {
    const id = String(student.id)
    const studentResults = (resultsByStudent.get(id) || []).sort(
      (a, b) =>
        a.termNumber - b.termNumber ||
        String(a.dueOn || "").localeCompare(String(b.dueOn || "")),
    )
    const studentAttendance = attendanceByStudent.get(id) || []
    const earned = studentResults.reduce((sum, item) => sum + item.score, 0)
    const possible = studentResults.reduce(
      (sum, item) => sum + item.maximumScore,
      0,
    )
    return {
      id,
      fullName: student.full_name,
      designation: student.designation,
      status: student.status,
      passport: student.passport,
      dateOfBirth: student.dob,
      studentId: id,
      assessmentCount: studentResults.length,
      averagePercentage: possible
        ? Math.round((earned / possible) * 1000) / 10
        : null,
      rankingPercentage: possible
        ? Math.round((earned / possible) * 100000000) / 1000000
        : null,
      attendance: summarizeAttendance(studentAttendance),
      assessmentHistory: studentResults,
      attendanceHistory: studentAttendance.sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }
  })

  rankStudents(studentSummaries)

  const classResults = studentSummaries.filter(
    (student) => student.averagePercentage !== null,
  )
  const subjectStats = new Map(
    subjectsResult.data.map((subject) => [
      String(subject.id),
      {
        subjectId: String(subject.id),
        subject: subject.name,
        earned: 0,
        possible: 0,
        resultCount: 0,
      },
    ]),
  )
  const termStats = new Map()
  const distribution = [
    { label: "Below 50%", min: 0, max: 50, count: 0 },
    { label: "50–64%", min: 50, max: 65, count: 0 },
    { label: "65–79%", min: 65, max: 80, count: 0 },
    { label: "80% and above", min: 80, max: 101, count: 0 },
  ]
  for (const result of scoredRecords) {
    if (result.subjectId) {
      const subjectId = String(result.subjectId)
      if (!subjectStats.has(subjectId)) {
        subjectStats.set(subjectId, {
          subjectId,
          subject: subjectById.get(subjectId) || "Subject",
          earned: 0,
          possible: 0,
          resultCount: 0,
        })
      }
      const subject = subjectStats.get(subjectId)
      subject.earned += result.score
      subject.possible += result.maximumScore
      subject.resultCount += 1
    }

    const termId = result.termId
    if (!termStats.has(termId)) {
      termStats.set(termId, {
        termId,
        termName: termById.get(termId)?.name || "Term",
        termNumber: termById.get(termId)?.term_number || 0,
        earned: 0,
        possible: 0,
        resultCount: 0,
        students: new Map(),
      })
    }
    const term = termStats.get(termId)
    term.earned += result.score
    term.possible += result.maximumScore
    term.resultCount += 1
    const studentId = result.studentId
    if (!term.students.has(studentId)) term.students.set(studentId, { earned: 0, possible: 0 })
    const studentTerm = term.students.get(studentId)
    studentTerm.earned += result.score
    studentTerm.possible += result.maximumScore
  }
  for (const student of classResults) {
    const bucket = distribution.find(
      (item) =>
        student.averagePercentage >= item.min &&
        student.averagePercentage < item.max,
    )
    if (bucket) bucket.count += 1
  }
  const subjectPerformance = [...subjectStats.values()]
    .map((item) => ({
      subjectId: item.subjectId,
      subject: item.subject,
      resultCount: item.resultCount,
      averagePercentage: item.possible
        ? Math.round((item.earned / item.possible) * 1000) / 10
        : null,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject))
  const termPerformance = terms.map((term) => {
    const stats = termStats.get(String(term.id))
    const studentAverages = stats
      ? [...stats.students.values()]
          .filter((student) => student.possible)
          .map((student) => (student.earned / student.possible) * 100)
      : []
    return {
      termId: String(term.id),
      termName: term.name,
      averagePercentage: studentAverages.length
        ? Math.round(
            (studentAverages.reduce((sum, average) => sum + average, 0) /
              studentAverages.length) *
              10,
          ) / 10
        : null,
      resultCount: stats?.resultCount || 0,
      attendance: summarizeAttendance(
        attendanceRecords
          .filter(
            (record) =>
              String(
                sessionById.get(String(record.attendance_session_id))
                  ?.academic_term_id,
              ) === String(term.id),
          )
          .map((record) => ({ status: record.status })),
      ),
    }
  })
  const sortedByAverage = [...classResults].sort(
    (a, b) => a.averagePercentage - b.averagePercentage,
  )
  const attendanceBySession = new Map(
    sessions.map((session) => [
      String(session.id),
      {
        sessionId: String(session.id),
        date: session.session_date,
        ...summarizeAttendance([]),
      },
    ]),
  )
  for (const record of attendanceRecords) {
    const item = attendanceBySession.get(String(record.attendance_session_id))
    if (!item) continue
    item[record.status] += 1
  }
  const attendanceTrend = [...attendanceBySession.values()]
    .map((item) => {
      const marked = item.present + item.absent + item.late
      return {
        ...item,
        marked,
        rate: marked
          ? Math.round(((item.present + item.late) / marked) * 1000) / 10
          : null,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  const attendanceTotals = summarizeAttendance(
    attendanceRecords.map((record) => ({ status: record.status })),
  )
  return {
    schoolClass: {
      id: String(schoolClass.id),
      name: schoolClass.name,
      academicYearId: String(schoolClass.academic_year_id),
    },
    academicYear: {
      id: String(year.id),
      name: year.name,
      startsOn: year.starts_on,
      endsOn: year.ends_on,
      isCurrent: year.is_current,
    },
    terms: terms.map((term) => ({
      id: String(term.id),
      name: term.name,
      startsOn: term.starts_on,
      endsOn: term.ends_on,
    })),
    students: studentSummaries,
    metrics: {
      studentCount: studentSummaries.length,
      assessedStudentCount: classResults.length,
      classAverage: classResults.length
        ? Math.round(
            (classResults.reduce(
              (sum, student) => sum + student.averagePercentage,
              0,
            ) /
              classResults.length) *
              10,
          ) / 10
        : null,
      highestAverage: sortedByAverage.at(-1)?.averagePercentage ?? null,
      highestStudent: sortedByAverage.at(-1)?.fullName || null,
      lowestAverage: sortedByAverage[0]?.averagePercentage ?? null,
      lowestStudent: sortedByAverage[0]?.fullName || null,
      assessmentCount: scoredRecords.length,
      academicHubActivityCount: includeActivity ? classroomPosts.length : null,
      attendance: attendanceTotals,
    },
    academicHubActivity: classroomPosts.slice(0, 100).map((post) => ({
      id: String(post.id),
      type: post.post_type,
      title: post.title,
      subject: post.subject_id
        ? subjectById.get(String(post.subject_id)) || null
        : null,
      author: authorById.get(String(post.author_id)) || "School staff",
      deadline: post.deadline,
      createdAt: post.created_at,
    })),
    subjectPerformance,
    termPerformance,
    attendanceTrend,
    performanceDistribution: distribution.map(
      ({ label, count }) => ({ label, count }),
    ),
  }
}

export async function getClassPerformance(schoolId, classId) {
  return getClassRecordData(schoolId, classId, { includeActivity: true })
}

export async function getAcademicYearPerformance(schoolId, academicYearId) {
  const [{ data: year, error: yearError }, { data: classes, error: classesError }] =
    await Promise.all([
      supabase
        .from("academic_years")
        .select("id,name,starts_on,ends_on,is_current")
        .eq("school_id", schoolId)
        .eq("id", academicYearId)
        .maybeSingle(),
      supabase
        .from("school_classes")
        .select("id,name,academic_year_id")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .order("name"),
    ])
  if (yearError) throw yearError
  if (classesError) throw classesError
  if (!year) return null

  const classRecords = await Promise.all(
    classes.map((schoolClass) => getClassRecordData(schoolId, schoolClass.id)),
  )
  return {
    academicYear: {
      id: String(year.id),
      name: year.name,
      startsOn: year.starts_on,
      endsOn: year.ends_on,
      isCurrent: year.is_current,
    },
    classes: classRecords.map((records) => ({
      schoolClass: records.schoolClass,
      metrics: records.metrics,
    })),
  }
}

export async function getClassStudentRecords(schoolId, classId, studentId) {
  const records = await getClassRecordData(schoolId, classId)
  if (!records) return null
  const student = records.students.find((item) => item.id === studentId)
  return student
    ? {
        schoolClass: records.schoolClass,
        academicYear: records.academicYear,
        student,
      }
    : null
}

export async function getStudentAcademicHistory(schoolId, studentId) {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id,full_name,designation,status,passport,dob,phone")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle()
  if (enrollmentError) throw enrollmentError
  if (!enrollment) return null

  const { data: memberships, error: membershipsError } = await supabase
    .from("school_class_students")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
  if (membershipsError) throw membershipsError

  const classIds = [...new Set(memberships.map((item) => String(item.class_id)))]
  const classRecords = await Promise.all(
    classIds.map((classId) => getClassRecordData(schoolId, classId)),
  )
  const history = classRecords
    .filter(Boolean)
    .map((records) => {
      const student = records.students.find(
        (item) => item.id === String(studentId),
      )
      if (!student) return null
      return {
        academicYear: records.academicYear,
        schoolClass: records.schoolClass,
        student,
      }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.academicYear.startsOn.localeCompare(b.academicYear.startsOn) ||
        a.schoolClass.name.localeCompare(b.schoolClass.name),
    )

  return {
    student: {
      id: String(enrollment.id),
      studentId: String(enrollment.id),
      fullName: enrollment.full_name,
      designation: enrollment.designation,
      status: enrollment.status,
      passport: enrollment.passport,
      dateOfBirth: enrollment.dob,
      phone: enrollment.phone,
    },
    history,
  }
}
