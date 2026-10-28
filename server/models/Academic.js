import { supabase } from "../supabase.js"

function mapYear(row) {
  return {
    id: String(row.id),
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    termCount: row.term_count,
    isCurrent: row.is_current,
  }
}

function mapTerm(row) {
  return {
    id: String(row.id),
    academicYearId: String(row.academic_year_id),
    termNumber: row.term_number,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }
}

function mapClass(row) {
  return {
    id: String(row.id),
    academicYearId: String(row.academic_year_id),
    name: row.name,
    classTeacherId: row.class_teacher_id ? String(row.class_teacher_id) : null,
  }
}

function mapSubject(row) {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    name: row.name,
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
  }
}

function mapEnrollment(row) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    designation: row.designation,
    classId: row.class_id ? String(row.class_id) : null,
  }
}

export async function getAcademicSetup(schoolId) {
  const [yearsResult, termsResult, classesResult, subjectsResult, studentsResult, teachersResult] =
    await Promise.all([
      supabase
        .from("academic_years")
        .select("id,name,starts_on,ends_on,term_count,is_current")
        .eq("school_id", schoolId)
        .order("starts_on", { ascending: false }),
      supabase
        .from("academic_terms")
        .select("id,academic_year_id,term_number,name,starts_on,ends_on")
        .eq("school_id", schoolId)
        .order("term_number"),
      supabase
        .from("school_classes")
        .select("id,academic_year_id,name,class_teacher_id")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("school_subjects")
        .select("id,class_id,name,teacher_id")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("enrollments")
        .select("id,full_name,designation,class_id,status")
        .eq("school_id", schoolId)
        .eq("role", "student")
        .order("full_name"),
      supabase
        .from("enrollments")
        .select("id,full_name,designation")
        .eq("school_id", schoolId)
        .eq("role", "teacher")
        .eq("status", "Active")
        .order("full_name"),
    ])

  for (const result of [
    yearsResult,
    termsResult,
    classesResult,
    subjectsResult,
    studentsResult,
    teachersResult,
  ]) {
    if (result.error) throw result.error
  }

  return {
    academicYears: yearsResult.data.map(mapYear),
    terms: termsResult.data.map(mapTerm),
    classes: classesResult.data.map(mapClass),
    subjects: subjectsResult.data.map(mapSubject),
    students: studentsResult.data.map((row) => ({
      ...mapEnrollment(row),
      status: row.status,
    })),
    teachers: teachersResult.data.map((row) => ({
      id: String(row.id),
      fullName: row.full_name,
      designation: row.designation,
    })),
  }
}

export async function createAcademicYear(
  schoolId,
  { name, startsOn, endsOn, termCount },
) {
  const { data, error } = await supabase.rpc("create_academic_year", {
    target_school_id: schoolId,
    year_name: name,
    year_starts_on: startsOn,
    year_ends_on: endsOn,
    number_of_terms: termCount,
  })
  if (error) throw error
  return data
}

export async function setCurrentAcademicYear(schoolId, yearId) {
  const { error } = await supabase.rpc("set_current_academic_year", {
    target_school_id: schoolId,
    target_year_id: yearId,
  })
  if (error) throw error
}

export async function createSchoolClass(schoolId, { academicYearId, name, classTeacherId }) {
  const { data, error } = await supabase
    .from("school_classes")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      name,
      class_teacher_id: classTeacherId || null,
    })
    .select("id,academic_year_id,name,class_teacher_id")
    .single()
  if (error) throw error
  return mapClass(data)
}

export async function createSchoolSubject(schoolId, { classId, name, teacherId }) {
  const { data, error } = await supabase
    .from("school_subjects")
    .insert({
      school_id: schoolId,
      class_id: classId,
      name,
      teacher_id: teacherId || null,
    })
    .select("id,class_id,name,teacher_id")
    .single()
  if (error) throw error
  return mapSubject(data)
}

export async function assignStudentsToClass(schoolId, classId, studentIds) {
  const { data, error } = await supabase.rpc("assign_school_class", {
    target_school_id: schoolId,
    target_class_id: classId,
    target_student_ids: studentIds,
  })
  if (error) throw error
  return data
}

export async function findSchoolTeacher(schoolId, teacherId) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .eq("role", "teacher")
    .eq("status", "Active")
    .maybeSingle()
  if (error) throw error
  return data !== null
}
