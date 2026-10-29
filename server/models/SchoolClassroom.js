import { randomUUID } from "node:crypto"

import { supabase } from "../supabase.js"

import { teacherCanAccessClass } from "./Portal.js"

const attachmentBucket = "school-classroom-files"

function mapQuestion(question, includeCorrectAnswer = false) {
  return {
    questionText: question.questionText,

    options: question.options,

    ...(includeCorrectAnswer
      ? { correctAnswerIndex: question.correctAnswerIndex }
      : {}),
  }
}

function mapExam(row, includeCorrectAnswers = false) {
  return {
    id: String(row.id),

    classId: String(row.class_id),

    subjectId: row.subject_id ? String(row.subject_id) : null,

    termId: String(row.academic_term_id),

    title: row.title,

    questions: row.questions.map((question) =>
      mapQuestion(question, includeCorrectAnswers),
    ),

    durationMinutes: row.duration_minutes,

    attemptsAllowed: row.attempts_allowed,

    createdAt: row.created_at,

    expiresAt: row.expires_at,

    ...(row.className ? { className: row.className } : {}),

    ...(row.subjectName ? { subjectName: row.subjectName } : {}),
  }
}

async function getClassForMember(schoolId, memberId, role, classId) {
  if (role === "student") {
    const { data: student, error: studentError } = await supabase

      .from("enrollments")

      .select("id,class_id")

      .eq("school_id", schoolId)

      .eq("id", memberId)

      .eq("role", "student")

      .eq("status", "Active")

      .maybeSingle()

    if (studentError) throw studentError

    if (
      !student?.class_id ||
      (classId && String(student.class_id) !== String(classId))
    )
      return null

    classId = String(student.class_id)
  } else if (!(await teacherCanAccessClass(schoolId, memberId, classId))) {
    return null
  }

  const { data, error } = await supabase

    .from("school_classes")

    .select("id,name,academic_year_id,class_teacher_id")

    .eq("school_id", schoolId)

    .eq("id", classId)

    .maybeSingle()

  if (error) throw error

  return data
}

async function getRoster(schoolId, classId) {
  const [studentsResult, classResult, subjectsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id,full_name,designation")

      .eq("school_id", schoolId)

      .eq("class_id", classId)

      .eq("role", "student")

      .eq("status", "Active")

      .order("full_name")

      .limit(501),

    supabase

      .from("school_classes")

      .select("class_teacher_id")

      .eq("school_id", schoolId)

      .eq("id", classId)

      .maybeSingle(),

    supabase

      .from("school_subjects")

      .select("id,name,teacher_id")

      .eq("school_id", schoolId)

      .eq("class_id", classId)

      .order("name"),
  ])

  for (const result of [studentsResult, classResult, subjectsResult]) {
    if (result.error) throw result.error
  }

  if (studentsResult.data.length > 500) {
    throw new Error("This class exceeds the 500-student safe roster limit.")
  }

  const teacherIds = [
    ...new Set([
      ...(classResult.data?.class_teacher_id
        ? [String(classResult.data.class_teacher_id)]
        : []),

      ...subjectsResult.data
        .map((subject) => subject.teacher_id && String(subject.teacher_id))
        .filter(Boolean),
    ]),
  ]

  const teachersResult = teacherIds.length
    ? await supabase

        .from("enrollments")
        .select("id,full_name,designation")

        .eq("school_id", schoolId)

        .eq("role", "teacher")

        .eq("status", "Active")

        .in("id", teacherIds)

        .order("full_name")
    : { data: [], error: null }

  if (teachersResult.error) throw teachersResult.error

  return {
    students: studentsResult.data.map((row) => ({
      id: String(row.id),

      fullName: row.full_name,
      designation: row.designation,
    })),

    teachers: teachersResult.data.map((row) => ({
      id: String(row.id),

      fullName: row.full_name,
      designation: row.designation,
    })),
  }
}

async function signedAttachment(path) {
  if (!path) return null

  const { data, error } = await supabase.storage

    .from(attachmentBucket)

    .createSignedUrl(path, 60 * 60)

  if (error) throw error

  return data.signedUrl
}

export async function getSchoolClassroom(schoolId, memberId, role, classId) {
  const schoolClass = await getClassForMember(schoolId, memberId, role, classId)

  if (!schoolClass) return null

  const [roster, yearResult, subjectResult, teacherResult] = await Promise.all([
    getRoster(schoolId, schoolClass.id),

    supabase

      .from("academic_years")

      .select("name")

      .eq("school_id", schoolId)

      .eq("id", schoolClass.academic_year_id)

      .maybeSingle(),

    supabase

      .from("school_subjects")

      .select("id,name,teacher_id")

      .eq("school_id", schoolId)

      .eq("class_id", schoolClass.id)

      .order("name"),

    schoolClass.class_teacher_id
      ? supabase

          .from("enrollments")

          .select("full_name")

          .eq("school_id", schoolId)

          .eq("id", schoolClass.class_teacher_id)

          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  for (const result of [yearResult, subjectResult, teacherResult]) {
    if (result.error) throw result.error
  }

  const subjects = subjectResult.data

  return {
    schoolClass: {
      id: String(schoolClass.id),

      name: schoolClass.name,

      academicYear: yearResult.data?.name || null,

      classTeacher: teacherResult.data?.full_name || null,
    },

    ...roster,

    subjects: subjects.map((subject) => ({
      id: String(subject.id),

      name: subject.name,

      teacherId: subject.teacher_id ? String(subject.teacher_id) : null,
    })),
  }
}

export async function getClassroomPosts(schoolId, classId) {
  const { data: rows, error } = await supabase

    .from("school_classroom_posts")

    .select(
      "id,author_id,subject_id,post_type,title,content_body,deadline,meeting_url,attachment_path,attachment_name,created_at",
    )

    .eq("school_id", schoolId)

    .eq("class_id", classId)

    .order("created_at", { ascending: false })

    .limit(100)

  if (error) throw error

  if (!rows.length) return []

  const teacherIds = [...new Set(rows.map((row) => String(row.author_id)))]

  const subjectIds = [
    ...new Set(
      rows
        .map((row) => row.subject_id && String(row.subject_id))
        .filter(Boolean),
    ),
  ]

  const [teachersResult, subjectsResult] = await Promise.all([
    supabase

      .from("enrollments")

      .select("id,full_name")

      .eq("school_id", schoolId)

      .in("id", teacherIds),

    subjectIds.length
      ? supabase

          .from("school_subjects")

          .select("id,name")

          .eq("school_id", schoolId)

          .in("id", subjectIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (teachersResult.error) throw teachersResult.error

  if (subjectsResult.error) throw subjectsResult.error

  const teacherNames = new Map(
    teachersResult.data.map((row) => [String(row.id), row.full_name]),
  )

  const subjectNames = new Map(
    subjectsResult.data.map((row) => [String(row.id), row.name]),
  )

  return Promise.all(
    rows.map(async (row) => ({
      id: String(row.id),

      authorId: String(row.author_id),

      author: teacherNames.get(String(row.author_id)) || "School staff",

      subject: row.subject_id
        ? subjectNames.get(String(row.subject_id)) || null
        : null,

      type: row.post_type,

      title: row.title,

      contentBody: row.content_body,

      deadline: row.deadline,

      meetingUrl: row.meeting_url,

      attachmentName: row.attachment_name,

      attachmentUrl: await signedAttachment(row.attachment_path),

      createdAt: row.created_at,
    })),
  )
}

export async function createClassroomPost(schoolId, teacherId, values) {
  if (!(await teacherCanAccessClass(schoolId, teacherId, values.classId)))
    return null

  if (values.subjectId) {
    const { data: subject, error } = await supabase

      .from("school_subjects")

      .select("id,teacher_id")

      .eq("school_id", schoolId)

      .eq("class_id", values.classId)

      .eq("id", values.subjectId)

      .maybeSingle()

    if (error) throw error

    if (
      !subject ||
      (subject.teacher_id && String(subject.teacher_id) !== String(teacherId))
    )
      return null
  }

  let attachmentPath = null

  if (values.attachment) {
    const file = Buffer.from(values.attachment.dataBase64, "base64")

    const safeName = values.attachment.name.replace(/[^A-Za-z0-9._-]/g, "_")

    attachmentPath = `${schoolId}/${values.classId}/${randomUUID()}-${safeName}`

    const { error } = await supabase.storage

      .from(attachmentBucket)

      .upload(attachmentPath, file, {
        contentType: values.attachment.mimeType,

        upsert: false,
      })

    if (error) throw error
  }

  const { data, error } = await supabase

    .from("school_classroom_posts")

    .insert({
      school_id: schoolId,

      class_id: values.classId,

      subject_id: values.subjectId,

      author_id: teacherId,

      post_type: values.type,

      title: values.title,

      content_body: values.contentBody,

      deadline: values.deadline,

      meeting_url: values.meetingUrl,

      attachment_path: attachmentPath,

      attachment_name: values.attachment?.name || null,
    })

    .select("id")

    .single()

  if (error) {
    if (attachmentPath) {
      const { error: cleanupError } = await supabase.storage

        .from(attachmentBucket)

        .remove([attachmentPath])

      if (cleanupError) throw cleanupError
    }

    throw error
  }

  return { id: String(data.id) }
}

export async function deleteClassroomPost(schoolId, teacherId, postId) {
  const { data: post, error: lookupError } = await supabase

    .from("school_classroom_posts")

    .select("id,attachment_path")

    .eq("school_id", schoolId)

    .eq("author_id", teacherId)

    .eq("id", postId)

    .maybeSingle()

  if (lookupError) throw lookupError

  if (!post) return false

  const { error } = await supabase

    .from("school_classroom_posts")

    .delete()

    .eq("school_id", schoolId)

    .eq("author_id", teacherId)

    .eq("id", postId)

  if (error) throw error

  if (post.attachment_path) {
    const { error: storageError } = await supabase.storage

      .from(attachmentBucket)

      .remove([post.attachment_path])

    if (storageError) throw storageError
  }

  return true
}

async function validateExamSchoolContext(schoolId, teacherId, values) {
  if (!(await teacherCanAccessClass(schoolId, teacherId, values.classId)))
    return false

  const [classResult, termResult] = await Promise.all([
    supabase
      .from("school_classes")

      .select("id,academic_year_id")

      .eq("school_id", schoolId)

      .eq("id", values.classId)

      .maybeSingle(),

    supabase
      .from("academic_terms")

      .select("id,academic_year_id,starts_on,ends_on")

      .eq("school_id", schoolId)

      .eq("id", values.termId)

      .maybeSingle(),
  ])

  if (classResult.error) throw classResult.error

  if (termResult.error) throw termResult.error

  if (
    !classResult.data ||
    !termResult.data ||
    String(classResult.data.academic_year_id) !==
      String(termResult.data.academic_year_id)
  )
    return false

  if (values.subjectId) {
    const { data, error } = await supabase
      .from("school_subjects")

      .select("id,teacher_id")

      .eq("school_id", schoolId)

      .eq("class_id", values.classId)

      .eq("id", values.subjectId)

      .maybeSingle()

    if (error) throw error

    if (
      !data ||
      (data.teacher_id && String(data.teacher_id) !== String(teacherId))
    )
      return false
  }

  return true
}

export async function createSchoolPortalExam(schoolId, teacherId, values) {
  if (!(await validateExamSchoolContext(schoolId, teacherId, values)))
    return null

  const { data, error } = await supabase
    .from("school_portal_exams")
    .insert({
      school_id: schoolId,

      class_id: values.classId,

      subject_id: values.subjectId,

      academic_term_id: values.termId,

      teacher_id: teacherId,

      title: values.title,

      questions: values.questions,

      duration_minutes: values.durationMinutes,

      attempts_allowed: values.attemptsAllowed,

      expires_at: values.expiresAt,
    })
    .select("*")
    .single()

  if (error) throw error

  return mapExam(data, true)
}

export async function getTeacherPortalExams(schoolId, teacherId) {
  const { data: rows, error } = await supabase
    .from("school_portal_exams")

    .select("*")

    .eq("school_id", schoolId)

    .eq("teacher_id", teacherId)

    .order("created_at", { ascending: false })

    .limit(100)

  if (error) throw error

  if (!rows.length) return []

  const classIds = [...new Set(rows.map((row) => String(row.class_id)))]

  const subjectIds = [
    ...new Set(
      rows
        .map((row) => row.subject_id && String(row.subject_id))
        .filter(Boolean),
    ),
  ]

  const [classesResult, subjectsResult] = await Promise.all([
    supabase
      .from("school_classes")
      .select("id,name")
      .eq("school_id", schoolId)
      .in("id", classIds),

    subjectIds.length
      ? supabase
          .from("school_subjects")
          .select("id,name")
          .eq("school_id", schoolId)
          .in("id", subjectIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [classesResult, subjectsResult])
    if (result.error) throw result.error

  const classNames = new Map(
    classesResult.data.map((row) => [String(row.id), row.name]),
  )

  const subjectNames = new Map(
    subjectsResult.data.map((row) => [String(row.id), row.name]),
  )

  return rows.map((row) => ({
    ...mapExam(
      {
        ...row,

        className: classNames.get(String(row.class_id)) || "Class",

        subjectName: subjectNames.get(String(row.subject_id)) || null,
      },
      true,
    ),
  }))
}

export async function getStudentPortalExams(schoolId, studentId) {
  const { data: student, error: studentError } = await supabase
    .from("enrollments")

    .select("class_id")

    .eq("school_id", schoolId)

    .eq("id", studentId)

    .eq("role", "student")

    .eq("status", "Active")

    .maybeSingle()

  if (studentError) throw studentError

  if (!student?.class_id) return []

  const { data: exams, error } = await supabase
    .from("school_portal_exams")

    .select(
      "id,title,class_id,subject_id,academic_term_id,questions,duration_minutes,attempts_allowed,created_at,expires_at",
    )

    .eq("school_id", schoolId)

    .eq("class_id", student.class_id)

    .eq("is_published", true)

    .order("created_at", { ascending: false })

    .limit(100)

  if (error) throw error

  if (!exams.length) return []

  const [attemptsResult, subjectsResult] = await Promise.all([
    supabase
      .from("school_portal_exam_attempts")
      .select("id,exam_id,status,start_time,answers")

      .eq("school_id", schoolId)

      .eq("student_id", studentId)

      .in(
        "exam_id",
        exams.map((exam) => exam.id),
      ),

    exams.some((exam) => exam.subject_id)
      ? supabase
          .from("school_subjects")
          .select("id,name")
          .eq("school_id", schoolId)

          .in("id", [
            ...new Set(exams.map((exam) => exam.subject_id).filter(Boolean)),
          ])
      : Promise.resolve({ data: [], error: null }),
  ])

  if (attemptsResult.error) throw attemptsResult.error

  if (subjectsResult.error) throw subjectsResult.error

  const attempts = new Map()

  const activeAttempts = new Map()

  for (const row of attemptsResult.data) {
    const key = String(row.exam_id)

    attempts.set(key, (attempts.get(key) || 0) + 1)

    if (row.status === "started") {
      activeAttempts.set(key, {
        id: String(row.id),

        startedAt: row.start_time,

        answers: row.answers,
      })
    }
  }

  const subjects = new Map(
    subjectsResult.data.map((row) => [String(row.id), row.name]),
  )

  return exams.map((row) => {
    const attemptsMade = attempts.get(String(row.id)) || 0

    return {
      ...mapExam(row),

      subjectName: row.subject_id
        ? subjects.get(String(row.subject_id)) || null
        : null,

      attemptsMade,

      attemptsRemaining: Math.max(0, row.attempts_allowed - attemptsMade),

      activeAttemptId: activeAttempts.get(String(row.id))?.id || null,

      activeStartedAt: activeAttempts.get(String(row.id))?.startedAt || null,

      savedAnswers: activeAttempts.get(String(row.id))?.answers || [],

      status: activeAttempts.has(String(row.id))
        ? "in_progress"
        : row.expires_at <= new Date().toISOString()
          ? "expired"
          : attemptsMade >= row.attempts_allowed
            ? "no_attempts_left"
            : "available",
    }
  })
}

export async function startStudentPortalExam(schoolId, examId, studentId) {
  const { data: attemptId, error: startError } = await supabase.rpc(
    "start_school_portal_exam",
    {
      target_school_id: schoolId,

      target_exam_id: examId,

      target_student_id: studentId,
    },
  )

  if (startError) throw startError

  const { data: attempt, error: attemptError } = await supabase
    .from("school_portal_exam_attempts")

    .select("start_time,answers")

    .eq("school_id", schoolId)

    .eq("exam_id", examId)

    .eq("student_id", studentId)

    .eq("id", attemptId)

    .maybeSingle()

  if (attemptError) throw attemptError

  if (!attempt) return null

  const { data: exam, error } = await supabase
    .from("school_portal_exams")

    .select("id,title,questions,duration_minutes")

    .eq("school_id", schoolId)

    .eq("id", examId)

    .maybeSingle()

  if (error) throw error

  if (!exam) return null

  return {
    attemptId: String(attemptId),

    startedAt: attempt.start_time,

    answers: attempt.answers || [],

    exam: {
      id: String(exam.id),

      title: exam.title,

      durationMinutes: exam.duration_minutes,

      questions: exam.questions.map((question) => mapQuestion(question)),
    },
  }
}

export async function saveStudentPortalExamDraft(
  schoolId,

  examId,

  attemptId,

  studentId,

  answers,
) {
  const { error } = await supabase.rpc("save_school_portal_exam_draft", {
    target_school_id: schoolId,

    target_exam_id: examId,

    target_attempt_id: attemptId,

    target_student_id: studentId,

    submitted_answers: answers,
  })

  if (error) throw error

  return { saved: true }
}

export async function submitStudentPortalExam(
  schoolId,
  examId,
  attemptId,
  studentId,
  answers,
  submissionType,
) {
  const { data: score, error } = await supabase.rpc(
    "submit_school_portal_exam",
    {
      target_school_id: schoolId,

      target_exam_id: examId,

      target_attempt_id: attemptId,

      target_student_id: studentId,

      submitted_answers: answers,

      submission_kind: submissionType,
    },
  )

  if (error) throw error

  const { data: exam, error: examError } = await supabase
    .from("school_portal_exams")

    .select("questions")

    .eq("school_id", schoolId)

    .eq("id", examId)

    .maybeSingle()

  if (examError) throw examError

  return { score, totalQuestions: exam?.questions.length || 0 }
}

export async function getTeacherPortalExamResults(schoolId, teacherId, examId) {
  const { data: exam, error: examError } = await supabase
    .from("school_portal_exams")

    .select("id,title,class_id,questions")

    .eq("school_id", schoolId)

    .eq("teacher_id", teacherId)

    .eq("id", examId)

    .maybeSingle()

  if (examError) throw examError

  if (!exam) return null

  const attempts = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("school_portal_exam_attempts")
      .select("student_id,score,status,end_time")
      .eq("school_id", schoolId)
      .eq("exam_id", examId)
      .eq("status", "submitted")
      .order("score", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999)

    if (error) throw error
    attempts.push(...data)
    if (data.length < 1000) break
  }

  const studentIds = [...new Set(attempts.map((row) => String(row.student_id)))]

  const studentsResult = studentIds.length
    ? await supabase
        .from("enrollments")
        .select("id,full_name")

        .eq("school_id", schoolId)
        .eq("role", "student")
        .in("id", studentIds)
    : { data: [], error: null }

  if (studentsResult.error) throw studentsResult.error

  const names = new Map(
    studentsResult.data.map((row) => [
      String(row.id),
      {
        name: row.full_name,
      },
    ]),
  )

  const { data: schoolClass, error: classError } = await supabase
    .from("school_classes")

    .select("name")
    .eq("school_id", schoolId)
    .eq("id", exam.class_id)
    .maybeSingle()

  if (classError) throw classError

  return {
    title: exam.title,

    className: schoolClass?.name || "Class",

    totalQuestions: exam.questions.length,

    results: attempts.map((row) => ({
      fullName: names.get(String(row.student_id))?.name || "Student",

      score: row.score,

      totalQuestions: exam.questions.length,

      percentage: exam.questions.length
        ? Math.round((row.score / exam.questions.length) * 100)
        : 0,

      submittedAt: row.end_time,
    })),
  }
}
