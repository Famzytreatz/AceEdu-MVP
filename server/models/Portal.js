import { supabase } from "../supabase.js"
import { getStudentSubjectChoices } from "./Curriculum.js"

const memberColumns =
  "id,school_id,full_name,role,designation,passport,access_pin,status,password_hash,class_id,class_level_id,assigned_classes,subjects"

function mapSubject(row) {
  return {
    id: String(row.id),

    name: row.name,

    classId: String(row.class_id),
  }
}

function mapTerm(row) {
  return {
    id: String(row.id),

    name: row.name,

    academicYearId: String(row.academic_year_id),

    startsOn: row.starts_on,

    endsOn: row.ends_on,
  }
}

export async function findPortalEnrollmentByCredentials(
  schoolId,
  accessPin,
) {
  const { data, error } = await supabase

    .from("enrollments")

    .select(memberColumns)

    .eq("school_id", schoolId)

    .eq("access_pin", accessPin)

    .in("role", ["student", "teacher"])

    .eq("status", "Active")

    .maybeSingle()

  if (error) throw error

  return data
}

export async function findActivePortalEnrollmentById(schoolId, memberId) {
  const { data, error } = await supabase

    .from("enrollments")

    .select(memberColumns)

    .eq("school_id", schoolId)

    .eq("id", memberId)

    .eq("status", "Active")

    .maybeSingle()

  if (error) throw error

  return data
}

export async function updatePortalPassword(
  schoolId,
  memberId,
  role,
  passwordHash,
) {
  const { data, error } = await supabase
    .from("enrollments")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId)
    .eq("id", memberId)
    .eq("role", role)
    .eq("status", "Active")
    .select("id")
    .maybeSingle()

  if (error) throw error

  return data !== null
}

export async function getStudentPortalDashboard(schoolId, studentId) {
  const { data: student, error: studentError } = await supabase

    .from("enrollments")

    .select("id,full_name,designation,passport,class_id,class_level_id")

    .eq("school_id", schoolId)

    .eq("id", studentId)

    .eq("role", "student")

    .eq("status", "Active")

    .maybeSingle()

  if (studentError) throw studentError

  if (!student) return null

  const [classLevelResult, subjectChoices] = await Promise.all([
    student.class_level_id
      ? supabase
          .from("school_class_levels")
          .select("id,name,nickname")
          .eq("school_id", schoolId)
          .eq("id", student.class_level_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getStudentSubjectChoices(schoolId, studentId),
  ])
  if (classLevelResult.error) throw classLevelResult.error

  if (!student.class_id) {
    return {
      profile: {
        fullName: student.full_name,
        designation: student.designation,
        passport: student.passport,
      },

      schoolClass: classLevelResult.data
        ? {
            id: String(classLevelResult.data.id),
            name:
              classLevelResult.data.nickname ||
              classLevelResult.data.name,
            academicYear: null,
          }
        : null,

      subjects: subjectChoices.approvedSubjects,

      attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },

      assessments: [],
    }
  }

  const [classResult, subjectsResult, sessionsResult, assessmentsResult] =
    await Promise.all([
      supabase

        .from("school_classes")

        .select("id,name,academic_year_id")

        .eq("school_id", schoolId)

        .eq("id", student.class_id)

        .maybeSingle(),

      supabase

        .from("school_subjects")

        .select("id,class_id,name")

        .eq("school_id", schoolId)

        .eq("class_id", student.class_id)

        .order("name"),

      supabase

        .from("attendance_sessions")

        .select("id,session_date")

        .eq("school_id", schoolId)

        .eq("class_id", student.class_id)

        .order("session_date", { ascending: false })

        .limit(180),

      supabase

        .from("academic_assessments")

        .select(
          "id,class_id,subject_id,title,assessment_type,maximum_score,due_on",
        )

        .eq("school_id", schoolId)

        .eq("class_id", student.class_id)

        .eq("is_published", true)

        .order("created_at", { ascending: false })

        .limit(200),
    ])

  for (const result of [
    classResult,
    subjectsResult,
    sessionsResult,
    assessmentsResult,
  ]) {
    if (result.error) throw result.error
  }

  const approvedSubjects = [
    ...subjectsResult.data.map((subject) => mapSubject(subject)),
    ...subjectChoices.approvedSubjects,
  ]
  const uniqueSubjects = [
    ...new Map(approvedSubjects.map((subject) => [subject.id, subject])).values(),
  ]

  const sessionIds = sessionsResult.data.map((session) => session.id)

  const assessmentIds = assessmentsResult.data.map(
    (assessment) => assessment.id,
  )

  const [attendanceResult, resultsResult, yearResult] = await Promise.all([
    sessionIds.length
      ? supabase

          .from("attendance_records")

          .select("attendance_session_id,status")

          .eq("school_id", schoolId)

          .eq("student_id", studentId)

          .in("attendance_session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),

    assessmentIds.length
      ? supabase

          .from("assessment_results")

          .select("assessment_id,score,feedback")

          .eq("school_id", schoolId)

          .eq("student_id", studentId)

          .in("assessment_id", assessmentIds)
      : Promise.resolve({ data: [], error: null }),

    classResult.data
      ? supabase

          .from("academic_years")

          .select("name")

          .eq("school_id", schoolId)

          .eq("id", classResult.data.academic_year_id)

          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  for (const result of [attendanceResult, resultsResult, yearResult]) {
    if (result.error) throw result.error
  }

  const subjectNames = new Map(
    subjectsResult.data.map((subject) => [String(subject.id), subject.name]),
  )

  const studentResults = new Map(
    resultsResult.data.map((result) => [String(result.assessment_id), result]),
  )

  const attendance = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }

  for (const record of attendanceResult.data) {
    attendance[record.status] += 1

    attendance.total += 1
  }

  return {
    profile: {
      fullName: student.full_name,
      designation: student.designation,
      passport: student.passport,
    },

    schoolClass: classResult.data
      ? {
          id: String(classResult.data.id),
          name:
            classLevelResult.data?.nickname ||
            classLevelResult.data?.name ||
            classResult.data.name,
          academicYear: yearResult.data?.name || null,
        }
      : null,

    subjects: uniqueSubjects,

    attendance,

    assessments: assessmentsResult.data.map((assessment) => {
      const result = studentResults.get(String(assessment.id))

      return {
        id: String(assessment.id),

        title: assessment.title,

        type: assessment.assessment_type,

        subject: subjectNames.get(String(assessment.subject_id)) || "Subject",

        maximumScore: Number(assessment.maximum_score),

        dueOn: assessment.due_on,

        score: result ? Number(result.score) : null,

        feedback: result?.feedback || null,
      }
    }),
  }
}

export async function getTeacherPortalDashboard(schoolId, teacherId) {
  const [teacherResult, classesResult, assignedSubjectsResult] =
    await Promise.all([
      supabase

        .from("enrollments")

        .select("id,full_name,designation,passport")

        .eq("school_id", schoolId)

        .eq("id", teacherId)

        .eq("role", "teacher")

        .eq("status", "Active")

        .maybeSingle(),

      supabase

        .from("school_classes")

        .select("id,name,academic_year_id")

        .eq("school_id", schoolId)

        .eq("class_teacher_id", teacherId)

        .order("name"),

      supabase

        .from("school_subjects")

        .select("id,class_id,name")

        .eq("school_id", schoolId)

        .eq("teacher_id", teacherId)

        .order("name"),
    ])

  for (const result of [teacherResult, classesResult, assignedSubjectsResult]) {
    if (result.error) throw result.error
  }

  if (!teacherResult.data) return null

  const classIds = [
    ...new Set([
      ...classesResult.data.map((item) => String(item.id)),

      ...assignedSubjectsResult.data.map((item) => String(item.class_id)),
    ]),
  ]

  if (!classIds.length) {
    return {
      profile: {
        fullName: teacherResult.data.full_name,
        designation: teacherResult.data.designation,
        passport: teacherResult.data.passport,
      },

      classes: [],
    }
  }

  const [classResult, studentsResult, subjectsResult] = await Promise.all([
    supabase

      .from("school_classes")

      .select("id,name,academic_year_id")

      .eq("school_id", schoolId)

      .in("id", classIds)

      .order("name"),

    supabase

      .from("enrollments")

      .select("id,full_name,designation,class_id")

      .eq("school_id", schoolId)

      .eq("role", "student")

      .eq("status", "Active")
      .in("class_id", classIds)
      .order("full_name")
      .limit(501),

    supabase

      .from("school_subjects")

      .select("id,class_id,name,teacher_id")

      .eq("school_id", schoolId)

      .in("class_id", classIds)

      .order("name"),
  ])

  for (const result of [classResult, studentsResult, subjectsResult]) {
    if (result.error) throw result.error
  }

  if (studentsResult.data.length > 500) {
    throw new Error(
      "An assigned class exceeds the 500-student safe roster limit. Contact your school administrator.",
    )
  }

  const yearIds = [
    ...new Set(classResult.data.map((item) => String(item.academic_year_id))),
  ]

  const [yearsResult, termsResult] = yearIds.length
    ? await Promise.all([
        supabase

          .from("academic_years")

          .select("id,name")

          .eq("school_id", schoolId)

          .in("id", yearIds),

        supabase

          .from("academic_terms")

          .select("id,name,academic_year_id,starts_on,ends_on")

          .eq("school_id", schoolId)

          .in("academic_year_id", yearIds)

          .order("term_number"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ]

  if (yearsResult.error) throw yearsResult.error

  if (termsResult.error) throw termsResult.error

  const teacherLedClassIds = new Set(
    classesResult.data.map((item) => String(item.id)),
  )

  const yearNames = new Map(
    yearsResult.data.map((year) => [String(year.id), year.name]),
  )

  const termsByYear = new Map()

  for (const term of termsResult.data) {
    const yearId = String(term.academic_year_id)

    if (!termsByYear.has(yearId)) termsByYear.set(yearId, [])

    termsByYear.get(yearId).push(mapTerm(term))
  }

  const assignedSubjectsByClass = new Map()

  for (const subject of subjectsResult.data) {
    const classId = String(subject.class_id)

    if (
      !teacherLedClassIds.has(classId) &&
      String(subject.teacher_id) !== String(teacherId)
    )
      continue

    if (!assignedSubjectsByClass.has(classId))
      assignedSubjectsByClass.set(classId, [])

    assignedSubjectsByClass.get(classId).push(mapSubject(subject))
  }

  const studentsByClass = new Map()

  for (const student of studentsResult.data) {
    const classId = String(student.class_id)

    if (!studentsByClass.has(classId)) studentsByClass.set(classId, [])

    studentsByClass.get(classId).push({
      id: String(student.id),

      fullName: student.full_name,

      designation: student.designation,
    })
  }

  return {
    profile: {
      fullName: teacherResult.data.full_name,
      designation: teacherResult.data.designation,
      passport: teacherResult.data.passport,
    },

    classes: classResult.data.map((schoolClass) => ({
      id: String(schoolClass.id),

      name: schoolClass.name,

      academicYear: yearNames.get(String(schoolClass.academic_year_id)) || null,

      academicYearId: String(schoolClass.academic_year_id),

      terms: termsByYear.get(String(schoolClass.academic_year_id)) || [],

      students: studentsByClass.get(String(schoolClass.id)) || [],

      subjects: assignedSubjectsByClass.get(String(schoolClass.id)) || [],
    })),
  }
}

export async function teacherCanAccessClass(schoolId, teacherId, classId) {
  const [classResult, subjectResult] = await Promise.all([
    supabase

      .from("school_classes")

      .select("id")

      .eq("school_id", schoolId)

      .eq("id", classId)

      .eq("class_teacher_id", teacherId)

      .maybeSingle(),

    supabase

      .from("school_subjects")

      .select("id")

      .eq("school_id", schoolId)

      .eq("class_id", classId)

      .eq("teacher_id", teacherId)

      .limit(1),
  ])

  if (classResult.error) throw classResult.error

  if (subjectResult.error) throw subjectResult.error

  return Boolean(classResult.data || subjectResult.data.length)
}
