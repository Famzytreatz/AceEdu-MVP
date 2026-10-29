import express from "express"

import {
  getAttendanceSession,
  saveAttendanceSession,
} from "../models/AcademicOperations.js"

import {
  getStudentPortalDashboard,
  getTeacherPortalDashboard,
  teacherCanAccessClass,
} from "../models/Portal.js"

import {
  createClassroomPost,
  createSchoolPortalExam,
  deleteClassroomPost,
  getClassroomPosts,
  getSchoolClassroom,
  getStudentPortalExams,
  getTeacherPortalExamResults,
  getTeacherPortalExams,
  saveStudentPortalExamDraft,
  startStudentPortalExam,
  submitStudentPortalExam,
} from "../models/SchoolClassroom.js"

import { isValidDatabaseId } from "../ids.js"

import {
  asyncRoute,
  createRequirePortalMember,
  requireEntitlement,
} from "../security.js"

import {
  validateAttendanceLookup,
  validateAttendancePayload,
} from "../academic-operations-validation.js"

import {
  validateClassroomPost,
  validateExamAnswers,
  validatePortalExam,
} from "../classroom-validation.js"

const studentRouter = express.Router()

const teacherRouter = express.Router()

const requirePortalMember = createRequirePortalMember()

studentRouter.use(
  requirePortalMember("student"),
  requireEntitlement("studentPortal"),
)

teacherRouter.use(
  requirePortalMember("teacher"),
  requireEntitlement("teacherPortal"),
)

studentRouter.get(
  "/dashboard",

  asyncRoute(async (req, res) => {
    const dashboard = await getStudentPortalDashboard(
      req.portalMember.schoolId,

      req.portalMember.id,
    )

    if (!dashboard)
      return res
        .status(401)
        .json({ error: "This student account is no longer active." })

    return res.json(dashboard)
  }),
)

studentRouter.get(
  "/classroom",
  asyncRoute(async (req, res) => {
    const classroom = await getSchoolClassroom(
      req.portalMember.schoolId,
      req.portalMember.id,
      "student",
    )
    if (!classroom) {
      return res.status(404).json({ error: "You are not assigned to a class." })
    }
    return res.json({
      ...classroom,
      posts: await getClassroomPosts(
        req.portalMember.schoolId,
        classroom.schoolClass.id,
      ),
    })
  }),
)

studentRouter.get(
  "/exams",
  asyncRoute(async (req, res) => {
    const exams = await getStudentPortalExams(
      req.portalMember.schoolId,
      req.portalMember.id,
    )
    return res.json({ exams })
  }),
)

studentRouter.post(
  "/exams/:examId/start",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.examId)) {
      return res.status(400).json({ error: "Select a valid exam." })
    }
    try {
      const attempt = await startStudentPortalExam(
        req.portalMember.schoolId,
        req.params.examId,
        req.portalMember.id,
      )
      if (!attempt) return res.status(404).json({ error: "Exam not found." })
      return res.json(attempt)
    } catch (error) {
      if (["22023", "42501", "P0002"].includes(error?.code)) {
        const status =
          error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409
        return res.status(status).json({ error: error.message })
      }
      throw error
    }
  }),
)

studentRouter.post(
  "/exams/:examId/submit",
  asyncRoute(async (req, res) => {
    if (
      !isValidDatabaseId(req.params.examId) ||
      !isValidDatabaseId(String(req.body?.attemptId || ""))
    ) {
      return res.status(400).json({ error: "The exam attempt is invalid." })
    }
    let answers
    try {
      answers = validateExamAnswers(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const submissionType = req.body?.submissionType || "manual"
    if (!["manual", "timed_out"].includes(submissionType)) {
      return res
        .status(400)
        .json({ error: "Choose a valid exam submission type." })
    }
    try {
      const result = await submitStudentPortalExam(
        req.portalMember.schoolId,
        req.params.examId,
        String(req.body.attemptId),
        req.portalMember.id,
        answers,
        submissionType,
      )
      return res.json(result)
    } catch (error) {
      if (["22023", "42501", "P0002"].includes(error?.code)) {
        const status =
          error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409
        return res.status(status).json({ error: error.message })
      }
      throw error
    }
  }),
)

studentRouter.patch(
  "/exams/:examId/attempt",
  asyncRoute(async (req, res) => {
    if (
      !isValidDatabaseId(req.params.examId) ||
      !isValidDatabaseId(String(req.body?.attemptId || ""))
    ) {
      return res.status(400).json({ error: "The exam attempt is invalid." })
    }
    let answers
    try {
      answers = validateExamAnswers(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    try {
      return res.json(
        await saveStudentPortalExamDraft(
          req.portalMember.schoolId,
          req.params.examId,
          String(req.body.attemptId),
          req.portalMember.id,
          answers,
        ),
      )
    } catch (error) {
      if (["22023", "42501", "P0002"].includes(error?.code)) {
        const status =
          error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409
        return res.status(status).json({ error: error.message })
      }
      throw error
    }
  }),
)

teacherRouter.get(
  "/dashboard",

  asyncRoute(async (req, res) => {
    const dashboard = await getTeacherPortalDashboard(
      req.portalMember.schoolId,

      req.portalMember.id,
    )

    if (!dashboard)
      return res
        .status(401)
        .json({ error: "This teacher account is no longer active." })

    return res.json(dashboard)
  }),
)

teacherRouter.get(
  "/classroom",
  asyncRoute(async (req, res) => {
    const classId = String(req.query.classId || "")
    if (!isValidDatabaseId(classId)) {
      return res.status(400).json({ error: "Select a valid class." })
    }
    const classroom = await getSchoolClassroom(
      req.portalMember.schoolId,
      req.portalMember.id,
      "teacher",
      classId,
    )
    if (!classroom) {
      return res
        .status(403)
        .json({ error: "You are not assigned to this class." })
    }
    return res.json({
      ...classroom,
      posts: await getClassroomPosts(
        req.portalMember.schoolId,
        classroom.schoolClass.id,
      ),
    })
  }),
)

teacherRouter.post(
  "/classroom/posts",
  express.json({ limit: "8mb", strict: true }),
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateClassroomPost(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const post = await createClassroomPost(
      req.portalMember.schoolId,
      req.portalMember.id,
      values,
    )
    if (!post) {
      return res
        .status(403)
        .json({ error: "You are not assigned to this class or subject." })
    }
    return res.status(201).json(post)
  }),
)

teacherRouter.delete(
  "/classroom/posts/:postId",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.postId)) {
      return res.status(400).json({ error: "Select a valid post." })
    }
    const deleted = await deleteClassroomPost(
      req.portalMember.schoolId,
      req.portalMember.id,
      req.params.postId,
    )
    if (!deleted)
      return res.status(404).json({ error: "Classroom post not found." })
    return res.status(204).end()
  }),
)

teacherRouter.get(
  "/exams",
  asyncRoute(async (req, res) => {
    const exams = await getTeacherPortalExams(
      req.portalMember.schoolId,
      req.portalMember.id,
    )
    return res.json({ exams })
  }),
)

teacherRouter.post(
  "/exams",
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validatePortalExam(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    const exam = await createSchoolPortalExam(
      req.portalMember.schoolId,
      req.portalMember.id,
      values,
    )
    if (!exam) {
      return res.status(403).json({
        error: "You are not assigned to this class, subject, or term.",
      })
    }
    return res.status(201).json({ exam })
  }),
)

teacherRouter.get(
  "/exams/:examId/results",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.examId)) {
      return res.status(400).json({ error: "Select a valid exam." })
    }
    const results = await getTeacherPortalExamResults(
      req.portalMember.schoolId,
      req.portalMember.id,
      req.params.examId,
    )
    if (!results)
      return res.status(404).json({ error: "Exam results not found." })
    return res.json(results)
  }),
)

teacherRouter.get(
  "/attendance",

  asyncRoute(async (req, res) => {
    let values

    try {
      values = validateAttendanceLookup(req.query.classId, req.query.date)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    if (
      !(await teacherCanAccessClass(
        req.portalMember.schoolId,
        req.portalMember.id,
        values.classId,
      ))
    ) {
      return res
        .status(403)
        .json({ error: "You are not assigned to this class." })
    }

    return res.json(
      await getAttendanceSession(
        req.portalMember.schoolId,
        values.classId,
        values.date,
      ),
    )
  }),
)

teacherRouter.post(
  "/attendance",

  asyncRoute(async (req, res) => {
    let values

    try {
      values = validateAttendancePayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    if (
      !isValidDatabaseId(values.classId) ||
      !isValidDatabaseId(values.termId)
    ) {
      return res
        .status(400)
        .json({ error: "Select a valid class and academic term." })
    }

    if (
      !(await teacherCanAccessClass(
        req.portalMember.schoolId,
        req.portalMember.id,
        values.classId,
      ))
    ) {
      return res
        .status(403)
        .json({ error: "You are not assigned to this class." })
    }

    let saved

    try {
      saved = await saveAttendanceSession(req.portalMember.schoolId, values)
    } catch (error) {
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }

      throw error
    }

    if (!saved) {
      return res.status(404).json({
        error: "The class or term was not found for this school and date.",
      })
    }

    return res.json(saved)
  }),
)

export { studentRouter, teacherRouter }
