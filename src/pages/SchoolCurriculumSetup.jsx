import { useEffect, useState } from "react"
import {
  createClassSubject,
  getSchoolCurriculum,
  getSubjectRequests,
  reviewSubjectRequest,
  saveClassSubjectRules,
  updateClassLevel,
  updateClassSubject,
} from "../data/api"
import PremiumAcademicSetup from "./PremiumAcademicSetup"
import "./SchoolCurriculumSetup.css"

export default function SchoolCurriculumSetup({ schoolType, onSchoolTypeChange }) {
  const [classLevels, setClassLevels] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [newSubjects, setNewSubjects] = useState({})
  const [showLegacyAcademic, setShowLegacyAcademic] = useState(false)

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const [curriculum, pending] = await Promise.all([
        getSchoolCurriculum(),
        getSubjectRequests(),
      ])
      setClassLevels(curriculum.classLevels)
      setRequests(pending.requests)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function run(action, successMessage) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await action()
      setNotice(successMessage)
      await refresh()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  function updateLevel(levelId, changes) {
    setClassLevels((current) =>
      current.map((level) =>
        level.id === levelId ? { ...level, ...changes } : level,
      ),
    )
  }

  return (
    <section className="school-curriculum" aria-labelledby="school-curriculum-title">
      <header className="school-curriculum__heading">
        <div>
          <p className="admin-eyebrow">SCHOOL SETUP</p>
          <h2 id="school-curriculum-title">Classes and subjects</h2>
          <p>Set the class names students see, define subject choices, and review each student's selection.</p>
        </div>
        <button type="button" className="admin-outline-button" onClick={() => void refresh()} disabled={loading || busy}>
          Refresh
        </button>
      </header>

      {error && <p className="school-curriculum__message is-error" role="alert">{error}</p>}
      {notice && <p className="school-curriculum__message" role="status">{notice}</p>}
      {loading && <p role="status">Loading your class and subject setup…</p>}

      {!loading && (
        <>
          <section className="admin-panel school-curriculum__panel">
            <header>
              <div>
                <h3>Available classes</h3>
                <p>Class levels are generated from your school type. Nicknames change the display name without losing the standard level.</p>
              </div>
            </header>
            <div className="school-curriculum__class-grid">
              {classLevels.map((level) => (
                <form
                  className="school-curriculum__class"
                  key={level.id}
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(
                      () => updateClassLevel(level.id, {
                        nickname: level.nickname,
                        isActive: level.isActive,
                      }),
                      `${level.displayName} class settings saved.`,
                    )
                  }}
                >
                  <div>
                    <strong>{level.name}</strong>
                    {level.isOptional && <small>Optional level</small>}
                  </div>
                  <label>
                    Display name / nickname
                    <input
                      value={level.nickname}
                      maxLength={80}
                      placeholder={level.name}
                      onChange={(event) =>
                        updateLevel(level.id, { nickname: event.target.value })
                      }
                    />
                  </label>
                  {level.isOptional && (
                    <label className="school-curriculum__check">
                      <input
                        type="checkbox"
                        checked={level.isActive}
                        onChange={(event) =>
                          updateLevel(level.id, { isActive: event.target.checked })
                        }
                      />
                      Offer this class
                    </label>
                  )}
                  <button type="submit" className="admin-outline-button" disabled={busy}>
                    Save class
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="admin-panel school-curriculum__panel">
            <header>
              <div>
                <h3>Subject choices by class</h3>
                <p>Students must include compulsory subjects and stay within the class minimum and maximum.</p>
              </div>
            </header>
            <div className="school-curriculum__subjects">
              {classLevels.filter((level) => level.isActive).map((level) => (
                <article className="school-curriculum__subject-class" key={level.id}>
                  <h4>{level.displayName}</h4>
                  <form
                    className="school-curriculum__rules"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void run(
                        () => saveClassSubjectRules(level.id, {
                          minimumSubjects: Number(level.minimumSubjects),
                          maximumSubjects: Number(level.maximumSubjects),
                        }),
                        `${level.displayName} subject limits saved.`,
                      )
                    }}
                  >
                    <label>
                      Minimum subjects
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={level.minimumSubjects}
                        onChange={(event) => updateLevel(level.id, { minimumSubjects: event.target.value })}
                      />
                    </label>
                    <label>
                      Maximum subjects
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={level.maximumSubjects}
                        onChange={(event) => updateLevel(level.id, { maximumSubjects: event.target.value })}
                      />
                    </label>
                    <button className="admin-outline-button" type="submit" disabled={busy}>Save limits</button>
                  </form>
                  <div className="school-curriculum__subject-list">
                    {level.subjects.map((subject) => (
                      <form
                        className="school-curriculum__subject-row"
                        key={subject.id}
                        onSubmit={(event) => {
                          event.preventDefault()
                          void run(
                            () => updateClassSubject(level.id, subject.id, subject),
                            `${subject.name} settings saved.`,
                          )
                        }}
                      >
                        <input
                          aria-label={`${subject.name} subject name`}
                          value={subject.name}
                          maxLength={100}
                          onChange={(event) =>
                            updateLevel(level.id, {
                              subjects: level.subjects.map((item) =>
                                item.id === subject.id ? { ...item, name: event.target.value } : item,
                              ),
                            })
                          }
                        />
                        <label className="school-curriculum__check">
                          <input
                            type="checkbox"
                            checked={subject.isCompulsory}
                            onChange={(event) =>
                              updateLevel(level.id, {
                                subjects: level.subjects.map((item) =>
                                  item.id === subject.id
                                    ? { ...item, isCompulsory: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          Compulsory
                        </label>
                        <label className="school-curriculum__check">
                          <input
                            type="checkbox"
                            checked={subject.isActive}
                            onChange={(event) =>
                              updateLevel(level.id, {
                                subjects: level.subjects.map((item) =>
                                  item.id === subject.id
                                    ? { ...item, isActive: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          Available
                        </label>
                        <button className="admin-outline-button" type="submit" disabled={busy}>Save</button>
                      </form>
                    ))}
                    <form
                      className="school-curriculum__add-subject"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const name = newSubjects[level.id]?.name?.trim()
                        if (!name) return
                        void run(async () => {
                          await createClassSubject(level.id, {
                            name,
                            isCompulsory: Boolean(newSubjects[level.id]?.isCompulsory),
                          })
                          setNewSubjects((current) => ({ ...current, [level.id]: { name: "", isCompulsory: false } }))
                        }, `${name} added to ${level.displayName}.`)
                      }}
                    >
                      <input
                        value={newSubjects[level.id]?.name || ""}
                        maxLength={100}
                        placeholder="Add a subject"
                        aria-label={`Add subject to ${level.displayName}`}
                        onChange={(event) =>
                          setNewSubjects((current) => ({
                            ...current,
                            [level.id]: { ...current[level.id], name: event.target.value },
                          }))
                        }
                      />
                      <label className="school-curriculum__check">
                        <input
                          type="checkbox"
                          checked={Boolean(newSubjects[level.id]?.isCompulsory)}
                          onChange={(event) =>
                            setNewSubjects((current) => ({
                              ...current,
                              [level.id]: { ...current[level.id], isCompulsory: event.target.checked },
                            }))
                          }
                        />
                        Compulsory
                      </label>
                      <button className="admin-primary-button" type="submit" disabled={busy}>Add subject</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel school-curriculum__panel">
            <header>
              <div>
                <h3>Student subject approvals</h3>
                <p>Every submitted combination stays pending until an administrator approves or declines it.</p>
              </div>
            </header>
            {requests.length ? (
              <div className="school-curriculum__requests">
                {requests.map((request) => (
                  <article className="school-curriculum__request" key={request.id}>
                    <div>
                      <strong>{request.studentName}</strong>
                      <span>{request.studentClass}</span>
                      <p>{request.subjects.map((subject) => `${subject.name}${subject.isCompulsory ? " (compulsory)" : ""}`).join(", ")}</p>
                    </div>
                    <div className="school-curriculum__request-actions">
                      <button
                        className="admin-primary-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void run(
                          () => reviewSubjectRequest(request.id, "approved"),
                          `Subject combination approved for ${request.studentName}.`,
                        )}
                      >
                        Approve
                      </button>
                      <button
                        className="admin-outline-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void run(
                          () => reviewSubjectRequest(request.id, "declined"),
                          `Subject combination declined for ${request.studentName}.`,
                        )}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="school-curriculum__empty">No student combinations are waiting for review.</p>
            )}
          </section>
        </>
      )}
      {schoolType && (
        <p className="school-curriculum__footnote">
          School type: <strong>{schoolType}</strong>. Changing it keeps existing class, student, and subject records; it only changes which standard class levels are offered.
          <button type="button" className="admin-text-button" onClick={onSchoolTypeChange}>Change in settings</button>
        </p>
      )}
      <section className="school-curriculum__legacy">
        <button
          type="button"
          className="admin-outline-button"
          aria-expanded={showLegacyAcademic}
          onClick={() => setShowLegacyAcademic((current) => !current)}
        >
          {showLegacyAcademic ? "Hide" : "Show"} advanced academic-year tools
        </button>
        {showLegacyAcademic && (
          <>
            <p>Existing tools for academic years, terms, and historical academic records.</p>
            <PremiumAcademicSetup />
          </>
        )}
      </section>
    </section>
  )
}
