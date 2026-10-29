import { config } from "./config.js"

const authenticationKeys = [
  "schoolId",
  "portalMemberId",
  "portalSchoolId",
  "portalRole",
  "operatorId",
]

export function updateAuthenticationSession(req, updates) {
  const preserved = Object.fromEntries(
    authenticationKeys
      .filter((key) => req.session[key] !== undefined)
      .map((key) => [key, req.session[key]]),
  )

  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)

      Object.assign(req.session, preserved, updates)

      req.session.save((saveError) =>
        saveError ? reject(saveError) : resolve(),
      )
    })
  })
}

export function removeAuthenticationSession(req, res, keys) {
  for (const key of keys) delete req.session[key]

  const hasOtherAuthentication = authenticationKeys.some(
    (key) => req.session[key] !== undefined,
  )

  const finish = (error) => {
    if (error) return error

    if (!hasOtherAuthentication) {
      res.clearCookie("aceedu.sid", {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
      })
    }

    return null
  }

  if (!hasOtherAuthentication) {
    return new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        const result = finish(error)
        if (result) return reject(result)
        return resolve()
      })
    })
  }

  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      const result = finish(error)
      if (result) return reject(result)
      return resolve()
    })
  })
}
