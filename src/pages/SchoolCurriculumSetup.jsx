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

export default function SchoolCurriculumSetup({
  schoolType,
  onSchoolTypeChange,
}) {
  const [classLevels, setClassLevels] = useState([])

  const [requests, setRequests] = useState([])

  const [loading, setLoading] = useState(true)

  const [busy, setBusy] = useState(false)

  const [error, setError] = useState("")

  const [notice, setNotice] = useState("")

  const [newSubjects, setNewSubjects] = useState({})

  const [selectedClassId, setSelectedClassId] = useState("")

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

      setSelectedClassId((current) =>
        curriculum.classLevels.some((level) => level.id === current)
          ? current
          : "",
      )

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

  const selectedLevel = classLevels.find(
    (level) => level.id === selectedClassId,
  )

  return (
    <section
      className="school-curriculum"
      aria-labelledby="school-curriculum-title"
    >
      <header className="school-curriculum__heading">
        <div>
          <p className="admin-eyebrow">SCHOOL SETUP</p>
          <h2 id="school-curriculum-title">Classes and subjects</h2>
          <p>
            Set the class names students see, define subject choices, and review
            each student's selection.
          </p>
        </div>
        <button
          type="button"
          className="admin-outline-button"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          Refresh
        </button>
      </header>

      {error && (
        <p className="school-curriculum__message is-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="school-curriculum__message" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">Loading your class and subject setup…</p>}

      {!loading && (
        <>
          <section className="admin-panel school-curriculum__panel">
            <header>
              <div>
                <h3>Choose a class to manage</h3>
                <p>
                  Select a class to edit its display name, subject requirements,
                  and subject list.
                </p>
              </div>
            </header>
            <div className="school-curriculum__class-grid">
              {classLevels.map((level, index) => (
                <button
                  type="button"
                  className={`school-curriculum__class-tile ${
                    selectedClassId === level.id ? "is-selected" : ""
                  } ${!level.isActive ? "is-inactive" : ""}`}
                  key={level.id}
                  aria-expanded={selectedClassId === level.id}
                  aria-controls={
                    selectedClassId === level.id
                      ? "school-class-settings"
                      : undefined
                  }
                  onClick={() =>
                    setSelectedClassId((current) =>
                      current === level.id ? "" : level.id,
                    )
                  }
                >
                  <div className="school-curriculum__tile-top">
                    <span className="school-curriculum__tile-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`school-curriculum__tile-status ${
                        level.isActive ? "" : "is-off"
                      }`}
                    >
                      {level.isActive ? "Available" : "Not offered"}
                    </span>
                  </div>
                  <strong>{level.displayName}</strong>
                  <span className="school-curriculum__tile-meta">
                    {
                      level.subjects.filter((subject) => subject.isActive)
                        .length
                    }{" "}
                    subjects
                    {level.isOptional ? " · Optional" : ""}
                  </span>
                  <span className="school-curriculum__tile-action">
                    {selectedClassId === level.id
                      ? "Close settings"
                      : "Manage class"}
                    <span aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {selectedLevel && (
            <section
              className="admin-panel school-curriculum__panel school-curriculum__details"
              id="school-class-settings"
              key={selectedLevel.id}
            >
              <header>
                <div>
                  <p className="admin-eyebrow">CLASS SETTINGS</p>
                  <h3>{selectedLevel.displayName}</h3>
                  <p>Changes here apply only to this class level.</p>
                </div>
                <button
                  type="button"
                  className="admin-outline-button"
                  onClick={() => setSelectedClassId("")}
                >
                  Close
                </button>
              </header>
              <form
                className="school-curriculum__class-settings"
                onSubmit={(event) => {
                  event.preventDefault()

                  void run(
                    () =>
                      updateClassLevel(selectedLevel.id, {
                        nickname: selectedLevel.nickname,

                        isActive: selectedLevel.isActive,
                      }),

                    `${selectedLevel.displayName} class settings saved.`,
                  )
                }}
              >
                <label>
                  Class display name / nickname
                  <input
                    value={selectedLevel.nickname}
                    maxLength={80}
                    placeholder={selectedLevel.name}
                    onChange={(event) =>
                      updateLevel(selectedLevel.id, {
                        nickname: event.target.value,
                      })
                    }
                  />
                </label>
                {selectedLevel.isOptional && (
                  <label className="school-curriculum__check">
                    <input
                      type="checkbox"
                      checked={selectedLevel.isActive}
                      onChange={(event) =>
                        updateLevel(selectedLevel.id, {
                          isActive: event.target.checked,
                        })
                      }
                    />
                    Offer this class to students
                  </label>
                )}
                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={busy}
                >
                  Save class settings
                </button>
              </form>
              <div className="school-curriculum__subject-class">
                <div>
                  <h4>Subject requirements</h4>
                  <p className="school-curriculum__section-help">
                    Students must meet these limits and select every compulsory
                    subject.
                  </p>
                </div>
                <form
                  className="school-curriculum__rules"
                  onSubmit={(event) => {
                    event.preventDefault()

                    void run(
                      () =>
                        saveClassSubjectRules(selectedLevel.id, {
                          minimumSubjects: Number(
                            selectedLevel.minimumSubjects,
                          ),

                          maximumSubjects: Number(
                            selectedLevel.maximumSubjects,
                          ),
                        }),

                      `${selectedLevel.displayName} subject limits saved.`,
                    )
                  }}
                >
                  <label>
                    Minimum subjects
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={selectedLevel.minimumSubjects}
                      onChange={(event) =>
                        updateLevel(selectedLevel.id, {
                          minimumSubjects: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Maximum subjects
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={selectedLevel.maximumSubjects}
                      onChange={(event) =>
                        updateLevel(selectedLevel.id, {
                          maximumSubjects: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="admin-outline-button"
                    type="submit"
                    disabled={busy}
                  >
                    Save limits
                  </button>
                </form>
                <div className="school-curriculum__subject-list">
                  {selectedLevel.subjects.map((subject) => (
                    <form
                      className="school-curriculum__subject-row"
                      key={subject.id}
                      onSubmit={(event) => {
                        event.preventDefault()

                        void run(
                          () =>
                            updateClassSubject(
                              selectedLevel.id,
                              subject.id,
                              subject,
                            ),

                          `${subject.name} settings saved.`,
                        )
                      }}
                    >
                      <input
                        aria-label={`${subject.name} subject name`}
                        value={subject.name}
                        maxLength={100}
                        onChange={(event) =>
                          updateLevel(selectedLevel.id, {
                            subjects: selectedLevel.subjects.map((item) =>
                              item.id === subject.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <label className="school-curriculum__check">
                        <input
                          type="checkbox"
                          checked={subject.isCompulsory}
                          onChange={(event) =>
                            updateLevel(selectedLevel.id, {
                              subjects: selectedLevel.subjects.map((item) =>
                                item.id === subject.id
                                  ? {
                                      ...item,
                                      isCompulsory: event.target.checked,
                                    }
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
                            updateLevel(selectedLevel.id, {
                              subjects: selectedLevel.subjects.map((item) =>
                                item.id === subject.id
                                  ? { ...item, isActive: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />
                        Available
                      </label>
                      <button
                        className="admin-outline-button"
                        type="submit"
                        disabled={busy}
                      >
                        Save
                      </button>
                    </form>
                  ))}
                  <form
                    className="school-curriculum__add-subject"
                    onSubmit={(event) => {
                      event.preventDefault()

                      const name = newSubjects[selectedLevel.id]?.name?.trim()

                      if (!name) return

                      void run(async () => {
                        await createClassSubject(selectedLevel.id, {
                          name,

                          isCompulsory: Boolean(
                            newSubjects[selectedLevel.id]?.isCompulsory,
                          ),
                        })

                        setNewSubjects((current) => ({
                          ...current,
                          [selectedLevel.id]: { name: "", isCompulsory: false },
                        }))
                      }, `${name} added to ${selectedLevel.displayName}.`)
                    }}
                  >
                    <input
                      value={newSubjects[selectedLevel.id]?.name || ""}
                      maxLength={100}
                      placeholder="Add a subject"
                      aria-label={`Add subject to ${selectedLevel.displayName}`}
                      onChange={(event) =>
                        setNewSubjects((current) => ({
                          ...current,

                          [selectedLevel.id]: {
                            ...current[selectedLevel.id],
                            name: event.target.value,
                          },
                        }))
                      }
                    />
                    <label className="school-curriculum__check">
                      <input
                        type="checkbox"
                        checked={Boolean(
                          newSubjects[selectedLevel.id]?.isCompulsory,
                        )}
                        onChange={(event) =>
                          setNewSubjects((current) => ({
                            ...current,

                            [selectedLevel.id]: {
                              ...current[selectedLevel.id],
                              isCompulsory: event.target.checked,
                            },
                          }))
                        }
                      />
                      Compulsory
                    </label>
                    <button
                      className="admin-primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      Add subject
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}

          <section className="admin-panel school-curriculum__panel">
            <header>
              <div>
                <h3>Student subject approvals</h3>
                <p>
                  Every submitted combination stays pending until an
                  administrator approves or declines it.
                </p>
              </div>
            </header>
            {requests.length ? (
              <div className="school-curriculum__requests">
                {requests.map((request) => (
                  <article
                    className="school-curriculum__request"
                    key={request.id}
                  >
                    <div>
                      <strong>{request.studentName}</strong>
                      <span>{request.studentClass}</span>
                      <p>
                        {request.subjects
                          .map(
                            (subject) =>
                              `${subject.name}${
                                subject.isCompulsory ? " (compulsory)" : ""
                              }`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <div className="school-curriculum__request-actions">
                      <button
                        className="admin-primary-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => reviewSubjectRequest(request.id, "approved"),

                            `Subject combination approved for ${request.studentName}.`,
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="admin-outline-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => reviewSubjectRequest(request.id, "declined"),

                            `Subject combination declined for ${request.studentName}.`,
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="school-curriculum__empty">
                No student combinations are waiting for review.
              </p>
            )}
          </section>
        </>
      )}
      {schoolType && (
        <p className="school-curriculum__footnote">
          School type: <strong>{schoolType}</strong>. Changing it keeps existing
          class, student, and subject records; it only changes which standard
          class levels are offered.
          <button
            type="button"
            className="admin-text-button"
            onClick={onSchoolTypeChange}
          >
            Change in settings
          </button>
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
            <p>
              Existing tools for academic years, terms, and historical academic
              records.
            </p>
            <PremiumAcademicSetup />
          </>
        )}
      </section>
    </section>
  )
}
