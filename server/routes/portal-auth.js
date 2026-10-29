import bcrypt from "bcryptjs"

import express from "express"

import { config } from "../config.js"

import { findPortalEnrollmentByCredentials } from "../models/Portal.js"

import { findSchoolLoginIdentityBySlug } from "../models/School.js"

import { asyncRoute, createRequirePortalMember } from "../security.js"

import { featureEntitlements, hasFeatureAccess } from "../entitlements.js"

import { getSchoolEntitlement } from "../models/Entitlement.js"

import { validatePortalLogin } from "../portal-validation.js"

const requirePortalMember = createRequirePortalMember()

function startPortalSession(req, member, schoolId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)

      req.session.portalMemberId = String(member.id)

      req.session.portalSchoolId = String(schoolId)

      req.session.portalRole = member.role

      req.session.save((saveError) =>
        saveError ? reject(saveError) : resolve(),
      )
    })
  })
}

function memberResponse(member, school, premiumAccess) {
  return {
    id: String(member.id),

    fullName: member.full_name,

    role: member.role,

    designation: member.designation,

    passport: member.passport,

    school: {
      schoolName: school.schoolName,

      slug: school.slug,

      logoUrl: school.logoUrl || null,
    },

    premiumAccess,
  }
}

export function createPortalAuthRouter({
  findSchool = findSchoolLoginIdentityBySlug,

  findEnrollment = findPortalEnrollmentByCredentials,

  findEntitlement = getSchoolEntitlement,

  comparePassword = bcrypt.compare,

  startSession = startPortalSession,
} = {}) {
  const router = express.Router()

  router.post(
    "/login",

    asyncRoute(async (req, res) => {
      let credentials

      try {
        credentials = validatePortalLogin(req.body)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      const school = await findSchool(credentials.schoolSlug)

      if (!school)
        return res.status(404).json({ error: "School space not found." })

      const member = await findEnrollment(
        school._id,

        credentials.accessPin,
      )

      const hasPassword =
        typeof member?.password_hash === "string" && member.password_hash

      const passwordMatches = hasPassword
        ? Boolean(credentials.password) &&
          await comparePassword(credentials.password, member.password_hash)
        : member?.role === "student" && !credentials.password

      if (
        !member ||
        !["student", "teacher"].includes(member.role) ||
        !passwordMatches
      ) {
        return res
          .status(401)
          .json({
            error: "Portal details are incorrect or the account is not active.",
          })
      }

      await startSession(req, member, school._id)

      const entitlement = await findEntitlement(school._id)

      const feature =
        member.role === "student" ? "studentPortal" : "teacherPortal"

      const premiumAccess = hasFeatureAccess(entitlement, feature)

      return res.json({
        member: memberResponse(member, school, premiumAccess),

        ...(premiumAccess ? {} : { code: "PREMIUM_REQUIRED" }),
      })
    }),
  )

  router.get(
    "/me",

    requirePortalMember(),

    asyncRoute(async (req, res) => {
      const entitlement = await findEntitlement(req.portalMember.schoolId)

      const feature =
        req.portalMember.role === "student" ? "studentPortal" : "teacherPortal"

      const school = req.school

      return res.json({
        member: memberResponse(
          {
            id: req.portalMember.id,

            full_name: req.portalMember.fullName,

            role: req.portalMember.role,

            designation: req.portalMember.designation,

            passport: req.portalMember.passport,
          },

          school,

          hasFeatureAccess(entitlement, feature),
        ),
      })
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

  return router
}

export default createPortalAuthRouter()
