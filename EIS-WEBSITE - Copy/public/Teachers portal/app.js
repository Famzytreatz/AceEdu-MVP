async function uploadToPortal() {
    // Get info from the URL or LocalStorage
    const subject = localStorage.getItem("currentActiveSubject"); 
    const tClass = localStorage.getItem("currentActiveClass");
    const tName = localStorage.getItem("userName");

    const postData = {
        subject: subject,
        targetClass: tClass,
        teacherName: tName,
        type: document.getElementById('contentType').value,
        title: document.getElementById('topic').value,
        body: document.getElementById('mainContent').value,
        deadline: document.getElementById('deadline').value
    };

    const response = await fetch('/api/content/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    });

    if (response.ok) {
        alert("Success! Your lesson is now live on the Student Portal.");
        window.location.href = "teacher.html";
    } else {
        alert("Error publishing content.");
    }
}