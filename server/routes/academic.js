import express from "express"
import {
  assignStudentsToClass,
  createAcademicYear,
  createSchoolClass,
  createSchoolSubject,
  findSchoolTeacher,
  getAcademicSetup,
  setCurrentAcademicYear,
} from "../models/Academic.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requireEntitlement } from "../security.js"
import {
  validateAcademicName,
  validateAcademicYearPayload,
} from "../academic-validation.js"

const router = express.Router()
router.use(requireEntitlement("classes"))

router.get(
  "/",
  asyncRoute(async (req, res) => {
    return res.json(await getAcademicSetup(req.session.schoolId))
  }),
)

router.post(
  "/years",
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateAcademicYearPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const year = await createAcademicYear(req.session.schoolId, values)
    return res.status(201).json({ year })
  }),
)

router.patch(
  "/years/:yearId/current",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.yearId)) {
      return res.status(400).json({ error: "Academic year ID is invalid." })
    }
    await setCurrentAcademicYear(req.session.schoolId, req.params.yearId)
    return res.status(204).end()
  }),
)

router.post(
  "/classes",
  asyncRoute(async (req, res) => {
    const academicYearId = req.body?.academicYearId
    const classTeacherId = req.body?.classTeacherId || null
    if (!isValidDatabaseId(academicYearId)) {
      return res.status(400).json({ error: "Select a valid academic year." })
    }
    if (classTeacherId && !isValidDatabaseId(classTeacherId)) {
      return res.status(400).json({ error: "Select a valid class teacher." })
    }
    let name
    try {
      name = validateAcademicName(req.body?.name, "Class name", 80)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    if (classTeacherId && !(await findSchoolTeacher(req.session.schoolId, classTeacherId))) {
      return res.status(400).json({ error: "The class teacher must be an active teacher in this school." })
    }
    const schoolClass = await createSchoolClass(req.session.schoolId, {
      academicYearId,
      name,
      classTeacherId,
    })
    return res.status(201).json({ schoolClass })
  }),
)

router.post(
  "/classes/:classId/subjects",
  asyncRoute(async (req, res) => {
    const classId = req.params.classId
    const teacherId = req.body?.teacherId || null
    if (!isValidDatabaseId(classId)) {
      return res.status(400).json({ error: "Class ID is invalid." })
    }
    if (teacherId && !isValidDatabaseId(teacherId)) {
      return res.status(400).json({ error: "Select a valid subject teacher." })
    }
    let name
    try {
      name = validateAcademicName(req.body?.name, "Subject name", 100)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    if (teacherId && !(await findSchoolTeacher(req.session.schoolId, teacherId))) {
      return res.status(400).json({ error: "The subject teacher must be an active teacher in this school." })
    }
    const subject = await createSchoolSubject(req.session.schoolId, {
      classId,
      name,
      teacherId,
    })
    return res.status(201).json({ subject })
  }),
)

router.put(
  "/classes/:classId/students",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.classId)) {
      return res.status(400).json({ error: "Class ID is invalid." })
    }
    const studentIds = req.body?.studentIds
    if (
      !Array.isArray(studentIds) ||
      studentIds.length > 500 ||
      studentIds.some((id) => !isValidDatabaseId(id)) ||
      new Set(studentIds).size !== studentIds.length
    ) {
      return res.status(400).json({ error: "Provide up to 500 unique student IDs." })
    }
    const assigned = await assignStudentsToClass(
      req.session.schoolId,
      req.params.classId,
      studentIds,
    )
    return res.json({ assigned })
  }),
)

export default router
