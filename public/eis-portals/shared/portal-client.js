/* Shared same-origin bridge between the preserved EIS portal UI and AceEdu APIs. */
(() => {
  const params = new URLSearchParams(window.location.search)
  let slug = params.get("schoolSlug") || ""

  function goToPortal(role) {
    const targetSlug = slug || params.get("schoolSlug") || ""
    const target = targetSlug
      ? `/s/${encodeURIComponent(targetSlug)}/${encodeURIComponent(role || "portal")}`
      : "/"
    try {
      if (window.top && window.top !== window) window.top.location.assign(target)
      else window.location.assign(target)
    } catch {
      window.location.assign(target)
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(result.error || "The request could not be completed.")
      error.status = response.status
      error.code = result.code
      throw error
    }
    return result
  }

  async function getMember(expectedRole) {
    try {
      const result = await request("/api/portal/me")
      const member = result.member
      if (!member) {
        goToPortal(expectedRole)
        return null
      }
      slug = member.school?.slug || slug
      if (expectedRole && member.role !== expectedRole) {
        goToPortal(member.role)
        return null
      }
      // A copied static page must not become a way around the React portal's
      // entitlement gate. The server remains authoritative for each API, and
      // this redirects expired/unentitled users back to the gated AceEdu route.
      if (member.premiumAccess === false) {
        goToPortal(member.role)
        return null
      }
      return member
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        goToPortal(expectedRole)
        return null
      }
      throw error
    }
  }

  async function logout(role) {
    try {
      await request("/api/portal/logout", { method: "POST", body: "{}" })
      goToPortal(role)
    } catch (error) {
      showError(`Sign-out failed: ${error.message || "Please try again."}`)
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character])
  }

  function shortId(member) {
    const id = String(member?.id || "")
    return id ? id.slice(-6).toUpperCase() : "—"
  }

  function avatarData(name, background = "0a192f", color = "ffffff") {
    const initials = String(name || "User")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "U"
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#${background}"/><text x="60" y="68" font-family="Arial,sans-serif" font-size="38" font-weight="700" text-anchor="middle" fill="#${color}">${initials.replace(/[&<>]/g, "")}</text></svg>`
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  }

  function pageLink(path, schoolSlug = slug) {
    const separator = path.includes("?") ? "&" : "?"
    return `${path}${separator}schoolSlug=${encodeURIComponent(schoolSlug || "")}`
  }

  function setText(id, value) {
    const element = document.getElementById(id)
    if (element) element.textContent = value == null || value === "" ? "—" : String(value)
  }

  function showError(message, element = document.getElementById("portalError")) {
    if (element) {
      element.textContent = message || "Something went wrong. Please try again."
      element.style.display = "block"
      element.setAttribute("role", "alert")
    } else {
      let notice = document.getElementById("aceeduPortalError")
      if (!notice) {
        notice = document.createElement("div")
        notice.id = "aceeduPortalError"
        notice.setAttribute("role", "alert")
        notice.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:20000;padding:12px 16px;border:1px solid #ef4444;border-radius:10px;background:#2a1118;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px #0005"
        document.body.appendChild(notice)
      }
      notice.textContent = message || "Something went wrong. Please try again."
    }
  }

  window.AceEduPortal = {
    request,
    getMember,
    logout,
    escapeHtml,
    shortId,
    avatarData,
    pageLink,
    setText,
    showError,
    get schoolSlug() { return slug },
    goToPortal,
  }
})()
