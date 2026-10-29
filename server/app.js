import express from "express"

import path from "node:path"

import { fileURLToPath } from "node:url"

import session from "express-session"

import rateLimit from "express-rate-limit"

import helmet from "helmet"

import { config } from "./config.js"

import { logError } from "./error-logging.js"

import { supabase } from "./supabase.js"

import { requireAllowedOrigin, requireSchool } from "./security.js"

import { SupabaseSessionStore } from "./session-store.js"

import adminRouter from "./routes/admin.js"

import authRouter from "./routes/auth.js"

import platformRouter from "./routes/platform.js"

import schoolsRouter from "./routes/schools.js"

import portalAuthRouter from "./routes/portal-auth.js"

import { studentRouter, teacherRouter } from "./routes/portal.js"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")

  if (config.trustProxy) app.set("trust proxy", 1)

  const store = new SupabaseSessionStore(supabase)

  app.use(helmet())

  const jsonParser = express.json({ limit: "2mb", strict: true })
  app.use((req, res, next) => {
    if (
      req.method === "POST" &&
      req.path === "/api/portal/teacher/classroom/posts"
    ) {
      return next()
    }
    return jsonParser(req, res, next)
  })

  app.use(
    session({
      name: "aceedu.sid",

      secret: config.sessionSecret,

      store,

      resave: false,

      saveUninitialized: false,

      cookie: {
        httpOnly: true,

        secure: config.isProduction,

        sameSite: "lax",

        maxAge: 8 * 60 * 60 * 1000,

        path: "/",
      },
    }),
  )

  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store")

    next()
  })

  app.use("/api", requireAllowedOrigin)

  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,

    limit: 5,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: { error: "Too many registration attempts. Try again later." },
  })

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 10,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: { error: "Too many sign-in attempts. Try again later." },
  })

  const operatorLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 5,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: { error: "Too many platform sign-in attempts. Try again later." },
  })

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }))

  app.use("/api/auth/register", registrationLimiter)

  app.use("/api/auth/login", loginLimiter)

  app.use("/api/portal/login", loginLimiter)

  app.use("/api/platform/login", operatorLoginLimiter)

  app.use("/api/auth", authRouter)

  app.use("/api/schools", schoolsRouter)

  app.use("/api/portal", portalAuthRouter)

  app.use("/api/portal/student", studentRouter)

  app.use("/api/portal/teacher", teacherRouter)

  app.use("/api/platform", platformRouter)

  app.use("/api/admin", requireSchool, adminRouter)

  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  )

  if (config.isProduction) {
    const clientDistPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),

      "../dist",
    )

    app.use(express.static(clientDistPath))

    app.get(/.*/, (req, res, next) => {
      if (!req.accepts("html")) return next()

      res.sendFile(path.join(clientDistPath, "index.html"), (error) => {
        if (error) next(error)
      })
    })
  }

  app.use((error, req, res, _next) => {
    logError("AceEdu API request failed:", error, req)

    if (res.headersSent) return res.end()

    if (error.type === "entity.parse.failed") {
      return res

        .status(400)

        .json({ error: "Request body must contain valid JSON." })
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large." })
    }

    return res

      .status(500)

      .json({ error: "The request could not be completed. Please try again." })
  })

  return app
}
