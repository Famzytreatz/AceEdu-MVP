import express from "express"

import {
  createSchoolSubjectOption,
  getSchoolCurriculum,
  listPendingSubjectRequests,
  reviewStudentSubjectRequest,
  saveClassSubjectRules,
  updateClassLevel,
  updateSchoolSubjectOption,
} from "../models/Curriculum.js"
import { updateSchoolType } from "../models/School.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute } from "../security.js"

const router = express.Router()
const schoolTypes = new Set(["Primary", "Secondary", "Combined", "Other"])

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function validateSubjectName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new Error("Subject name must contain 1 to 100 characters.")
  }
  return value.trim()
}

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const classLevels = await getSchoolCurriculum(
      req.session.schoolId,
      req.school.schoolType,
    )
    return res.json({ schoolType: req.school.schoolType, classLevels })
  }),
)

router.patch(
  "/school-type",
  asyncRoute(async (req, res) => {
    if (
      !isObject(req.body) ||
      Object.keys(req.body).some((key) => key !== "schoolType") ||
      !schoolTypes.has(req.body.schoolType)
    ) {
      return res.status(400).json({ error: "Choose a valid school type." })
    }
    const school = await updateSchoolType(
      req.session.schoolId,
      req.body.schoolType,
    )
    if (!school) return res.status(404).json({ error: "School not found." })
    const classLevels = await getSchoolCurriculum(
      req.session.schoolId,
      school.schoolType,
    )
    return res.json({ schoolType: school.schoolType, classLevels })
  }),
)

router.patch(
  "/classes/:classId",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.classId)) {
      return res.status(400).json({ error: "Class ID is invalid." })
    }
    if (
      !isObject(req.body) ||
      Object.keys(req.body).some(
        (key) => !["nickname", "isActive"].includes(key),
      ) ||
      (req.body.nickname !== null &&
        typeof req.body.nickname !== "string") ||
      typeof req.body.isActive !== "boolean"
    ) {
      return res.status(400).json({ error: "Class settings are invalid." })
    }
    const nickname = req.body.nickname?.trim() || ""
    if (nickname.length > 80) {
      return res.status(400).json({ error: "Class nickname cannot exceed 80 characters." })
    }
    try {
      const schoolClass = await updateClassLevel(
        req.session.schoolId,
        req.params.classId,
        { nickname, isActive: req.body.isActive },
      )
      if (!schoolClass) return res.status(404).json({ error: "Class not found." })
      return res.json({ schoolClass })
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  }),
)

router.put(
  "/classes/:classId/subject-rules",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.classId)) {
      return res.status(400).json({ error: "Class ID is invalid." })
    }
    const { minimumSubjects, maximumSubjects } = req.body || {}
    if (
      !Number.isInteger(minimumSubjects) ||
      minimumSubjects < 0 ||
      minimumSubjects > 50 ||
      !Number.isInteger(maximumSubjects) ||
      maximumSubjects < 1 ||
      maximumSubjects > 50 ||
      minimumSubjects > maximumSubjects
    ) {
      return res.status(400).json({
        error: "Set a minimum from 0 to 50 and a maximum from 1 to 50; minimum cannot exceed maximum.",
      })
    }
    const rules = await saveClassSubjectRules(
      req.session.schoolId,
      req.params.classId,
      minimumSubjects,
      maximumSubjects,
    )
    return res.json({ rules })
  }),
)

router.post(
  "/classes/:classId/subjects",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.classId)) {
      return res.status(400).json({ error: "Class ID is invalid." })
    }
    let name
    try {
      name = validateSubjectName(req.body?.name)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    if (typeof req.body?.isCompulsory !== "boolean") {
      return res.status(400).json({ error: "Choose whether this subject is compulsory." })
    }
    const subject = await createSchoolSubjectOption(
      req.session.schoolId,
      req.params.classId,
      name,
      req.body.isCompulsory,
    )
    return res.status(201).json({ subject })
  }),
)

router.patch(
  "/classes/:classId/subjects/:subjectId",
  asyncRoute(async (req, res) => {
    if (
      !isValidDatabaseId(req.params.classId) ||
      !isValidDatabaseId(req.params.subjectId)
    ) {
      return res.status(400).json({ error: "Subject ID is invalid." })
    }
    let name
    try {
      name = validateSubjectName(req.body?.name)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    if (
      typeof req.body?.isCompulsory !== "boolean" ||
      typeof req.body?.isActive !== "boolean"
    ) {
      return res.status(400).json({ error: "Subject settings are invalid." })
    }
    const subject = await updateSchoolSubjectOption(
      req.session.schoolId,
      req.params.classId,
      req.params.subjectId,
      {
        name,
        isCompulsory: req.body.isCompulsory,
        isActive: req.body.isActive,
      },
    )
    if (!subject) return res.status(404).json({ error: "Subject not found." })
    return res.json({ subject })
  }),
)

router.get(
  "/subject-requests",
  asyncRoute(async (req, res) => {
    return res.json({
      requests: await listPendingSubjectRequests(req.session.schoolId),
    })
  }),
)

router.patch(
  "/subject-requests/:requestId",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.requestId)) {
      return res.status(400).json({ error: "Subject request ID is invalid." })
    }
    const decision = req.body?.decision
    if (!["approved", "declined"].includes(decision)) {
      return res.status(400).json({ error: "Choose approve or decline." })
    }
    let updated
    try {
      updated = await reviewStudentSubjectRequest(
        req.session.schoolId,
        req.params.requestId,
        decision,
      )
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
    if (!updated) return res.status(404).json({ error: "Pending subject request not found." })
    return res.json({ status: decision })
  }),
)

export default router
