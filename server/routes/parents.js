import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import express from "express"

import {
  listSchoolParents,
  resetParentPassword,
  setParentStudents,
} from "../models/Parents.js"
import { sendParentSetupSms } from "../parent-notifications.js"
import { logError } from "../error-logging.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requireEntitlement } from "../security.js"
import {
  validateParentStudentsPayload,
} from "../premium-validation.js"

const router = express.Router()

router.use(requireEntitlement("parentPortal"))

function temporaryPassword() {
  return randomBytes(12).toString("base64url")
}

router.get(
  "/",
  asyncRoute(async (req, res) => {
    return res.json({ parents: await listSchoolParents(req.session.schoolId) })
  }),
)

router.put(
  "/:parentId/students",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.parentId)) {
      return res.status(400).json({ error: "The parent account ID is invalid." })
    }
    let values
    try {
      values = validateParentStudentsPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    try {
      await setParentStudents(
        req.session.schoolId,
        req.params.parentId,
        values.studentIds,
      )
      const parent = (await listSchoolParents(req.session.schoolId)).find(
        (item) => item.id === req.params.parentId,
      )
      if (!parent) return res.status(404).json({ error: "Parent account not found." })
      return res.json({ parent })
    } catch (error) {
      if (error?.code === "P0002") {
        return res.status(404).json({ error: "Parent account not found." })
      }
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  }),
)

router.post(
  "/:parentId/password/reset",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.parentId)) {
      return res.status(400).json({ error: "The parent account ID is invalid." })
    }
    const password = temporaryPassword()
    const passwordHash = await bcrypt.hash(password, 12)
    const updated = await resetParentPassword(
      req.session.schoolId,
      req.params.parentId,
      passwordHash,
    )
    if (!updated) return res.status(404).json({ error: "Parent account not found." })
    const parent = (await listSchoolParents(req.session.schoolId)).find(
      (item) => item.id === req.params.parentId,
    )
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found." })
    }

    try {
      const delivery = await sendParentSetupSms({
        phone: parent.phone,
        parentName: parent.fullName,
        schoolName: req.school.schoolName,
        schoolSlug: req.school.slug,
        setupCode: password,
      })
      return res.json({
        sent: delivery.delivered,
        ...(!delivery.delivered
          ? { setupCode: password, deliveryIssue: delivery.reason }
          : {}),
      })
    } catch (deliveryError) {
      logError("Parent setup SMS delivery failed:", deliveryError, req)
      return res.json({
        sent: false,
        setupCode: password,
        deliveryIssue: "delivery_failed",
      })
    }
  }),
)

export default router
