import express from "express"

import {
  createFeeInvoice,
  createFeeSchedule,
  getFinanceData,
  recordFeePayment,
} from "../models/Finance.js"
import { isValidDatabaseId } from "../ids.js"
import { asyncRoute, requireEntitlement } from "../security.js"
import {
  validateFeePaymentPayload,
  validateFeeSchedulePayload,
  validateInvoicePayload,
} from "../premium-validation.js"

const router = express.Router()

router.use(requireEntitlement("financialManagement"))

router.get(
  "/",
  asyncRoute(async (req, res) => {
    return res.json(await getFinanceData(req.session.schoolId))
  }),
)

router.post(
  "/schedules",
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateFeeSchedulePayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    try {
      const schedule = await createFeeSchedule(req.session.schoolId, values)
      if (schedule.error === "CLASS_OR_TERM_NOT_FOUND") {
        return res.status(404).json({ error: "Class or academic term not found." })
      }
      if (schedule.error === "CLASS_TERM_YEAR_MISMATCH") {
        return res.status(400).json({
          error: "The class and academic term must belong to the same academic year.",
        })
      }
      return res.status(201).json({ schedule })
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "A fee with this name already exists for the selected class and term.",
        })
      }
      throw error
    }
  }),
)

router.post(
  "/invoices",
  asyncRoute(async (req, res) => {
    let values
    try {
      values = validateInvoicePayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    try {
      const result = await createFeeInvoice(
        req.session.schoolId,
        values.feeScheduleId,
        values.studentId,
      )
      if (result.error === "FEE_SCHEDULE_NOT_FOUND") {
        return res.status(404).json({ error: "Active fee schedule not found." })
      }
      if (result.error === "STUDENT_NOT_FOUND") {
        return res.status(404).json({ error: "Active student record not found." })
      }
      if (result.error === "STUDENT_NOT_IN_CLASS") {
        return res.status(400).json({
          error: "The student is not assigned to the fee schedule's class.",
        })
      }
      return res.status(201).json(result)
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "An invoice for this fee schedule and student already exists.",
        })
      }
      throw error
    }
  }),
)

router.post(
  "/invoices/:invoiceId/payments",
  asyncRoute(async (req, res) => {
    if (!isValidDatabaseId(req.params.invoiceId)) {
      return res.status(400).json({ error: "The invoice ID is invalid." })
    }
    let values
    try {
      values = validateFeePaymentPayload(req.body)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }
    try {
      const payment = await recordFeePayment(
        req.session.schoolId,
        req.params.invoiceId,
        values,
      )
      return res.status(201).json({ payment })
    } catch (error) {
      if (error?.code === "P0002") {
        return res.status(404).json({ error: "Invoice not found for this school." })
      }
      if (error?.code === "22023") {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  }),
)

export default router
