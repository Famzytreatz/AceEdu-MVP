(() => {
  const portal = window.AceEduPortal
  let member = null
  let dashboard = null
  let classroom = null
  let exams = []

  const $ = (selector) => document.querySelector(selector)

  function setSchoolBrand(name) {
    const schoolName = name || "Your School"
    const brand = $(".school-brand h3:first-child")
    if (brand) {
      const words = schoolName.toUpperCase().trim().split(/\s+/)
      const accent = words.pop() || "SCHOOL"
      brand.innerHTML = `${portal.escapeHtml(words.join(" "))}${words.length ? " " : ""}<span style="color:var(--gold)">${portal.escapeHtml(accent)}</span>`
    }
    const idBrand = $(".id-school-info h4")
    if (idBrand) idBrand.textContent = schoolName.toUpperCase()
    document.title = `Student Terminal | ${schoolName}`
  }

  function buildAvatar(name) {
    return portal.avatarData(name, "00d2ff", "ffffff")
  }

  function renderIdentity() {
    const schoolName = member.school?.schoolName || "Your School"
    const profile = dashboard?.profile || member
    const className = dashboard?.schoolClass?.name || profile.designation || "Not assigned"
    setSchoolBrand(schoolName)
    portal.setText("welcomeName", `GREETINGS, ${(profile.fullName || "STUDENT").split(/\s+/)[0].toUpperCase()}`)
    portal.setText("stuName", profile.fullName || member.fullName)
    portal.setText("stuPin", portal.shortId(member))
    portal.setText("stuClass", className)
    portal.setText("currentDate", new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))
    const photo = document.getElementById("stuPassport")
    if (photo) {
      photo.src = profile.passport || member.passport || buildAvatar(profile.fullName || member.fullName)
      photo.alt = `${profile.fullName || member.fullName} profile photo`
    }
    const academicLink = document.getElementById("studentHubLink")
    if (academicLink) academicLink.href = portal.pageLink("./academy-hub.html")
    const examTrigger = document.getElementById("openExamPortal")
    if (examTrigger) examTrigger.setAttribute("aria-label", "Open exam portal")
    const hubTrigger = document.getElementById("openAcademicHub")
    if (hubTrigger) hubTrigger.setAttribute("aria-label", "Open academic hub")
  }

  function renderTransmissions(posts) {
    const display = document.getElementById("broadcastDisplay")
    if (!display) return
    if (!Array.isArray(posts) || posts.length === 0) {
      display.innerHTML = '<p style="text-align:center; opacity:0.45; padding:20px;">NO CURRENT BROADCASTS</p>'
      return
    }
    display.innerHTML = posts.slice(0, 8).map((post) => {
      const type = post.type === "assignment" ? "ASSIGNMENT" : (post.type || "notice").replaceAll("_", " ").toUpperCase()
      const attachment = post.attachmentUrl
        ? `<a href="${portal.escapeHtml(post.attachmentUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyber-blue);display:inline-block;margin-top:8px;">${portal.escapeHtml(post.attachmentName || "Open attachment")}</a>`
        : ""
      const meeting = post.meetingUrl
        ? `<a href="${portal.escapeHtml(post.meetingUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyber-blue);display:inline-block;margin-top:8px;">Join class meeting</a>`
        : ""
      return `<article style="background:rgba(255,255,255,0.035);border-left:3px solid var(--cyber-blue);padding:13px 14px;border-radius:8px;margin:10px 0;">
        <div style="font-size:10px;letter-spacing:1px;color:var(--cyber-blue);font-weight:800;">${portal.escapeHtml(type)}</div>
        <h4 style="margin:7px 0;color:#e6f1ff;">${portal.escapeHtml(post.title || "School update")}</h4>
        <p style="margin:0;color:var(--text-dim);font-size:13px;line-height:1.5;white-space:pre-wrap;">${portal.escapeHtml(post.contentBody || "")}</p>
        <small style="display:block;color:var(--text-dim);margin-top:9px;">${portal.escapeHtml(post.author || "School staff")} · ${portal.escapeHtml(new Date(post.createdAt).toLocaleDateString())}${post.deadline ? ` · Due ${portal.escapeHtml(post.deadline)}` : ""}</small>
        ${attachment}${meeting}
      </article>`
    }).join("")
  }

  function openProfile() {
    const modal = document.getElementById("profileModal")
    const content = document.getElementById("profileContent")
    if (!modal || !content || !member) return
    const profile = dashboard?.profile || member
    const rows = [
      ["Full Name", profile.fullName || member.fullName],
      ["Member ID", portal.shortId(member)],
      ["Role", "Student"],
      ["School", member.school?.schoolName],
      ["Class", dashboard?.schoolClass?.name || profile.designation || "Not assigned"],
      ["Academic Year", dashboard?.schoolClass?.academicYear || "Not set"],
      ["Subjects", (dashboard?.subjects || []).map((item) => item.name).join(", ") || "Not assigned"],
      ["Attendance Sessions", dashboard?.attendance?.total ?? 0],
    ]
    content.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${portal.escapeHtml(profile.passport || member.passport || buildAvatar(profile.fullName || member.fullName))}" style="width:100px;height:100px;border-radius:50%;border:2px solid var(--cyber-blue);object-fit:cover;" alt="Student portrait"></div>${rows.map(([label, value]) => `<div class="profile-row"><span class="profile-label">${portal.escapeHtml(label)}</span><span class="profile-value">${portal.escapeHtml(value ?? "—")}</span></div>`).join("")}`
    modal.style.display = "block"
  }

  function closeProfile() {
    const modal = document.getElementById("profileModal")
    if (modal) modal.style.display = "none"
  }

  function openResults() {
    const modal = document.getElementById("resultsModal")
    const content = document.getElementById("resultsContent")
    if (!modal || !content) return
    const assessments = dashboard?.assessments || []
    if (!assessments.length) {
      content.innerHTML = '<p style="color:var(--text-dim);line-height:1.6;">No published assessments or results are available for your class yet.</p>'
    } else {
      content.innerHTML = assessments.map((assessment) => {
        const hasScore = assessment.score !== null && assessment.score !== undefined
        const score = hasScore ? `${portal.escapeHtml(assessment.score)} / ${portal.escapeHtml(assessment.maximumScore)}` : "Not graded yet"
        const due = assessment.dueOn ? `<p style="margin:6px 0 0;color:var(--text-dim);font-size:12px;">Due: ${portal.escapeHtml(assessment.dueOn)}</p>` : ""
        const feedback = assessment.feedback ? `<p style="margin:10px 0 0;white-space:pre-wrap;color:var(--text-dim);">${portal.escapeHtml(assessment.feedback)}</p>` : ""
        return `<article style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08);"><div style="display:flex;gap:12px;justify-content:space-between;align-items:flex-start;"><div><h3 style="margin:0;color:#e6f1ff;font-size:15px;">${portal.escapeHtml(assessment.title)}</h3><p style="margin:6px 0 0;color:var(--cyber-blue);font-size:12px;">${portal.escapeHtml(assessment.subject || "Subject")} · ${portal.escapeHtml(assessment.type || "Assessment")}</p>${due}${feedback}</div><strong style="color:${hasScore ? "var(--cyber-blue)" : "var(--text-dim)"};white-space:nowrap;">${score}</strong></div></article>`
      }).join("")
    }
    modal.style.display = "block"
  }

  function closeResults() {
    const modal = document.getElementById("resultsModal")
    if (modal) modal.style.display = "none"
  }

  function showStatus(message) {
    const display = document.getElementById("broadcastDisplay")
    if (display) display.innerHTML = `<p style="padding:16px;color:#fca5a5;" role="alert">${portal.escapeHtml(message)}</p>`
  }

  async function init() {
    try {
      member = await portal.getMember("student")
      if (!member) return
      const results = await Promise.allSettled([
        portal.request("/api/portal/student/dashboard"),
        portal.request("/api/portal/student/classroom"),
        portal.request("/api/portal/student/exams"),
      ])
      if (results[0].status === "fulfilled") dashboard = results[0].value
      if (results[1].status === "fulfilled") classroom = results[1].value
      else if (results[1].reason?.status !== 404) console.warn("Student classroom was not loaded.", results[1].reason)
      if (results[2].status === "fulfilled") exams = results[2].value.exams || []
      else console.warn("Student exams were not loaded.", results[2].reason)

      renderIdentity()
      renderTransmissions(classroom?.posts || [])
      const examTrigger = document.getElementById("openExamPortal")
      if (examTrigger) examTrigger.title = `${exams.length} published examination${exams.length === 1 ? "" : "s"}`

      document.getElementById("studentProfileLink")?.addEventListener("click", (event) => { event.preventDefault(); openProfile() })
      document.getElementById("studentResultsLink")?.addEventListener("click", (event) => { event.preventDefault(); openResults() })
      document.getElementById("closeResultsModal")?.addEventListener("click", closeResults)
      document.getElementById("resultsModal")?.addEventListener("click", (event) => { if (event.target.id === "resultsModal") closeResults() })
      document.getElementById("studentLogoutBtn")?.addEventListener("click", () => portal.logout("student"))
      document.getElementById("closeProfileModal")?.addEventListener("click", closeProfile)
      document.getElementById("printStudentId")?.addEventListener("click", () => window.print())
      const openPage = (path) => { window.location.href = portal.pageLink(path) }
      const academicHub = document.getElementById("openAcademicHub")
      const examPortal = document.getElementById("openExamPortal")
      academicHub?.addEventListener("click", () => openPage("./academy-hub.html"))
      examPortal?.addEventListener("click", () => openPage("./exam-room.html"))
      academicHub?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPage("./academy-hub.html") }
      })
      examPortal?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPage("./exam-room.html") }
      })
      document.getElementById("profileModal")?.addEventListener("click", (event) => { if (event.target.id === "profileModal") closeProfile() })

      const overlay = document.getElementById("init-overlay")
      const progress = document.getElementById("init-progress")
      const greeting = document.getElementById("init-greeting")
      if (greeting) greeting.textContent = `Welcome, ${(member.fullName || "student").split(/\s+/)[0]}`
      if (progress) progress.style.width = "100%"
      const container = document.getElementById("mainContainer")
      if (container) container.style.opacity = "1"
      if (overlay) {
        overlay.style.opacity = "0"
        window.setTimeout(() => overlay.remove(), 850)
      }
      if (results[0].status === "rejected") showStatus(results[0].reason.message)
      else if (results[1].status === "rejected" && results[1].reason?.status !== 404) showStatus("Your class feed could not be loaded right now. Please refresh to try again.")
    } catch (error) {
      console.error("AceEdu student portal failed to load", error)
      showStatus(error.message || "The student portal could not be loaded.")
      const overlay = document.getElementById("init-overlay")
      if (overlay) overlay.style.display = "none"
      const container = document.getElementById("mainContainer")
      if (container) container.style.opacity = "1"
    }
  }

  window.openProfile = openProfile
  window.logout = () => portal.logout("student")
  window.addEventListener("DOMContentLoaded", init)
})()
