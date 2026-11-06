import express from "express"

import {
  createSchoolAnnouncement,
  deleteSchoolAnnouncement,
  listSchoolAnnouncements,
} from "../models/Communications.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requireEntitlement } from "../security.js"
import { validateSchoolAnnouncementPayload } from "../premium-validation.js"

const router = express.Router()

router.use(requireEntitlement("parentPortal"))

router.get(
  "/",
  asyncRoute(async (req, res) => {
    return res.json({
      announcements: await listSchoolAnnouncements(req.session.schoolId),
    })
  }),
)

router.post(
  "/",
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateSchoolAnnouncementPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(201).json({
      announcement: await createSchoolAnnouncement(
        req.session.schoolId,
        values,
      ),
    })
  }),
)

router.delete(
  "/:announcementId",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.announcementId)) {
      return res.status(400).json({ error: "The announcement ID is invalid." })
    }
    const deleted = await deleteSchoolAnnouncement(
      req.session.schoolId,
      req.params.announcementId,
    )
    if (!deleted) return res.status(404).json({ error: "Announcement not found." })
    return res.status(204).end()
  }),
)

export default router
