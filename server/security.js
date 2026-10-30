import { config } from "./config.js"
import { isValidDatabaseId } from "./ids.js"
import { hasFeatureAccess } from "./entitlements.js"
import { getSchoolEntitlement } from "./models/Entitlement.js"
import { findActivePlatformOperatorById } from "./models/PlatformOperator.js"
import { findActivePortalEnrollmentById } from "./models/Portal.js"
import { findSchoolById } from "./models/School.js"

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"])

export function requireAllowedOrigin(req, res, next) {
  if (safeMethods.has(req.method)) return next()

  const origin = req.get("origin")
  const sameHostOrigin = !config.isProduction && origin === `${req.protocol}://${req.get("host")}`
  if (origin !== config.appOrigin && !sameHostOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." })
  }

  return next()
}

export function createRequireSchool(findSchool = findSchoolById) {
  return function requireSchool(req, res, next) {
    const schoolId = req.session?.schoolId
    if (!isValidDatabaseId(schoolId)) {
      return res.status(401).json({ error: "Sign in to access this school account." })
    }
    return findSchool(schoolId)
      .then((school) => {
        if (!school) return res.status(401).json({ error: "This school account is no longer available." })
        req.school = school
        return next()
      })
      .catch(next)
  }
}

export const requireSchool = createRequireSchool()

export function createRequirePortalMember({
  findEnrollment = findActivePortalEnrollmentById,
  findSchool = findSchoolById,
} = {}) {
  return function requirePortalMember(role) {
    return (req, res, next) => {
      const memberId = req.session?.portalMemberId
      const schoolId = req.session?.portalSchoolId
      const sessionRole = req.session?.portalRole
      if (
        !isValidDatabaseId(memberId) ||
        !isValidDatabaseId(schoolId) ||
        !["student", "teacher"].includes(sessionRole) ||
        (role && sessionRole !== role)
      ) {
        return res.status(401).json({ error: "Sign in to your school portal." })
      }

      return Promise.all([
        findEnrollment(schoolId, memberId),
        findSchool(schoolId),
      ])
        .then(([member, school]) => {
          if (
            !member ||
            !school ||
            String(member.school_id) !== String(schoolId) ||
            member.role !== sessionRole
          ) {
            return res.status(401).json({ error: "This portal account is no longer available." })
          }
          req.portalMember = {
            id: String(member.id),
            schoolId: String(member.school_id),
            role: member.role,
            fullName: member.full_name,
            designation: member.designation,
            assignedClasses: member.assigned_classes,
            subjects: member.subjects,
            passport: member.passport,
            accessPin: member.access_pin,
            classLevelId: member.class_level_id ? String(member.class_level_id) : null,
            hasPortalPassword: Boolean(member.password_hash),
          }
          req.school = school
          return next()
        })
        .catch(next)
    }
  }
}

export function requirePlatformOperator(req, res, next) {
  const operatorId = req.session?.operatorId
  if (!isValidDatabaseId(operatorId)) {
    return res.status(401).json({ error: "Sign in with a platform operator account." })
  }
  return findActivePlatformOperatorById(operatorId)
    .then((operator) => {
      if (!operator) return res.status(401).json({ error: "This platform operator account is unavailable." })
      req.platformOperator = operator
      return next()
    })
    .catch(next)
}

export function createRequireEntitlement(findEntitlement = getSchoolEntitlement) {
  return (feature) => (req, res, next) => {
    const schoolId = req.school?._id ?? req.session.schoolId
    findEntitlement(schoolId)
      .then((entitlement) => {
        if (!hasFeatureAccess(entitlement, feature)) {
          return res.status(403).json({
            error: "This feature requires an active Premium entitlement.",
            code: "PREMIUM_REQUIRED",
          })
        }
        req.entitlement = entitlement
        return next()
      })
      .catch(next)
  }
}

export const requireEntitlement = createRequireEntitlement()

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
