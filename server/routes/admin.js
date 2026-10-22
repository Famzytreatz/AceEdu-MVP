import bcrypt from "bcryptjs"

import { randomInt } from "node:crypto"

import express from "express"

import {
  countEnrollments,
  createEnrollment,
  deleteEnrollment,
  enrollmentPinExists,
  iterateEnrollments,
  listEnrollments,
  verifyEnrollment,
} from "../models/Enrollment.js"

import { isValidDatabaseId } from "../ids.js"

import { asyncRoute } from "../security.js"

import { validateEnrollment } from "../validation.js"

const router = express.Router()

const pageSize = 50

function csvCell(value) {
  let text = String(value ?? "")

  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`

  return `"${text.replaceAll('"', '""')}"`
}

async function makeAccessPin(schoolId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accessPin = String(randomInt(100000, 1000000))

    const exists = await enrollmentPinExists(schoolId, accessPin)

    if (!exists) return accessPin
  }

  throw new Error("Could not generate an unused access PIN. Please try again.")
}

router.get(
  "/dashboard",

  asyncRoute(async (req, res) => {
    const schoolId = req.session.schoolId

    const [students, staff, total] = await Promise.all([
      countEnrollments(schoolId, ["student"]),

      countEnrollments(schoolId, ["teacher", "sub-admin", "school-admin"]),

      countEnrollments(schoolId),
    ])

    return res.json({ school: req.school, metrics: { students, staff, total } })
  }),
)

router.get(
  "/users",

  asyncRoute(async (req, res) => {
    const schoolId = req.session.schoolId

    const queryText =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : ""

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : ""

    if (cursor && !isValidDatabaseId(cursor)) {
      return res.status(400).json({ error: "The registry cursor is invalid." })
    }

    const records = await listEnrollments({ schoolId, queryText, cursor })

    const hasMore = records.length > pageSize

    const items = records.slice(0, pageSize)

    return res.json({
      items,

      nextCursor: hasMore ? items.at(-1)._id.toString() : null,
    })
  }),
)

router.post(
  "/users",

  asyncRoute(async (req, res) => {
    let values

    try {
      values = validateEnrollment(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    const passwordHash = values.password
      ? await bcrypt.hash(values.password, 12)
      : null

    delete values.password

    values.passwordHash = passwordHash

    const schoolId = req.session.schoolId

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const enrollment = await createEnrollment({
          schoolId,

          values,

          accessPin: await makeAccessPin(schoolId),
        })

        return res.status(201).json({ enrollment })
      } catch (error) {
        if (error?.code === "23505" && attempt < 4) continue

        throw error
      }
    }

    throw new Error("Could not create the registry entry after retrying.")
  }),
)

router.patch(
  "/users/:userId/verify",

  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.userId)) {
      return res
        .status(400)
        .json({ error: "The registry entry ID is invalid." })
    }

    const enrollment = await verifyEnrollment(
      req.session.schoolId,
      req.params.userId,
    )

    if (!enrollment)
      return res.status(404).json({ error: "Registry entry not found." })

    return res.json({ enrollment })
  }),
)

router.delete(
  "/users/:userId",

  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.userId)) {
      return res
        .status(400)
        .json({ error: "The registry entry ID is invalid." })
    }

    const deleted = await deleteEnrollment(
      req.session.schoolId,
      req.params.userId,
    )

    if (!deleted)
      return res.status(404).json({ error: "Registry entry not found." })

    return res.status(204).end()
  }),
)

router.get(
  "/users/export.csv",

  asyncRoute(async (req, res) => {
    const schoolId = req.session.schoolId

    const schoolName = req.school.schoolName

    const filename =
      schoolName
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "school"

    res.setHeader("Content-Type", "text/csv; charset=utf-8")

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}-registry.csv"`,
    )

    res.write("Name,Role,Class or designation,Access PIN,Status,Created\n")

    for await (const record of iterateEnrollments(schoolId)) {
      if (res.destroyed) break

      const cells = [
        record.fullName,

        record.role,

        record.designation,

        record.accessPin,

        record.status,

        record.createdAt,
      ]

      res.write(`${cells.map(csvCell).join(",")}\n`)
    }

    if (!res.destroyed) res.end()
  }),
)

export default router
