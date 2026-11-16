import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  FilePlus2,
  FileText,
  GripVertical,
  Layers3,
  LoaderCircle,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import {
  createRegistrationForm,
  getRegistrationForm,
  getRegistrationForms,
  publishRegistrationForm,
  saveRegistrationFormDraft,
} from "../data/api"

import "./RegistrationWorkspace.css"

const FIELD_TYPES = [
  ["text", "Short answer"],
  ["textarea", "Long answer"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["date", "Date"],
  ["number", "Number"],
  ["boolean", "Yes / no"],
  ["select", "Dropdown"],
  ["multiselect", "Multiple selection"],
  ["radio", "Single choice"],
  ["checkbox", "Checkbox"],
  ["file", "File upload"],
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function makeKey(label, fallback = "custom_field") {
  const base = String(label || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72)
  return /^[a-z]/.test(base) ? base : fallback
}

function latestEditableVersion(form) {
  return form?.draftVersion || form?.latestVersion || form?.publishedVersion || null
}

function getFieldPlaceholder(field) {
  if (field.placeholder) return field.placeholder
  if (field.type === "date") return "Select a date"
  if (field.type === "phone") return "Enter phone number"
  if (field.type === "email") return "name@example.com"
  if (field.type === "number") return "Enter a number"
  if (field.type === "textarea") return "Enter your response"
  if (field.type === "file") return "Choose a file"
  return "Enter your response"
}

function FieldPreview({ field }) {
  const common = {
    className: "registration-preview__input",
    placeholder: getFieldPlaceholder(field),
    disabled: true,
  }

  if (field.type === "textarea") return <textarea {...common} rows={3} />
  if (field.type === "boolean" || field.type === "checkbox") {
    return (
      <label className="registration-preview__choice">
        <input type="checkbox" disabled />
        <span>{field.label}</span>
      </label>
    )
  }
  if (["select", "multiselect"].includes(field.type)) {
    return (
      <select {...common} defaultValue="" multiple={field.type === "multiselect"}>
        <option value="">Choose an option</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    )
  }
  if (field.type === "radio") {
    return (
      <div className="registration-preview__choices">
        {(field.options || []).map((option) => (
          <label className="registration-preview__choice" key={option}>
            <input type="radio" disabled />
            <span>{option}</span>
          </label>
        ))}
      </div>
    )
  }
  if (field.type === "file") {
    return <div className="registration-preview__file"><FileText size={16} /> {field.placeholder || "Upload a document"}</div>
  }
  return <input {...common} type={field.type === "date" || field.type === "email" || field.type === "number" ? field.type : "text"} />
}

function StatusPill({ status }) {
  const label = status === "published" ? "Published" : status === "draft" ? "Draft" : status === "retired" ? "Archived version" : "Not published"
  return <span className={`registration-status is-${status || "empty"}`}>{label}</span>
}

export default function RegistrationWorkspace({ schoolName = "your school" }) {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [definition, setDefinition] = useState(null)
  const [formName, setFormName] = useState("")
  const [description, setDescription] = useState("")
  const [activeTab, setActiveTab] = useState("builder")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldType, setNewFieldType] = useState("text")
  const [newFieldSection, setNewFieldSection] = useState("")
  const [showAddField, setShowAddField] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormName, setNewFormName] = useState("")

  const activeVersion = latestEditableVersion(selectedForm)
  const publishedVersion = selectedForm?.publishedVersion || null
  const draftVersion = selectedForm?.draftVersion || null
  const fieldCount = definition?.fields?.length || 0
  const requiredCount = useMemo(
    () => (definition?.fields || []).filter((field) => field.required).length,
    [definition],
  )

  const installForm = useCallback((form) => {
    setSelectedForm(form)
    const version = latestEditableVersion(form)
    setDefinition(version?.definition ? clone(version.definition) : null)
    setFormName(form?.formName || "")
    setDescription(form?.description || "")
    setError("")
  }, [])

  const loadForms = useCallback(async (preferredId = null) => {
    setLoading(true)
    setError("")
    try {
      const result = await getRegistrationForms()
      const nextForms = result.forms || []
      setForms(nextForms)
      const nextId = preferredId || selectedForm?.id || result.defaultFormId || nextForms[0]?.id
      if (nextId) {
        const detail = await getRegistrationForm(nextId)
        installForm(detail.form)
      } else {
        setSelectedForm(null)
        setDefinition(null)
      }
    } catch (loadError) {
      setError(loadError.message || "Could not load registration forms.")
    } finally {
      setLoading(false)
    }
  }, [installForm, selectedForm?.id])

  useEffect(() => {
    void loadForms()
  }, [loadForms])

  async function selectForm(formId) {
    if (!formId || formId === selectedForm?.id) return
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const result = await getRegistrationForm(formId)
      installForm(result.form)
      setActiveTab("builder")
    } catch (loadError) {
      setError(loadError.message || "Could not open this registration form.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateForm(event) {
    event.preventDefault()
    if (!newFormName.trim() || creating) return
    setCreating(true)
    setError("")
    setNotice("")
    try {
      const result = await createRegistrationForm({ formName: newFormName.trim() })
      setNewFormName("")
      setShowNewForm(false)
      await loadForms(result.form.id)
      setNotice("Your new registration form has been created as a draft.")
    } catch (createError) {
      setError(createError.message || "Could not create this registration form.")
    } finally {
      setCreating(false)
    }
  }

  function updateDefinition(updater) {
    setDefinition((current) => {
      if (!current) return current
      const next = typeof updater === "function" ? updater(current) : updater
      return next
    })
  }

  function updateSettings(key, value) {
    updateDefinition((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }))
  }

  function updateSection(sectionKey, patch) {
    updateDefinition((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.sectionKey === sectionKey ? { ...section, ...patch } : section,
      ),
    }))
  }

  function updateField(fieldKey, patch) {
    updateDefinition((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.fieldKey === fieldKey ? { ...field, ...patch } : field,
      ),
    }))
  }

  function addCustomField(event) {
    event.preventDefault()
    if (!definition || !newFieldLabel.trim()) return
    const base = makeKey(newFieldLabel)
    let fieldKey = base
    let suffix = 2
    while (definition.fields.some((field) => field.fieldKey === fieldKey)) {
      fieldKey = `${base}_${suffix}`
      suffix += 1
    }
    const sectionKey = newFieldSection || definition.sections[0]?.sectionKey
    if (!sectionKey) return
    const field = {
      fieldKey,
      label: newFieldLabel.trim(),
      type: newFieldType,
      sectionKey,
      required: false,
      storage: "custom",
      dataClassification: "standard",
      description: null,
      placeholder: null,
      helpText: null,
      options: ["select", "multiselect", "radio"].includes(newFieldType) ? ["Option 1", "Option 2"] : [],
      validationRules: {},
      order: Math.max(0, ...definition.fields.map((item) => item.order || 0)) + 10,
    }
    updateDefinition((current) => ({ ...current, fields: [...current.fields, field] }))
    setNewFieldLabel("")
    setShowAddField(false)
    setNotice("Custom field added. Save the draft to keep your changes.")
  }

  function removeCustomField(fieldKey) {
    updateDefinition((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.fieldKey !== fieldKey),
    }))
  }

  function addSection() {
    if (!definition || definition.sections.length >= 30) return
    const index = definition.sections.length + 1
    let sectionKey = `additional_section_${index}`
    let suffix = 2
    while (definition.sections.some((section) => section.sectionKey === sectionKey)) {
      sectionKey = `additional_section_${index}_${suffix}`
      suffix += 1
    }
    const nextSection = {
      sectionKey,
      title: `New section ${index}`,
      description: "",
      order: Math.max(0, ...definition.sections.map((section) => section.order || 0)) + 10,
    }
    updateDefinition((current) => ({ ...current, sections: [...current.sections, nextSection] }))
    setNewFieldSection(sectionKey)
  }

  function moveField(fieldKey, direction) {
    updateDefinition((current) => {
      const fields = [...current.fields]
      const field = fields.find((item) => item.fieldKey === fieldKey)
      if (!field) return current

      const sectionFields = fields
        .filter((item) => item.sectionKey === field.sectionKey)
        .sort((a, b) => a.order - b.order)
      const index = sectionFields.findIndex((item) => item.fieldKey === fieldKey)
      const target = index + direction
      if (target < 0 || target >= sectionFields.length) return current

      ;[sectionFields[index], sectionFields[target]] = [sectionFields[target], sectionFields[index]]
      const orderByKey = new Map(
        sectionFields.map((item, position) => [item.fieldKey, (position + 1) * 10]),
      )
      return {
        ...current,
        fields: fields.map((item) => ({
          ...item,
          ...(orderByKey.has(item.fieldKey) ? { order: orderByKey.get(item.fieldKey) } : {}),
        })),
      }
    })
  }

  async function handleSaveDraft() {
    if (!selectedForm || !definition || saving) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const result = await saveRegistrationFormDraft(selectedForm.id, {
        formName: formName.trim(),
        description: description.trim(),
        formDefinition: definition,
      })
      installForm(result.form)
      await loadForms(result.form.id)
      setNotice("Draft saved. Your published registration form has not been changed.")
    } catch (saveError) {
      setError(saveError.message || "Could not save the registration form draft.")
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    const versionId = selectedForm?.draftVersion?.id
    if (!selectedForm || !versionId || publishing) return
    const confirmed = window.confirm(
      "Publish this registration form version? It will become the active form for new registrations. Existing submissions will keep their original form version.",
    )
    if (!confirmed) return
    setPublishing(true)
    setError("")
    setNotice("")
    try {
      const result = await publishRegistrationForm(selectedForm.id, versionId)
      installForm(result.form)
      await loadForms(result.form.id)
      setNotice("Registration form published successfully.")
    } catch (publishError) {
      setError(publishError.message || "Could not publish this registration form.")
    } finally {
      setPublishing(false)
    }
  }

  const groupedFields = useMemo(() => {
    if (!definition) return []
    return [...definition.sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        fields: [...definition.fields]
          .filter((field) => field.sectionKey === section.sectionKey)
          .sort((a, b) => a.order - b.order),
      }))
  }, [definition])

  const canPublish = Boolean(draftVersion?.id)

  return (
    <section className="registration-workspace" aria-label="Registration setup">
      <div className="registration-workspace__intro">
        <div>
          <div className="registration-workspace__eyebrow"><Sparkles size={14} /> SCHOOL-SPECIFIC REGISTRATION</div>
          <h2>Registration Form Setup</h2>
          <p>Configure the information {schoolName} collects during student admission. Your changes stay in draft until you publish them.</p>
        </div>
        <div className="registration-workspace__intro-actions">
          <button className="registration-btn registration-btn--quiet" type="button" onClick={() => void loadForms(selectedForm?.id)} disabled={loading}>
            {loading ? <LoaderCircle className="registration-spin" size={16} /> : <ArrowDown size={16} />}
            Refresh
          </button>
          <button className="registration-btn registration-btn--primary" type="button" onClick={() => setShowNewForm((value) => !value)}>
            <Plus size={16} /> New form
          </button>
        </div>
      </div>

      {error && <div className="registration-alert registration-alert--error" role="alert"><AlertCircle size={17} /> <span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
      {notice && <div className="registration-alert registration-alert--success" role="status"><Check size={17} /> <span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}

      {showNewForm && (
        <form className="registration-create-form" onSubmit={handleCreateForm}>
          <div><strong>Create another registration form</strong><span>Use this for a separate admission route or intake process.</span></div>
          <input aria-label="New registration form name" value={newFormName} onChange={(event) => setNewFormName(event.target.value)} placeholder="e.g. Transfer Student Admission" maxLength={160} required />
          <button className="registration-btn registration-btn--primary" type="submit" disabled={creating || !newFormName.trim()}>{creating ? <LoaderCircle className="registration-spin" size={16} /> : <Plus size={16} />} Create form</button>
          <button className="registration-icon-btn" type="button" onClick={() => setShowNewForm(false)} aria-label="Close create form"><X size={17} /></button>
        </form>
      )}

      <div className="registration-workspace__layout">
        <aside className="registration-form-list">
          <div className="registration-form-list__heading"><span>YOUR FORMS</span><span>{forms.length}</span></div>
          {loading && forms.length === 0 ? (
            <div className="registration-loading"><LoaderCircle className="registration-spin" size={19} /> Loading forms…</div>
          ) : forms.length ? (
            <div className="registration-form-list__items">
              {forms.map((form) => {
                const status = form.draftVersion?.status || form.publishedVersion?.status || "empty"
                return (
                  <button className={`registration-form-item ${selectedForm?.id === form.id ? "is-selected" : ""}`} type="button" key={form.id} onClick={() => void selectForm(form.id)}>
                    <span className="registration-form-item__icon"><FileText size={17} /></span>
                    <span className="registration-form-item__body"><strong>{form.formName}</strong><small>{form.isDefault ? "Default admission form" : "Additional form"}</small><StatusPill status={status} /></span>
                    <ChevronDown className="registration-form-item__chevron" size={15} />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="registration-list-empty"><FilePlus2 size={23} /><strong>No registration forms yet</strong><span>Create a form to begin configuring student admission.</span></div>
          )}
          <div className="registration-form-list__note"><CircleHelp size={15} /><span>Each school has its own form structure. Published versions remain attached to the records collected with them.</span></div>
        </aside>

        <div className="registration-workspace__main">
          {!selectedForm || !definition ? (
            <div className="registration-empty-state"><Layers3 size={30} /><h3>Set up your student registration</h3><p>Choose a form on the left, or create one to begin building your school's digital admission process.</p><button className="registration-btn registration-btn--primary" type="button" onClick={() => setShowNewForm(true)}><Plus size={16} /> Create registration form</button></div>
          ) : (
            <>
              <div className="registration-form-heading">
                <div><span className="registration-form-heading__eyebrow">FORM BUILDER</span><h3>{formName || "Untitled registration form"}</h3><p>{selectedForm.formKey} · {fieldCount} fields · {requiredCount} required</p></div>
                <div className="registration-form-heading__status"><StatusPill status={publishedVersion ? "published" : "empty"} />{draftVersion && <StatusPill status="draft" />}</div>
              </div>

              <div className="registration-tabs" role="tablist" aria-label="Registration form workspace tabs">
                <button type="button" role="tab" aria-selected={activeTab === "builder"} className={activeTab === "builder" ? "is-active" : ""} onClick={() => setActiveTab("builder")}><Settings2 size={15} /> Builder</button>
                <button type="button" role="tab" aria-selected={activeTab === "preview"} className={activeTab === "preview" ? "is-active" : ""} onClick={() => setActiveTab("preview")}><Eye size={15} /> Parent preview</button>
              </div>

              {activeTab === "builder" ? (
                <div className="registration-builder">
                  <section className="registration-editor-card">
                    <div className="registration-card-heading"><div><span className="registration-card-heading__number">01</span><div><h4>Form identity</h4><p>Name this process and explain what it is for.</p></div></div><FileText size={18} /></div>
                    <div className="registration-editor-grid">
                      <label className="registration-control registration-control--full"><span>Form name</span><input value={formName} onChange={(event) => setFormName(event.target.value)} maxLength={160} /></label>
                      <label className="registration-control registration-control--full"><span>Description for school staff</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Explain when this form should be used." /></label>
                    </div>
                  </section>

                  <section className="registration-editor-card">
                    <div className="registration-card-heading"><div><span className="registration-card-heading__number">02</span><div><h4>Parent-facing introduction</h4><p>Control the wording parents see when they open the form.</p></div></div><Settings2 size={18} /></div>
                    <div className="registration-editor-grid">
                      <label className="registration-control registration-control--full"><span>Form title</span><input value={definition.settings.formTitle} onChange={(event) => updateSettings("formTitle", event.target.value)} maxLength={160} /></label>
                      <label className="registration-control registration-control--full"><span>Introduction</span><textarea rows={3} value={definition.settings.introText} onChange={(event) => updateSettings("introText", event.target.value)} maxLength={1000} /></label>
                      <label className="registration-control"><span>Submit button text</span><input value={definition.settings.submitLabel} onChange={(event) => updateSettings("submitLabel", event.target.value)} maxLength={60} /></label>
                      <label className="registration-control"><span>Confirmation message</span><input value={definition.settings.successMessage} onChange={(event) => updateSettings("successMessage", event.target.value)} maxLength={500} /></label>
                    </div>
                    <div className="registration-toggle-row"><label><input type="checkbox" checked={definition.settings.allowDraftSave} onChange={(event) => updateSettings("allowDraftSave", event.target.checked)} /><span><strong>Allow parents to save a draft</strong><small>Parents can continue an application later.</small></span></label><label><input type="checkbox" checked={definition.settings.showProgress} onChange={(event) => updateSettings("showProgress", event.target.checked)} /><span><strong>Show form progress</strong><small>Display progress through registration sections.</small></span></label></div>
                  </section>

                  <section className="registration-editor-card">
                    <div className="registration-card-heading"><div><span className="registration-card-heading__number">03</span><div><h4>Registration sections and fields</h4><p>Organise information into clear sections. Standard AceEdu fields stay connected to the student record.</p></div></div><Layers3 size={18} /></div>
                    <div className="registration-field-legend"><span><i className="is-standard" /> AceEdu standard field</span><span><i className="is-custom" /> School-specific field</span></div>
                    {groupedFields.map((section, sectionIndex) => (
                      <div className="registration-section-editor" key={section.sectionKey}>
                        <div className="registration-section-editor__top"><span className="registration-section-editor__index">SECTION {String(sectionIndex + 1).padStart(2, "0")}</span><span>{section.fields.length} fields</span></div>
                        <div className="registration-editor-grid">
                          <label className="registration-control"><span>Section title</span><input value={section.title} onChange={(event) => updateSection(section.sectionKey, { title: event.target.value })} maxLength={120} /></label>
                          <label className="registration-control"><span>Section guidance</span><input value={section.description || ""} onChange={(event) => updateSection(section.sectionKey, { description: event.target.value })} maxLength={500} placeholder="Optional instructions" /></label>
                        </div>
                        <div className="registration-field-list">
                          {section.fields.map((field, fieldIndex) => {
                            const standard = field.storage === "standard"
                            return (
                              <article className="registration-field-row" key={field.fieldKey}>
                                <div className="registration-field-row__handle"><GripVertical size={16} /><span>{String(fieldIndex + 1).padStart(2, "0")}</span></div>
                                <div className="registration-field-row__content">
                                  <div className="registration-field-row__top"><label className="registration-control"><span>Field label</span><input value={field.label} onChange={(event) => updateField(field.fieldKey, { label: event.target.value })} maxLength={160} /></label><label className="registration-control"><span>Input type</span><select value={field.type} onChange={(event) => updateField(field.fieldKey, { type: event.target.value, options: ["select", "multiselect", "radio"].includes(event.target.value) ? (field.options?.length ? field.options : ["Option 1", "Option 2"]) : [] })} disabled={standard}><option value={field.type}>{FIELD_TYPES.find(([type]) => type === field.type)?.[1] || field.type}</option>{!standard && FIELD_TYPES.filter(([type]) => type !== field.type).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label></div>
                                  <div className="registration-field-row__bottom"><span className={`registration-field-kind ${standard ? "is-standard" : "is-custom"}`}>{standard ? "STANDARD FIELD" : "CUSTOM FIELD"}</span><label className="registration-required"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.fieldKey, { required: event.target.checked })} disabled={field.fieldKey === "full_name"} /><span>Required</span></label><label className="registration-control registration-control--section"><span>Section</span><select value={field.sectionKey} onChange={(event) => updateField(field.fieldKey, { sectionKey: event.target.value })}>{definition.sections.map((item) => <option key={item.sectionKey} value={item.sectionKey}>{item.title}</option>)}</select></label>{!standard && <label className="registration-control registration-control--section"><span>Data handling</span><select value={field.dataClassification || "standard"} onChange={(event) => updateField(field.fieldKey, { dataClassification: event.target.value })}><option value="standard">Standard</option><option value="sensitive">Sensitive</option><option value="restricted">Restricted</option></select></label>}<div className="registration-field-row__actions"><button type="button" onClick={() => moveField(field.fieldKey, -1)} title="Move field up"><ArrowUp size={15} /></button><button type="button" onClick={() => moveField(field.fieldKey, 1)} title="Move field down"><ArrowDown size={15} /></button>{!standard && <button className="is-danger" type="button" onClick={() => removeCustomField(field.fieldKey)} title="Remove custom field"><Trash2 size={15} /></button>}</div></div>
                                  {!["full_name", "date_of_birth", "guardian_name", "guardian_phone", "home_address", "state_of_origin", "student_phone", "passport"].includes(field.fieldKey) && ["select", "multiselect", "radio"].includes(field.type) && <label className="registration-control registration-control--options"><span>Options (separate with commas)</span><input value={(field.options || []).join(", ")} onChange={(event) => updateField(field.fieldKey, { options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Option 1, Option 2" /></label>}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="registration-builder-actions"><button className="registration-btn registration-btn--quiet" type="button" onClick={addSection} disabled={definition.sections.length >= 30}><Plus size={15} /> Add section</button><button className="registration-btn registration-btn--quiet" type="button" onClick={() => { setNewFieldSection(definition.sections[0]?.sectionKey || ""); setShowAddField((value) => !value) }} disabled={fieldCount >= 100}><Plus size={15} /> Add custom field</button></div>
                    {showAddField && <form className="registration-add-field" onSubmit={addCustomField}><label className="registration-control"><span>Field label</span><input value={newFieldLabel} onChange={(event) => setNewFieldLabel(event.target.value)} placeholder="e.g. Previous school attended" required maxLength={160} /></label><label className="registration-control"><span>Field type</span><select value={newFieldType} onChange={(event) => setNewFieldType(event.target.value)}>{FIELD_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="registration-control"><span>Place in section</span><select value={newFieldSection} onChange={(event) => setNewFieldSection(event.target.value)}>{definition.sections.map((section) => <option key={section.sectionKey} value={section.sectionKey}>{section.title}</option>)}</select></label><button className="registration-btn registration-btn--primary" type="submit"><Plus size={15} /> Add field</button></form>}
                  </section>

                  <div className="registration-builder-footer"><span><ShieldCheckIcon /> Changes are saved as a draft until you publish them.</span><button className="registration-btn registration-btn--primary" type="button" onClick={() => void handleSaveDraft()} disabled={saving || !formName.trim()}>{saving ? <LoaderCircle className="registration-spin" size={16} /> : <Save size={16} />} {saving ? "Saving draft…" : "Save draft"}</button></div>
                </div>
              ) : (
                <div className="registration-parent-preview">
                  <div className="registration-parent-preview__meta"><span><Eye size={15} /> PARENT VIEW PREVIEW</span><span>Preview only · Submissions are not enabled yet</span></div>
                  <div className="registration-preview__paper">
                    <div className="registration-preview__brand"><span className="registration-preview__brand-mark">A</span><span><strong>{schoolName}</strong><small>STUDENT ADMISSION</small></span></div>
                    <div className="registration-preview__title"><span>ADMISSIONS</span><h3>{definition.settings.formTitle || formName}</h3><p>{definition.settings.introText}</p></div>
                    {groupedFields.map((section, index) => <section className="registration-preview__section" key={section.sectionKey}><div className="registration-preview__section-title"><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{section.title}</h4>{section.description && <p>{section.description}</p>}</div></div><div className="registration-preview__fields">{section.fields.map((field) => <label className="registration-preview__field" key={field.fieldKey}><span>{field.label}{field.required && <i>*</i>}</span><FieldPreview field={field} />{field.helpText && <small>{field.helpText}</small>}</label>)}</div></section>)}
                    <div className="registration-preview__submit">{definition.settings.submitLabel || "Submit application"}<small>{definition.settings.successMessage}</small></div>
                  </div>
                </div>
              )}

              <div className="registration-publish-bar"><div><strong>{publishedVersion ? `Published version ${publishedVersion.versionNumber}` : "This form has not been published"}</strong><span>{draftVersion ? `Draft version ${draftVersion.versionNumber} is ready for review.` : "Save your edits to create a new draft version."}</span></div><button className="registration-btn registration-btn--publish" type="button" onClick={() => void handlePublish()} disabled={!canPublish || publishing || saving}>{publishing ? <LoaderCircle className="registration-spin" size={16} /> : <Check size={16} />} {publishing ? "Publishing…" : "Publish form"}</button></div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function ShieldCheckIcon() {
  return <Check size={15} aria-hidden="true" />
}
