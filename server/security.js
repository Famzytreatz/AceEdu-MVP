import { config } from "./config.js"
import { isValidDatabaseId } from "./ids.js"
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

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
