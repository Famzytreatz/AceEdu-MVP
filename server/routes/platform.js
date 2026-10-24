import bcrypt from "bcryptjs"
import express from "express"
import { config } from "../config.js"
import { findActivePlatformOperatorById, findPlatformOperatorByEmail } from "../models/PlatformOperator.js"
import {
  approveSchoolVerification,
  listVerificationRequests,
  rejectSchoolVerification,
} from "../models/Entitlement.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requirePlatformOperator } from "../security.js"
import { normalizeEmail } from "../validation.js"

const router = express.Router()

function startOperatorSession(req, operatorId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)
      req.session.operatorId = operatorId
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()))
    })
  })
}

function compareNames(first, second) {
  const left = first.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "")
  const right = second.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "")
  if (!left || !right) return 0
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column]
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length)
}

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    if (
      typeof req.body?.password !== "string" ||
      !req.body.password ||
      req.body.password.length > 128
    ) {
      return res.status(400).json({ error: "Enter your operator email address and password." })
    }
    let email
    try {
      email = normalizeEmail(req.body.email)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const operator = await findPlatformOperatorByEmail(email)
    if (
      !operator?.isActive ||
      !(await bcrypt.compare(req.body.password, operator.passwordHash))
    ) {
      return res.status(401).json({ error: "Operator email or password is incorrect." })
    }
    await startOperatorSession(req, operator.id)
    return res.json({ operator: { id: operator.id, email: operator.email } })
  }),
)

router.get(
  "/me",
  asyncRoute(async (req, res) => {
    const operatorId = req.session?.operatorId
    if (!isValidDatabaseId(operatorId)) {
      return res.status(401).json({ error: "No platform operator is signed in." })
    }
    const operator = await findActivePlatformOperatorById(operatorId)
    if (!operator) return res.status(401).json({ error: "This platform operator account is unavailable." })
    return res.json({ operator })
  }),
)

router.post(
  "/logout",
  requirePlatformOperator,
  asyncRoute(async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()))
    })
    res.clearCookie("aceedu.sid", {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/",
    })
    return res.status(204).end()
  }),
)

router.use(requirePlatformOperator)

router.get(
  "/verification-requests",
  asyncRoute(async (_req, res) => {
    const allRequests = await listVerificationRequests()
    const openRequests = allRequests
      .filter((request) => ["pending", "review_required"].includes(request.status))
      .sort((first, second) => new Date(first.created_at) - new Date(second.created_at))
    const requests = openRequests.map((request) => {
      const possibleMatches = allRequests
        .filter((candidate) => candidate.school_id !== request.school_id)
        .filter(
          (candidate) =>
            candidate.registration_identity_id === request.registration_identity_id ||
            (candidate.country.toLocaleLowerCase() === request.country.toLocaleLowerCase() &&
              candidate.state.toLocaleLowerCase() === request.state.toLocaleLowerCase() &&
              candidate.city.toLocaleLowerCase() === request.city.toLocaleLowerCase() &&
              compareNames(candidate.school_name, request.school_name) >= 0.72),
        )
        .slice(0, 5)
        .map((candidate) => ({
          schoolName: candidate.school_name,
          status: candidate.status,
          sameRegistrationIdentity:
            candidate.registration_identity_id === request.registration_identity_id,
        }))
      return {
        id: String(request.id),
        schoolId: String(request.school_id),
        schoolName: request.school_name,
        country: request.country,
        state: request.state,
        city: request.city,
        status: request.status,
        reviewReason: request.review_reason,
        officialRegistrationId:
          request.school_trial_identities?.normalized_registration_id ?? "",
        createdAt: request.created_at,
        possibleMatches,
      }
    })
    return res.json({ requests })
  }),
)

router.post(
  "/verification-requests/:requestId/approve",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.requestId)) {
      return res.status(400).json({ error: "The verification request ID is invalid." })
    }
    const result = await approveSchoolVerification(
      req.params.requestId,
      req.platformOperator.id,
    )
    return res.json({ result })
  }),
)

router.post(
  "/verification-requests/:requestId/reject",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.requestId)) {
      return res.status(400).json({ error: "The verification request ID is invalid." })
    }
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : ""
    if (!reason || reason.length > 500) {
      return res.status(400).json({ error: "Provide a review reason of 1 to 500 characters." })
    }
    const result = await rejectSchoolVerification(
      req.params.requestId,
      req.platformOperator.id,
      reason,
    )
    return res.json({ result })
  }),
)

export default router
