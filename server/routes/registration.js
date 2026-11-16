import express from "express"
import {
  createRegistrationForm,
  ensureDefaultRegistrationForm,
  getRegistrationForm,
  listRegistrationForms,
  publishRegistrationFormVersion,
  saveRegistrationFormDraft,
} from "../models/Registration.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute } from "../security.js"
import {
  validateCreateRegistrationForm,
  validateSaveRegistrationDraft,
} from "../registration-validation.js"

function expectedError(res, error) {
  if (error?.code === "23505") {
    return res.status(409).json({
      error: "A registration form with that key already exists. Choose a different form key.",
    })
  }
  if (error?.code === "P0002") {
    return res.status(404).json({ error: "The requested registration form or draft was not found." })
  }
  if (error?.code === "22023") {
    return res.status(400).json({ error: error.message || "The registration form cannot be published." })
  }
  return null
}

export function createRegistrationRouter(services = {}) {
  const service = {
    createRegistrationForm,
    ensureDefaultRegistrationForm,
    getRegistrationForm,
    listRegistrationForms,
    publishRegistrationFormVersion,
    saveRegistrationFormDraft,
    ...services,
  }
  const router = express.Router()

  router.get(
    "/forms",
    asyncRoute(async (req, res) => {
      const schoolId = req.session.schoolId
      const defaultForm = await service.ensureDefaultRegistrationForm(schoolId)
      const forms = await service.listRegistrationForms(schoolId)
      return res.json({
        forms,
        defaultFormId: defaultForm?.id || null,
      })
    }),
  )

  router.post(
    "/forms",
    asyncRoute(async (req, res) => {
      let values
      try {
        values = validateCreateRegistrationForm(req.body)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      try {
        const form = await service.createRegistrationForm({
          schoolId: req.session.schoolId,
          ...values,
        })
        return res.status(201).json({ form })
      } catch (error) {
        const response = expectedError(res, error)
        if (response) return response
        throw error
      }
    }),
  )

  router.get(
    "/forms/:formId",
    asyncRoute(async (req, res) => {
      if (!isValidDatabaseId(req.params.formId)) {
        return res.status(400).json({ error: "The registration form ID is invalid." })
      }
      const form = await service.getRegistrationForm(req.session.schoolId, req.params.formId)
      if (!form) return res.status(404).json({ error: "Registration form not found." })
      return res.json({ form })
    }),
  )

  router.put(
    "/forms/:formId/draft",
    asyncRoute(async (req, res) => {
      if (!isValidDatabaseId(req.params.formId)) {
        return res.status(400).json({ error: "The registration form ID is invalid." })
      }

      let values
      try {
        values = validateSaveRegistrationDraft(req.body)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      try {
        const form = await service.saveRegistrationFormDraft({
          schoolId: req.session.schoolId,
          formId: req.params.formId,
          ...values,
        })
        if (!form) return res.status(404).json({ error: "Registration form not found or inactive." })
        return res.json({ form })
      } catch (error) {
        const response = expectedError(res, error)
        if (response) return response
        throw error
      }
    }),
  )

  router.post(
    "/forms/:formId/publish",
    asyncRoute(async (req, res) => {
      if (!isValidDatabaseId(req.params.formId)) {
        return res.status(400).json({ error: "The registration form ID is invalid." })
      }
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body) ||
        Object.keys(req.body).some((key) => key !== "versionId") ||
        !isValidDatabaseId(req.body.versionId)
      ) {
        return res.status(400).json({ error: "Choose a valid draft version to publish." })
      }

      try {
        const form = await service.publishRegistrationFormVersion({
          schoolId: req.session.schoolId,
          formId: req.params.formId,
          versionId: req.body.versionId,
        })
        if (!form) return res.status(404).json({ error: "Registration form not found." })
        return res.json({ form })
      } catch (error) {
        const response = expectedError(res, error)
        if (response) return response
        throw error
      }
    }),
  )

  return router
}

export default createRegistrationRouter()
