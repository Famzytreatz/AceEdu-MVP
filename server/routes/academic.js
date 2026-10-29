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
import {
  createClassAssessment,
  getAttendanceSession,
  getClassAssessments,
  saveAssessmentResults,
  saveAttendanceSession,
} from "../models/AcademicOperations.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requireEntitlement } from "../security.js"
import {
  validateAcademicListIds,
  validateAssessmentId,
  validateAssessmentPayload,
  validateAssessmentResultsPayload,
  validateAttendanceLookup,
  validateAttendancePayload,
} from "../academic-operations-validation.js"
import {
  validateAcademicName,
  validateAcademicYearPayload,
} from "../academic-validation.js"

const router = express.Router()

router.get(
  "/",
  requireEntitlement("classes"),
  asyncRoute(async (req, res) => {
    return res.json(await getAcademicSetup(req.session.schoolId))
  }),
)

router.post(
  "/years",
  requireEntitlement("classes"),
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
  requireEntitlement("classes"),
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
  requireEntitlement("classes"),
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
  requireEntitlement("classes"),
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
  requireEntitlement("classes"),
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

router.get(
  "/attendance",
  requireEntitlement("attendance"),
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateAttendanceLookup(req.query.classId, req.query.date)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    return res.json(
      await getAttendanceSession(
        req.session.schoolId,
        values.classId,
        values.date,
      ),
    )
  }),
)

router.post(
  "/attendance",
  requireEntitlement("attendance"),
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateAttendancePayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    let saved
    try {
      saved = await saveAttendanceSession(req.session.schoolId, values)
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
    if (!saved) {
      return res
        .status(404)
        .json({ error: "The class or term was not found for this school and date." })
    }
    return res.json(saved)
  }),
)

router.get(
  "/assessments",
  requireEntitlement("academicRecords"),
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateAcademicListIds(req.query.classId, req.query.termId)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const result = await getClassAssessments(
      req.session.schoolId,
      values.classId,
      values.termId,
    )
    if (!result) {
      return res.status(404).json({ error: "The class or term was not found for this school." })
    }
    return res.json(result)
  }),
)

router.post(
  "/assessments",
  requireEntitlement("academicRecords"),
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateAssessmentPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    let assessment
    try {
      assessment = await createClassAssessment(req.session.schoolId, values)
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
    if (!assessment) {
      return res
        .status(404)
        .json({ error: "The class, subject, or term was not found for this school." })
    }
    return res.status(201).json({ assessment })
  }),
)

router.put(
  "/assessments/:assessmentId/results",
  requireEntitlement("academicRecords"),
  asyncRoute(async (req, res) => {
    let assessmentId
    let results
    try {
      assessmentId = validateAssessmentId(req.params.assessmentId)
      results = validateAssessmentResultsPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    let saved
    try {
      saved = await saveAssessmentResults(
        req.session.schoolId,
        assessmentId,
        results,
      )
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
    if (!saved) {
      return res.status(404).json({ error: "Assessment not found for this school." })
    }
    return res.json(saved)
  }),
)

export default router
