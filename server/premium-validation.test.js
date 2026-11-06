import test from "node:test"
import assert from "node:assert/strict"

import {
  validateFeePaymentPayload,
  validateFeeSchedulePayload,
  validateInvoicePayload,
  validateParentAccountPayload,
  validateParentStudentsPayload,
  validateSchoolAnnouncementPayload,
} from "./premium-validation.js"

test("validates fee schedules with explicit currency and exact amounts", () => {
  assert.deepEqual(
    validateFeeSchedulePayload({
      name: "Term tuition",
      amount: "125000.5",
      currency: "ngn",
      dueOn: "2026-12-01",
      classId: "7",
      academicTermId: "3",
    }),
    {
      name: "Term tuition",
      amount: 125000.5,
      currency: "NGN",
      dueOn: "2026-12-01",
      classId: "7",
      academicTermId: "3",
    },
  )
  assert.throws(
    () =>
      validateFeeSchedulePayload({
        name: "Tuition",
        amount: 10.001,
        currency: "NGN",
        classId: "7",
        academicTermId: "3",
      }),
    /up to two decimals/,
  )
})

test("requires valid student and fee schedule IDs for invoices", () => {
  assert.deepEqual(
    validateInvoicePayload({ feeScheduleId: "2", studentId: 7 }),
    { feeScheduleId: "2", studentId: "7" },
  )
  assert.throws(
    () => validateInvoicePayload({ feeScheduleId: "0", studentId: "7" }),
    /valid fee schedule and student/,
  )
})

test("validates manual payments and limits payment methods", () => {
  assert.deepEqual(
    validateFeePaymentPayload({
      amount: 40,
      method: "bank_transfer",
      reference: "TRX-123",
      paidOn: "2026-11-04",
    }),
    {
      amount: 40,
      method: "bank_transfer",
      reference: "TRX-123",
      paidOn: "2026-11-04",
    },
  )
  assert.throws(
    () => validateFeePaymentPayload({ amount: 10, method: "online" }),
    /payment method/,
  )
})

test("requires explicit unique student links for parent accounts", () => {
  assert.deepEqual(
    validateParentAccountPayload({
      fullName: "Ada Parent",
      phone: "+234 (801) 234-5678",
      studentIds: ["4", 5],
    }),
    {
      fullName: "Ada Parent",
      phone: "+2348012345678",
      studentIds: ["4", "5"],
    },
  )
  assert.throws(
    () =>
      validateParentStudentsPayload({
        studentIds: ["4", 4],
      }),
    /unique student records/,
  )
})

test("validates audience-scoped school announcements and event dates", () => {
  assert.equal(
    validateSchoolAnnouncementPayload({
      title: "Open day",
      body: "Families are welcome.",
      type: "event",
      eventDate: "2026-12-03",
    }).audience,
    "all",
  )
  assert.throws(
    () =>
      validateSchoolAnnouncementPayload({
        title: "Open day",
        body: "Families are welcome.",
        type: "event",
      }),
    /event date is required/,
  )
  assert.throws(
    () =>
      validateSchoolAnnouncementPayload({
        title: "Private notice",
        body: "Hello",
        audience: "unknown",
      }),
    /valid announcement audience/,
  )
})
