import { supabase } from "../supabase.js"

function announcementFromRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    type: row.announcement_type,
    audience: row.audience,
    eventDate: row.event_date,
    createdAt: row.created_at,
    source: "school",
    author: "School administration",
  }
}

export async function listSchoolAnnouncements(schoolId) {
  const { data, error } = await supabase
    .from("school_announcements")
    .select("id,title,body,announcement_type,audience,event_date,created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return data.map(announcementFromRow)
}

export async function getPortalAnnouncements(schoolId, audience) {
  const { data, error } = await supabase
    .from("school_announcements")
    .select("id,title,body,announcement_type,audience,event_date,created_at")
    .eq("school_id", schoolId)
    .in("audience", ["all", audience])
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw error
  return data.map(announcementFromRow)
}

export async function createSchoolAnnouncement(schoolId, values) {
  const { data, error } = await supabase
    .from("school_announcements")
    .insert({
      school_id: schoolId,
      title: values.title,
      body: values.body,
      announcement_type: values.type,
      audience: values.audience,
      event_date: values.eventDate,
    })
    .select("id,title,body,announcement_type,audience,event_date,created_at")
    .single()
  if (error) throw error
  return announcementFromRow(data)
}

export async function deleteSchoolAnnouncement(schoolId, announcementId) {
  const { data, error } = await supabase
    .from("school_announcements")
    .delete()
    .eq("school_id", schoolId)
    .eq("id", announcementId)
    .select("id")
    .maybeSingle()
  if (error) throw error
  return data !== null
}
