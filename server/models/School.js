import { supabase } from "../supabase.js"

const publicColumns =
  "id,school_name,school_type,country,state,city,address,school_email,school_phone,admin_name,admin_email,admin_phone,admin_role,created_at,updated_at"

function schoolFromRow(row) {
  return {
    _id: String(row.id),
    schoolName: row.school_name,
    schoolType: row.school_type,
    country: row.country,
    state: row.state,
    city: row.city,
    address: row.address,
    schoolEmail: row.school_email,
    schoolPhone: row.school_phone,
    adminName: row.admin_name,
    adminEmail: row.admin_email,
    adminPhone: row.admin_phone,
    adminRole: row.admin_role,
    ...(row.password_hash === undefined ? {} : { passwordHash: row.password_hash }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function schoolEmailExists(adminEmail) {
  const { data, error } = await supabase
    .from("schools")
    .select("id")
    .eq("admin_email", adminEmail)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function createSchool(values, passwordHash) {
  const { data, error } = await supabase
    .from("schools")
    .insert({
      school_name: values.schoolName,
      school_type: values.schoolType,
      country: values.country,
      state: values.state,
      city: values.city,
      address: values.address,
      school_email: values.schoolEmail,
      school_phone: values.schoolPhone,
      admin_name: values.adminName,
      admin_email: values.adminEmail,
      admin_phone: values.adminPhone,
      admin_role: values.adminRole,
      password_hash: passwordHash,
    })
    .select(`${publicColumns},password_hash`)
    .single()
  if (error) throw error
  return schoolFromRow(data)
}

export async function findSchoolByEmail(adminEmail) {
  const { data, error } = await supabase
    .from("schools")
    .select(`${publicColumns},password_hash`)
    .eq("admin_email", adminEmail)
    .maybeSingle()
  if (error) throw error
  return data ? schoolFromRow(data) : null
}

export async function findSchoolById(id) {
  const { data, error } = await supabase
    .from("schools")
    .select(publicColumns)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ? schoolFromRow(data) : null
}
