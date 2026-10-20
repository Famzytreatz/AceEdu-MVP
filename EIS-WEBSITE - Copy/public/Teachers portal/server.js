const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// --- 1. MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(__dirname));

// --- 2. DATABASE CONNECTION ---
mongoose.connect('mongodb://localhost:27017/EliteAcademy')
    .then(() => console.log("✅ Elite Vault Connected"))
    .catch(err => console.error("❌ Connection failed:", err));

// --- 3. UPDATED SCHEMA (With your new requirements) ---
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    role: { type: String, required: true },
    accessPin: { type: String, unique: true, required: true },
    passport: { type: String },
    
    // New Fields
    phone: { type: String },          // For 2FA
    dob: { type: String },            // Date of Birth
    country: { type: String },
    region: { type: String },
    homeAddress: { type: String },
    guardianPhone: { type: String },  // Specifically for students
    
    // Faculty/Student Specifics
    subjects: { type: String },       // Teachers
    assignedClasses: { type: String },// Teachers
    designation: { type: String },    // Students (Current Class)
    
    status: { type: String, default: 'Active' },
    regDate: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const contentSchema = new mongoose.Schema({
    subject: String,
    targetClass: String,
    teacherName: String,
    type: { type: String, enum: ['lesson', 'assignment', 'notice'] },
    title: String,
    body: String,
    deadline: Date,
    createdAt: { type: Date, default: Date.now }
});
const Content = mongoose.model('Content', contentSchema);

const broadcastSchema = new mongoose.Schema({
    target: { type: String, enum: ['student', 'teacher', 'all'] },
    content: { type: String, required: true },
    sender: { type: String, default: 'Elite Administration' },
    createdAt: { type: Date, default: Date.now }
});
const Broadcast = mongoose.model('Broadcast', broadcastSchema);

// --- 4. PAGE ROUTES (Fixed paths with spaces) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Fix: Routing /admin or /identity-installation to the same file
app.get(['/admin', '/identity-installation'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin Panel', 'admin.html'));
});

app.get('/teachers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Teachers portal', 'teacher.html'));
});

app.get('/student-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Students portal', 'student-dashboard.html'));
});
// --- 5. TEACHER API LOGIC ---
app.get('/api/teacher/profile/:pin', async (req, res) => {
    try {
        const teacher = await User.findOne({ accessPin: req.params.pin, role: 'teacher' });
        if (!teacher) return res.status(404).json({ error: "Identity not found" });
        const classesArray = teacher.assignedClasses ? teacher.assignedClasses.split(',').map(c => c.trim()) : [];
        res.json({ fullName: teacher.fullName, classes: classesArray, subjects: teacher.subjects, designation: teacher.designation });
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

app.get('/api/teacher/students', async (req, res) => {
    try {
        const teacher = await User.findOne({ accessPin: req.query.pin });
        if (!teacher || !teacher.assignedClasses) return res.json([]);
        const classesArray = teacher.assignedClasses.split(',').map(c => c.trim());
        const students = await User.find({ role: 'student', designation: { $in: classesArray } });
        res.json(students);
    } catch (err) { res.status(500).json({ error: "Failed to fetch students" }); }
});

// THE ADMIN EDIT FEATURE FOR TEACHERS
app.put('/api/admin/update-teacher/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedClasses, subjects } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            id, 
            { 
                assignedClasses: assignedClasses, 
                subjects: subjects 
            }, 
            { new: true } 
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "Teacher not found" });
        }

        res.json({ success: true, message: "Teacher portal updated", data: updatedUser });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ success: false, message: "Server error updating teacher" });
    }
});

app.post('/api/teacher/post-content', async (req, res) => {
    try {
        const newPost = new Content(req.body);
        await newPost.save();
        res.status(201).json({ success: true, message: "Published successfully!" });
    } catch (err) { res.status(500).json({ error: "Broadcast failed" }); }
});

// --- 6. STUDENT API LOGIC ---
app.get('/api/student/profile/:pin', async (req, res) => {
    try {
        const student = await User.findOne({ accessPin: req.params.pin, role: 'student' });
        if (!student) return res.status(404).json({ error: "Identity not found" });
        res.json(student);
    } catch (err) { res.status(500).json({ error: "Vault Retrieval Error" }); }
});

app.get('/api/student/feed/:className', async (req, res) => {
    try {
        const feed = await Content.find({ targetClass: req.params.className }).sort({ createdAt: -1 });
        res.json(feed);
    } catch (err) { res.status(500).json({ error: "Could not load feed" }); }
});

// --- 7. ADMIN & GLOBAL BROADCAST SYSTEM ---
app.post('/api/admin/enroll', async (req, res) => {
    try {
        const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
        const newUser = new User({ ...req.body, accessPin: generatedPin });
        await newUser.save();
        res.status(201).json({ success: true, pin: generatedPin });
    } catch (err) { res.status(500).json({ success: false, error: "Enrollment Failed" }); }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find().sort({ regDate: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ error: "Could not load registry" }); }
});

app.post('/api/admin/broadcast', async (req, res) => {
    try {
        const newBroadcast = new Broadcast(req.body);
        await newBroadcast.save();
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ error: "Transmission Interrupted" }); }
});

app.get('/api/student/broadcasts', async (req, res) => {
    try {
        const messages = await Broadcast.find({ target: { $in: ['student', 'all'] } }).sort({ createdAt: -1 }).limit(5);
        res.json(messages);
    } catch (err) { res.status(500).json({ error: "Broadcast fetch failed" }); }
});


// --- 8. UPDATED START LOG (Clearer Links) ---
app.listen(PORT, () => {
    console.log(`
    🚀 ELIUD ACADEMY OS ONLINE
    -----------------------------------------
    🌐 STUDENT: http://localhost:${PORT}/student-portal
    🛡️  ADMIN:   http://localhost:${PORT}/identity-installation
    👨‍🏫 TEACHER: http://localhost:${PORT}/teachers
    -----------------------------------------
    `);
});