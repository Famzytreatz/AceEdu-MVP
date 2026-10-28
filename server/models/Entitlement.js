import { supabase } from "../supabase.js"
import { mapActivePremiumSchools } from "../premium-schools.js"

export async function getSchoolEntitlement(schoolId) {
  const { data, error } = await supabase.rpc("get_school_entitlement", {
    target_school_id: schoolId,
  })
  if (error) throw error
  return data
}

export async function requestSchoolVerification(schoolId, registrationId) {
  const { data, error } = await supabase.rpc("request_school_verification", {
    target_school_id: schoolId,
    submitted_registration_id: registrationId,
  })
  if (error) throw error
  return data
}

export async function listVerificationRequests() {
  const { data, error } = await supabase
    .from("school_verification_requests")
    .select(
      "id,school_id,school_name,country,state,city,registration_identity_id,status,review_reason,created_at,school_trial_identities(normalized_registration_id)",
    )
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw error
  return data
}

export async function listActivePremiumSchools() {
  const { data, error } = await supabase.rpc("list_active_premium_schools")
  if (error) throw error
  return mapActivePremiumSchools(data)
}

export async function approveSchoolVerification(requestId, operatorId) {
  const { data, error } = await supabase.rpc("approve_school_verification", {
    target_request_id: requestId,
    target_operator_id: operatorId,
  })
  if (error) throw error
  return data
}

export async function rejectSchoolVerification(requestId, operatorId, reason) {
  const { data, error } = await supabase.rpc("reject_school_verification", {
    target_request_id: requestId,
    target_operator_id: operatorId,
    rejection_reason: reason,
  })
  if (error) throw error
  return data
}
