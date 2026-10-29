(() => {
  const portal = window.AceEduPortal
  let member = null
  let classroom = null
  let attachedFile = null
  const $ = (selector) => document.querySelector(selector)

  function safeHref(value) {
    try {
      const url = new URL(value, window.location.origin)
      return ["https:", "http:"].includes(url.protocol) ? url.href : ""
    } catch {
      return ""
    }
  }

  function showBusy(message) {
    const stream = document.getElementById("assignmentStream")
    if (stream) stream.innerHTML = `<div class="message-box" style="padding:35px;text-align:center;color:var(--text-secondary);">${portal.escapeHtml(message)}</div>`
  }

  function renderPosts() {
    const stream = document.getElementById("assignmentStream")
    const posts = classroom?.posts || []
    if (!stream) return
    if (!posts.length) {
      stream.innerHTML = '<div style="text-align:center;padding:50px;color:var(--text-secondary);opacity:0.75;"><i class="fa fa-cloud-sun" style="font-size:40px;"></i><p>The classroom is quiet. No posts found.</p></div>'
      return
    }
    stream.innerHTML = posts.map((post) => {
      const isOwner = member?.role === "teacher" && post.authorId === member.id
      const type = post.type || "notice"
      const attachmentUrl = safeHref(post.attachmentUrl)
      const meetingUrl = safeHref(post.meetingUrl)
      let attachmentHtml = ""
      if (attachmentUrl) {
        const name = portal.escapeHtml(post.attachmentName || "Download attached material")
        attachmentHtml = `<div style="margin-top:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:8px;"><a href="${portal.escapeHtml(attachmentUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;font-weight:bold;font-size:13px;"><i class="fa fa-file-download"></i> ${name}</a></div>`
      }
      const meetingHtml = meetingUrl ? `<p><a href="${portal.escapeHtml(meetingUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);"><i class="fas fa-video"></i> Join online class</a></p>` : ""
      const due = post.deadline ? ` · Due ${portal.escapeHtml(post.deadline)}` : ""
      return `<article class="post-card" id="post-${portal.escapeHtml(post.id)}">
        <div class="post-header"><div class="post-meta"><div class="post-icon"><i class="fas ${type === "assignment" ? "fa-book-open" : type === "live_class" ? "fa-video" : "fa-bullhorn"}"></i></div><div class="post-info"><h3>${portal.escapeHtml(post.title)}</h3><span>${portal.escapeHtml(post.author || "Instructor")} · ${portal.escapeHtml(new Date(post.createdAt).toLocaleDateString())}${due}</span></div></div>${isOwner ? `<button type="button" data-delete-post="${portal.escapeHtml(post.id)}" aria-label="Delete your post" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:16px;"><i class="fa fa-trash-alt"></i></button>` : ""}</div>
        <div class="post-content" style="white-space:pre-wrap;">${portal.escapeHtml(post.contentBody || "")}</div>${attachmentHtml}${meetingHtml}
        <div class="post-footer"><span><i class="far fa-comment"></i> Comments disabled</span><span>${portal.escapeHtml(type.replaceAll("_", " ").toUpperCase())}</span></div>
      </article>`
    }).join("")
    stream.querySelectorAll("[data-delete-post]").forEach((button) => button.addEventListener("click", () => deletePost(button.dataset.deletePost)))
  }

  function renderRoster() {
    const teacherCards = document.getElementById("teacherCards")
    const studentCards = document.getElementById("studentCards")
    if (teacherCards) {
      teacherCards.innerHTML = (classroom?.teachers || []).map((teacher) => `<div class="person-card"><img src="${portal.avatarData(teacher.fullName, "d4af37", "0a192f")}" class="person-img" alt=""><div class="person-name">${portal.escapeHtml(teacher.fullName)}</div><div class="person-role">FACULTY${teacher.designation ? ` · ${portal.escapeHtml(teacher.designation)}` : ""}</div></div>`).join("") || '<p style="color:var(--text-secondary);">No instructors are assigned to this class yet.</p>'
    }
    if (studentCards) {
      studentCards.innerHTML = (classroom?.students || []).map((student) => `<div class="person-card"><img src="${portal.avatarData(student.fullName, "112240", "f1f5f9")}" class="person-img" alt=""><div class="person-name">${portal.escapeHtml(student.fullName)}</div><div class="person-role">${portal.escapeHtml(student.designation || "STUDENT")}</div></div>`).join("") || '<p style="color:var(--text-secondary);">No active students are assigned to this class.</p>'
    }
  }

  function switchTab(view) {
    const stream = document.getElementById("assignmentStream")
    const roster = document.getElementById("classRoster")
    const streamButton = document.getElementById("tab-stream")
    const rosterButton = document.getElementById("tab-roster")
    if (view === "stream") {
      if (stream) stream.style.display = "block"
      if (roster) roster.style.display = "none"
      streamButton?.classList.add("active")
      rosterButton?.classList.remove("active")
    } else {
      if (stream) stream.style.display = "none"
      if (roster) roster.style.display = "block"
      streamButton?.classList.remove("active")
      rosterButton?.classList.add("active")
      renderRoster()
    }
  }

  function openCreator() {
    const modal = document.getElementById("creatorModal")
    if (modal) modal.style.display = "flex"
  }

  function closeCreator() {
    const modal = document.getElementById("creatorModal")
    if (modal) modal.style.display = "none"
    const title = document.getElementById("postTitle")
    const body = document.getElementById("postContent")
    const deadline = document.getElementById("postDeadline")
    const meetingUrl = document.getElementById("postMeetingUrl")
    if (title) title.value = ""
    if (body) body.value = ""
    if (deadline) deadline.value = ""
    if (meetingUrl) meetingUrl.value = ""
    clearFile()
  }

  function clearFile() {
    attachedFile = null
    const input = document.getElementById("mediaUpload")
    const preview = document.getElementById("filePreview")
    if (input) input.value = ""
    if (preview) preview.style.display = "none"
  }

  function processFile(input) {
    const file = input?.files?.[0]
    if (!file) return
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      alert("Please attach a PDF, JPEG, PNG, or WebP file.")
      input.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Attachments must be 5 MB or smaller.")
      input.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      attachedFile = { file, dataUrl: String(reader.result) }
      portal.setText("fileName", `Ready: ${file.name}`)
      const preview = document.getElementById("filePreview")
      if (preview) preview.style.display = "block"
    }
    reader.onerror = () => alert("The attachment could not be read.")
    reader.readAsDataURL(file)
  }

  async function deletePost(postId) {
    if (member?.role !== "teacher" || !confirm("Delete this classroom post?")) return
    try {
      await portal.request(`/api/portal/teacher/classroom/posts/${encodeURIComponent(postId)}`, { method: "DELETE" })
      await loadClassroom()
    } catch (error) {
      alert(error.message || "The post could not be deleted.")
    }
  }

  async function submitPost() {
    if (member?.role !== "teacher" || !classroom?.schoolClass?.id) return
    const title = document.getElementById("postTitle")?.value.trim() || ""
    const contentBody = document.getElementById("postContent")?.value.trim() || ""
    const type = document.getElementById("postType")?.value || "notice"
    const subjectId = document.getElementById("postSubject")?.value || null
    const deadline = document.getElementById("postDeadline")?.value || null
    const meetingUrl = document.getElementById("postMeetingUrl")?.value.trim() || null
    const btn = document.getElementById("transmitBtn")
    if (!title) return alert("Please enter a title.")
    if (!contentBody && !meetingUrl) return alert("Add the post content or a meeting link.")
    if (type === "assignment" && !deadline) return alert("Choose a due date for this assignment.")
    if (type === "live_class" && !meetingUrl) return alert("Enter a valid HTTPS meeting URL.")
    if (meetingUrl && !meetingUrl.startsWith("https://")) return alert("Meeting links must use HTTPS.")

    const payload = { classId: classroom.schoolClass.id, subjectId, type, title, contentBody, deadline, meetingUrl }
    if (attachedFile) {
      payload.attachment = {
        name: attachedFile.file.name,
        mimeType: attachedFile.file.type,
        dataBase64: attachedFile.dataUrl.split(",")[1] || "",
      }
    }
    if (btn) { btn.disabled = true; btn.textContent = "TRANSMITTING…" }
    try {
      await portal.request("/api/portal/teacher/classroom/posts", { method: "POST", body: JSON.stringify(payload) })
      closeCreator()
      await loadClassroom()
    } catch (error) {
      alert(error.message || "The classroom post could not be published.")
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-broadcast-tower"></i> TRANSMIT' }
    }
  }

  async function loadClassroom() {
    if (!member) return
    const classId = new URLSearchParams(location.search).get("classId")
    const path = member.role === "teacher"
      ? `/api/portal/teacher/classroom?classId=${encodeURIComponent(classId || "")}`
      : "/api/portal/student/classroom"
    classroom = await portal.request(path)
    portal.setText("className", classroom.schoolClass?.name || "Classroom")
    portal.setText("broadcastTarget", `Targeting: ${classroom.schoolClass?.name || "Class"}`)
    renderPosts()
    renderRoster()
    const subjects = document.getElementById("postSubject")
    if (subjects) {
      subjects.innerHTML = '<option value="">General classroom post</option>' + (classroom.subjects || []).map((subject) => `<option value="${portal.escapeHtml(subject.id)}">${portal.escapeHtml(subject.name)}</option>`).join("")
    }
  }

  function startLiveClass() {
    if (!classroom?.schoolClass?.id) return
    const className = classroom.schoolClass.name || "Class"
    const meetingUrl = `https://meet.jit.si/AceEdu-${(member.school?.slug || "school")}-${classroom.schoolClass.id}`
    const target = document.getElementById("postMeetingUrl")
    const type = document.getElementById("postType")
    const title = document.getElementById("postTitle")
    const body = document.getElementById("postContent")
    if (target) target.value = meetingUrl
    if (type) type.value = "live_class"
    if (title) title.value = `Live class · ${className}`
    if (body) body.value = "Join the scheduled online class using the meeting link."
    openCreator()
    window.open(meetingUrl, "_blank", "noopener,noreferrer")
  }

  function updateComposerFields() {
    const type = document.getElementById("postType")?.value
    const deadline = document.getElementById("postDeadline")
    const meeting = document.getElementById("postMeetingUrl")
    if (deadline) {
      deadline.style.display = type === "assignment" ? "block" : "none"
      deadline.required = type === "assignment"
    }
    if (meeting) {
      meeting.style.display = type === "live_class" ? "block" : "none"
      meeting.required = type === "live_class"
    }
  }

  async function init() {
    try {
      member = await portal.getMember()
      if (!member) return
      if (!["student", "teacher"].includes(member.role)) {
        portal.goToPortal("portal")
        return
      }
      if (member.role === "teacher" && !new URLSearchParams(location.search).get("classId")) {
        portal.goToPortal("teacher")
        return
      }
      portal.setText("studentName", (member.fullName || "User").toUpperCase())
      portal.setText("studentID", `ID: ${portal.shortId(member)}`)
      portal.setText("accessLevel", member.role.toUpperCase())
      const schoolNameSpan = document.querySelector(".brand span")
      if (schoolNameSpan) {
        const words = (member.school?.schoolName || "YOUR SCHOOL").toUpperCase().trim().split(/\s+/)
        const accent = words.splice(Math.max(0, words.length - 2)).join(" ") || "SCHOOL"
        schoolNameSpan.innerHTML = `${portal.escapeHtml(words.join(" "))}${words.length ? " " : ""}<span style="color:var(--primary)">${portal.escapeHtml(accent)}</span>`
      }
      document.title = `Classroom Hub | ${member.school?.schoolName || "AceEdu"}`
      const photo = document.getElementById("studentPhoto")
      if (photo) {
        photo.src = member.passport || portal.avatarData(member.fullName, "d4af37", "0a192f")
        photo.alt = `${member.fullName} profile photo`
      }
      const teacherConsole = document.getElementById("teacherConsole")
      if (teacherConsole) teacherConsole.style.display = member.role === "teacher" ? "flex" : "none"
      const exitBtn = document.getElementById("exitClassroomBtn")
      if (exitBtn) exitBtn.style.display = member.role === "teacher" ? "inline-flex" : "none"
      const brandHome = document.getElementById("academyBrandHome")
      if (brandHome) brandHome.addEventListener("click", () => portal.goToPortal(member.role))
      document.querySelectorAll("[data-hub-tab]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.hubTab)))
      document.getElementById("openPostCreator")?.addEventListener("click", openCreator)
      document.getElementById("startLiveClassBtn")?.addEventListener("click", startLiveClass)
      document.getElementById("exitClassroomBtn")?.addEventListener("click", () => portal.goToPortal("teacher"))
      document.getElementById("chooseAttachmentBtn")?.addEventListener("click", () => document.getElementById("mediaUpload")?.click())
      document.getElementById("mediaUpload")?.addEventListener("change", (event) => processFile(event.target))
      document.getElementById("clearAttachedFileBtn")?.addEventListener("click", clearFile)
      document.getElementById("transmitBtn")?.addEventListener("click", submitPost)
      document.getElementById("cancelPostBtn")?.addEventListener("click", closeCreator)
      document.getElementById("postType")?.addEventListener("change", updateComposerFields)
      const upload = document.getElementById("mediaUpload")
      if (upload) upload.accept = ".pdf,.jpg,.jpeg,.png,.webp"
      await loadClassroom()
      updateComposerFields()
    } catch (error) {
      console.error("AceEdu classroom hub failed to load", error)
      showBusy(error.message || "Classroom data could not be loaded.")
    }
  }

  window.switchTab = switchTab
  window.openCreator = openCreator
  window.closeCreator = closeCreator
  window.processFile = processFile
  window.clearFile = clearFile
  window.submitPost = submitPost
  window.deletePost = deletePost
  window.startLiveClass = startLiveClass
  window.addEventListener("DOMContentLoaded", init)
})()
