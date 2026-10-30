import { supabase } from "../supabase.js"

const primaryLevels = [
  ["kg", "Kindergarten", false, 10],
  ["primary_1", "Primary 1", false, 20],
  ["primary_2", "Primary 2", false, 30],
  ["primary_3", "Primary 3", false, 40],
  ["primary_4", "Primary 4", false, 50],
  ["primary_5", "Primary 5", false, 60],
  ["primary_6", "Primary 6", true, 70],
]

const secondaryLevels = [
  ["jss_1", "JSS 1", false, 80],
  ["jss_2", "JSS 2", false, 90],
  ["jss_3", "JSS 3", false, 100],
  ["sss_1", "SSS 1", false, 110],
  ["sss_2", "SSS 2", false, 120],
  ["sss_3", "SSS 3", false, 130],
]

function levelsForSchoolType(schoolType) {
  if (schoolType === "Primary") return primaryLevels
  if (schoolType === "Secondary") return secondaryLevels
  return [...primaryLevels, ...secondaryLevels]
}

function classLevelFromRow(row) {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    nickname: row.nickname || "",
    displayName: row.nickname || row.name,
    isOptional: row.is_optional,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    minimumSubjects: row.rules?.[0]?.minimum_subjects ?? 1,
    maximumSubjects: row.rules?.[0]?.maximum_subjects ?? 15,
    subjects: (row.subjects || []).map((subject) => ({
      id: String(subject.id),
      name: subject.name,
      isCompulsory: subject.is_compulsory,
      isActive: subject.is_active,
    })),
  }
}

export async function ensureSchoolClassLevels(schoolId, schoolType) {
  const { data: existing, error: existingError } = await supabase
    .from("school_class_levels")
    .select("code")
    .eq("school_id", schoolId)
  if (existingError) throw existingError
  const existingCodes = new Set(existing.map((row) => row.code))
  const defaults = levelsForSchoolType(schoolType)
    .filter(([code]) => !existingCodes.has(code))
    .map(([code, name, isOptional, sortOrder]) => ({
      school_id: schoolId,
      code,
      name,
      is_optional: isOptional,
      is_active: !isOptional,
      sort_order: sortOrder,
    }))
  if (!defaults.length) return

  const { error } = await supabase
    .from("school_class_levels")
    .upsert(defaults, {
      onConflict: "school_id,code",
      ignoreDuplicates: true,
    })
  if (error) throw error
}

export async function getSchoolCurriculum(schoolId, schoolType) {
  await ensureSchoolClassLevels(schoolId, schoolType)
  const allowedCodes = new Set(levelsForSchoolType(schoolType).map(([code]) => code))
  const { data, error } = await supabase
    .from("school_class_levels")
    .select(
      "id,code,name,nickname,is_optional,is_active,sort_order,rules:school_class_subject_rules(minimum_subjects,maximum_subjects),subjects:school_subject_options(id,name,is_compulsory,is_active)",
    )
    .eq("school_id", schoolId)
    .order("sort_order")
  if (error) throw error
  return data
    .filter((row) => allowedCodes.has(row.code))
    .map(classLevelFromRow)
}

export async function findSchoolClassLevel(
  schoolId,
  classLevelId,
  schoolType,
) {
  const { data, error } = await supabase
    .from("school_class_levels")
    .select("id,code,name,nickname,is_active")
    .eq("school_id", schoolId)
    .eq("id", classLevelId)
    .maybeSingle()
  if (error) throw error
  const allowedCodes = new Set(levelsForSchoolType(schoolType).map(([code]) => code))
  return data
    ? {
        id: String(data.id),
        name: data.nickname || data.name,
        isActive: data.is_active && allowedCodes.has(data.code),
      }
    : null
}

export async function updateClassLevel(schoolId, classLevelId, values) {
  const { data: current, error: currentError } = await supabase
    .from("school_class_levels")
    .select("id,is_optional")
    .eq("school_id", schoolId)
    .eq("id", classLevelId)
    .maybeSingle()
  if (currentError) throw currentError
  if (!current) return null
  if (!current.is_optional && !values.isActive) {
    const error = new Error("Required class levels cannot be disabled.")
    error.code = "22023"
    throw error
  }

  const { data, error } = await supabase
    .from("school_class_levels")
    .update({
      nickname: values.nickname || null,
      is_active: values.isActive,
    })
    .eq("school_id", schoolId)
    .eq("id", classLevelId)
    .select("id,code,name,nickname,is_optional,is_active,sort_order")
    .maybeSingle()
  if (error) throw error
  return data ? classLevelFromRow(data) : null
}

export async function saveClassSubjectRules(
  schoolId,
  classLevelId,
  minimumSubjects,
  maximumSubjects,
) {
  const { data, error } = await supabase
    .from("school_class_subject_rules")
    .upsert(
      {
        school_id: schoolId,
        class_level_id: classLevelId,
        minimum_subjects: minimumSubjects,
        maximum_subjects: maximumSubjects,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,class_level_id" },
    )
    .select("minimum_subjects,maximum_subjects")
    .single()
  if (error) throw error
  return data
}

export async function createSchoolSubjectOption(
  schoolId,
  classLevelId,
  name,
  isCompulsory,
) {
  const { data, error } = await supabase
    .from("school_subject_options")
    .insert({
      school_id: schoolId,
      class_level_id: classLevelId,
      name,
      is_compulsory: isCompulsory,
    })
    .select("id,name,is_compulsory,is_active")
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    name: data.name,
    isCompulsory: data.is_compulsory,
    isActive: data.is_active,
  }
}

export async function updateSchoolSubjectOption(
  schoolId,
  classLevelId,
  subjectId,
  values,
) {
  const { data, error } = await supabase
    .from("school_subject_options")
    .update({
      name: values.name,
      is_compulsory: values.isCompulsory,
      is_active: values.isActive,
    })
    .eq("school_id", schoolId)
    .eq("class_level_id", classLevelId)
    .eq("id", subjectId)
    .select("id,name,is_compulsory,is_active")
    .maybeSingle()
  if (error) throw error
  return data
    ? {
        id: String(data.id),
        name: data.name,
        isCompulsory: data.is_compulsory,
        isActive: data.is_active,
      }
    : null
}

export async function getStudentSubjectChoices(schoolId, studentId) {
  const { data: student, error: studentError } = await supabase
    .from("enrollments")
    .select("class_level_id")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .eq("role", "student")
    .eq("status", "Active")
    .maybeSingle()
  if (studentError) throw studentError
  if (!student?.class_level_id) {
    return { classLevel: null, request: null, approvedSubjects: [] }
  }

  const { data: classLevel, error: classError } = await supabase
    .from("school_class_levels")
    .select(
      "id,name,nickname,rules:school_class_subject_rules(minimum_subjects,maximum_subjects),subjects:school_subject_options(id,name,is_compulsory,is_active)",
    )
    .eq("school_id", schoolId)
    .eq("id", student.class_level_id)
    .maybeSingle()
  if (classError) throw classError
  if (!classLevel) return { classLevel: null, request: null, approvedSubjects: [] }

  const { data: requests, error: requestError } = await supabase
    .from("student_subject_requests")
    .select("id,status,is_current,submitted_at")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(10)
  if (requestError) throw requestError

  const current = requests.find((request) => request.is_current)
  const latest = requests[0] || current || null
  const subjectRequest = latest
    ? await getRequestWithSubjects(schoolId, latest)
    : null

  const approvedRequest =
    current?.status === "approved"
      ? await getRequestWithSubjects(schoolId, current)
      : null

  return {
    classLevel: {
      id: String(classLevel.id),
      name: classLevel.nickname || classLevel.name,
      minimumSubjects: classLevel.rules?.[0]?.minimum_subjects ?? 1,
      maximumSubjects: classLevel.rules?.[0]?.maximum_subjects ?? 15,
      subjects: classLevel.subjects
        .filter((subject) => subject.is_active)
        .map((subject) => ({
          id: String(subject.id),
          name: subject.name,
          isCompulsory: subject.is_compulsory,
        })),
    },
    request: subjectRequest,
    approvedSubjects: approvedRequest?.subjects || [],
  }
}

async function getRequestWithSubjects(schoolId, request) {
  const { data, error } = await supabase
    .from("student_subject_request_items")
    .select("subject:school_subject_options(id,name)")
    .eq("school_id", schoolId)
    .eq("request_id", request.id)
  if (error) throw error
  return {
    id: String(request.id),
    status: request.status,
    submittedAt: request.submitted_at,
    subjects: data.map((item) => ({
      id: String(item.subject.id),
      name: item.subject.name,
    })),
  }
}

export async function submitStudentSubjectRequest(
  schoolId,
  studentId,
  subjectIds,
) {
  const { data, error } = await supabase.rpc(
    "submit_student_subject_request",
    {
      target_school_id: schoolId,
      target_student_id: studentId,
      selected_subject_ids: subjectIds,
    },
  )
  if (error) throw error
  return { requestId: String(data) }
}

export async function listPendingSubjectRequests(schoolId) {
  const { data: requests, error } = await supabase
    .from("student_subject_requests")
    .select("id,student_id,class_level_id,submitted_at")
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .order("submitted_at")
    .limit(200)
  if (error) throw error
  if (!requests.length) return []

  const [studentsResult, classesResult, itemsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id,full_name,designation")
      .eq("school_id", schoolId)
      .eq("role", "student")
      .eq("status", "Active")
      .in("id", requests.map((request) => request.student_id)),
    supabase
      .from("school_class_levels")
      .select("id,name,nickname")
      .eq("school_id", schoolId)
      .in("id", requests.map((request) => request.class_level_id)),
    supabase
      .from("student_subject_request_items")
      .select("request_id,subject:school_subject_options(id,name,is_compulsory)")
      .eq("school_id", schoolId)
      .in("request_id", requests.map((request) => request.id)),
  ])
  for (const result of [studentsResult, classesResult, itemsResult]) {
    if (result.error) throw result.error
  }
  const students = new Map(
    studentsResult.data.map((student) => [String(student.id), student]),
  )
  const classes = new Map(
    classesResult.data.map((schoolClass) => [String(schoolClass.id), schoolClass]),
  )
  const subjects = new Map()
  for (const item of itemsResult.data) {
    const requestId = String(item.request_id)
    if (!subjects.has(requestId)) subjects.set(requestId, [])
    subjects.get(requestId).push({
      id: String(item.subject.id),
      name: item.subject.name,
      isCompulsory: item.subject.is_compulsory,
    })
  }
  return requests.map((request) => {
    const student = students.get(String(request.student_id))
    const schoolClass = classes.get(String(request.class_level_id))
    return {
      id: String(request.id),
      studentId: String(request.student_id),
      studentName: student?.full_name || "Student",
      studentClass: schoolClass?.nickname || schoolClass?.name || student?.designation,
      submittedAt: request.submitted_at,
      subjects: subjects.get(String(request.id)) || [],
    }
  })
}

export async function reviewStudentSubjectRequest(schoolId, requestId, decision) {
  const { data, error } = await supabase.rpc(
    "review_student_subject_request",
    {
      target_school_id: schoolId,
      target_request_id: requestId,
      review_decision: decision,
    },
  )
  if (error) throw error
  return Boolean(data)
}
