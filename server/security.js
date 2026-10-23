import { config } from "./config.js"
import { isValidDatabaseId } from "./ids.js"
import { hasFeatureAccess } from "./entitlements.js"
import { getSchoolEntitlement } from "./models/Entitlement.js"
import { findActivePlatformOperatorById } from "./models/PlatformOperator.js"
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

export function requireSchool(req, res, next) {
  const schoolId = req.session?.schoolId
  if (!isValidDatabaseId(schoolId)) {
    return res.status(401).json({ error: "Sign in to access this school account." })
  }
  return findSchoolById(schoolId)
    .then((school) => {
      if (!school) return res.status(401).json({ error: "This school account is no longer available." })
      req.school = school
      return next()
    })
    .catch(next)
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

export function requireEntitlement(feature) {
  return (req, res, next) => {
    getSchoolEntitlement(req.session.schoolId)
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

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
