const path = require("node:path")
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") })

const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run the EIS server.")
}

let parsedUrl
try {
  parsedUrl = new URL(supabaseUrl)
} catch {
  throw new Error("SUPABASE_URL must be a valid absolute URL.")
}

if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  throw new Error("SUPABASE_URL must use HTTP or HTTPS.")
}

const supabase = createClient(parsedUrl.origin, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const userColumns =
  "id,full_name,role,designation,assigned_classes,subjects,access_pin,passport,reg_date,status,registered_by,dob,guardian_phone,address,state_of_origin,phone,country,region,home_address"
const userAuthColumns = `${userColumns},password_hash`
const contentColumns =
  "id,subject,target_class,teacher_name,type,title,body,content_body,deadline,file_url,author,created_at"
const messageColumns = "id,target,sender,content,date,priority,message_type"
const examColumns =
  "id,teacher_id,target_class,title,questions,duration_minutes,attempts_allowed,created_at,expires_at"
const attemptColumns =
  "id,student_id,exam_id,class_id,attempt_number,start_time,end_time,answers,score,status,is_revoked,submission_type"

function userFromRow(row, includePassword = false) {
  if (!row) return null
  return {
    _id: String(row.id),
    fullName: row.full_name,
    role: row.role,
    designation: row.designation,
    assignedClasses: row.assigned_classes,
    subjects: row.subjects,
    accessPin: row.access_pin,
    passport: row.passport,
    regDate: row.reg_date,
    status: row.status,
    registeredBy: row.registered_by,
    dob: row.dob,
    guardianPhone: row.guardian_phone,
    address: row.address,
    stateOfOrigin: row.state_of_origin,
    phone: row.phone,
    country: row.country,
    region: row.region,
    homeAddress: row.home_address,
    ...(includePassword ? { passwordHash: row.password_hash } : {}),
  }
}

function contentFromRow(row) {
  return {
    _id: String(row.id),
    subject: row.subject,
    targetClass: row.target_class,
    teacherName: row.teacher_name,
    type: row.type,
    title: row.title,
    body: row.body,
    contentBody: row.content_body,
    deadline: row.deadline,
    fileUrl: row.file_url,
    author: row.author,
    createdAt: row.created_at,
  }
}

function messageFromRow(row) {
  return {
    _id: String(row.id),
    target: row.target,
    sender: row.sender,
    content: row.content,
    date: row.date,
    priority: row.priority,
    type: row.message_type,
  }
}

function examFromRow(row) {
  return {
    _id: String(row.id),
    teacherId: row.teacher_id,
    targetClass: row.target_class,
    title: row.title,
    questions: row.questions,
    durationMinutes: row.duration_minutes,
    attemptsAllowed: row.attempts_allowed,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function attemptFromRow(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    studentId: row.student_id,
    examId: String(row.exam_id),
    classId: row.class_id,
    attemptNumber: row.attempt_number,
    startTime: row.start_time,
    endTime: row.end_time,
    answers: row.answers,
    score: row.score,
    status: row.status,
    isRevoked: row.is_revoked,
    submissionType: row.submission_type,
  }
}

function parseId(value) {
  const id = String(value ?? "")
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null
}

async function verifySupabaseConnection() {
  const { error } = await supabase.from("eis_users").select("id").limit(1)
  if (error) throw error
}

module.exports = {
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
}
