const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// --- 1. CONFIGURATION ---
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// --- 2. DATABASE CONNECTION ---
mongoose
  .connect("mongodb://localhost:27017/EliteAcademy")
  .then(() => console.log("✅ Elite Vault Connected Successfully"))
  .catch((err) => console.error("❌ Database connection failed:", err));

// --- 3. SCHEMAS ---
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  role: { type: String, required: true },
  designation: { type: String },
  assignedClasses: { type: String },
  subjects: { type: String },
  accessPin: { type: String, unique: true, required: true },
  passport: { type: String },
  regDate: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
  registeredBy: { type: String, default: "Staff Terminal" },
  dob: { type: String },
  guardianPhone: { type: String },
  address: { type: String },
  stateOfOrigin: { type: String },
  phone: { type: String },
  password: { type: String },
});
const User = mongoose.model("User", userSchema);

// --- REMOVE LEGACY ADMIN (Third Person) ---
// This ensures the "ADMIN-8090" user is deleted from the database if it exists.
User.deleteOne({ accessPin: "ADMIN-8090" })
  .then(() => console.log("✅ Legacy Admin (ADMIN-8090) removed."))
  .catch((err) => console.error("Cleanup Error:", err));

const messageSchema = new mongoose.Schema({
  target: { type: String, required: true },
  sender: { type: String, default: "Admin Office" },
  content: { type: String, required: true },
  date: { type: Date, default: Date.now },
  priority: { type: String, default: "normal" },
});
const Message = mongoose.model("Message", messageSchema);

const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ["assignment", "material"], default: "material" },
  targetClass: { type: String, required: true },
  contentBody: { type: String },
  fileUrl: { type: String },
  author: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const Content = mongoose.model("Content", contentSchema);

// New Schema: ExamQuestion
const examQuestionSchema = new mongoose.Schema({
  teacherId: { type: String, required: true }, // Access PIN of the teacher
  targetClass: { type: String, required: true },
  title: { type: String, required: true },
  questions: [
    {
      questionText: { type: String, required: true },
      options: [{ type: String, required: true }],
      correctAnswerIndex: { type: Number, required: true }, // 0-indexed
    },
  ],
  durationMinutes: { type: Number, required: true }, // e.g., 120 for 2 hours
  attemptsAllowed: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Calculated: createdAt + durationMinutes
});
const ExamQuestion = mongoose.model("ExamQuestion", examQuestionSchema);

// New Schema: StudentExamAttempt
const studentExamAttemptSchema = new mongoose.Schema({
  studentId: { type: String, required: true }, // Access PIN of the student
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExamQuestion",
    required: true,
  },
  classId: { type: String, required: true },
  attemptNumber: { type: Number, default: 1 },
  startTime: { type: Date },
  endTime: { type: Date },
  answers: [{ questionIndex: Number, selectedOptionIndex: Number }],
  score: { type: Number },
  status: {
    type: String,
    enum: ["started", "submitted", "expired", "revoked"],
    default: "started",
  },
  isRevoked: { type: Boolean, default: false }, // For admin revocation
  submissionType: { type: String, default: "manual" }, // 'manual' or 'timeout'
});
const StudentExamAttempt = mongoose.model(
  "StudentExamAttempt",
  studentExamAttemptSchema,
);

// --- 4. PAGE ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "Login.html")),
);
app.get("/admin-auth", (req, res) =>
  res.sendFile(path.join(__dirname, "admin-auth.html")),
);
app.get("/teacher-auth", (req, res) =>
  res.sendFile(path.join(__dirname, "teacher-auth.html")),
);
app.get("/sub-admin-auth", (req, res) =>
  res.sendFile(path.join(__dirname, "sub-admin-auth.html")),
);
app.get(["/academy-hub", "/academy-hub.html"], (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "Students portal", "academy-hub.html"),
  );
});
app.get("/student-dashboard", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "Students portal", "student-dashboard.html"),
  );
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Admin Panel", "admin.html"));
});
app.get("/identity-installation", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "Admin Panel", "identity-installation.html"),
  );
});
app.get("/teachers", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "Teachers portal", "teacher.html"),
  );
});
app.get("/teacher-exam-portal", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "Teachers portal",
      "teacher-exam-portal.html",
    ),
  );
});

// --- 5. ADMIN API (Verification, Update, Delete) ---

// Get all users for the Registry table
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await User.find().sort({ regDate: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Registry Load Failed" });
  }
});

// Update Teacher Portal
app.put("/api/admin/update-teacher/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedClasses, subjects } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { assignedClasses, subjects },
      { new: true },
    );
    if (!updatedUser)
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });
    res.json({
      success: true,
      message: "Updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Vault Error" });
  }
});

// Verify User (Updates status to 'Verified')
app.post("/api/admin/verify/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { status: "Verified" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// --- ADD THIS TO SERVER.JS ---
app.post("/api/content/create", async (req, res) => {
  try {
    const { title, type, targetClass, contentBody, fileUrl, author } = req.body;
    const newContent = new Content({
      title,
      type,
      targetClass,
      contentBody,
      fileUrl, // Saves the base64 media
      author, // Saves the teacher's name
      createdAt: new Date(),
    });
    await newContent.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Vault upload failed" });
  }
});
// DELETE ROUTE
app.delete("/api/content/:id", async (req, res) => {
  try {
    await Content.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Post eliminated from feed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post." });
  }
});

// Delete Identity
app.delete("/api/admin/delete/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

// Broadcast
app.post("/api/admin/broadcast", async (req, res) => {
  try {
    const newMessage = new Message(req.body);
    await newMessage.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Broadcast failed" });
  }
});

// --- 6. AUTH & PORTAL API ---

app.post("/api/login", async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findOne({ accessPin: pin });

    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid Access PIN" });

    const isAdmin = user.role === "admin" || user.role === "sub-admin";
    if (user.status !== "Verified" && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Account Pending Verification." });
    }

    let destination = "/student-dashboard";
    if (user.role === "admin")
      destination = "/admin-auth"; // Master Admin
    else if (user.role === "sub-admin" || user.role === "school-admin")
      destination = "/sub-admin-auth"; // Sub Admin
    else if (user.role === "teacher") destination = "/teacher-auth";

    res.json({
      success: true,
      redirectUrl: destination,
      userName: user.fullName,
      pin: user.accessPin,
      designation: user.designation,
      passport: user.passport,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login Failed" });
  }
});

// Teacher Password Verification
app.post("/api/teacher/login", async (req, res) => {
  try {
    const { pin, password } = req.body;
    const user = await User.findOne({ accessPin: pin, role: "teacher" });

    if (!user)
      return res.status(401).json({ success: false, message: "Invalid User" });

    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect Password" });
    }

    res.json({ success: true, redirectUrl: "/teachers" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Sub-Admin Password Verification
app.post("/api/sub-admin/login", async (req, res) => {
  try {
    const { pin, password } = req.body;
    const user = await User.findOne({
      accessPin: pin,
      role: { $in: ["sub-admin", "school-admin"] },
    });

    if (!user)
      return res.status(401).json({ success: false, message: "Invalid User" });

    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect Password" });
    }

    res.json({ success: true, redirectUrl: "/identity-installation" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Double check your Enrollment Route matches these keys
app.post("/api/admin/enroll", async (req, res) => {
  try {
    const {
      fullName,
      role,
      designation,
      passport,
      assignedClasses,
      subjects,
      registeredBy,
      dob,
      guardianPhone,
      address,
      stateOfOrigin,
      phone,
      password,
    } = req.body;

    // Generate Unique PIN based on Role
    const prefix =
      role === "admin"
        ? "ADM"
        : role === "school-admin"
          ? "SCH"
          : role === "sub-admin"
            ? "SUB"
            : role === "teacher"
              ? "TCH"
              : "STU";
    const pin = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newUser = new User({
      fullName,
      role,
      designation, // This matches the dropdown 'regClass'
      passport,
      accessPin: pin,
      assignedClasses: assignedClasses || "",
      subjects: subjects || "",
      registeredBy: registeredBy || "Staff Terminal",
      status: role === "admin" ? "Verified" : "Pending",
      dob,
      guardianPhone,
      address,
      stateOfOrigin,
      phone,
      password,
    });

    await newUser.save();
    res.json({ success: true, pin: pin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Enrollment Failed" });
  }
});

// --- NEW EXAM SYSTEM API ---

// API for Teacher to create an exam
app.post("/api/exams/create", async (req, res) => {
  try {
    const {
      teacherId,
      targetClass,
      title,
      questions,
      durationMinutes,
      validityMinutes, // New parameter for expiration
      attemptsAllowed,
    } = req.body;

    // Calculate expiresAt based on createdAt and validityMinutes (Availability)
    // Strictly decoupled from durationMinutes. Defaults to 24 hours if not provided.
    const createdAt = new Date();
    const validity = (validityMinutes && !isNaN(validityMinutes)) ? validityMinutes : 1440;
    const expiresAt = new Date(
      createdAt.getTime() + validity * 60 * 1000,
    );

    const newExam = new ExamQuestion({
      teacherId,
      targetClass,
      title,
      questions,
      durationMinutes,
      attemptsAllowed,
      createdAt,
      expiresAt,
    });
    await newExam.save();
    res.json({
      success: true,
      message: "Exam created successfully!",
      examId: newExam._id,
    });
  } catch (err) {
    console.error("Exam creation failed:", err);
    res.status(500).json({ success: false, message: "Failed to create exam." });
  }
});

// API for Student to fetch available exams for their class
app.get("/api/exams/student/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const studentId = req.query.studentId; // Assuming studentId is passed as query param

    const exams = await ExamQuestion.find({ targetClass: classId }).sort({
      createdAt: -1,
    });

    const examsWithStatus = await Promise.all(
      exams.map(async (exam) => {
        const attempts = await StudentExamAttempt.find({
          studentId,
          examId: exam._id,
        });
        const attemptsMade = attempts.filter(
          (a) => a.status !== "revoked",
        ).length;
        const hasAttempted = attemptsMade > 0;
        const attemptsRemaining = exam.attemptsAllowed - attemptsMade;

        let status = "available";
        if (exam.expiresAt < new Date()) {
          status = "expired";
        } else if (attemptsRemaining <= 0) {
          status = "no_attempts_left";
        }

        return {
          _id: exam._id,
          title: exam.title,
          durationMinutes: exam.durationMinutes,
          attemptsAllowed: exam.attemptsAllowed,
          attemptsMade,
          attemptsRemaining,
          expiresAt: exam.expiresAt,
          status,
        };
      }),
    );

    res.json({ success: true, exams: examsWithStatus });
  } catch (err) {
    console.error("Failed to fetch student exams:", err);
    res.status(500).json({ success: false, message: "Failed to fetch exams." });
  }
});

// API for Student to start an exam (records attempt)
app.get("/api/exams/student/:examId/start", async (req, res) => {
  try {
    const { examId } = req.params;
    const { studentId, classId } = req.query; // studentId and classId passed as query params

    const exam = await ExamQuestion.findById(examId);
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found." });

    if (exam.expiresAt < new Date()) {
      return res
        .status(403)
        .json({ success: false, message: "Exam has expired." });
    }

    const existingAttempts = await StudentExamAttempt.find({
      studentId,
      examId,
      isRevoked: false,
    });
    if (existingAttempts.length >= exam.attemptsAllowed) {
      return res
        .status(403)
        .json({ success: false, message: "No attempts left for this exam." });
    }

    const newAttempt = new StudentExamAttempt({
      studentId,
      examId,
      classId,
      attemptNumber: existingAttempts.length + 1,
      startTime: new Date(),
      status: "started",
    });
    await newAttempt.save();

    res.json({ success: true, exam, attemptId: newAttempt._id });
  } catch (err) {
    console.error("Failed to start exam:", err);
    res.status(500).json({ success: false, message: "Failed to start exam." });
  }
});

// API for Student to submit exam answers
app.post("/api/exams/student/:examId/submit", async (req, res) => {
  try {
    const { examId } = req.params;
    const { attemptId, answers, submissionType } = req.body; // answers: [{ questionIndex, selectedOptionIndex }]

    const attempt = await StudentExamAttempt.findById(attemptId);
    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found." });
    if (attempt.status !== "started")
      return res
        .status(403)
        .json({
          success: false,
          message: "Exam already submitted or expired.",
        });

    const exam = await ExamQuestion.findById(examId);
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found." });

    let score = 0;
    answers.forEach((studentAnswer) => {
      const question = exam.questions[studentAnswer.questionIndex];
      if (
        question &&
        question.correctAnswerIndex === studentAnswer.selectedOptionIndex
      ) {
        score++;
      }
    });

    attempt.answers = answers;
    attempt.score = score;
    attempt.endTime = new Date();
    attempt.status = "submitted";
    attempt.submissionType = submissionType || "manual";
    await attempt.save();

    res.json({
      success: true,
      message: "Exam submitted successfully!",
      score,
      totalQuestions: exam.questions.length,
      exam, // Send the full exam object back for review
      studentAnswers: attempt.answers, // Send the saved answers
    });
  } catch (err) {
    console.error("Failed to submit exam:", err);
    res.status(500).json({ success: false, message: "Failed to submit exam." });
  }
});

// API for Admin to revoke a student's exam attempt
app.post("/api/exams/admin/revoke-attempt/:attemptId", async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await StudentExamAttempt.findById(attemptId);

    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found." });

    attempt.isRevoked = true;
    attempt.status = "revoked";
    await attempt.save();

    res.json({ success: true, message: "Attempt revoked successfully." });
  } catch (err) {
    console.error("Failed to revoke attempt:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to revoke attempt." });
  }
});

// API for Teacher to fetch their created exams
app.get("/api/exams/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const exams = await ExamQuestion.find({ teacherId: teacherId }).sort({
      createdAt: -1,
    });

    // Map over exams and add submission count
    const examsWithCounts = await Promise.all(
      exams.map(async (exam) => {
        const submissionCount = await StudentExamAttempt.countDocuments({ examId: exam._id });
        return { ...exam.toObject(), submissionCount };
      }),
    );
    res.json({ success: true, exams: examsWithCounts });
  } catch (err) {
    console.error("Failed to fetch teacher exams:", err);
    res.status(500).json({ success: false, message: "Failed to fetch your created exams." });
  }
});

// API to get exam results for Teacher
app.get("/api/exams/:examId/results", async (req, res) => {
  try {
    const { examId } = req.params;
    // Find the exam to get total questions count
    const exam = await ExamQuestion.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    // Find all attempts for this exam
    const attempts = await StudentExamAttempt.find({ examId }).sort({ score: -1 });

    // Get student details
    const studentPins = attempts.map(a => a.studentId);
    const students = await User.find({ accessPin: { $in: studentPins } });
    const studentMap = {};
    students.forEach(s => studentMap[s.accessPin] = s);

    const results = attempts.map(attempt => {
      const student = studentMap[attempt.studentId];
      let statusDisplay = attempt.status;
      if (attempt.submissionType === 'timeout') {
        statusDisplay = 'Incomplete';
      }

      return {
        studentName: student ? student.fullName : "Unknown",
        studentId: attempt.studentId,
        score: attempt.score,
        total: exam.questions.length,
        status: statusDisplay
      };
    });

    res.json({ success: true, results, examTitle: exam.title, targetClass: exam.targetClass });
  } catch (err) {
    console.error("Results fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch results" });
  }
});

// Roster for Classroom
app.get("/api/classroom/roster/:className", async (req, res) => {
  try {
    const className = req.params.className;
    const users = await User.find({
      $or: [
        { designation: className },
        { assignedClasses: { $regex: className, $options: "i" } },
      ],
    });
    res.json({
      teachers: users.filter((u) => u.role === "teacher"),
      students: users.filter((u) => u.role === "student"),
    });
  } catch (err) {
    res.status(500).json({ error: "Sync Failed" });
  }
});
// --- ADD THIS TO SERVER.JS TO FIX "UNABLE TO CONNECT" ---
app.get("/api/classroom/content/:className", async (req, res) => {
  try {
    const className = req.params.className;
    // This looks for assignments/materials created for this class
    const materials = await Content.find({ targetClass: className }).sort({
      createdAt: -1,
    });
    res.json(materials || []);
  } catch (err) {
    console.error("Transmission Feed Error:", err);
    res.status(500).json({ error: "Feed Sync Failed" });
  }
});

// Also add a route for student messages if it doesn't exist
app.get("/api/messages/student", async (req, res) => {
  try {
    const messages = await Message.find({
      target: { $in: ["all", "student"] },
    }).sort({ date: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Broadcast Fetch Failed" });
  }
});

app.get("/api/messages/teacher", async (req, res) => {
  try {
    const messages = await Message.find({
      target: { $in: ["all", "teacher"] },
    }).sort({ date: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Broadcast Fetch Failed" });
  }
});
// Teacher/Student Profiles
app.get("/api/student/profile/:pin", async (req, res) => {
  try {
    const student = await User.findOne({
      accessPin: req.params.pin,
      role: "student",
    });
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Explicitly map designation to studentClass for your HTML
    res.json({
      fullName: student.fullName,
      accessPin: student.accessPin,
      studentClass: student.designation, // This fixes the "---"
      passport: student.passport,
      status: student.status,
      role: student.role,
      dob: student.dob,
      guardianPhone: student.guardianPhone,
      address: student.address,
      stateOfOrigin: student.stateOfOrigin,
    });
  } catch (err) {
    res.status(500).json({ error: "Fetch Failed" });
  }
});

app.get("/api/teacher/profile/:pin", async (req, res) => {
  try {
    const teacher = await User.findOne({
      accessPin: req.params.pin,
      role: "teacher",
    });
    if (teacher) teacher.password = undefined; // Hide password for self-view
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: "Fetch Failed" });
  }
});

// --- 7. START SERVER ---
app.listen(PORT, () => {
  console.log(`
    =======================================================
    🚀 ELIUD ACADEMY OS IS LIVE
    =======================================================
    LOGIN PAGE:    http://localhost:${PORT}/login
    MASTER ADMIN:  http://localhost:${PORT}/admin
    STAFF PORTAL:  http://localhost:${PORT}/identity-installation
    Public Page: http://localhost:${PORT}/index.html
    =======================================================
    `);
});
