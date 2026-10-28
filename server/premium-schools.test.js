import assert from "node:assert/strict"
import test from "node:test"

import { mapActivePremiumSchools } from "./premium-schools.js"

test("active Premium school records map to the operator console contract", () => {
  assert.deepEqual(
    mapActivePremiumSchools([
      {
        public_school_id: "80415273906182740519362847051936",
        school_name: "Bright Future Academy",
        country: "Nigeria",
        state: "Lagos",
        city: "Ikeja",
        access_type: "trial",
        trial_started_at: "2026-10-27T18:00:00.000Z",
        trial_ends_at: "2027-01-25T18:00:00.000Z",
      },
    ]),
    [
      {
        schoolId: "80415273906182740519362847051936",
        schoolName: "Bright Future Academy",
        country: "Nigeria",
        state: "Lagos",
        city: "Ikeja",
        accessType: "trial",
        trialStartedAt: "2026-10-27T18:00:00.000Z",
        trialEndsAt: "2027-01-25T18:00:00.000Z",
      },
    ],
  )
})
