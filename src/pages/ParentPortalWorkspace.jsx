import { useEffect, useMemo, useState } from "react"
import {
  Users, UserRound, ShieldCheck, RefreshCw, Search, RotateCcw,
  Link2, Megaphone, Send, Bell, CalendarDays, Trash2, Check,
  ArrowUpRight, Plus, X, Copy, ExternalLink
} from "lucide-react"
import {
  createSchoolAnnouncement, deleteSchoolAnnouncement, getAllStudents,
  getSchoolAnnouncements, getSchoolParents, resetParentPortalPassword,
  updateParentStudents
} from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"

function useParentResource(loader) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision((v) => v + 1)
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    Promise.resolve().then(loader).then((value) => {
      if (active) setData(value)
    }).catch((err) => {
      if (active) setError(err.message || "Unable to load records.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  return { data, loading, error, refresh }
}

function ParentMetric({ icon: Icon, label, value, note, tone = "blue" }) {
  return <article className={`ace-parent__metric is-${tone}`}>
    <span className="ace-parent__metric-icon"><Icon size={18}/></span>
    <span className="ace-parent__metric-label">{label}</span>
    <strong>{value}</strong><small>{note}</small>
  </article>
}

export default function ParentPortalWorkspace({ school }) {
  const parentsResource = useParentResource(getSchoolParents)
  const studentsResource = useParentResource(getAllStudents)
  const announcementsResource = useParentResource(getSchoolAnnouncements)
  const [view, setView] = useState("overview")
  const [search, setSearch] = useState("")
  const [selectedParent, setSelectedParent] = useState(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [setupCode, setSetupCode] = useState("")
  const [announcement, setAnnouncement] = useState({title:"",body:"",type:"announcement",audience:"all",eventDate:""})
  const parents = parentsResource.data?.parents || []
  const students = studentsResource.data || []
  const announcements = announcementsResource.data || []
  const linkedCount = useMemo(() => parents.reduce((n,p) => n + (p.students?.length || 0), 0), [parents])
  const filteredParents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return parents.filter((p) => !q || [p.fullName,p.phone,...(p.students || []).map(s=>s.fullName)].join(" ").toLowerCase().includes(q))
  }, [parents, search])
  const refreshAll = () => { parentsResource.refresh(); studentsResource.refresh(); announcementsResource.refresh() }
  const problem = error || parentsResource.error || studentsResource.error || announcementsResource.error

  async function resetAccess(parent) {
    if (!window.confirm(`Generate a new one-time setup code for ${parent.fullName}?`)) return
    setBusy(true); setError(""); setSetupCode("")
    try {
      const result = await resetParentPortalPassword(parent.id)
      setSetupCode(result.setupCode || "")
      setNotice(`A new setup code is ready for ${parent.fullName}.`)
      parentsResource.refresh()
    } catch (err) { setError(err.message || "Could not reset parent access.") }
    finally { setBusy(false) }
  }
  async function saveLinks(event) {
    event.preventDefault()
    if (!selectedParent || !selectedStudentIds.length) return
    setBusy(true); setError("")
    try {
      await updateParentStudents(selectedParent.id, selectedStudentIds)
      setNotice(`Linked students updated for ${selectedParent.fullName}.`)
      setSelectedParent(null); parentsResource.refresh()
    } catch (err) { setError(err.message || "Could not update family links.") }
    finally { setBusy(false) }
  }
  async function publish(event) {
    event.preventDefault(); setBusy(true); setError("")
    try {
      await createSchoolAnnouncement({...announcement,eventDate:announcement.type === "event" ? announcement.eventDate : null})
      setAnnouncement({title:"",body:"",type:"announcement",audience:"all",eventDate:""})
      setNotice("School update published successfully.")
      announcementsResource.refresh()
    } catch (err) { setError(err.message || "Could not publish update.") }
    finally { setBusy(false) }
  }
  async function remove(item) {
    if (!window.confirm(`Remove "${item.title}" from the school feed?`)) return
    try {
      await deleteSchoolAnnouncement(item.id)
      setNotice("School update removed.")
      announcementsResource.refresh()
    } catch (err) { setError(err.message || "Could not remove update.") }
  }

  return <section className="ace-parent" aria-label="Parent portal management">
    <header className="ace-parent__hero">
      <div className="ace-parent__hero-copy">
        <span className="ace-parent__eyebrow"><span/> FAMILY EXPERIENCE · PREMIUM</span>
        <h1>Parent portal</h1>
        <p>Manage family access, student connections and the updates shared with your school community.</p>
        <div className="ace-parent__hero-meta"><span><ShieldCheck size={14}/> Controlled family access</span><span><Users size={14}/> {parentsResource.loading ? "…" : parents.length} family accounts</span></div>
      </div>
      <div className="ace-parent__hero-art"><div className="ace-parent__orb ace-parent__orb--one"/><div className="ace-parent__orb ace-parent__orb--two"/><div className="ace-parent__hero-icon"><Users size={42}/></div><span className="ace-parent__floating ace-parent__floating--a"><Check size={14}/> Secure access</span><span className="ace-parent__floating ace-parent__floating--b"><UserRound size={14}/> Family links</span></div>
    </header>

    {problem && <div className="ace-parent__alert is-error" role="alert"><span>{problem}</span><button onClick={refreshAll} type="button"><RefreshCw size={14}/> Retry</button></div>}
    {notice && <div className="ace-parent__alert is-success" role="status"><Check size={16}/>{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {setupCode && <div className="ace-parent__credential"><ShieldCheck size={20}/><div><strong>One-time parent setup code</strong><code>{setupCode}</code><small>Share securely with the parent. The code expires in 24 hours and requires a new password at first sign-in.</small></div><button type="button" onClick={()=>navigator.clipboard?.writeText(setupCode)}><Copy size={15}/> Copy</button></div>}

    <div className="ace-parent__metrics">
      <ParentMetric icon={Users} label="Family accounts" value={parentsResource.loading ? "—" : parents.length} note="Registered parent profiles"/>
      <ParentMetric icon={Link2} label="Student connections" value={parentsResource.loading ? "—" : linkedCount} note="Current parent-to-student links" tone="teal"/>
      <ParentMetric icon={ShieldCheck} label="Active access" value={parentsResource.loading ? "—" : parents.filter(p=>!p.mustChangePassword).length} note="Parents who completed setup" tone="violet"/>
      <ParentMetric icon={Megaphone} label="Published updates" value={announcementsResource.loading ? "—" : announcements.length} note="Items in the school feed" tone="amber"/>
    </div>

    <nav className="ace-parent__nav" aria-label="Parent portal sections">
      {[["overview","Overview"],["families","Family directory"],["communications","School communications"]].map(([id,label])=><button key={id} type="button" className={view===id?"is-active":""} onClick={()=>setView(id)}>{label}{id==="families" && <span>{parents.length}</span>}{id==="communications" && <span>{announcements.length}</span>}</button>)}
      <button className="ace-parent__refresh" type="button" onClick={refreshAll} disabled={parentsResource.loading || announcementsResource.loading}><RefreshCw size={15}/> Refresh</button>
    </nav>

    {view==="overview" && <div className="ace-parent__overview">
      <section className="ace-parent__panel ace-parent__welcome">
        <div><span className="ace-parent__eyebrow">FAMILY ACCESS CONTROL</span><h2>A connected school community.</h2><p>Parent accounts are created from guardian details during student registration. Matching guardian phone numbers can bring siblings into one family account.</p><button type="button" className="ace-parent__primary" onClick={()=>setView("families")}>Manage family accounts <ArrowUpRight size={15}/></button></div>
        <div className="ace-parent__welcome-symbol"><Users size={58}/><span>Family hub</span></div>
      </section>
      <section className="ace-parent__panel ace-parent__quick">
        <div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">QUICK ACCESS</span><h2>Workspace shortcuts</h2></div></div>
        <button type="button" onClick={()=>setView("families")}><span className="ace-parent__shortcut-icon"><Users size={18}/></span><span><strong>Review family directory</strong><small>Search parents and manage student links</small></span><ArrowUpRight size={16}/></button>
        <button type="button" onClick={()=>setView("communications")}><span className="ace-parent__shortcut-icon is-violet"><Megaphone size={18}/></span><span><strong>Publish school update</strong><small>Share an announcement or event</small></span><ArrowUpRight size={16}/></button>
        {school?.slug && <a href={`/s/${encodeURIComponent(school.slug)}/portal`} target="_blank" rel="noreferrer"><span className="ace-parent__shortcut-icon is-teal"><ExternalLink size={18}/></span><span><strong>Open parent sign-in</strong><small>Preview the shared school portal</small></span><ArrowUpRight size={16}/></a>}
      </section>
      <section className="ace-parent__panel ace-parent__security"><ShieldCheck size={22}/><div><strong>Family privacy is built into the access model</strong><p>Parents see only the students linked to their account. Attendance, published results and class updates are available in the portal; private financial records are not exposed through parent access.</p></div></section>
      <section className="ace-parent__panel"><div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">LATEST COMMUNICATION</span><h2>Recent school updates</h2></div><button type="button" className="ace-parent__text-action" onClick={()=>setView("communications")}>View all <ArrowUpRight size={14}/></button></div>
        {announcementsResource.loading ? <div className="ace-parent__loading"><LoadingSpinner/> Loading school updates…</div> : announcements.length ? <div className="ace-parent__updates">{announcements.slice(0,3).map(item=><article key={item.id}><span className="ace-parent__update-icon"><Bell size={16}/></span><div><div className="ace-parent__update-meta"><span>{item.type}</span><span>{item.audience}</span><time>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recently"}</time></div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}</div> : <div className="ace-parent__empty"><Megaphone size={24}/><strong>No school updates yet</strong><span>Published announcements and events will appear here.</span></div>}
      </section>
    </div>}

    {view==="families" && <div className="ace-parent__panel">
      <div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">ACCOUNT DIRECTORY</span><h2>Family accounts</h2><p>Manage parent access and the students connected to each family.</p></div></div>
      <label className="ace-parent__search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search parent, phone number or student…"/></label>
      {parentsResource.loading ? <div className="ace-parent__loading"><LoadingSpinner/> Loading family records…</div> : filteredParents.length ? <div className="ace-parent__table-wrap"><table className="ace-parent__table"><thead><tr><th>Parent / guardian</th><th>Contact</th><th>Students linked</th><th>Access status</th><th>Actions</th></tr></thead><tbody>{filteredParents.map(parent=><tr key={parent.id}><td><strong>{parent.fullName}</strong><small>{parent.isFamily ? "Family account" : "Individual account"}</small></td><td>{parent.phone || "—"}</td><td><div className="ace-parent__student-chips">{(parent.students||[]).map(s=><span key={s.id}>{s.fullName}</span>)}{!parent.students?.length && <small>No linked students</small>}</div></td><td><span className={`ace-parent__status ${parent.mustChangePassword?"is-pending":"is-active"}`}>{parent.mustChangePassword?"Setup required":"Active"}</span></td><td><div className="ace-parent__row-actions"><button type="button" onClick={()=>{setSelectedParent(parent);setSelectedStudentIds((parent.students||[]).map(s=>String(s.id)))}} disabled={busy}><Link2 size={14}/> Edit links</button><button type="button" onClick={()=>void resetAccess(parent)} disabled={busy}><RotateCcw size={14}/> Reset access</button></div></td></tr>)}</tbody></table></div> : <div className="ace-parent__empty"><Users size={25}/><strong>{search ? "No matching families" : "No parent accounts yet"}</strong><span>{search ? "Try another name, phone number or student." : "Parent accounts are created from guardian details during student registration."}</span></div>}
    </div>}

    {view==="communications" && <div className="ace-parent__communications">
      <form className="ace-parent__panel ace-parent__composer" onSubmit={publish}>
        <div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">SCHOOL-WIDE MESSAGING</span><h2>Create an update</h2><p>Publish an announcement, event or newsletter to the selected school audience.</p></div></div>
        <label>Headline<input maxLength={160} required value={announcement.title} onChange={e=>setAnnouncement({...announcement,title:e.target.value})} placeholder="e.g. Mid-term break announcement"/></label>
        <label>Message<textarea rows={6} maxLength={5000} required value={announcement.body} onChange={e=>setAnnouncement({...announcement,body:e.target.value})} placeholder="Write the details your audience needs to know…"/></label>
        <div className="ace-parent__form-row"><label>Content type<select value={announcement.type} onChange={e=>setAnnouncement({...announcement,type:e.target.value})}><option value="announcement">Announcement</option><option value="event">Event</option><option value="newsletter">Newsletter</option></select></label><label>Audience<select value={announcement.audience} onChange={e=>setAnnouncement({...announcement,audience:e.target.value})}><option value="all">Everyone</option><option value="parents">Parents</option><option value="students">Students</option><option value="teachers">Teachers</option></select></label></div>
        {announcement.type==="event" && <label>Event date<input type="date" required value={announcement.eventDate} onChange={e=>setAnnouncement({...announcement,eventDate:e.target.value})}/></label>}
        <button className="ace-parent__primary" disabled={busy}>{busy ? <LoadingSpinner/> : <Send size={15}/>} Publish update</button>
      </form>
      <section className="ace-parent__panel"><div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">PUBLISHED CONTENT</span><h2>School feed</h2></div><span className="ace-parent__count">{announcements.length} updates</span></div>
        {announcementsResource.loading ? <div className="ace-parent__loading"><LoadingSpinner/> Loading feed…</div> : announcements.length ? <div className="ace-parent__feed">{announcements.map(item=><article key={item.id}><span className="ace-parent__update-icon"><Bell size={16}/></span><div><div className="ace-parent__update-meta"><span>{item.type}</span><span>{item.audience}</span><time>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recently"}</time></div><h3>{item.title}</h3><p>{item.body}</p>{item.eventDate && <small><CalendarDays size={13}/> {new Date(item.eventDate).toLocaleDateString()}</small>}</div><button type="button" aria-label={`Delete ${item.title}`} onClick={()=>void remove(item)}><Trash2 size={16}/></button></article>)}</div> : <div className="ace-parent__empty"><Megaphone size={24}/><strong>Your school feed is clear</strong><span>Publish the first update using the form.</span></div>}
      </section>
    </div>}

    {selectedParent && <div className="ace-parent__modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setSelectedParent(null)}><form className="ace-parent__modal" onSubmit={saveLinks}><div className="ace-parent__section-title"><div><span className="ace-parent__eyebrow">FAMILY PERMISSIONS</span><h2>Manage linked students</h2><p>{selectedParent.fullName} · choose the students this parent can access.</p></div><button type="button" className="ace-parent__close" onClick={()=>setSelectedParent(null)}><X size={18}/></button></div><div className="ace-parent__student-picker">{students.map(student=><label key={student._id}><input type="checkbox" checked={selectedStudentIds.includes(String(student._id))} onChange={e=>setSelectedStudentIds(current=>e.target.checked?[...current,String(student._id)]:current.filter(id=>id!==String(student._id)))}/><span><strong>{student.fullName}</strong><small>{student.designation || "Class not assigned"}</small></span></label>)}</div><div className="ace-parent__modal-actions"><button type="button" className="ace-parent__secondary" onClick={()=>setSelectedParent(null)}>Cancel</button><button className="ace-parent__primary" disabled={busy || !selectedStudentIds.length}>{busy ? "Saving…" : <><Check size={15}/> Save family links</>}</button></div></form></div>}
  </section>
}
