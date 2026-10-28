import express from "express"
import { findSchoolBySlug } from "../models/School.js"
import { asyncRoute } from "../security.js"
import { publicSchoolBranding, validateSchoolSlug } from "../school-slugs.js"

export function createSchoolsRouter(findSchool = findSchoolBySlug) {
  const router = express.Router()

  router.get(
    "/:slug",
    asyncRoute(async (req, res) => {
      let slug
      try {
        slug = validateSchoolSlug(req.params.slug)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      const school = await findSchool(slug)
      if (!school) return res.status(404).json({ error: "School space not found." })

      return res.json({ school: publicSchoolBranding(school) })
    }),
  )

  return router
}

export default createSchoolsRouter()
