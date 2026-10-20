function validateSchoolID(id) {
    // Regex explanation: Starts with ADM, TCH, or STU, followed by a dash and numbers
    const idPattern = /^(ADM|TCH|STU)-\d{3,6}$/; 
    return idPattern.test(id);
}

async function registerUser() {
    const schoolID = document.getElementById('schoolID').value.toUpperCase();
    
    // 1. Check if the ID follows the school rules
    if (!validateSchoolID(schoolID)) {
        alert("Access Denied: Invalid ID format. Use ADM-123, TCH-123, or STU-123.");
        return; // Stops the registration immediately
    }

    // 2. Determine Role based on ID prefix
    let userRole = "";
    if (schoolID.startsWith("ADM")) userRole = "admin";
    else if (schoolID.startsWith("TCH")) userRole = "teacher";
    else if (schoolID.startsWith("STU")) userRole = "student";

    const userData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        schoolID: schoolID,
        role: userRole
    };

    // 3. Send to your local server
    const response = await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });

    if (response.ok) {
        alert(`${userRole.toUpperCase()} account created successfully!`);
        window.location.href = "index.html";
    } else {
        const error = await response.json();
        alert(error.error);
    }
}
