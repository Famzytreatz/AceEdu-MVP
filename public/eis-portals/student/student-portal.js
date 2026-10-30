(() => {
  const portal = window.AceEduPortal
  if (!portal) return

  let member = null
  let dashboard = null
  let classroom = null
  let exams = []
  let passwordSaving = false
  let subjectChoices = null
  let subjectChoicesSaving = false

  const $ = (selector) => document.querySelector(selector)
  const byId = (id) => document.getElementById(id)
  const escape = (value) => portal.escapeHtml(value ?? "")

  function setSchoolBrand(name) {
    const schoolName = name || "Your School"
    const brand = $(".school-brand h3:first-child")
    if (brand) {
      const words = schoolName.toUpperCase().trim().split(/\s+/).filter(Boolean)
      const accent = words.pop() || "SCHOOL"
      brand.innerHTML = `${escape(words.join(" "))}${words.length ? " " : ""}<span>${escape(accent)}</span>`
    }

    const idBrand = $(".id-school-info h4")
    if (idBrand) idBrand.textContent = schoolName
    document.title = `Student Portal | ${schoolName}`
  }

  function buildAvatar(name) {
    return portal.avatarData(name, "377dff", "ffffff")
  }

  function safeLink(value) {
    if (!value) return ""
    try {
      const resolved = new URL(value, window.location.origin)
      const isSameOrigin = resolved.origin === window.location.origin
      if (resolved.protocol === "https:" || (isSameOrigin && resolved.protocol === window.location.protocol)) {
        return resolved.href
      }
    } catch {
      return ""
    }
    return ""
  }

  function renderIdentity() {
    const schoolName = member.school?.schoolName || "Your School"
    const profile = dashboard?.profile || member
    const firstName = (profile.fullName || member.fullName || "student").trim().split(/\s+/)[0]
    const className = dashboard?.schoolClass?.name || profile.designation || "Not assigned"
    const academicYear = dashboard?.schoolClass?.academicYear

    setSchoolBrand(schoolName)
    portal.setText("welcomeName", `Welcome back, ${firstName}`)
    portal.setText("headerStudentName", profile.fullName || member.fullName || "Student")
    portal.setText("stuName", profile.fullName || member.fullName || "Student")
    portal.setText("stuPin", member.accessCode || portal.shortId(member))
    portal.setText("stuClass", className)
    portal.setText("currentDate", new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))
    portal.setText("studentClassLabel", dashboard?.schoolClass
      ? `${className}${academicYear ? ` · ${academicYear}` : ""}`
      : "Your class details will appear once your school administrator assigns you to a class.")

    const photoUrl = profile.passport || member.passport || buildAvatar(profile.fullName || member.fullName)
    const photo = byId("stuPassport")
    if (photo) {
      photo.src = photoUrl
      photo.alt = `${profile.fullName || member.fullName || "Student"} profile photo`
    }
    const headerPhoto = byId("headerAvatar")
    if (headerPhoto) {
      headerPhoto.src = photoUrl
      headerPhoto.alt = ""
    }

    const subjects = Array.isArray(dashboard?.subjects) ? dashboard.subjects : []
    const attendance = dashboard?.attendance || { total: 0, present: 0, late: 0 }
    const attendanceRate = Number(attendance.total) > 0
      ? `${Math.round(((Number(attendance.present || 0) + Number(attendance.late || 0)) / Number(attendance.total)) * 100)}%`
      : "—"
    const assessments = Array.isArray(dashboard?.assessments) ? dashboard.assessments : []

    portal.setText("subjectCount", subjects.length)
    portal.setText("attendanceRate", attendanceRate)
    portal.setText("resultCount", assessments.length)
    portal.setText("examCount", exams.length)
    portal.setText("examQuickCount", `${exams.length} published exam${exams.length === 1 ? "" : "s"}`)

    const academicLink = byId("studentHubLink")
    if (academicLink) academicLink.href = portal.pageLink("./academy-hub.html")
    const examLink = byId("studentExamNavLink")
    if (examLink) examLink.href = portal.pageLink("./exam-room.html")

    renderRecentResults(assessments)
  }

  function renderTransmissions(posts) {
    const display = byId("broadcastDisplay")
    if (!display) return

    if (!Array.isArray(posts) || posts.length === 0) {
      display.innerHTML = '<div class="announcement-empty"><i class="fa-regular fa-bell" aria-hidden="true"></i>No class announcements yet. Your teachers’ latest notices and resources will appear here.</div>'
      return
    }

    display.innerHTML = posts.slice(0, 5).map((post) => {
      const type = post.type === "assignment" ? "Assignment" : (post.type || "notice").replaceAll("_", " ")
      const createdDate = post.createdAt && !Number.isNaN(new Date(post.createdAt).getTime())
        ? new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "Recently"
      const attachmentUrl = safeLink(post.attachmentUrl)
      const meetingUrl = safeLink(post.meetingUrl)
      const attachment = attachmentUrl
        ? `<a href="${escape(attachmentUrl)}"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> ${escape(post.attachmentName || "Open attachment")}</a>`
        : ""
      const meeting = meetingUrl
        ? `<a href="${escape(meetingUrl)}"><i class="fa-solid fa-video" aria-hidden="true"></i> Join class meeting</a>`
        : ""
      const deadline = post.deadline ? ` · Due ${escape(post.deadline)}` : ""

      return `<article class="announcement-item">
        <div class="announcement-top"><span class="announcement-type"><i class="fa-solid fa-circle-dot" aria-hidden="true"></i>${escape(type)}</span><time>${escape(createdDate)}</time></div>
        <h3>${escape(post.title || "Class update")}</h3>
        <p>${escape(post.contentBody || "")}</p>
        <div class="announcement-meta">${escape(post.author || "School staff")}${deadline}</div>
        ${attachment || meeting ? `<div class="announcement-links">${attachment}${meeting}</div>` : ""}
      </article>`
    }).join("")
  }

  function renderRecentResults(assessments) {
    const display = byId("recentResultsDisplay")
    if (!display) return
    if (!Array.isArray(assessments) || assessments.length === 0) {
      display.innerHTML = '<div class="results-empty">No published results are available yet. Check back when your teachers release academic records.</div>'
      return
    }

    display.innerHTML = assessments.slice(0, 4).map((assessment) => {
      const hasScore = assessment.score !== null && assessment.score !== undefined && assessment.score !== ""
      const score = hasScore
        ? `${escape(assessment.score)}${assessment.maximumScore !== undefined && assessment.maximumScore !== null ? ` / ${escape(assessment.maximumScore)}` : ""}`
        : "Pending"
      const isPending = !hasScore
      return `<article class="recent-result">
        <div class="recent-result-info"><span class="result-subject-icon"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span><div><strong>${escape(assessment.title || "Assessment")}</strong><small>${escape(assessment.subject || "General")}${assessment.type ? ` · ${escape(assessment.type)}` : ""}</small></div></div>
        <span class="result-score${isPending ? " pending" : ""}">${score}</span>
      </article>`
    }).join("")
  }

  function openProfile() {
    const modal = byId("profileModal")
    const content = byId("profileContent")
    if (!modal || !content || !member) return
    const profile = dashboard?.profile || member
    const rows = [
      ["Full name", profile.fullName || member.fullName],
      ["Student ID", member.accessCode || portal.shortId(member)],
      ["Role", "Student"],
      ["School", member.school?.schoolName],
      ["Class", dashboard?.schoolClass?.name || profile.designation || "Not assigned"],
      ["Academic year", dashboard?.schoolClass?.academicYear || "Not set"],
      ["Subjects", (dashboard?.subjects || []).map((item) => item.name).join(", ") || "Not assigned"],
      ["Attendance sessions", dashboard?.attendance?.total ?? 0],
    ]
    const photo = profile.passport || member.passport || buildAvatar(profile.fullName || member.fullName)
    content.innerHTML = `<div class="profile-photo-wrap"><img src="${escape(photo)}" alt="Student portrait"></div>${rows.map(([label, value]) => `<div class="profile-row"><span class="profile-label">${escape(label)}</span><span class="profile-value">${escape(value ?? "—")}</span></div>`).join("")}`
    modal.style.display = "block"
    byId("closeProfileModal")?.focus()
  }

  function closeProfile() {
    const modal = byId("profileModal")
    if (modal) modal.style.display = "none"
  }

  function openResults() {
    const modal = byId("resultsModal")
    const content = byId("resultsContent")
    if (!modal || !content) return
    const assessments = Array.isArray(dashboard?.assessments) ? dashboard.assessments : []
    if (!assessments.length) {
      content.innerHTML = '<p class="results-empty">No published assessments or results are available yet.</p>'
    } else {
      content.innerHTML = assessments.map((assessment) => {
        const hasScore = assessment.score !== null && assessment.score !== undefined && assessment.score !== ""
        const score = hasScore
          ? `${escape(assessment.score)}${assessment.maximumScore !== null && assessment.maximumScore !== undefined ? ` / ${escape(assessment.maximumScore)}` : ""}`
          : "Not graded yet"
        const due = assessment.dueOn ? `<p>Due: ${escape(assessment.dueOn)}</p>` : ""
        const feedback = assessment.feedback ? `<p class="feedback">${escape(assessment.feedback)}</p>` : ""
        return `<article class="result-modal-item"><div class="result-modal-row"><div><h3>${escape(assessment.title || "Assessment")}</h3><p>${escape(assessment.subject || "Subject")}${assessment.type ? ` · ${escape(assessment.type)}` : ""}</p>${due}${feedback}</div><strong class="result-score${hasScore ? "" : " pending"}">${score}</strong></div></article>`
      }).join("")
    }
    modal.style.display = "block"
    byId("closeResultsModal")?.focus()
  }

  function closeResults() {
    const modal = byId("resultsModal")
    if (modal) modal.style.display = "none"
  }

  function setPasswordMessage(message, isError = false) {
    const display = byId("passwordFormMessage")
    if (!display) return
    display.textContent = message
    display.style.display = message ? "block" : "none"
    display.style.color = isError ? "#b42335" : "#21875d"
  }

  function openSettings() {
    const modal = byId("settingsModal")
    const status = byId("passwordStatus")
    const currentPasswordField = byId("currentPasswordField")
    const hasPassword = Boolean(member?.hasPortalPassword)
    if (status) {
      status.textContent = hasPassword
        ? "A portal password is set. Enter your current password to change it."
        : "Add a password so you can sign in with your access code and password."
    }
    if (currentPasswordField) {
      currentPasswordField.style.display = hasPassword ? "block" : "none"
    }
    byId("currentPortalPassword").value = ""
    byId("newPortalPassword").value = ""
    byId("confirmPortalPassword").value = ""
    setPasswordMessage("")
    if (modal) modal.style.display = "block"
    byId("newPortalPassword")?.focus()
  }

  async function savePassword(event) {
    event.preventDefault()
    if (passwordSaving) return
    const currentPassword = byId("currentPortalPassword").value
    const newPassword = byId("newPortalPassword").value
    const confirmation = byId("confirmPortalPassword").value
    const button = byId("savePortalPassword")
    if (newPassword !== confirmation) {
      setPasswordMessage("The new passwords do not match.", true)
      return
    }
    passwordSaving = true
    button.disabled = true
    button.textContent = "Saving…"
    setPasswordMessage("")
    try {
      await portal.request("/api/portal/password", {
        method: "PATCH",
        body: JSON.stringify({
          ...(member.hasPortalPassword ? { currentPassword } : {}),
          newPassword,
        }),
      })
      member.hasPortalPassword = true
      byId("currentPortalPassword").value = ""
      byId("newPortalPassword").value = ""
      byId("confirmPortalPassword").value = ""
      const currentPasswordField = byId("currentPasswordField")
      if (currentPasswordField) currentPasswordField.style.display = "block"
      const status = byId("passwordStatus")
      if (status) status.textContent = "Your portal password has been saved."
      setPasswordMessage("Password saved. Keep it private and do not share it.")
    } catch (error) {
      setPasswordMessage(error.message || "Your password could not be saved.", true)
    } finally {
      passwordSaving = false
      button.disabled = false
      button.textContent = "Save password"
    }
  }

  function closeSettings() {
    const modal = byId("settingsModal")
    if (modal) modal.style.display = "none"
  }

  function setSubjectChoiceMessage(message, isError = false) {
    const display = byId("subjectChoiceMessage")
    if (!display) return
    display.textContent = message
    display.style.display = message ? "block" : "none"
    display.style.color = isError ? "#b42335" : "#21875d"
  }

  function renderSubjectChoices() {
    const classLevel = subjectChoices?.classLevel
    const options = byId("subjectChoiceOptions")
    const instruction = byId("subjectChoiceInstructions")
    const submit = byId("submitSubjectChoices")
    const status = byId("subjectChoiceStatus")
    const approvedList = byId("approvedSubjectList")
    if (!classLevel) {
      if (instruction) {
        instruction.textContent = "Your school administrator must assign your class before subject options are available."
      }
      if (options) options.innerHTML = ""
      if (submit) submit.disabled = true
      if (status) status.textContent = "Class assignment required"
      if (approvedList) approvedList.innerHTML = ""
      return
    }

    const currentRequest = subjectChoices.request
    const selectedIds = new Set(
      (currentRequest?.subjects || subjectChoices.approvedSubjects || [])
        .map((subject) => String(subject.id)),
    )
    const compulsoryIds = classLevel.subjects
      .filter((subject) => subject.isCompulsory)
      .map((subject) => String(subject.id))
    for (const id of compulsoryIds) selectedIds.add(id)

    if (instruction) {
      instruction.textContent = `${classLevel.name}: select ${classLevel.minimumSubjects} to ${classLevel.maximumSubjects} subjects. Compulsory subjects are already selected. Your combination must be approved by your school before it is final.`
    }
    if (options) {
      options.innerHTML = classLevel.subjects.length
        ? classLevel.subjects.map((subject) => `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e6ebf2;color:#33415c;font-size:13px;">
              <input type="checkbox" name="studentSubjectChoice" value="${escape(subject.id)}" ${selectedIds.has(String(subject.id)) ? "checked" : ""} ${subject.isCompulsory ? "disabled" : ""} />
              <span>${escape(subject.name)}${subject.isCompulsory ? " · Compulsory" : ""}</span>
            </label>
          `).join("")
        : '<p style="color:#66748e;font-size:12px;">Your school has not added any subjects for this class yet.</p>'
    }
    if (submit) submit.disabled = subjectChoicesSaving
    if (status) {
      status.textContent = currentRequest?.status === "pending"
        ? "Subject combination awaiting admin approval"
        : currentRequest?.status === "approved"
          ? "Subject combination approved"
          : currentRequest?.status === "declined"
            ? "Previous selection was declined · choose and submit again"
            : "No subject combination submitted"
    }
    if (approvedList) {
      const approved = subjectChoices.approvedSubjects || []
      approvedList.innerHTML = approved.length
        ? `<strong style="display:block;margin-bottom:8px;color:#33415c;font-size:12px;">Approved subjects</strong><p style="margin:0;color:#66748e;font-size:12px;line-height:1.6;">${approved.map((subject) => escape(subject.name)).join(", ")}</p>`
        : ""
    }
  }

  async function loadSubjectChoices() {
    subjectChoices = await portal.request("/api/portal/student/subjects")
    renderSubjectChoices()
  }

  function openSubjectChoices() {
    setSubjectChoiceMessage("")
    const modal = byId("subjectChoiceModal")
    if (modal) modal.style.display = "block"
  }

  async function saveSubjectChoices() {
    if (subjectChoicesSaving || !subjectChoices?.classLevel) return
    const selectedIds = [...document.querySelectorAll(
      'input[name="studentSubjectChoice"]:checked',
    )].map((input) => Number(input.value))
    const { minimumSubjects, maximumSubjects, subjects } = subjectChoices.classLevel
    if (selectedIds.length < minimumSubjects || selectedIds.length > maximumSubjects) {
      setSubjectChoiceMessage(
        `Choose between ${minimumSubjects} and ${maximumSubjects} subjects.`,
        true,
      )
      return
    }
    const selected = new Set(selectedIds.map(String))
    if (subjects.some((subject) => subject.isCompulsory && !selected.has(String(subject.id)))) {
      setSubjectChoiceMessage("Include every compulsory subject.", true)
      return
    }

    const button = byId("submitSubjectChoices")
    subjectChoicesSaving = true
    if (button) {
      button.disabled = true
      button.textContent = "Submitting…"
    }
    setSubjectChoiceMessage("")
    try {
      await portal.request("/api/portal/student/subjects", {
        method: "POST",
        body: JSON.stringify({ subjectIds: selectedIds }),
      })
      setSubjectChoiceMessage("Your subject combination was submitted and is waiting for admin approval.")
      try {
        await loadSubjectChoices()
      } catch (refreshError) {
        setSubjectChoiceMessage(
          `Your combination was submitted, but its latest status could not be loaded: ${refreshError.message}`,
          true,
        )
      }
    } catch (error) {
      setSubjectChoiceMessage(error.message || "Your subject selection could not be submitted.", true)
    } finally {
      subjectChoicesSaving = false
      if (button) {
        button.disabled = false
        button.textContent = "Submit for approval"
      }
    }
  }

  function closeSubjectChoices() {
    const modal = byId("subjectChoiceModal")
    if (modal) modal.style.display = "none"
  }

  function showStatus(message) {
    const display = byId("portalError")
    if (display) {
      display.textContent = message || "Something went wrong. Please refresh and try again."
      display.style.display = "block"
    } else {
      portal.showError(message)
    }
  }

  function openPage(path) {
    window.location.href = portal.pageLink(path)
  }

  async function init() {
    try {
      member = await portal.getMember("student")
      if (!member) return

      const results = await Promise.allSettled([
        portal.request("/api/portal/student/dashboard"),
        portal.request("/api/portal/student/classroom"),
        portal.request("/api/portal/student/exams"),
        portal.request("/api/portal/student/subjects"),
      ])
      if (results[0].status === "fulfilled") dashboard = results[0].value
      if (results[1].status === "fulfilled") classroom = results[1].value
      else if (results[1].reason?.status !== 404) console.warn("Student classroom was not loaded.", results[1].reason)
      if (results[2].status === "fulfilled") exams = results[2].value.exams || []
      else console.warn("Student exams were not loaded.", results[2].reason)
      if (results[3].status === "fulfilled") subjectChoices = results[3].value
      else console.warn("Student subject choices were not loaded.", results[3].reason)

      renderIdentity()
      renderSubjectChoices()
      renderTransmissions(classroom?.posts || [])

      byId("studentOverviewLink")?.addEventListener("click", () => {
        byId("studentOverviewLink")?.classList.add("active")
      })
      byId("studentProfileLink")?.addEventListener("click", (event) => { event.preventDefault(); openProfile() })
      byId("studentProfileShortcut")?.addEventListener("click", openProfile)
      byId("studentResultsLink")?.addEventListener("click", (event) => { event.preventDefault(); openResults() })
      byId("recentResultsLink")?.addEventListener("click", openResults)
      byId("closeResultsModal")?.addEventListener("click", closeResults)
      byId("resultsModal")?.addEventListener("click", (event) => { if (event.target.id === "resultsModal") closeResults() })
      byId("studentLogoutBtn")?.addEventListener("click", () => portal.logout("student"))
      byId("studentSettingsLink")?.addEventListener("click", (event) => {
        event.preventDefault()
        openSettings()
      })
      byId("closeSettingsModal")?.addEventListener("click", closeSettings)
      byId("settingsModal")?.addEventListener("click", (event) => {
        if (event.target.id === "settingsModal") closeSettings()
      })
      byId("studentPasswordForm")?.addEventListener("submit", savePassword)
      byId("studentSubjectsLink")?.addEventListener("click", (event) => {
        event.preventDefault()
        openSubjectChoices()
      })
      byId("openSubjectChoices")?.addEventListener("click", openSubjectChoices)
      byId("closeSubjectChoiceModal")?.addEventListener("click", closeSubjectChoices)
      byId("subjectChoiceModal")?.addEventListener("click", (event) => {
        if (event.target.id === "subjectChoiceModal") closeSubjectChoices()
      })
      byId("submitSubjectChoices")?.addEventListener("click", saveSubjectChoices)
      byId("closeProfileModal")?.addEventListener("click", closeProfile)
      byId("printStudentId")?.addEventListener("click", () => window.print())
      byId("openAcademicHub")?.addEventListener("click", () => openPage("./academy-hub.html"))
      byId("openExamPortal")?.addEventListener("click", () => openPage("./exam-room.html"))
      byId("studentExamNavLink")?.addEventListener("click", (event) => {
        event.preventDefault()
        openPage("./exam-room.html")
      })
      byId("profileModal")?.addEventListener("click", (event) => { if (event.target.id === "profileModal") closeProfile() })

      const greeting = byId("init-greeting")
      const progress = byId("init-progress")
      if (greeting) greeting.textContent = `Welcome, ${(member.fullName || "student").split(/\s+/)[0]}`
      if (progress) progress.style.width = "100%"
      const container = byId("mainContainer")
      if (container) container.style.opacity = "1"
      const overlay = byId("init-overlay")
      if (overlay) {
        overlay.style.opacity = "0"
        window.setTimeout(() => overlay.remove(), 500)
      }

      if (results[0].status === "rejected") showStatus(results[0].reason.message)
      else if (results[1].status === "rejected" && results[1].reason?.status !== 404) showStatus("Your class feed could not be loaded right now. Please refresh to try again.")
      else if (results[2].status === "rejected") showStatus("Your examination list could not be loaded right now. Please refresh to try again.")
    } catch (error) {
      console.error("Student portal failed to load", error)
      showStatus(error.message || "The student portal could not be loaded.")
      const overlay = byId("init-overlay")
      if (overlay) overlay.style.display = "none"
      const container = byId("mainContainer")
      if (container) container.style.opacity = "1"
    }
  }

  window.openProfile = openProfile
  window.logout = () => portal.logout("student")
  window.addEventListener("DOMContentLoaded", init)
})()
