;(() => {
  const portal = window.AceEduPortal
  let member = null
  let dashboard = null
  let passwordSaving = false
  const $ = (selector) => document.querySelector(selector)

  function setSchoolName(name) {
    const school = name || "Your School"
    portal.setText("teacherSchoolName", school)
    document.title = `Teacher Portal | ${school}`
  }

  function renderClasses() {
    const grid = document.getElementById("classGrid")
    const linkedClasses = dashboard?.classes || []
    const assignedClasses = (member?.assignedClasses || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    const assignedSubjects = (member?.subjects || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    const classes = linkedClasses.length
      ? linkedClasses
      : assignedClasses.map((name) => ({
          id: null,
          name,
          assignmentUnresolved: true,
          subjects: assignedSubjects.map((subjectName) => ({
            name: subjectName,
          })),
        }))
    if (!grid) return
    if (!classes.length) {
      grid.innerHTML =
        '<div class="empty-classes"><i class="fas fa-chalkboard-user" aria-hidden="true"></i><strong>No classrooms assigned yet</strong><p>Your school administrator has not assigned any classes or subjects to your account. Once assigned, your classrooms will appear here.</p></div>'
      return
    }
    grid.innerHTML = ""
    classes.forEach((schoolClass) => {
      const card = document.createElement("div")
      card.className = "class-command-card"
      const badge = document.createElement("div")
      badge.className = "class-badge"
      badge.textContent =
        schoolClass.academicYear ||
        (schoolClass.curriculumOnly ? "Class assignment" : "Academic Portal")
      const name = document.createElement("div")
      name.className = "class-name"
      name.textContent = schoolClass.name
      const subject = document.createElement("p")
      subject.style.cssText =
        "color:var(--text-dim);font-size:12px;margin:8px 0;"
      subject.textContent =
        (schoolClass.subjects || []).map((item) => item.name).join(", ") ||
        "No subjects assigned"
      card.append(badge, name, subject)

      if (schoolClass.id || schoolClass.classLevelId) {
        const classroomButton = document.createElement("button")
        classroomButton.type = "button"
        classroomButton.className = "enter-btn"
        classroomButton.innerHTML =
          '<i class="fas fa-arrow-right" aria-hidden="true"></i> OPEN CLASSROOM'
        classroomButton.addEventListener("click", () =>
          window.launchClassroom(schoolClass.id, schoolClass.classLevelId),
        )
        card.appendChild(classroomButton)
      }

      if (schoolClass.id && !schoolClass.curriculumOnly) {
        const examButton = document.createElement("button")
        examButton.type = "button"
        examButton.className = "enter-btn"
        examButton.textContent = "OPEN EXAM PORTAL"
        examButton.addEventListener("click", () =>
          window.launchSpecificClass(schoolClass.id),
        )
        card.appendChild(examButton)
      } else {
        const setupNote = document.createElement("p")
        setupNote.style.cssText =
          "color:var(--text-dim);font-size:11px;margin:8px 0 0;"
        setupNote.textContent = schoolClass.assignmentUnresolved
          ? "This saved class name does not match an active school class. Ask the administrator to update your class assignment."
          : "Class assignment is active. Exam creation becomes available when an academic-year class and term are linked."
        card.appendChild(setupNote)
      }
      grid.appendChild(card)
    })
  }

  function showView(viewId, element) {
    document
      .querySelectorAll(".view")
      .forEach((view) => view.classList.remove("active"))
    document
      .querySelectorAll(".nav-btn[data-view]")
      .forEach((button) => button.classList.remove("active"))
    const panel = document.getElementById(viewId)
    if (panel) panel.classList.add("active")
    const navButton =
      element || document.querySelector(`.nav-btn[data-view="${viewId}"]`)
    if (navButton) navButton.classList.add("active")
  }

  function openProfile() {
    if (!member) return
    const modal = document.getElementById("profileModal")
    const content = document.getElementById("profileContent")
    const classes = dashboard?.classes || []
    const subjects = [
      ...new Set(
        classes.flatMap((schoolClass) =>
          (schoolClass.subjects || []).map((subject) => subject.name),
        ),
      ),
    ]
    const rows = [
      ["Full Name", member.fullName],
      ["Member ID", portal.shortId(member)],
      ["Role", "Teacher"],
      ["School", member.school?.schoolName],
      ["Subjects", subjects.join(", ") || member.subjects || "Not assigned"],
      [
        "Assigned Classes",
        classes.map((schoolClass) => schoolClass.name).join(", ") ||
          member.assignedClasses ||
          "Not assigned",
      ],
    ]
    const photo =
      member.passport || portal.avatarData(member.fullName, "f59e0b", "020c1b")
    content.innerHTML = `<div style="text-align:center;margin-bottom:20px;"><img src="${portal.escapeHtml(photo)}" style="width:100px;height:100px;border-radius:50%;border:2px solid var(--gold);object-fit:cover;" alt="Teacher portrait"></div>${rows.map(([label, value]) => `<div class="profile-row"><span class="profile-label">${portal.escapeHtml(label)}</span><span class="profile-value">${portal.escapeHtml(value ?? "—")}</span></div>`).join("")}`
    modal.style.display = "block"
  }

  function setPasswordMessage(message, isError = false) {
    const display = document.getElementById("teacherPasswordMessage")
    if (!display) return
    display.textContent = message
    display.style.display = message ? "block" : "none"
    display.style.color = isError ? "#b42335" : "#21875d"
  }

  function openPasswordSettings() {
    const modal = document.getElementById("teacherPasswordModal")
    if (modal) modal.style.display = "block"
    setPasswordMessage("")
    document.getElementById("teacherPasswordForm")?.reset()
    document.getElementById("teacherCurrentPassword")?.focus()
  }

  async function savePassword(event) {
    event.preventDefault()
    if (passwordSaving) return
    const currentPassword = document.getElementById(
      "teacherCurrentPassword",
    ).value
    const newPassword = document.getElementById("teacherNewPassword").value
    const confirmation = document.getElementById("teacherConfirmPassword").value
    const button = document.getElementById("saveTeacherPassword")
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
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      document.getElementById("teacherPasswordForm").reset()
      setPasswordMessage("Password saved. Keep it private and do not share it.")
    } catch (error) {
      setPasswordMessage(
        error.message || "Your password could not be saved.",
        true,
      )
    } finally {
      passwordSaving = false
      button.disabled = false
      button.textContent = "Save password"
    }
  }

  function launchSpecificClass(classId) {
    if (!member?.school?.slug || !classId) return
    const target = `./teacher-exam-portal.html?classId=${encodeURIComponent(classId)}`
    window.location.assign(portal.pageLink(target))
  }

  function launchClassroom(classId, classLevelId) {
    if (!member?.school?.slug) return
    const params = classId
      ? `classId=${encodeURIComponent(classId)}`
      : `classLevelId=${encodeURIComponent(classLevelId || "")}`
    if (!classId && !classLevelId) return
    const target = `../student/academy-hub.html?${params}`
    window.location.assign(portal.pageLink(target))
  }

  async function init() {
    try {
      member = await portal.getMember("teacher")
      if (!member) return
      dashboard = await portal.request("/api/portal/teacher/dashboard")
      setSchoolName(member.school?.schoolName)
      const firstName = (member.fullName || "Teacher").trim().split(/\s+/)[0]
      portal.setText("displayTeacherName", `Welcome back, ${firstName}`)
      portal.setText("sidebarTeacherName", member.fullName || "Teacher")
      portal.setText("facFullName", member.fullName)
      portal.setText("facID", portal.shortId(member))
      const classes = dashboard.classes || []
      const assignedSubjects = (member.subjects || "")
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean)
      const subjects = [
        ...new Set(
          classes.flatMap((schoolClass) =>
            (schoolClass.subjects || []).map((subject) => subject.name),
          ),
        ),
      ]
      portal.setText(
        "facDept",
        subjects.join(", ") ||
          assignedSubjects.join(", ") ||
          member.designation ||
          "General Faculty",
      )
      const photo = document.getElementById("facPhoto")
      const avatar =
        member.passport ||
        portal.avatarData(member.fullName, "3978f6", "ffffff")
      if (photo) {
        photo.src = avatar
        photo.alt = `${member.fullName} profile photo`
      }
      ;["sidebarTeacherPhoto", "headerTeacherPhoto"].forEach((id) => {
        const image = document.getElementById(id)
        if (image) {
          image.src = avatar
          image.alt = `${member.fullName} profile photo`
        }
      })
      // The legacy EIS QR encoded the teacher's sign-in PIN. Do not put a
      // reusable authentication credential on a printable ID card.
      const credentialBadge = document.getElementById("facQr")
      if (credentialBadge) {
        credentialBadge.textContent = `ID ${portal.shortId(member)}`
        credentialBadge.setAttribute(
          "aria-label",
          "Non-secret member identifier",
        )
      }
      const uniqueSubjects = new Set(
        classes.flatMap((schoolClass) =>
          (schoolClass.subjects || []).map((subject) => subject.name),
        ),
      )
      const assignedClassCount = (member.assignedClasses || "")
        .split(",")
        .filter((name) => name.trim()).length
      portal.setText("classes-count", classes.length || assignedClassCount)
      portal.setText(
        "subjects-count",
        uniqueSubjects.size || new Set(assignedSubjects).size,
      )
      portal.setText("class-list-count", classes.length || assignedClassCount)
      renderClasses()

      const examLink = document.getElementById("teacherExamLink")
      if (examLink)
        examLink.href = portal.pageLink("./teacher-exam-portal.html")
      document.querySelectorAll(".nav-btn[data-view]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault()
          showView(button.dataset.view, button)
          portal.setText(
            "breadcrumbCurrent",
            button.dataset.view === "broadcast" ? "My classrooms" : "Overview",
          )
        })
      })
      document.querySelectorAll("[data-open-classes]").forEach((button) =>
        button.addEventListener("click", () => {
          showView("broadcast")
          portal.setText("breadcrumbCurrent", "My classrooms")
        }),
      )
      ;["quickProfileBtn", "identityProfileBtn"].forEach((id) =>
        document.getElementById(id)?.addEventListener("click", openProfile),
      )
      const quickExamLink = document.getElementById("quickExamLink")
      if (quickExamLink)
        quickExamLink.href = portal.pageLink("./teacher-exam-portal.html")
      document
        .getElementById("teacherLogoutBtn")
        ?.addEventListener("click", (event) => {
          event.preventDefault()
          portal.logout("teacher")
        })
      document
        .getElementById("teacherProfileBtn")
        ?.addEventListener("click", openProfile)
      document
        .getElementById("teacherSettingsBtn")
        ?.addEventListener("click", (event) => {
          event.preventDefault()
          openPasswordSettings()
        })
      document
        .getElementById("closeTeacherPasswordModal")
        ?.addEventListener("click", () => {
          document.getElementById("teacherPasswordModal").style.display = "none"
        })
      document
        .getElementById("teacherPasswordModal")
        ?.addEventListener("click", (event) => {
          if (event.target.id === "teacherPasswordModal")
            event.target.style.display = "none"
        })
      document
        .getElementById("teacherPasswordForm")
        ?.addEventListener("submit", savePassword)
      document
        .getElementById("closeTeacherProfileModal")
        ?.addEventListener("click", () => {
          document.getElementById("profileModal").style.display = "none"
        })
      document
        .getElementById("profileModal")
        ?.addEventListener("click", (event) => {
          if (event.target.id === "profileModal")
            document.getElementById("profileModal").style.display = "none"
        })

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
      if (label)
        label.textContent =
          error.message || "Unable to load the teacher portal."
      const fill = document.getElementById("prog-fill")
      if (fill) fill.style.width = "100%"
    }
  }

  window.showView = showView
  window.openProfile = openProfile
  window.launchSpecificClass = launchSpecificClass
  window.launchClassroom = launchClassroom
  window.logout = () => portal.logout("teacher")
  window.addEventListener("DOMContentLoaded", init)
})()
