async function handleLogin() {
    const studentCode = document.getElementById('studentPinInput').value;

    if (!studentCode) {
        alert("Please enter your unique access code.");
        return;
    }

    try {
        // 1. Ask the server: "Does this code exist in the Admin's database?"
        const response = await fetch('/api/verify-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: studentCode })
        });

        const result = await response.json();

        if (result.success) {
            // 2. SUCCESS: Store the code in the browser's "memory" (localStorage)
            // This is vital so the dashboard knows WHICH student to load
            localStorage.setItem('userPin', studentCode);
            
            // 3. Open the door to their personal portal room
            window.location.href = "student-dashboard.html";
        } else {
            // 4. FAIL: The code wasn't found in the Admin's records
            alert("Access Denied: Invalid Student Code");
        }
    } catch (error) {
        console.error("Connection error:", error);
        alert("System offline. Please contact the Admin.");
    }
}