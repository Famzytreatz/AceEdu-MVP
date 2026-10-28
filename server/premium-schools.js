export function mapActivePremiumSchools(rows) {
  return rows.map((row) => ({
    schoolId: row.public_school_id,
    schoolName: row.school_name,
    country: row.country,
    state: row.state,
    city: row.city,
    accessType: row.access_type,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
  }))
}
