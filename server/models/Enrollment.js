import { supabase } from "../supabase.js"

const enrollmentColumns =
  "id,school_id,full_name,role,designation,assigned_classes,subjects,passport,dob,guardian_phone,address,state_of_origin,phone,access_pin,status,created_at,updated_at"

const pageSize = 50

function enrollmentFromRow(row) {
  return {
    _id: String(row.id),

    schoolId: String(row.school_id),

    fullName: row.full_name,

    role: row.role,

    designation: row.designation,

    assignedClasses: row.assigned_classes,

    subjects: row.subjects,

    passport: row.passport,

    dob: row.dob,

    guardianPhone: row.guardian_phone,

    address: row.address,

    stateOfOrigin: row.state_of_origin,

    phone: row.phone,

    accessPin: row.access_pin,

    status: row.status,

    createdAt: row.created_at,

    updatedAt: row.updated_at,
  }
}

function escapeLikePrefix(value) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export async function enrollmentPinExists(schoolId, accessPin) {
  const { data, error } = await supabase

    .from("enrollments")

    .select("id")

    .eq("school_id", schoolId)

    .eq("access_pin", accessPin)

    .maybeSingle()

  if (error) throw error

  return data !== null
}

export async function getDashboardAnalytics(schoolId) {
  const { data, error } = await supabase.rpc("get_school_dashboard_analytics", {
    target_school_id: schoolId,
  })

  if (error) throw error

  return data
}

async function findPage({ schoolId, prefix, column, cursor, limit, roles, status }) {
  let query = supabase

    .from("enrollments")

    .select(enrollmentColumns)

    .eq("school_id", schoolId)

    .order("id", { ascending: false })

    .limit(limit)

  if (cursor) query = query.lt("id", cursor)

  if (roles) query = query.in("role", roles)

  if (status) query = query.eq("status", status)

  if (prefix !== null)
    query = query.ilike(column, `${escapeLikePrefix(prefix)}%`)

  const { data, error } = await query

  if (error) throw error

  return data.map(enrollmentFromRow)
}

export async function listEnrollments({ schoolId, queryText, cursor, role, status }) {
  const roles =
    role === "student"
      ? ["student"]
      : role === "staff"
        ? ["teacher", "sub-admin", "school-admin"]
        : null

  if (!queryText) {
    return findPage({
      schoolId,
      prefix: null,
      column: "name_search",
      cursor,
      limit: pageSize + 1,
      roles,
      status,
    })
  }

  const [byName, byPin, byRole] = await Promise.all([
    findPage({
      schoolId,
      prefix: queryText.toLocaleLowerCase(),
      column: "name_search",
      cursor,
      limit: pageSize + 1,
      roles,
      status,
    }),

    findPage({
      schoolId,
      prefix: queryText,
      column: "access_pin",
      cursor,
      limit: pageSize + 1,
      roles,
      status,
    }),

    findPage({
      schoolId,
      prefix: queryText.toLocaleLowerCase(),
      column: "role",
      cursor,
      limit: pageSize + 1,
      roles,
      status,
    }),
  ])

  const unique = new Map(
    [...byName, ...byPin, ...byRole]
      .filter((record) => !roles || roles.includes(record.role))
      .map((record) => [record._id, record]),
  )

  return [...unique.values()]

    .sort((first, second) => (BigInt(first._id) > BigInt(second._id) ? -1 : 1))

    .slice(0, pageSize + 1)
}

export async function createEnrollment({ schoolId, values, accessPin }) {
  const { data, error } = await supabase

    .from("enrollments")

    .insert({
      school_id: schoolId,

      full_name: values.fullName,

      role: values.role,

      designation: values.designation,

      assigned_classes: values.assignedClasses,

      subjects: values.subjects,

      passport: values.passport,

      dob: values.dob,

      guardian_phone: values.guardianPhone,

      address: values.address,

      state_of_origin: values.stateOfOrigin,

      phone: values.phone,

      password_hash: values.passwordHash,

      access_pin: accessPin,

      status: "Pending",
    })

    .select(enrollmentColumns)

    .single()

  if (error) throw error

  return enrollmentFromRow(data)
}

export async function verifyEnrollment(schoolId, id) {
  const { data, error } = await supabase

    .from("enrollments")

    .update({ status: "Active", updated_at: new Date().toISOString() })

    .eq("school_id", schoolId)

    .eq("id", id)

    .select(enrollmentColumns)

    .maybeSingle()

  if (error) throw error

  return data ? enrollmentFromRow(data) : null
}

export async function deleteEnrollment(schoolId, id) {
  const { data, error } = await supabase

    .from("enrollments")

    .delete()

    .eq("school_id", schoolId)

    .eq("id", id)

    .select("id")

    .maybeSingle()

  if (error) throw error

  return data !== null
}

export async function* iterateEnrollments(schoolId) {
  let cursor = null

  while (true) {
    let query = supabase

      .from("enrollments")

      .select(enrollmentColumns)

      .eq("school_id", schoolId)

      .order("id", { ascending: true })

      .limit(500)

    if (cursor) query = query.gt("id", cursor)

    const { data, error } = await query

    if (error) throw error

    if (data.length === 0) return

    for (const row of data) yield enrollmentFromRow(row)

    cursor = String(data.at(-1).id)
  }
}
