import { supabase } from "../supabase.js"

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

function summarizeAttendance(records) {
  const totals = { present: 0, absent: 0, late: 0, excused: 0 }
  for (const record of records) totals[record.status] += 1
  const marked = totals.present + totals.absent + totals.late
  return {
    ...totals,
    marked,
    rate: marked
      ? Math.round(((totals.present + totals.late) / marked) * 1000) / 10
      : null,
  }
}

async function getClassRecordData(schoolId, classId) {
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

  const termIds = terms.map((term) => term.id)
  let assessments = []
  let sessions = []
  if (termIds.length) {
    const [assessmentResult, sessionResult] = await Promise.all([
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
    ])
    assessments = assessmentResult
    sessions = sessionResult
  }

  const assessmentIds = assessments.map((assessment) => assessment.id)
  const sessionIds = sessions.map((session) => session.id)
  const [results, attendanceRecords] = await Promise.all([
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
  ])

  const studentIds = [
    ...new Set([
      ...roster.map((item) => String(item.student_id)),
      ...results.map((item) => String(item.student_id)),
      ...attendanceRecords.map((item) => String(item.student_id)),
    ]),
  ]
  const [studentsResult, subjectsResult] = await Promise.all([
    studentIds.length
      ? supabase
          .from("enrollments")
          .select("id,full_name,designation,status")
          .eq("school_id", schoolId)
          .eq("role", "student")
          .in("id", studentIds)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
    assessments.length
      ? supabase
          .from("school_subjects")
          .select("id,name")
          .eq("school_id", schoolId)
          .in(
            "id",
            [...new Set(assessments.map((assessment) => assessment.subject_id))],
          )
      : Promise.resolve({ data: [], error: null }),
  ])
  if (studentsResult.error) throw studentsResult.error
  if (subjectsResult.error) throw subjectsResult.error

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
  const resultsByStudent = new Map()
  for (const result of results) {
    const key = String(result.student_id)
    if (!resultsByStudent.has(key)) resultsByStudent.set(key, [])
    const assessment = assessmentById.get(String(result.assessment_id))
    if (!assessment) continue
    resultsByStudent.get(key).push({
      assessmentId: String(assessment.id),
      title: assessment.title,
      type: assessment.assessment_type,
      subject: subjectById.get(String(assessment.subject_id)) || "Subject",
      termId: String(assessment.academic_term_id),
      termName:
        termById.get(String(assessment.academic_term_id))?.name || "Term",
      termNumber:
        termById.get(String(assessment.academic_term_id))?.term_number || 0,
      maximumScore: Number(assessment.maximum_score),
      score: Number(result.score),
      dueOn: assessment.due_on,
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
      assessmentCount: studentResults.length,
      averagePercentage: possible
        ? Math.round((earned / possible) * 1000) / 10
        : null,
      attendance: summarizeAttendance(studentAttendance),
      assessmentHistory: studentResults,
      attendanceHistory: studentAttendance.sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }
  })

  const rankedStudents = studentSummaries
    .filter((student) => student.averagePercentage !== null)
    .sort(
      (a, b) =>
        b.averagePercentage - a.averagePercentage ||
        a.fullName.localeCompare(b.fullName),
    )
  let previousAverage = null
  let previousRank = 0
  for (let index = 0; index < rankedStudents.length; index += 1) {
    const student = rankedStudents[index]
    if (student.averagePercentage !== previousAverage) {
      previousRank = index + 1
      previousAverage = student.averagePercentage
    }
    student.rank = previousRank
  }
  studentSummaries.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank || a.fullName.localeCompare(b.fullName)
    if (a.rank) return -1
    if (b.rank) return 1
    return a.fullName.localeCompare(b.fullName)
  })

  const classResults = studentSummaries.filter(
    (student) => student.averagePercentage !== null,
  )
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
      assessmentCount: assessments.length,
      attendance: attendanceTotals,
    },
  }
}

export async function getClassPerformance(schoolId, classId) {
  return getClassRecordData(schoolId, classId)
}

export async function getClassStudentRecords(schoolId, classId, studentId) {
  const records = await getClassRecordData(schoolId, classId)
  if (!records) return null
  const student = records.students.find((item) => item.id === studentId)
  return student ? { schoolClass: records.schoolClass, academicYear: records.academicYear, student } : null
}
