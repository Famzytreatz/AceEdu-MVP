import { supabase } from "../supabase.js"

function operatorFromRow(row) {
  return {
    id: String(row.id),
    email: row.email,
    passwordHash: row.password_hash,
    isActive: row.is_active,
  }
}

export async function findPlatformOperatorByEmail(email) {
  const { data, error } = await supabase
    .from("platform_operators")
    .select("id,email,password_hash,is_active")
    .eq("email", email)
    .maybeSingle()
  if (error) throw error
  return data ? operatorFromRow(data) : null
}

export async function findActivePlatformOperatorById(id) {
  const { data, error } = await supabase
    .from("platform_operators")
    .select("id,email,is_active")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error
  return data ? { id: String(data.id), email: data.email } : null
}

export async function createPlatformOperator(email, passwordHash) {
  const { error } = await supabase.from("platform_operators").insert({
    email,
    password_hash: passwordHash,
  })
  if (error) throw error
}
