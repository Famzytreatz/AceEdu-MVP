(() => {
  const portal = window.AceEduPortal
  let member = null
  let exams = []
  let examData = null
  let currentAttemptId = null
  let answers = []
  let timerInterval = null
  let saveTimer = null
  let finishing = false

  const $ = (id) => document.getElementById(id)

  function showSection(sectionId) {
    ["exam-list-wrapper", "exam-wrapper", "exam-message", "exam-results"].forEach((id) => {
      const section = $(id)
      if (section) section.style.display = id === sectionId ? "block" : "none"
    })
  }

  function displayMessage(title, text) {
    showSection("exam-message")
    portal.setText("message-title", title)
    portal.setText("message-text", text)
    clearInterval(timerInterval)
    clearTimeout(saveTimer)
  }

  function renderExamList() {
    const container = $("exam-list-container")
    if (!container) return
    if (!exams.length) {
      container.innerHTML = '<div class="message-box"><h1>No Exams Found</h1><p>There are currently no published exams for your class.</p></div>'
      return
    }
    container.innerHTML = exams.map((exam) => {
      const expired = exam.status === "expired"
      const noAttempts = exam.status === "no_attempts_left"
      const inProgress = exam.status === "in_progress"
      const disabled = expired || noAttempts
      const actionLabel = inProgress ? "Resume Exam" : disabled ? (expired ? "Expired" : "Attempt Limit Reached") : "Start Exam"
      const status = expired
        ? `<p style="color:var(--text-secondary);">This exam has expired.</p>`
        : noAttempts
          ? '<p style="color:var(--danger);">You have used all available attempts.</p>'
          : `<p style="color:var(--success);">Attempts remaining: ${exam.attemptsRemaining}</p>`
      return `<article class="q-card">
        <h2>${portal.escapeHtml(exam.title)}</h2>
        <p>${portal.escapeHtml(exam.subjectName || "General assessment")} · ${portal.escapeHtml(exam.className || "Your class")}</p>
        <p>Duration: ${Number(exam.durationMinutes) || 0} minutes</p>
        <p>Attempts allowed: ${Number(exam.attemptsAllowed) || 1}</p>
        ${exam.expiresAt ? `<p class="expiration-timer" data-expires="${portal.escapeHtml(exam.expiresAt)}" style="color:var(--gold);font-weight:bold;margin-bottom:10px;font-family:monospace;">Available until ${portal.escapeHtml(new Date(exam.expiresAt).toLocaleString())}</p>` : ""}
        ${status}
        <div style="margin-top:20px;"><button type="button" class="submit-btn" data-start-exam="${portal.escapeHtml(exam.id)}" ${disabled ? "disabled" : ""}>${portal.escapeHtml(actionLabel)}</button></div>
      </article>`
    }).join("")
    container.querySelectorAll("[data-start-exam]").forEach((button) => button.addEventListener("click", () => startSpecificExam(button.dataset.startExam)))
  }

  async function loadAvailableExams() {
    const container = $("exam-list-container")
    if (container) container.innerHTML = '<div class="message-box"><h1><i class="fas fa-spinner fa-spin"></i> Fetching Exams…</h1></div>'
    try {
      const result = await portal.request("/api/portal/student/exams")
      exams = result.exams || []
      if (exams.length) {
        // The secure API returns current status and attempt counts; do not infer unpublished exams in the browser.
        renderExamList()
      } else renderExamList()
    } catch (error) {
      if (error.status === 401) return
      if (container) container.innerHTML = `<div class="message-box"><h1>Connection Error</h1><p>${portal.escapeHtml(error.message || "Could not fetch exams.")}</p></div>`
    }
  }

  function renderQuestions() {
    const container = $("questions-container")
    if (!container) return
    container.innerHTML = ""
    ;(examData.questions || []).forEach((question, questionIndex) => {
      const card = document.createElement("article")
      card.className = "q-card"
      const title = document.createElement("p")
      title.textContent = `Question ${questionIndex + 1} of ${examData.questions.length}`
      const prompt = document.createElement("h2")
      prompt.textContent = question.questionText
      const options = document.createElement("div")
      options.className = "options"
      ;(question.options || []).forEach((option, optionIndex) => {
        const label = document.createElement("label")
        const radio = document.createElement("input")
        radio.type = "radio"
        radio.name = `q${questionIndex}`
        radio.value = String(optionIndex)
        radio.checked = answers.some((answer) => answer.questionIndex === questionIndex && answer.selectedOptionIndex === optionIndex)
        radio.addEventListener("change", () => recordAnswer(questionIndex, optionIndex))
        label.append(radio, document.createTextNode(` ${option}`))
        options.appendChild(label)
      })
      card.append(title, prompt, options)
      container.appendChild(card)
    })
  }

  function recordAnswer(questionIndex, selectedOptionIndex) {
    const existing = answers.find((answer) => answer.questionIndex === questionIndex)
    if (existing) existing.selectedOptionIndex = selectedOptionIndex
    else answers.push({ questionIndex, selectedOptionIndex })
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      if (!examData || !currentAttemptId) return
      portal.request(`/api/portal/student/exams/${encodeURIComponent(examData.id)}/attempt`, {
        method: "PATCH",
        body: JSON.stringify({ attemptId: currentAttemptId, answers }),
      }).catch((error) => portal.showError(`Your answers could not be saved yet: ${error.message}`))
    }, 300)
  }

  function startTimer(startedAt, durationMinutes) {
    clearInterval(timerInterval)
    const endTime = new Date(startedAt).getTime() + Number(durationMinutes) * 60_000
    const timer = $("timer")
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60
      if (timer) timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      if (remaining <= 0) {
        clearInterval(timerInterval)
        void submitExam(true)
      }
    }
    tick()
    timerInterval = window.setInterval(tick, 1000)
  }

  async function startSpecificExam(examId) {
    if (!examId) return
    clearInterval(timerInterval)
    finishing = false
    const loading = $("loading-message")
    if (loading) { loading.style.display = "block"; loading.textContent = "Loading your secure exam…" }
    showSection("exam-wrapper")
    if ($("submit-exam-btn")) { $("submit-exam-btn").style.display = "none"; $("submit-exam-btn").disabled = false }
    try {
      const attempt = await portal.request(`/api/portal/student/exams/${encodeURIComponent(examId)}/start`, { method: "POST", body: "{}" })
      examData = attempt.exam
      currentAttemptId = attempt.attemptId
      answers = Array.isArray(attempt.answers) ? attempt.answers.map((answer) => ({ questionIndex: Number(answer.questionIndex), selectedOptionIndex: Number(answer.selectedOptionIndex) })) : []
      portal.setText("exam-title-display", examData.title)
      portal.setText("student-id-tag", `ID: ${portal.shortId(member)}`)
      if (loading) loading.style.display = "none"
      if ($("submit-exam-btn")) $("submit-exam-btn").style.display = "block"
      renderQuestions()
      startTimer(attempt.startedAt, examData.durationMinutes)
    } catch (error) {
      if (error.status === 401) return
      displayMessage("Exam Access Error", error.message || "This exam cannot be started.")
    }
  }

  function displayResultsPage(result, timedOut) {
    showSection("exam-results")
    portal.setText("results-title", "Exam Submitted!")
    portal.setText("results-score", `Your final score is ${result.score} out of ${result.totalQuestions}.${timedOut ? " Time ran out." : ""}`)
    const reviewBtn = $("review-answers-btn")
    if (reviewBtn) {
      reviewBtn.textContent = "Return to Exam List"
      reviewBtn.onclick = async () => {
        showSection("exam-list-wrapper")
        await loadAvailableExams()
      }
    }
  }

  async function submitExam(timedOut) {
    if (!examData || !currentAttemptId || finishing) return
    finishing = true
    clearInterval(timerInterval)
    clearTimeout(saveTimer)
    const button = $("submit-exam-btn")
    if (button) { button.disabled = true; button.textContent = "Submitting…" }
    try {
      const result = await portal.request(`/api/portal/student/exams/${encodeURIComponent(examData.id)}/submit`, {
        method: "POST",
        body: JSON.stringify({ attemptId: currentAttemptId, answers, submissionType: timedOut ? "timed_out" : "manual" }),
      })
      displayResultsPage(result, timedOut)
    } catch (error) {
      finishing = false
      if (error.status === 401) return
      displayMessage("Submission Failed", error.message || "The exam could not be submitted.")
    } finally {
      if (button) { button.disabled = false; button.textContent = "Submit Examination" }
    }
  }

  async function init() {
    try {
      member = await portal.getMember("student")
      if (!member) return
      portal.setText("s-name", member.fullName)
      portal.setText("s-class", member.designation || "Student")
      portal.setText("student-id-tag", `ID: ${portal.shortId(member)}`)
      portal.setText("student-id-tag-list", `ID: ${portal.shortId(member)}`)
      const photo = $("monitor-photo")
      if (photo) photo.src = member.passport || portal.avatarData(member.fullName, "d4af37", "0a192f")
      document.title = `Secure Examination Hall | ${member.school?.schoolName || "AceEdu"}`
      document.querySelectorAll('a[href="./student-dashboard.html"]').forEach((link) => { link.href = portal.pageLink("./student-dashboard.html") })
      $("submit-exam-btn")?.addEventListener("click", () => submitExam(false))
      const params = new URLSearchParams(location.search)
      const examId = params.get("examId")
      if (examId) await startSpecificExam(examId)
      else {
        showSection("exam-list-wrapper")
        await loadAvailableExams()
      }
    } catch (error) {
      console.error("AceEdu exam room failed to load", error)
      displayMessage("Connection Error", error.message || "The examination hall could not be loaded.")
    }
  }

  window.startSpecificExam = startSpecificExam
  window.addEventListener("DOMContentLoaded", init)
})()
