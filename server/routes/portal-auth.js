import bcrypt from "bcryptjs"

import express from "express"

import {
  findActivePortalEnrollmentById,
  findPortalEnrollmentByCredentials,
  updatePortalPassword,
} from "../models/Portal.js"

import { findSchoolLoginIdentityBySlug } from "../models/School.js"

import { asyncRoute, createRequirePortalMember } from "../security.js"

import { featureEntitlements, hasFeatureAccess } from "../entitlements.js"

import { getSchoolEntitlement } from "../models/Entitlement.js"

import {
  validatePortalLogin,
  validateStudentPortalPassword,
} from "../portal-validation.js"
import { removeAuthenticationSession, updateAuthenticationSession } from "../session-auth.js"

const requirePortalMember = createRequirePortalMember()

function startPortalSession(req, member, schoolId) {
  return updateAuthenticationSession(req, {
    portalMemberId: String(member.id),
    portalSchoolId: String(schoolId),
    portalRole: member.role,
  })
}

function memberResponse(member, school, premiumAccess) {
  return {
    id: String(member.id),

    fullName: member.full_name,

    role: member.role,

    designation: member.designation,

    assignedClasses: member.assigned_classes ?? member.assignedClasses ?? "",

    subjects: member.subjects || "",

    passport: member.passport,

    ...(member.role === "student"
      ? { accessCode: member.access_pin }
      : {}),

    hasPortalPassword:
      member.hasPortalPassword ?? Boolean(member.password_hash),

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

  findActiveEnrollment = findActivePortalEnrollmentById,

  findEntitlement = getSchoolEntitlement,

  comparePassword = bcrypt.compare,

  hashPassword = (password) => bcrypt.hash(password, 12),

  setMemberPassword = updatePortalPassword,

  requireMember = requirePortalMember,

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

  router.patch(
    "/password",

    requireMember(),

    asyncRoute(async (req, res) => {
      let values

      try {
        values = validateStudentPortalPassword(req.body)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      const role = req.portalMember.role
      if (!["student", "teacher"].includes(role)) {
        return res.status(403).json({ error: "This account cannot change a portal password." })
      }

      if (req.portalMember.hasPortalPassword) {
        if (!values.currentPassword) {
          return res.status(400).json({ error: "Enter your current password." })
        }

        const member = await findActiveEnrollment(
          req.portalMember.schoolId,
          req.portalMember.id,
        )

        if (
          !member ||
          String(member.id) !== req.portalMember.id ||
          !(await comparePassword(
            values.currentPassword,
            member.password_hash,
          ))
        ) {
          return res
            .status(401)
            .json({ error: "Your current password is incorrect." })
        }
      }

      const passwordHash = await hashPassword(values.newPassword)
      const updated = await setMemberPassword(
        req.portalMember.schoolId,
        req.portalMember.id,
        role,
        passwordHash,
      )

      if (!updated) {
        return res
          .status(401)
          .json({ error: "This student account is no longer active." })
      }

      return res.json({ hasPortalPassword: true })
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
            access_pin: req.portalMember.accessPin,
            hasPortalPassword: req.portalMember.hasPortalPassword,
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
      await removeAuthenticationSession(req, res, [
        "portalMemberId",
        "portalSchoolId",
        "portalRole",
      ])

      return res.status(204).end()
    }),
  )

  return router
}

export default createPortalAuthRouter()
