(() => {
  const portal = window.AceEduPortal
  let member = null
  let dashboard = null
  const $ = (selector) => document.querySelector(selector)

  function setSchoolName(name) {
    const school = name || "Your School"
    const idSchool = $(".id-school-info p")
    if (idSchool) idSchool.textContent = school
    document.title = `Faculty Command | ${school}`
  }

  function renderClasses() {
    const grid = document.getElementById("classGrid")
    const classes = dashboard?.classes || []
    if (!grid) return
    if (!classes.length) {
      grid.innerHTML = '<p style="color:var(--text-dim);">No classes or subjects have been assigned to your account yet. Contact your school administrator.</p>'
      return
    }
    grid.innerHTML = ""
    classes.forEach((schoolClass) => {
      const card = document.createElement("div")
      card.className = "class-command-card"
      const badge = document.createElement("div")
      badge.className = "class-badge"
      badge.textContent = schoolClass.academicYear || "Academic Portal"
      const name = document.createElement("div")
      name.className = "class-name"
      name.textContent = schoolClass.name
      const subject = document.createElement("p")
      subject.style.cssText = "color:var(--text-dim);font-size:12px;margin:8px 0;"
      subject.textContent = (schoolClass.subjects || []).map((item) => item.name).join(", ") || "No subjects assigned"
      const button = document.createElement("button")
      button.type = "button"
      button.className = "enter-btn"
      button.innerHTML = '<i class="fas fa-sign-in-alt" aria-hidden="true"></i> ENTER CLASSROOM'
      button.addEventListener("click", () => window.launchSpecificClass(schoolClass.id))
      card.append(badge, name, subject, button)
      grid.appendChild(card)
    })
  }

  function showView(viewId, element) {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"))
    document.querySelectorAll(".nav-btn[data-view]").forEach((button) => button.classList.remove("active"))
    const panel = document.getElementById(viewId)
    if (panel) panel.classList.add("active")
    const navButton = element || document.querySelector(`.nav-btn[data-view="${viewId}"]`)
    if (navButton) navButton.classList.add("active")
  }

  function openProfile() {
    if (!member) return
    const modal = document.getElementById("profileModal")
    const content = document.getElementById("profileContent")
    const classes = dashboard?.classes || []
    const subjects = [...new Set(classes.flatMap((schoolClass) => (schoolClass.subjects || []).map((subject) => subject.name)))]
    const rows = [
      ["Full Name", member.fullName],
      ["Member ID", portal.shortId(member)],
      ["Role", "Teacher"],
      ["School", member.school?.schoolName],
      ["Subjects", subjects.join(", ") || "Not assigned"],
      ["Assigned Classes", classes.map((schoolClass) => schoolClass.name).join(", ") || "Not assigned"],
    ]
    const photo = member.passport || portal.avatarData(member.fullName, "f59e0b", "020c1b")
    content.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${portal.escapeHtml(photo)}" style="width:100px;height:100px;border-radius:50%;border:2px solid var(--gold);object-fit:cover;" alt="Teacher portrait"></div>${rows.map(([label, value]) => `<div class="profile-row"><span class="profile-label">${portal.escapeHtml(label)}</span><span class="profile-value">${portal.escapeHtml(value ?? "—")}</span></div>`).join("")}`
    modal.style.display = "block"
  }

  function launchSpecificClass(classId) {
    if (!member?.school?.slug || !classId) return
    const href = `/eis-portals/student/academy-hub.html?schoolSlug=${encodeURIComponent(member.school.slug)}&classId=${encodeURIComponent(classId)}`
    window.location.assign(href)
  }

  async function init() {
    try {
      member = await portal.getMember("teacher")
      if (!member) return
      dashboard = await portal.request("/api/portal/teacher/dashboard")
      setSchoolName(member.school?.schoolName)
      portal.setText("displayTeacherName", `Instructor ${(member.fullName || "").split(/\s+/)[0]}`)
      portal.setText("facFullName", member.fullName)
      portal.setText("facID", portal.shortId(member))
      const classes = dashboard.classes || []
      const subjects = [...new Set(classes.flatMap((schoolClass) => (schoolClass.subjects || []).map((subject) => subject.name)))]
      portal.setText("facDept", subjects.join(", ") || member.designation || "General Faculty")
      const photo = document.getElementById("facPhoto")
      if (photo) {
        photo.src = member.passport || portal.avatarData(member.fullName, "f59e0b", "020c1b")
        photo.alt = `${member.fullName} profile photo`
      }
      // The legacy EIS QR encoded the teacher's sign-in PIN. Do not put a
      // reusable authentication credential on a printable ID card.
      const credentialBadge = document.getElementById("facQr")
      if (credentialBadge) {
        credentialBadge.style.cssText = "width:44px;height:44px;background:#fff;padding:3px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#020c1b;font:700 10px/1.2 Arial,sans-serif;text-align:center;"
        credentialBadge.textContent = `ID ${portal.shortId(member)}`
        credentialBadge.setAttribute("aria-label", "Non-secret member identifier")
      }
      const ring = document.getElementById("metric-ring")
      if (ring) ring.style.strokeDashoffset = String(440 - (Math.min(classes.length, 6) / 6) * 440)
      portal.setText("attendance-pct", String(classes.length))
      renderClasses()

      const examLink = document.getElementById("teacherExamLink")
      if (examLink) examLink.href = portal.pageLink("./teacher-exam-portal.html")
      document.querySelectorAll(".nav-btn[data-view]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault()
          showView(button.dataset.view, button)
        })
      })
      document.getElementById("teacherLogoutBtn")?.addEventListener("click", (event) => { event.preventDefault(); portal.logout("teacher") })
      document.getElementById("teacherProfileBtn")?.addEventListener("click", openProfile)
      document.getElementById("closeTeacherProfileModal")?.addEventListener("click", () => { document.getElementById("profileModal").style.display = "none" })
      document.getElementById("profileModal")?.addEventListener("click", (event) => { if (event.target.id === "profileModal") document.getElementById("profileModal").style.display = "none" })

      const overlay = document.getElementById("init-overlay")
      const fill = document.getElementById("prog-fill")
      if (fill) fill.style.width = "100%"
      if (overlay) {
        overlay.style.opacity = "0"
        window.setTimeout(() => overlay.remove(), 850)
      }
      const wrapper = document.getElementById("deckWrapper")
      if (wrapper) wrapper.style.opacity = "1"
    } catch (error) {
      console.error("AceEdu teacher portal failed to load", error)
      const label = document.getElementById("init-text")
      if (label) label.textContent = error.message || "Unable to load the teacher portal."
      const fill = document.getElementById("prog-fill")
      if (fill) fill.style.width = "100%"
    }
  }

  window.showView = showView
  window.openProfile = openProfile
  window.launchSpecificClass = launchSpecificClass
  window.logout = () => portal.logout("teacher")
  window.addEventListener("DOMContentLoaded", init)
})()
