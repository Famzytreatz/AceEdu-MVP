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
