import bcrypt from "bcryptjs"
import express from "express"
import { config } from "../config.js"
import { createSchool, findSchoolByEmail, findSchoolById, schoolEmailExists } from "../models/School.js"
import { asyncRoute } from "../security.js"
import { normalizeEmail, validateRegistration } from "../validation.js"

const router = express.Router()
const passwordRounds = 12

function publicSchool(school) {
  return {
    id: school._id,
    schoolName: school.schoolName,
    schoolType: school.schoolType,
    country: school.country,
    state: school.state,
    city: school.city,
    address: school.address,
    schoolEmail: school.schoolEmail,
    schoolPhone: school.schoolPhone,
    adminName: school.adminName,
    adminEmail: school.adminEmail,
    adminPhone: school.adminPhone,
    adminRole: school.adminRole,
    createdAt: school.createdAt,
  }
}

function startSession(req, schoolId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)
      req.session.schoolId = schoolId.toString()
      req.session.save((saveError) => {
        if (saveError) return reject(saveError)
        return resolve()
      })
    })
  })
}

router.post(
  "/register",
  asyncRoute(async (req, res) => {
    let registration
    try {
      registration = validateRegistration(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    const existingSchool = await schoolEmailExists(registration.adminEmail)
    if (existingSchool) {
      return res.status(409).json({ error: "An account already exists for this administrator email." })
    }

    const passwordHash = await bcrypt.hash(registration.password, passwordRounds)
    delete registration.password

    let school
    try {
      school = await createSchool(registration, passwordHash)
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "An account already exists for this administrator email." })
      }
      throw error
    }

    await startSession(req, school._id)
    return res.status(201).json({ school: publicSchool(school) })
  }),
)

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    let email
    if (typeof req.body?.password !== "string" || !req.body.password || req.body.password.length > 128) {
      return res.status(400).json({ error: "Enter your email address and password." })
    }
    try {
      email = normalizeEmail(req.body.email)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    const school = await findSchoolByEmail(email)
    if (!school || !(await bcrypt.compare(req.body.password, school.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." })
    }

    await startSession(req, school._id)
    return res.json({ school: publicSchool(school) })
  }),
)

router.get(
  "/me",
  asyncRoute(async (req, res) => {
    if (!req.session?.schoolId) {
      return res.status(401).json({ error: "No school account is signed in." })
    }
    const school = await findSchoolById(req.session.schoolId)
    if (!school) {
      req.session.destroy(() => {})
      return res.status(401).json({ error: "This school account is no longer available." })
    }
    return res.json({ school: publicSchool(school) })
  }),
)

router.post(
  "/logout",
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

export default router
