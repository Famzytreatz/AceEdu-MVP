const assert = require("node:assert/strict")
const test = require("node:test")

process.env.SUPABASE_URL ||= "https://example.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key"

const { examFromRow, parseId, userFromRow } = require("../database.js")

test("database IDs accept positive safe integers only", () => {
  assert.equal(parseId("1"), "1")
  assert.equal(parseId(42), "42")
  assert.equal(parseId("0"), null)
  assert.equal(parseId("-1"), null)
  assert.equal(parseId("1.5"), null)
  assert.equal(parseId("9007199254740992"), null)
  assert.equal(parseId("not-an-id"), null)
})

test("user records keep the portal field names without exposing password hashes", () => {
  const user = userFromRow({
    id: 9,
    full_name: "Ada Example",
    role: "teacher",
    designation: "Maths",
    assigned_classes: "JSS 1",
    subjects: "Algebra",
    access_pin: "TCH-123456",
    passport: null,
    reg_date: "2026-10-21T10:00:00Z",
    status: "Verified",
    registered_by: "Admin",
    dob: null,
    guardian_phone: null,
    address: null,
    state_of_origin: null,
    phone: null,
    country: null,
    region: null,
    home_address: null,
    password_hash: "$2b$12$not-for-response",
  })

  assert.equal(user._id, "9")
  assert.equal(user.fullName, "Ada Example")
  assert.equal(user.assignedClasses, "JSS 1")
  assert.equal("password" in user, false)
  assert.equal("passwordHash" in user, false)
})

test("exam rows map Postgres IDs and columns to the portal contract", () => {
  const exam = examFromRow({
    id: 12,
    teacher_id: "TCH-123456",
    target_class: "JSS 1",
    title: "Algebra",
    questions: [{ questionText: "1 + 1?", options: ["1", "2"], correctAnswerIndex: 1 }],
    duration_minutes: 30,
    attempts_allowed: 2,
    created_at: "2026-10-21T10:00:00Z",
    expires_at: "2026-10-22T10:00:00Z",
  })

  assert.equal(exam._id, "12")
  assert.equal(exam.teacherId, "TCH-123456")
  assert.equal(exam.durationMinutes, 30)
  assert.equal(exam.questions[0].correctAnswerIndex, 1)
})
