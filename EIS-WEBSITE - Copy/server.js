require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", ".env") })

const bcrypt = require("bcryptjs")
const express = require("express")
const path = require("node:path")
const { randomInt } = require("node:crypto")
const cors = require("cors")
const {
  attemptColumns,
  attemptFromRow,
  contentColumns,
  contentFromRow,
  examColumns,
  examFromRow,
  messageColumns,
  messageFromRow,
  parseId,
  supabase,
  userAuthColumns,
  userColumns,
  userFromRow,
  verifySupabaseConnection,
} = require("./database")

const app = express()
const PORT = Number.parseInt(process.env.EIS_PORT || "3000", 10)
const passwordRounds = 12

app.disable("x-powered-by")
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(express.static(path.join(__dirname, "public")))
app.use(express.static(__dirname))

function logDatabaseError(action, error) {
  console.error(`${action}:`, error?.code || error?.message || "Unknown database error")
}

function userValuesFromBody(body, accessPin, passwordHash) {
  return {
    full_name: body.fullName,
    role: body.role,
    designation: body.designation || null,
    assigned_classes: body.assignedClasses || "",
    subjects: body.subjects || "",
    access_pin: accessPin,
    passport: body.passport || null,
    status: body.role === "admin" ? "Verified" : "Pending",
    registered_by: body.registeredBy || "Staff Terminal",
    dob: body.dob || null,
    guardian_phone: body.guardianPhone || null,
    address: body.address || null,
    state_of_origin: body.stateOfOrigin || null,
    phone: body.phone || null,
    country: body.country || null,
    region: body.region || null,
    home_address: body.homeAddress || null,
    password_hash: passwordHash,
  }
}

async function findUserByPin(pin, role) {
  let query = supabase.from("eis_users").select(userAuthColumns).eq("access_pin", pin)
  if (role) query = query.eq("role", role)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

async function passwordMatches(user, password) {
  if (typeof password !== "string" || !password) return false
  const storedPassword = user.password_hash || ""
  if (/^\$2[aby]\$/.test(storedPassword)) {
    return bcrypt.compare(password, storedPassword)
  }
  if (storedPassword !== password) return false

  const passwordHash = await bcrypt.hash(password, passwordRounds)
  const { error } = await supabase
    .from("eis_users")
    .update({ password_hash: passwordHash })
    .eq("id", user.id)
  if (error) throw error
  return true
}

function pinPrefix(role) {
  if (role === "admin") return "ADM"
  if (role === "school-admin") return "SCH"
  if (role === "sub-admin") return "SUB"
  if (role === "teacher") return "TCH"
  return "STU"
}

async function generateUserPin(role) {
  const prefix = pinPrefix(role)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pin = `${prefix}-${randomInt(100000, 1000000)}`
    const { data, error } = await supabase
      .from("eis_users")
      .select("id")
      .eq("access_pin", pin)
      .maybeSingle()
    if (error) throw error
    if (!data) return pin
  }
  throw new Error("Could not generate an unused access PIN.")
}

app.get("/api/health", async (_req, res) => {
  try {
    const { error } = await supabase.from("eis_users").select("id").limit(1)
    if (error) throw error
    return res.json({ status: "ok", database: "supabase" })
  } catch (error) {
    logDatabaseError("EIS health check failed", error)
    return res.status(503).json({ status: "unavailable", database: "supabase" })
  }
})

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")))
app.get("/login", (_req, res) => res.sendFile(path.join(__dirname, "Login.html")))
app.get("/admin-auth", (_req, res) => res.sendFile(path.join(__dirname, "admin-auth.html")))
app.get("/teacher-auth", (_req, res) => res.sendFile(path.join(__dirname, "teacher-auth.html")))
app.get("/sub-admin-auth", (_req, res) => res.sendFile(path.join(__dirname, "sub-admin-auth.html")))
app.get(["/academy-hub", "/academy-hub.html"], (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Students portal", "academy-hub.html")),
)
app.get("/student-dashboard", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Students portal", "student-dashboard.html")),
)
app.get("/admin", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Admin Panel", "admin.html")),
)
app.get("/identity-installation", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Admin Panel", "identity-installation.html")),
)
app.get("/teachers", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Teachers portal", "teacher.html")),
)
app.get("/teacher-exam-portal", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "Teachers portal", "teacher-exam-portal.html")),
)

app.get("/api/admin/users", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("eis_users")
      .select(userColumns)
      .order("reg_date", { ascending: false })
    if (error) throw error
    return res.json(data.map((row) => userFromRow(row)))
  } catch (error) {
    logDatabaseError("Registry load failed", error)
    return res.status(500).json({ error: "Registry Load Failed" })
  }
})

app.put("/api/admin/update-teacher/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ success: false, message: "Teacher ID is invalid." })
  try {
    const { data, error } = await supabase
      .from("eis_users")
      .update({
        assigned_classes: req.body.assignedClasses ?? "",
        subjects: req.body.subjects ?? "",
      })
      .eq("id", id)
      .eq("role", "teacher")
      .select(userColumns)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ success: false, message: "Teacher not found" })
    return res.json({
      success: true,
      message: "Updated successfully",
      data: userFromRow(data),
    })
  } catch (error) {
    logDatabaseError("Teacher update failed", error)
    return res.status(500).json({ success: false, message: "Vault Error" })
  }
})

app.post("/api/admin/verify/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: "User ID is invalid." })
  try {
    const { error } = await supabase.from("eis_users").update({ status: "Verified" }).eq("id", id)
    if (error) throw error
    return res.json({ success: true })
  } catch (error) {
    logDatabaseError("User verification failed", error)
    return res.status(500).json({ error: "Verification failed" })
  }
})

app.post("/api/content/create", async (req, res) => {
  const body = req.body || {}
  if (!body.title || !body.targetClass) {
    return res.status(400).json({ error: "Content title and target class are required." })
  }
  try {
    const { error } = await supabase.from("eis_content").insert({
      title: body.title,
      type: body.type || "material",
      target_class: body.targetClass,
      content_body: body.contentBody ?? body.body ?? null,
      body: body.body ?? null,
      file_url: body.fileUrl || null,
      author: body.author || null,
      subject: body.subject || null,
      teacher_name: body.teacherName || null,
      deadline: body.deadline || null,
    })
    if (error) throw error
    return res.json({ success: true })
  } catch (error) {
    logDatabaseError("Content creation failed", error)
    return res.status(500).json({ error: "Vault upload failed" })
  }
})

app.delete("/api/content/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: "Content ID is invalid." })
  try {
    const { error } = await supabase.from("eis_content").delete().eq("id", id)
    if (error) throw error
    return res.json({ success: true, message: "Post eliminated from feed." })
  } catch (error) {
    logDatabaseError("Content deletion failed", error)
    return res.status(500).json({ error: "Failed to delete post." })
  }
})

app.delete("/api/admin/delete/:id", async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ error: "User ID is invalid." })
  try {
    const { error } = await supabase.from("eis_users").delete().eq("id", id)
    if (error) throw error
    return res.json({ success: true })
  } catch (error) {
    logDatabaseError("User deletion failed", error)
    return res.status(500).json({ error: "Deletion failed" })
  }
})

app.post("/api/admin/broadcast", async (req, res) => {
  const body = req.body || {}
  const target = body.target || body.type || "all"
  const content = body.content || body.message
  if (!content) return res.status(400).json({ error: "Broadcast content is required." })
  try {
    const { error } = await supabase.from("eis_messages").insert({
      target,
      content,
      sender: body.sender || "Admin Office",
      priority: body.priority || "normal",
      message_type: body.type || null,
    })
    if (error) throw error
    return res.json({ success: true })
  } catch (error) {
    logDatabaseError("Broadcast creation failed", error)
    return res.status(500).json({ error: "Broadcast failed" })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : ""
    if (!pin) return res.status(400).json({ success: false, message: "Enter your Access PIN." })
    const row = await findUserByPin(pin)
    const user = userFromRow(row)
    if (!user) return res.status(401).json({ success: false, message: "Invalid Access PIN" })

    const isAdmin = user.role === "admin" || user.role === "sub-admin"
    if (user.status !== "Verified" && !isAdmin) {
      return res.status(403).json({ success: false, message: "Account Pending Verification." })
    }

    let destination = "/student-dashboard"
    if (user.role === "admin") destination = "/admin-auth"
    else if (user.role === "sub-admin" || user.role === "school-admin") destination = "/sub-admin-auth"
    else if (user.role === "teacher") destination = "/teacher-auth"

    return res.json({
      success: true,
      redirectUrl: destination,
      userName: user.fullName,
      pin: user.accessPin,
      designation: user.designation,
      passport: user.passport,
      role: user.role,
    })
  } catch (error) {
    logDatabaseError("PIN login failed", error)
    return res.status(500).json({ success: false, message: "Login Failed" })
  }
})

app.post("/api/verify-student", async (req, res) => {
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : ""
  if (!pin) return res.status(400).json({ success: false })
  try {
    const user = await findUserByPin(pin, "student")
    return res.json({ success: Boolean(user && user.status === "Verified") })
  } catch (error) {
    logDatabaseError("Student PIN verification failed", error)
    return res.status(500).json({ success: false, message: "Verification failed." })
  }
})

app.get("/api/verify-pin/:pin", async (req, res) => {
  try {
    const user = userFromRow(await findUserByPin(req.params.pin))
    if (!user) return res.json({ found: false })
    return res.json({
      found: true,
      user: {
        fullName: user.fullName,
        role: user.role,
        accessPin: user.accessPin,
        status: user.status,
      },
    })
  } catch (error) {
    logDatabaseError("PIN verification failed", error)
    return res.status(500).json({ found: false, error: "Verification failed." })
  }
})

app.post("/api/teacher/login", async (req, res) => {
  try {
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : ""
    const password = typeof req.body?.password === "string" ? req.body.password : ""
    const user = await findUserByPin(pin, "teacher")
    if (!user) return res.status(401).json({ success: false, message: "Invalid User" })
    if (!(await passwordMatches(user, password))) {
      return res.status(401).json({ success: false, message: "Incorrect Password" })
    }
    return res.json({ success: true, redirectUrl: "/teachers" })
  } catch (error) {
    logDatabaseError("Teacher login failed", error)
    return res.status(500).json({ success: false, message: "Server Error" })
  }
})

app.post("/api/sub-admin/login", async (req, res) => {
  try {
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : ""
    const password = typeof req.body?.password === "string" ? req.body.password : ""
    const { data, error } = await supabase
      .from("eis_users")
      .select(userAuthColumns)
      .eq("access_pin", pin)
      .in("role", ["sub-admin", "school-admin"])
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(401).json({ success: false, message: "Invalid User" })
    if (!(await passwordMatches(data, password))) {
      return res.status(401).json({ success: false, message: "Incorrect Password" })
    }
    return res.json({ success: true, redirectUrl: "/identity-installation" })
  } catch (error) {
    logDatabaseError("Sub-admin login failed", error)
    return res.status(500).json({ success: false, message: "Server Error" })
  }
})

app.post("/api/admin/enroll", async (req, res) => {
  const body = req.body || {}
  if (typeof body.fullName !== "string" || !body.fullName.trim() || typeof body.role !== "string" || !body.role.trim()) {
    return res.status(400).json({ success: false, error: "Enter a user name and select a role." })
  }
  try {
    const pin = await generateUserPin(body.role)
    const passwordHash = body.password
      ? await bcrypt.hash(String(body.password), passwordRounds)
      : null
    const { error } = await supabase.from("eis_users").insert(userValuesFromBody(body, pin, passwordHash))
    if (error) throw error
    return res.status(201).json({ success: true, pin })
  } catch (error) {
    logDatabaseError("Enrollment failed", error)
    return res.status(500).json({ success: false, error: "Enrollment Failed" })
  }
})

app.post("/api/exams/create", async (req, res) => {
  const body = req.body || {}
  if (!body.teacherId || !body.targetClass || !body.title || !Array.isArray(body.questions) || !body.questions.length) {
    return res.status(400).json({ success: false, message: "Provide the teacher, class, exam title, and questions." })
  }
  const durationMinutes = Number(body.durationMinutes)
  const attemptsAllowed = Number(body.attemptsAllowed || 1)
  const validityMinutes = Number(body.validityMinutes || 1440)
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(attemptsAllowed) || attemptsAllowed <= 0 || !Number.isFinite(validityMinutes) || validityMinutes <= 0) {
    return res.status(400).json({ success: false, message: "Exam timing and attempt limits must be positive values." })
  }
  const createdAt = new Date()
  try {
    const { data, error } = await supabase
      .from("eis_exams")
      .insert({
        teacher_id: body.teacherId,
        target_class: body.targetClass,
        title: body.title,
        questions: body.questions,
        duration_minutes: durationMinutes,
        attempts_allowed: attemptsAllowed,
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + validityMinutes * 60 * 1000).toISOString(),
      })
      .select(examColumns)
      .single()
    if (error) throw error
    return res.json({
      success: true,
      message: "Exam created successfully!",
      examId: String(data.id),
    })
  } catch (error) {
    logDatabaseError("Exam creation failed", error)
    return res.status(500).json({ success: false, message: "Failed to create exam." })
  }
})

app.get("/api/exams/student/:classId", async (req, res) => {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : ""
  if (!studentId) return res.status(400).json({ success: false, message: "Student ID is required." })
  try {
    const { data: examRows, error: examError } = await supabase
      .from("eis_exams")
      .select(examColumns)
      .eq("target_class", req.params.classId)
      .order("created_at", { ascending: false })
    if (examError) throw examError
    if (!examRows.length) return res.json({ success: true, exams: [] })
    const { data: attemptRows, error: attemptError } = await supabase
      .from("eis_exam_attempts")
      .select("exam_id,status,is_revoked")
      .eq("student_id", studentId)
      .in("exam_id", examRows.map((exam) => exam.id))
    if (attemptError) throw attemptError
    const attemptsByExam = new Map()
    for (const attempt of attemptRows) {
      const examId = String(attempt.exam_id)
      if (!attemptsByExam.has(examId)) attemptsByExam.set(examId, [])
      attemptsByExam.get(examId).push(attempt)
    }
    const exams = examRows.map((row) => {
      const exam = examFromRow(row)
      const attempts = attemptsByExam.get(exam._id) || []
      const attemptsMade = attempts.filter((attempt) => !attempt.is_revoked && attempt.status !== "revoked").length
      const attemptsRemaining = exam.attemptsAllowed - attemptsMade
      let status = "available"
      if (new Date(exam.expiresAt) < new Date()) status = "expired"
      else if (attemptsRemaining <= 0) status = "no_attempts_left"
      return {
        _id: exam._id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        attemptsAllowed: exam.attemptsAllowed,
        attemptsMade,
        attemptsRemaining,
        expiresAt: exam.expiresAt,
        status,
      }
    })
    return res.json({ success: true, exams })
  } catch (error) {
    logDatabaseError("Student exam list failed", error)
    return res.status(500).json({ success: false, message: "Failed to fetch exams." })
  }
})

app.get("/api/exams/student/:examId/start", async (req, res) => {
  const examId = parseId(req.params.examId)
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : ""
  const classId = typeof req.query.classId === "string" ? req.query.classId : ""
  if (!examId || !studentId || !classId) {
    return res.status(400).json({ success: false, message: "Exam, student, and class IDs are required." })
  }
  try {
    const { data: examRow, error: examError } = await supabase
      .from("eis_exams")
      .select(examColumns)
      .eq("id", examId)
      .maybeSingle()
    if (examError) throw examError
    if (!examRow) return res.status(404).json({ success: false, message: "Exam not found." })
    const exam = examFromRow(examRow)
    if (new Date(exam.expiresAt) < new Date()) {
      return res.status(403).json({ success: false, message: "Exam has expired." })
    }
    const { data: attemptRows, error: attemptsError } = await supabase
      .from("eis_exam_attempts")
      .select(attemptColumns)
      .eq("student_id", studentId)
      .eq("exam_id", examId)
      .eq("is_revoked", false)
    if (attemptsError) throw attemptsError
    if (attemptRows.length >= exam.attemptsAllowed) {
      return res.status(403).json({ success: false, message: "No attempts left for this exam." })
    }
    const { data: attemptRow, error: createError } = await supabase
      .from("eis_exam_attempts")
      .insert({
        student_id: studentId,
        exam_id: examId,
        class_id: classId,
        attempt_number: attemptRows.length + 1,
        start_time: new Date().toISOString(),
        status: "started",
      })
      .select(attemptColumns)
      .single()
    if (createError) throw createError
    return res.json({
      success: true,
      exam: { ...exam, _id: exam._id },
      attemptId: String(attemptRow.id),
    })
  } catch (error) {
    logDatabaseError("Exam start failed", error)
    return res.status(500).json({ success: false, message: "Failed to start exam." })
  }
})

app.post("/api/exams/student/:examId/submit", async (req, res) => {
  const examId = parseId(req.params.examId)
  const attemptId = parseId(req.body?.attemptId)
  const answers = req.body?.answers
  if (!examId || !attemptId || !Array.isArray(answers)) {
    return res.status(400).json({ success: false, message: "Exam, attempt, and answer details are required." })
  }
  try {
    const [{ data: attemptRow, error: attemptError }, { data: examRow, error: examError }] = await Promise.all([
      supabase.from("eis_exam_attempts").select(attemptColumns).eq("id", attemptId).eq("exam_id", examId).maybeSingle(),
      supabase.from("eis_exams").select(examColumns).eq("id", examId).maybeSingle(),
    ])
    if (attemptError) throw attemptError
    if (examError) throw examError
    if (!attemptRow) return res.status(404).json({ success: false, message: "Attempt not found." })
    if (attemptRow.status !== "started") {
      return res.status(403).json({ success: false, message: "Exam already submitted or expired." })
    }
    if (!examRow) return res.status(404).json({ success: false, message: "Exam not found." })
    const exam = examFromRow(examRow)
    const score = answers.reduce((total, studentAnswer) => {
      const question = exam.questions[studentAnswer.questionIndex]
      return question && question.correctAnswerIndex === studentAnswer.selectedOptionIndex ? total + 1 : total
    }, 0)
    const { data: savedAttempt, error: updateError } = await supabase
      .from("eis_exam_attempts")
      .update({
        answers,
        score,
        end_time: new Date().toISOString(),
        status: "submitted",
        submission_type: req.body.submissionType || "manual",
      })
      .eq("id", attemptId)
      .eq("status", "started")
      .select(attemptColumns)
      .maybeSingle()
    if (updateError) throw updateError
    if (!savedAttempt) return res.status(403).json({ success: false, message: "Exam already submitted or expired." })
    return res.json({
      success: true,
      message: "Exam submitted successfully!",
      score,
      totalQuestions: exam.questions.length,
      exam,
      studentAnswers: attemptFromRow(savedAttempt).answers,
    })
  } catch (error) {
    logDatabaseError("Exam submission failed", error)
    return res.status(500).json({ success: false, message: "Failed to submit exam." })
  }
})

app.post("/api/exams/admin/revoke-attempt/:attemptId", async (req, res) => {
  const attemptId = parseId(req.params.attemptId)
  if (!attemptId) return res.status(400).json({ success: false, message: "Attempt ID is invalid." })
  try {
    const { data, error } = await supabase
      .from("eis_exam_attempts")
      .update({ is_revoked: true, status: "revoked" })
      .eq("id", attemptId)
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ success: false, message: "Attempt not found." })
    return res.json({ success: true, message: "Attempt revoked successfully." })
  } catch (error) {
    logDatabaseError("Exam attempt revocation failed", error)
    return res.status(500).json({ success: false, message: "Failed to revoke attempt." })
  }
})

app.get("/api/exams/teacher/:teacherId", async (req, res) => {
  try {
    const { data: examRows, error: examsError } = await supabase
      .from("eis_exams")
      .select(examColumns)
      .eq("teacher_id", req.params.teacherId)
      .order("created_at", { ascending: false })
    if (examsError) throw examsError
    if (!examRows.length) return res.json({ success: true, exams: [] })
    const { data: attempts, error: attemptsError } = await supabase
      .from("eis_exam_attempts")
      .select("exam_id")
      .in("exam_id", examRows.map((exam) => exam.id))
    if (attemptsError) throw attemptsError
    const counts = new Map()
    for (const attempt of attempts) {
      const key = String(attempt.exam_id)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return res.json({
      success: true,
      exams: examRows.map((row) => {
        const exam = examFromRow(row)
        return { ...exam, submissionCount: counts.get(exam._id) || 0 }
      }),
    })
  } catch (error) {
    logDatabaseError("Teacher exam list failed", error)
    return res.status(500).json({ success: false, message: "Failed to fetch your created exams." })
  }
})

app.get("/api/exams/:examId/results", async (req, res) => {
  const examId = parseId(req.params.examId)
  if (!examId) return res.status(400).json({ success: false, message: "Exam ID is invalid." })
  try {
    const { data: examRow, error: examError } = await supabase
      .from("eis_exams")
      .select(examColumns)
      .eq("id", examId)
      .maybeSingle()
    if (examError) throw examError
    if (!examRow) return res.status(404).json({ success: false, message: "Exam not found" })
    const { data: attempts, error: attemptsError } = await supabase
      .from("eis_exam_attempts")
      .select(attemptColumns)
      .eq("exam_id", examId)
      .order("score", { ascending: false })
    if (attemptsError) throw attemptsError
    const studentPins = [...new Set(attempts.map((attempt) => attempt.student_id))]
    let studentRows = []
    if (studentPins.length) {
      const { data, error } = await supabase
        .from("eis_users")
        .select(userColumns)
        .in("access_pin", studentPins)
      if (error) throw error
      studentRows = data
    }
    const students = new Map(studentRows.map((row) => [row.access_pin, userFromRow(row)]))
    const exam = examFromRow(examRow)
    const results = attempts.map((attempt) => ({
      studentName: students.get(attempt.student_id)?.fullName || "Unknown",
      studentId: attempt.student_id,
      score: attempt.score,
      total: exam.questions.length,
      status: attempt.submission_type === "timeout" ? "Incomplete" : attempt.status,
    }))
    return res.json({ success: true, results, examTitle: exam.title, targetClass: exam.targetClass })
  } catch (error) {
    logDatabaseError("Exam results load failed", error)
    return res.status(500).json({ success: false, message: "Failed to fetch results" })
  }
})

app.get("/api/classroom/roster/:className", async (req, res) => {
  try {
    const { data, error } = await supabase.from("eis_users").select(userColumns)
    if (error) throw error
    const className = req.params.className.trim().toLocaleLowerCase()
    const users = data
      .map((row) => userFromRow(row))
      .filter((user) => user.designation === req.params.className ||
        user.assignedClasses?.toLocaleLowerCase().includes(className))
    return res.json({
      teachers: users.filter((user) => user.role === "teacher"),
      students: users.filter((user) => user.role === "student"),
    })
  } catch (error) {
    logDatabaseError("Class roster load failed", error)
    return res.status(500).json({ error: "Sync Failed" })
  }
})

app.get("/api/classroom/content/:className", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("eis_content")
      .select(contentColumns)
      .eq("target_class", req.params.className)
      .order("created_at", { ascending: false })
    if (error) throw error
    return res.json(data.map(contentFromRow))
  } catch (error) {
    logDatabaseError("Classroom feed load failed", error)
    return res.status(500).json({ error: "Feed Sync Failed" })
  }
})

for (const audience of ["student", "teacher"]) {
  app.get(`/api/messages/${audience}`, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("eis_messages")
        .select(messageColumns)
        .in("target", ["all", audience])
        .order("date", { ascending: false })
    if (error) throw error
    return res.json(data.map(messageFromRow))
    } catch (error) {
      logDatabaseError(`${audience} message load failed`, error)
      return res.status(500).json({ error: "Broadcast Fetch Failed" })
    }
  })
}

app.get("/api/student/profile/:pin", async (req, res) => {
  try {
    const row = await findUserByPin(req.params.pin, "student")
    if (!row) return res.status(404).json({ error: "Student not found" })
    const student = userFromRow(row)
    return res.json({
      fullName: student.fullName,
      accessPin: student.accessPin,
      studentClass: student.designation,
      designation: student.designation,
      passport: student.passport,
      status: student.status,
      role: student.role,
      dob: student.dob,
      guardianPhone: student.guardianPhone,
      address: student.address,
      stateOfOrigin: student.stateOfOrigin,
    })
  } catch (error) {
    logDatabaseError("Student profile load failed", error)
    return res.status(500).json({ error: "Fetch Failed" })
  }
})

app.get("/api/teacher/profile/:pin", async (req, res) => {
  try {
    const row = await findUserByPin(req.params.pin, "teacher")
    if (!row) return res.status(404).json({ error: "Teacher not found" })
    const user = userFromRow(row)
    return res.json({
      _id: user._id,
      fullName: user.fullName,
      role: user.role,
      designation: user.designation,
      assignedClasses: user.assignedClasses,
      subjects: user.subjects,
      accessPin: user.accessPin,
      passport: user.passport,
      status: user.status,
    })
  } catch (error) {
    logDatabaseError("Teacher profile load failed", error)
    return res.status(500).json({ error: "Fetch Failed" })
  }
})

const notFound = (_req, res) => res.status(404).json({ error: "API endpoint not found." })
app.use("/api", notFound)

app.use((error, _req, res, _next) => {
  logDatabaseError("EIS request failed", error)
  if (res.headersSent) return res.end()
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must contain valid JSON." })
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." })
  }
  return res.status(500).json({ error: "The request could not be completed. Please try again." })
})

if (require.main === module) {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be a valid TCP port.")
  }
  verifySupabaseConnection()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`EIS server listening on port ${PORT} with Supabase.`)
      })
    })
    .catch((error) => {
      logDatabaseError("EIS server startup failed", error)
      process.exitCode = 1
    })
}

module.exports = app
