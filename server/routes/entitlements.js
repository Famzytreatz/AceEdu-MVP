import express from "express"
import { getSchoolEntitlement, requestSchoolVerification } from "../models/Entitlement.js"
import { asyncRoute } from "../security.js"

const router = express.Router()

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const entitlement = await getSchoolEntitlement(req.session.schoolId)
    return res.json({ entitlement })
  }),
)

router.post(
  "/verification-requests",
  asyncRoute(async (req, res) => {
    const registrationId =
      typeof req.body?.registrationId === "string"
        ? req.body.registrationId.trim()
        : ""
    if (registrationId.length < 2 || registrationId.length > 80) {
      return res.status(400).json({
        error: "Enter an official school registration ID between 2 and 80 characters.",
      })
    }
    const request = await requestSchoolVerification(
      req.session.schoolId,
      registrationId,
    )
    return res.status(202).json({ request })
  }),
)

export default router
