/**
 * ELITE ACADEMY - STUDENT PORTAL LOGIC
 * This script handles the identity display and dashboard functionality.
 */

// 1. INITIALIZE DASHBOARD ON LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Check if the user is actually logged in
    const studentData = JSON.parse(localStorage.getItem('studentIdentity'));
    
    if (!studentData) {
        // If no identity found, kick them back to login
        window.location.href = "login.html";
        return;
    }

    // Run the UI updates
    displayIdentity(studentData);
    loadStudentNavigation(studentData);
});

// 2. DISPLAY IDENTITY (Injected from Admin's Database)
function displayIdentity(data) {
    if (!document.getElementById('displayName')) return;

    // Matches the IDs in your student.html
    document.getElementById('displayName').innerText = `Welcome, ${data.fullName}`;
    document.getElementById('displayClass').innerText = data.designation;
    document.getElementById('displayPin').innerText = data.accessPin;
    
    // Handle Passport Photo
    const photoFrame = document.getElementById('displayPhoto');
    if (photoFrame) {
        photoFrame.src = data.passport || 'default-avatar.png';
    }
}

// 3. DYNAMIC NAVIGATION & CLASS CONTENT
function loadStudentNavigation(data) {
    const nav = document.getElementById("navLinks"); // Ensure this ID exists in your HTML
    if (!nav) return;

    // Simplified Elite Nav - focusing only on the Student's assigned class
    nav.innerHTML = `
        <a href="#" class="active"><i class="fas fa-home"></i> My Dashboard</a>
        <a href="#" onclick="showClassWork('${data.designation}')">
            <i class="fas fa-users"></i> My Class (${data.designation})
        </a>
        <a href="#"><i class="fas fa-pen-nib"></i> Take Exam</a>
        <a href="#" onclick="logout()" class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</a>
    `;

    // Automatically show classwork content in the main area
    showClassWork(data.designation);
}

// 4. SHOW CLASSWORK CONTENT
function showClassWork(className) {
    const content = document.getElementById("contentArea");
    if (!content) return;

    content.innerHTML = `
        <div class="glass-card">
            <h2><i class="fas fa-chalkboard-teacher"></i> Classroom: ${className}</h2>
            <p>Welcome to your official digital classroom for ${className}.</p>
            <hr style="border: 0.5px solid var(--elite-gold); opacity: 0.3; margin: 20px 0;">
            <div id="assignments">
                <p><i class="fas fa-info-circle"></i> Checking for new assignments from your teachers...</p>
            </div>
        </div>`;
}

// 5. LOGOUT FUNCTION
function logout() {
    localStorage.removeItem('studentIdentity');
    window.location.href = "login.html";
}