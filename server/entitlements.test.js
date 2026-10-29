import assert from "node:assert/strict"
import test from "node:test"
import {
  featureEntitlements,
  getEffectivePlan,
  hasFeatureAccess,
  premiumTrialDays,
} from "./entitlements.js"

const now = Date.parse("2026-01-15T00:00:00.000Z")

test("MVP features remain available without an entitlement record", () => {
  assert.equal(hasFeatureAccess(null, "dashboard", now), true)
  assert.equal(hasFeatureAccess(null, "studentRegistry", now), true)
})

test("Premium features require an active plan or an active trial", () => {
  assert.equal(hasFeatureAccess(null, "attendance", now), false)
  assert.equal(
    hasFeatureAccess(
      { trialStartedAt: "2026-01-01T00:00:00.000Z", trialEndsAt: "2026-02-01T00:00:00.000Z" },
      "attendance",
      now,
    ),
    true,
  )
  assert.equal(
    hasFeatureAccess(
      { trialStartedAt: "2025-01-01T00:00:00.000Z", trialEndsAt: "2025-04-01T00:00:00.000Z" },
      "attendance",
      now,
    ),
    false,
  )
  assert.equal(
    hasFeatureAccess(
      { trialStartedAt: "2026-01-15T00:00:00.000Z", trialEndsAt: "2026-02-01T00:00:00.000Z" },
      "attendance",
      now,
    ),
    true,
  )
  assert.equal(
    hasFeatureAccess(
      { trialStartedAt: "2026-01-01T00:00:00.000Z", trialEndsAt: "2026-01-15T00:00:00.000Z" },
      "attendance",
      now,
    ),
    false,
  )
  assert.equal(hasFeatureAccess({ plan: "premium" }, "attendance", now), true)
})

test("unknown features are denied and trial duration is fixed", () => {
  assert.equal(hasFeatureAccess({ plan: "premium" }, "unlistedFeature", now), false)
  assert.equal(featureEntitlements.attendance, "premium")
  assert.equal(premiumTrialDays, 90)
})

test("every declared Premium entitlement activates for a Premium plan and active trial", () => {
  const activeTrial = {
    trialStartedAt: "2026-01-01T00:00:00.000Z",
    trialEndsAt: "2026-04-01T00:00:00.000Z",
  }
  for (const [feature, requiredPlan] of Object.entries(featureEntitlements)) {
    if (requiredPlan !== "premium") continue
    assert.equal(hasFeatureAccess({ plan: "premium" }, feature, now), true, `${feature} plan access`)
    assert.equal(hasFeatureAccess(activeTrial, feature, now), true, `${feature} trial access`)
    assert.equal(
      hasFeatureAccess(
        {
          trialStartedAt: "2025-01-01T00:00:00.000Z",
          trialEndsAt: "2025-04-01T00:00:00.000Z",
        },
        feature,
        now,
      ),
      false,
      `${feature} access after trial expiry`,
    )
  }
})

test("effective plan falls back to MVP for invalid or future trial dates", () => {
  assert.equal(getEffectivePlan(null, now), "mvp")
  assert.equal(
    getEffectivePlan(
      { trialStartedAt: "2026-01-16T00:00:00.000Z", trialEndsAt: "2026-04-16T00:00:00.000Z" },
      now,
    ),
    "mvp",
  )
  assert.equal(
    getEffectivePlan(
      { trialStartedAt: "invalid", trialEndsAt: "2026-04-16T00:00:00.000Z" },
      now,
    ),
    "mvp",
  )
})
