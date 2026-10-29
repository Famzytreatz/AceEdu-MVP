(() => {
  const portal = window.AceEduPortal
  let member = null
  let dashboard = null
  let exams = []
  let questionCounter = 0
  let activeResults = null
  const $ = (id) => document.getElementById(id)

  function selectedClass() {
    return (dashboard?.classes || []).find((item) => String(item.id) === String($("examTargetClass")?.value)) || null
  }

  function fillClassOptions() {
    const select = $("examTargetClass")
    if (!select) return
    const classes = dashboard?.classes || []
    select.innerHTML = classes.length
      ? classes.map((item) => `<option value="${portal.escapeHtml(item.id)}">${portal.escapeHtml(item.name)}${item.academicYear ? ` · ${portal.escapeHtml(item.academicYear)}` : ""}</option>`).join("")
      : '<option value="">No assigned classes</option>'
    select.disabled = !classes.length
    updateClassSelectors()
  }

  function updateClassSelectors() {
    const schoolClass = selectedClass()
    const subjects = $("examTargetSubject")
    const terms = $("examTargetTerm")
    if (subjects) {
      const list = schoolClass?.subjects || []
      subjects.innerHTML = '<option value="">No subject selected</option>' + list.map((subject) => `<option value="${portal.escapeHtml(subject.id)}">${portal.escapeHtml(subject.name)}</option>`).join("")
    }
    if (terms) {
      const list = schoolClass?.terms || []
      terms.innerHTML = list.length
        ? list.map((term) => `<option value="${portal.escapeHtml(term.id)}">${portal.escapeHtml(term.name)}${term.startsOn ? ` · ${portal.escapeHtml(term.startsOn)}` : ""}</option>`).join("")
        : '<option value="">No academic terms configured</option>'
      terms.disabled = !list.length
    }
  }

  function addQuestion() {
    questionCounter += 1
    const questionId = `ace-q-${questionCounter}`
    const container = $("questionsList")
    if (!container) return
    const div = document.createElement("div")
    div.className = "question-card"
    div.id = questionId
    div.innerHTML = `<div class="question-header"><label>Question ${questionCounter}:</label><button type="button" class="remove-q-btn" data-remove-question><i class="fas fa-trash"></i> Remove</button></div>
      <div class="form-group"><textarea placeholder="Enter question text…" rows="2" required></textarea></div>
      <div class="options-grid"><input type="text" placeholder="Option A" aria-label="Option A" required><input type="text" placeholder="Option B" aria-label="Option B" required><input type="text" placeholder="Option C" aria-label="Option C" required><input type="text" placeholder="Option D" aria-label="Option D" required></div>
      <div class="correct-answer-group"><label style="color:var(--gold);font-weight:bold;">Correct Answer:</label>${["A", "B", "C", "D"].map((letter, index) => `<label><input type="radio" name="correct-${questionId}" value="${index}" required> ${letter}</label>`).join("")}</div>`
    div.querySelector("[data-remove-question]").addEventListener("click", () => div.remove())
    container.appendChild(div)
  }

  function switchTab(viewName, button) {
    document.querySelectorAll(".menu-item[data-exam-tab]").forEach((item) => item.classList.toggle("active", item.dataset.examTab === viewName))
    document.querySelectorAll(".view-section").forEach((section) => section.classList.toggle("active", section.id === `${viewName}View`))
    const titles = {
      create: ["Set Questions", "Create and deploy secure, timed assessments for your students."],
      history: ["Exam History", "Review and print assessments you have created."],
      results: ["Submitted Results", "View scores and performance data for deployed exams."],
    }
    const [title, description] = titles[viewName] || titles.create
    portal.setText("pageTitle", title)
    portal.setText("pageDesc", description)
    if (viewName === "history") void loadExamHistory()
    if (viewName === "results") void loadResultsDashboard()
    if (button) button.blur()
  }

  async function refreshExams() {
    const result = await portal.request("/api/portal/teacher/exams")
    exams = result.exams || []
    return exams
  }

  async function handleCreateExam(event) {
    event.preventDefault()
    const form = event.currentTarget
    const button = form.querySelector(".submit-btn")
    const schoolClass = selectedClass()
    const termId = $("examTargetTerm")?.value || ""
    if (!schoolClass) return alert("You need an assigned class before creating an exam.")
    if (!termId) return alert("Configure an academic term for this class before creating an exam.")
    const questionCards = Array.from(document.querySelectorAll("#questionsList .question-card"))
    if (!questionCards.length) return alert("Add at least one question.")
    const questions = []
    for (const card of questionCards) {
      const questionText = card.querySelector("textarea")?.value.trim() || ""
      const options = Array.from(card.querySelectorAll(".options-grid input")).map((input) => input.value.trim())
      const selectedAnswer = card.querySelector('input[type="radio"]:checked')
      if (!questionText || options.length !== 4 || options.some((value) => !value) || !selectedAnswer) {
        return alert("Complete every question, all four options, and the correct answer.")
      }
      questions.push({ questionText, options, correctAnswerIndex: Number(selectedAnswer.value) })
    }
    const payload = {
      title: $("examTitle").value.trim(),
      classId: schoolClass.id,
      subjectId: $("examTargetSubject")?.value || null,
      termId,
      durationMinutes: Number($("durationMinutes").value),
      validityMinutes: Number($("validityMinutes").value),
      attemptsAllowed: Number($("attemptsAllowed").value),
      questions,
    }
    if (!payload.title) return alert("Enter an exam title.")
    if (button) { button.disabled = true; button.textContent = "DEPLOYING…" }
    try {
      await portal.request("/api/portal/teacher/exams", { method: "POST", body: JSON.stringify(payload) })
      alert(`Exam “${payload.title}” has been created.`)
      form.reset()
      $("questionsList").innerHTML = ""
      questionCounter = 0
      addQuestion()
      fillClassOptions()
      await refreshExams()
    } catch (error) {
      alert(error.message || "The exam could not be created.")
    } finally {
      if (button) { button.disabled = false; button.textContent = "CREATE & DEPLOY EXAM" }
    }
  }

  async function loadExamHistory() {
    const container = $("examHistoryContainer")
    if (!container) return
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Loading history…</p>'
    try {
      await refreshExams()
      if (!exams.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">You have not created any exams yet.</p>'
        return
      }
      container.innerHTML = exams.map((exam) => `<article class="history-card" id="history-exam-${portal.escapeHtml(exam.id)}">
        <button type="button" class="history-card-header" data-toggle-history="${portal.escapeHtml(exam.id)}" style="width:100%;text-align:left;background:transparent;border:0;color:inherit;cursor:pointer;">
          <div><h3 style="margin:0;color:white;">${portal.escapeHtml(exam.title)}</h3><p style="margin:5px 0 0;color:var(--text-muted);font-size:12px;">${portal.escapeHtml(exam.className || "Class")} · ${portal.escapeHtml(exam.subjectName || "General")} · ${exam.questions.length} questions</p></div><i class="fas fa-chevron-down" aria-hidden="true"></i>
        </button>
        <div id="history-content-${portal.escapeHtml(exam.id)}" class="history-card-content" style="display:none;"><div class="printable-content">${exam.questions.map((question, index) => `<div style="margin-top:15px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.05);"><p style="font-weight:bold;color:var(--primary);">Q${index + 1}: ${portal.escapeHtml(question.questionText)}</p><ul style="list-style:none;padding-left:15px;font-size:14px;">${question.options.map((option, optionIndex) => `<li style="${optionIndex === question.correctAnswerIndex ? "color:var(--primary);font-weight:bold;" : ""}">${String.fromCharCode(65 + optionIndex)}. ${portal.escapeHtml(option)} ${optionIndex === question.correctAnswerIndex ? '<i class="fas fa-check" aria-label="Correct answer"></i>' : ""}</li>`).join("")}</ul></div>`).join("")}</div><button type="button" class="print-btn" data-print-exam="${portal.escapeHtml(exam.id)}"><i class="fas fa-print"></i> Print Exam</button></div>
      </article>`).join("")
      container.querySelectorAll("[data-toggle-history]").forEach((button) => button.addEventListener("click", () => {
        const content = $(`history-content-${button.dataset.toggleHistory}`)
        if (!content) return
        const open = content.style.display === "block"
        content.style.display = open ? "none" : "block"
        const icon = button.querySelector("i")
        if (icon) icon.className = `fas fa-chevron-${open ? "down" : "up"}`
      }))
      container.querySelectorAll("[data-print-exam]").forEach((button) => button.addEventListener("click", () => printExam(`history-exam-${button.dataset.printExam}`)))
    } catch (error) {
      container.innerHTML = `<p style="text-align:center;color:var(--danger);">${portal.escapeHtml(error.message || "Failed to load exam history.")}</p>`
    }
  }

  function printExam(cardId) {
    const card = $(cardId)
    if (!card) return
    const printable = card.querySelector(".printable-content")
    const title = card.querySelector("h3")?.textContent || "Exam"
    const printWindow = window.open("", "", "height=800,width=1000")
    if (!printWindow || !printable) return
    printWindow.document.write(`<html><head><title>${portal.escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px}li{margin-bottom:6px}</style></head><body><h1>${portal.escapeHtml(title)}</h1>${printable.innerHTML}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
  }

  async function loadResultsDashboard() {
    const container = $("resultsListContainer")
    if (!container) return
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Loading exams…</p>'
    try {
      await refreshExams()
      if (!exams.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No exams have been created yet.</p>'
        return
      }
      const withResults = await Promise.all(exams.map(async (exam) => {
        try {
          return { exam, result: await portal.request(`/api/portal/teacher/exams/${encodeURIComponent(exam.id)}/results`) }
        } catch (error) {
          return { exam, result: null, error }
        }
      }))
      container.innerHTML = withResults.map(({ exam, result }) => `<article class="result-card"><div class="result-card-icon"><i class="fas fa-poll-h"></i></div><div class="result-card-details"><h3 style="margin:0;color:white;font-size:16px;">${portal.escapeHtml(exam.title)}</h3><p style="margin:5px 0 0;font-size:12px;color:var(--text-muted);">Class: ${portal.escapeHtml(result?.className || exam.className || "Class")} · Questions: ${exam.questions.length}</p></div><div class="result-card-stats"><span class="stat-value">${result?.results?.length ?? 0}</span><span class="stat-label">Submissions</span></div><button type="button" data-view-results="${portal.escapeHtml(exam.id)}" class="view-submissions-btn">View</button></article>`).join("")
      container.querySelectorAll("[data-view-results]").forEach((button) => button.addEventListener("click", () => viewResults(button.dataset.viewResults)))
    } catch (error) {
      container.innerHTML = `<p style="text-align:center;color:var(--danger);">${portal.escapeHtml(error.message || "Failed to load results.")}</p>`
    }
  }

  async function viewResults(examId) {
    const modal = $("resultsModal")
    const tbody = $("resultsTableBody")
    const summary = $("resultsSummary")
    if (!modal || !tbody || !summary) return
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Loading…</td></tr>'
    summary.style.display = "none"
    modal.style.display = "block"
    try {
      const result = await portal.request(`/api/portal/teacher/exams/${encodeURIComponent(examId)}/results`)
      activeResults = result
      portal.setText("resultsTitle", result.title || "Exam Results")
      portal.setText("resultsClass", `Class: ${result.className || "Class"}`)
      const rows = result.results || []
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No attempts recorded yet.</td></tr>'
        return
      }
      const total = Number(result.totalQuestions) || 0
      const average = rows.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / rows.length
      const averagePercentage = rows.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0) / rows.length
      summary.innerHTML = `<div class="summary-item"><span class="stat-label">Total Submissions</span><span class="stat-value">${rows.length}</span></div><div class="summary-item"><span class="stat-label">Average Score</span><span class="stat-value">${average.toFixed(1)} / ${total}</span></div><div class="summary-item"><span class="stat-label">Class Average</span><span class="stat-value">${Math.round(averagePercentage)}%</span></div>`
      summary.style.display = "grid"
      tbody.innerHTML = rows.map((row) => `<tr><td>${portal.escapeHtml(row.fullName || "Student")}</td><td>—</td><td>${Number(row.score) || 0} / ${Number(row.totalQuestions) || total}</td><td style="color:${Number(row.percentage) >= 50 ? "#4ade80" : "#ef4444"};font-weight:bold;">${Number(row.percentage) || 0}%</td><td style="text-transform:uppercase;font-size:11px;">Submitted</td></tr>`).join("")
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">${portal.escapeHtml(error.message || "Error loading results.")}</td></tr>`
    }
  }

  function closeResultsModal() {
    const modal = $("resultsModal")
    if (modal) modal.style.display = "none"
  }

  function printResults() {
    const modalBody = document.querySelector("#resultsModal .modal-body")
    if (!modalBody) return
    const clone = modalBody.cloneNode(true)
    clone.querySelector(".print-btn")?.remove()
    const printWindow = window.open("", "", "height=800,width=1000")
    if (!printWindow) return
    printWindow.document.write(`<html><head><title>${portal.escapeHtml(activeResults?.title || "Exam Results")}</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}.results-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1rem;padding:1rem}</style></head><body><h1>${portal.escapeHtml(activeResults?.title || "Exam Results")}</h1>${clone.innerHTML}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
  }

  async function init() {
    try {
      member = await portal.getMember("teacher")
      if (!member) return
      dashboard = await portal.request("/api/portal/teacher/dashboard")
      portal.setText("teacherName", member.fullName)
      portal.setText("teacherPin", `ID: ${portal.shortId(member)}`)
      const photo = $("teacherPassport")
      if (photo) photo.src = member.passport || portal.avatarData(member.fullName, "d4af37", "0a192f")
      document.title = `Exam Control | ${member.school?.schoolName || "AceEdu"}`
      const link = $("returnToTeacherDashboard")
      if (link) link.href = portal.pageLink("./teacher.html")
      fillClassOptions()
      addQuestion()
      $("examTargetClass")?.addEventListener("change", updateClassSelectors)
      $("addQuestionBtn")?.addEventListener("click", addQuestion)
      $("examCreationForm")?.addEventListener("submit", handleCreateExam)
      $("examLogoutBtn")?.addEventListener("click", () => portal.logout("teacher"))
      $("closeResultsModalBtn")?.addEventListener("click", closeResultsModal)
      $("printResultsBtn")?.addEventListener("click", printResults)
      $("resultsModal")?.addEventListener("click", (event) => { if (event.target.id === "resultsModal") closeResultsModal() })
      document.querySelectorAll(".menu-item[data-exam-tab]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); switchTab(button.dataset.examTab, button) }))
      const homeLink = document.getElementById("returnToTeacherDashboard")
      if (homeLink) homeLink.href = portal.pageLink("./teacher.html")
    } catch (error) {
      console.error("AceEdu teacher exam portal failed to load", error)
      portal.showError(error.message || "The examination portal could not be loaded.")
    }
  }

  window.addQuestion = addQuestion
  window.switchTab = switchTab
  window.closeResultsModal = closeResultsModal
  window.printResults = printResults
  window.viewResults = viewResults
  window.printExam = printExam
  window.addEventListener("DOMContentLoaded", init)
})()
