import { useEffect, useState } from "react"
import { Settings } from "lucide-react"
import { updateSchoolType } from "../data/api"
import "./SchoolCurriculumSetup.css"

const schoolTypes = ["Primary", "Secondary", "Combined", "Other"]

export default function SchoolSettings({ school, onSchoolUpdated, onCurriculumUpdated }) {
  const [schoolType, setSchoolType] = useState(school.schoolType)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    setSchoolType(school.schoolType)
  }, [school.schoolType])

  async function saveSchoolType(event) {
    event.preventDefault()
    if (pending || schoolType === school.schoolType) return
    setPending(true)
    setError("")
    setNotice("")
    try {
      const result = await updateSchoolType(schoolType)
      onSchoolUpdated?.({ ...school, schoolType: result.schoolType })
      onCurriculumUpdated(result.classLevels)
      setNotice("School type saved. Existing student records and classes were kept.")
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="admin-panel school-settings" aria-labelledby="school-settings-title">
      <div className="admin-panel__heading">
        <div>
          <span className="admin-panel__icon"><Settings size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="school-settings-title">School settings</h2>
            <p>Update your school's education levels.</p>
          </div>
        </div>
      </div>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {notice && <p className="school-curriculum__message" role="status">{notice}</p>}
      <form className="school-settings__form" onSubmit={saveSchoolType}>
        <label htmlFor="school-type-setting">School type</label>
        <select
          id="school-type-setting"
          value={schoolType}
          onChange={(event) => setSchoolType(event.target.value)}
          disabled={pending}
        >
          {schoolTypes.map((type) => <option value={type} key={type}>{type}</option>)}
        </select>
        <p>
          Primary offers Kindergarten through Primary 5, with Primary 6 available as an optional class.
          Secondary offers JSS 1 through SSS 3. Combined offers both sets of classes.
        </p>
        <p>
          Changing type does not delete existing students, class records, subjects, or approvals.
        </p>
        <button className="admin-primary-button" type="submit" disabled={pending || schoolType === school.schoolType}>
          {pending ? "Saving…" : "Save school type"}
        </button>
      </form>
    </section>
  )
}
