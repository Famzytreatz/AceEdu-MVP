import { supabase } from "../supabase.js"
import { getPortalAnnouncements } from "./Communications.js"
import { getClassroomPosts } from "./SchoolClassroom.js"
import { getStudentPortalDashboard } from "./Portal.js"

export async function findParentByPhone(schoolId, phone) {
  const { data, error } = await supabase
    .from("parent_accounts")
    .select("id,school_id,full_name,phone,password_hash,must_change_password,initial_password_expires_at,is_active")
    .eq("school_id", schoolId)
    .eq("phone", phone)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findActiveParentById(schoolId, parentId) {
  const { data, error } = await supabase
    .from("parent_accounts")
    .select("id,school_id,full_name,phone,password_hash,must_change_password,initial_password_expires_at,is_active")
    .eq("school_id", schoolId)
    .eq("id", parentId)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listSchoolParents(schoolId) {
  const { data: parentRows, error: parentError } = await supabase
    .from("parent_accounts")
    .select("id,full_name,phone,is_active,must_change_password,created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(500)
  if (parentError) throw parentError

  if (!parentRows.length) return []
  const parentIds = parentRows.map((parent) => String(parent.id))
  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select("parent_id,student_id")
    .eq("school_id", schoolId)
    .in("parent_id", parentIds)
    .limit(10000)
  if (linksError) throw linksError

  const studentIds = [...new Set(links.map((link) => String(link.student_id)))]
  const { data: students, error: studentsError } = studentIds.length
    ? await supabase
        .from("enrollments")
        .select("id,full_name,status")
        .eq("school_id", schoolId)
        .eq("role", "student")
        .in("id", studentIds)
    : { data: [], error: null }
  if (studentsError) throw studentsError

  const studentById = new Map(
    students.map((student) => [
      String(student.id),
      {
        id: String(student.id),
        fullName: student.full_name,
        active: student.status === "Active",
      },
    ]),
  )
  const childrenByParent = new Map()
  for (const link of links) {
    const children = childrenByParent.get(String(link.parent_id)) || []
    const student = studentById.get(String(link.student_id))
    if (student) children.push(student)
    childrenByParent.set(String(link.parent_id), children)
  }

  return parentRows.map((parent) => {
    const students = childrenByParent.get(String(parent.id)) || []
    return {
      id: String(parent.id),
      fullName: parent.full_name,
      phone: parent.phone,
      active: parent.is_active,
      mustChangePassword: parent.must_change_password,
      createdAt: parent.created_at,
      isFamily: students.length > 1,
      students,
    }
  })
}

export async function ensureParentPortalForStudent(
  schoolId,
  studentId,
  guardian,
  passwordHash,
  setupCodeExpiresAt,
) {
  const { data, error } = await supabase.rpc(
    "ensure_school_parent_for_student",
    {
      target_school_id: schoolId,
      target_student_id: studentId,
      parent_name: guardian.fullName,
      parent_phone: guardian.phone,
      parent_password_hash: passwordHash,
      setup_code_expires_at: setupCodeExpiresAt,
    },
  )
  if (error) throw error
  return {
    parentId: String(data.parentId),
    parentName: data.parentName,
    created: data.created,
    sendSetupCode: data.sendSetupCode,
    studentCount: data.studentCount,
    isFamily: data.isFamily,
  }
}

export async function setParentStudents(schoolId, parentId, studentIds) {
  const { data, error } = await supabase.rpc("set_school_parent_students", {
    target_school_id: schoolId,
    target_parent_id: parentId,
    linked_student_ids: studentIds,
  })
  if (error) throw error
  return data
}

export async function resetParentPassword(schoolId, parentId, passwordHash) {
  const { data, error } = await supabase
    .from("parent_accounts")
    .update({
      password_hash: passwordHash,
      must_change_password: true,
      initial_password_expires_at: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("school_id", schoolId)
    .eq("id", parentId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function updateParentPassword(
  schoolId,
  parentId,
  passwordHash,
) {
  const { data, error } = await supabase
    .from("parent_accounts")
    .update({
      password_hash: passwordHash,
      must_change_password: false,
      initial_password_expires_at: null,
    })
    .eq("school_id", schoolId)
    .eq("id", parentId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function getParentPortalDashboard(schoolId, parentId) {
  const [parentResult, linksResult, announcements] = await Promise.all([
    supabase
      .from("parent_accounts")
      .select("id,full_name,phone,must_change_password")
      .eq("school_id", schoolId)
      .eq("id", parentId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("parent_id", parentId),
    getPortalAnnouncements(schoolId, "parents"),
  ])
  if (parentResult.error) throw parentResult.error
  if (linksResult.error) throw linksResult.error
  if (!parentResult.data) return null

  const studentIds = linksResult.data.map((link) => String(link.student_id))
  if (!studentIds.length) {
    return {
      profile: {
        fullName: parentResult.data.full_name,
        phone: parentResult.data.phone,
        mustChangePassword: parentResult.data.must_change_password,
      },
      children: [],
      announcements,
      classroomPosts: [],
    }
  }

  const { data: studentRows, error: studentError } = await supabase
    .from("enrollments")
    .select("id,full_name,class_id,status")
    .eq("school_id", schoolId)
    .eq("role", "student")
    .eq("status", "Active")
    .in("id", studentIds)
  if (studentError) throw studentError

  const children = await Promise.all(
    studentRows.map(async (student) => ({
      id: String(student.id),
      fullName: student.full_name,
      dashboard: await getStudentPortalDashboard(schoolId, String(student.id)),
    })),
  )

  const classIds = [
    ...new Set(
      studentRows
        .map((student) => student.class_id && String(student.class_id))
        .filter(Boolean),
    ),
  ]
  const postGroups = await Promise.all(
    classIds.map((classId) => getClassroomPosts(schoolId, classId)),
  )
  const classroomPosts = postGroups
    .flat()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 100)

  return {
    profile: {
      fullName: parentResult.data.full_name,
      phone: parentResult.data.phone,
      mustChangePassword: parentResult.data.must_change_password,
    },
    children,
    announcements,
    classroomPosts,
  }
}
