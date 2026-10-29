export const premiumTrialDays = 90

export const featureEntitlements = Object.freeze({
  dashboard: "mvp",
  studentRegistry: "mvp",
  staffRegistry: "mvp",
  classes: "premium",
  academicRecords: "premium",
  attendance: "premium",
  examinations: "premium",
  financialManagement: "premium",
  advancedReports: "premium",
  studentPortal: "premium",
  teacherPortal: "premium",
  parentPortal: "premium",
})

export function getEffectivePlan(entitlement, now = Date.now()) {
  if (entitlement?.plan === "premium") return "premium"
  const start = Date.parse(entitlement?.trialStartedAt || "")
  const end = Date.parse(entitlement?.trialEndsAt || "")
  return Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= now &&
    now < end
    ? "premium"
    : "mvp"
}

export function hasFeatureAccess(entitlement, feature, now = Date.now()) {
  const requiredPlan = featureEntitlements[feature]
  if (!requiredPlan) return false
  if (requiredPlan === "mvp") return true
  return getEffectivePlan(entitlement, now) === "premium"
}
