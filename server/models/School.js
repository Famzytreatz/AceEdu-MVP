import { supabase } from "../supabase.js"

const publicColumns =
  "id,public_school_id,school_name,school_type,country,state,city,address,school_email,school_phone,admin_name,admin_email,admin_phone,admin_role,slug,logo_url,created_at,updated_at"

function schoolFromRow(row) {
  return {
    _id: String(row.id),
    publicId: row.public_school_id,
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
    slug: row.slug,
    logoUrl: row.logo_url,
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

export async function findSchoolBySlug(slug) {
  const { data, error } = await supabase
    .from("schools")
    .select("public_school_id,school_name,slug,logo_url")
    .eq("slug", slug)
    .maybeSingle()
  if (error) throw error
  const school = data || (await findSchoolBySlugAlias(slug, "public_school_id,school_name,slug,logo_url"))
  return school ? publicSchoolFromRow(school) : null
}

export async function findSchoolLoginIdentityBySlug(slug) {
  const { data, error } = await supabase
    .from("schools")
    .select("id,public_school_id,school_name,slug,logo_url")
    .eq("slug", slug)
    .maybeSingle()
  if (error) throw error
  const school = data || (await findSchoolBySlugAlias(slug, "id,public_school_id,school_name,slug,logo_url"))
  return school ? loginIdentityFromRow(school) : null
}

async function findSchoolBySlugAlias(slug, columns) {
  const { data: alias, error: aliasError } = await supabase
    .from("school_slug_aliases")
    .select("school_id")
    .eq("slug", slug)
    .maybeSingle()
  if (aliasError) throw aliasError
  if (!alias) return null

  const { data, error } = await supabase
    .from("schools")
    .select(columns)
    .eq("id", alias.school_id)
    .maybeSingle()
  if (error) throw error
  return data
}

function publicSchoolFromRow(data) {
  return {
    publicId: data.public_school_id,
    schoolName: data.school_name,
    slug: data.slug,
    logoUrl: data.logo_url,
  }
}

function loginIdentityFromRow(data) {
  return {
    _id: String(data.id),
    publicId: data.public_school_id,
    schoolName: data.school_name,
    slug: data.slug,
    logoUrl: data.logo_url,
  }
}
