import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  slugifyRegistrationFormName,
  validateCreateRegistrationForm,
  validateRegistrationFormDefinition,
  validateRegistrationFormMetadata,
  validateSaveRegistrationDraft,
} from "./registration-validation.js"

const validDefinition = {
  schemaVersion: 1,
  settings: {
    formTitle: "Student Admission",
    introText: "Complete all required fields.",
    submitLabel: "Send application",
    successMessage: "Application received.",
    allowDraftSave: true,
    showProgress: true,
  },
  sections: [
    { sectionKey: "student_details", title: "Student details", order: 10 },
    { sectionKey: "guardian_details", title: "Guardian details", order: 20 },
  ],
  fields: [
    {
      fieldKey: "full_name",
      label: "Student full name",
      type: "text",
      sectionKey: "student_details",
      required: true,
      storage: "standard",
    },
    {
      fieldKey: "previous_school",
      label: "Previous school",
      type: "text",
      sectionKey: "student_details",
      required: false,
      storage: "custom",
    },
    {
      fieldKey: "guardian_phone",
      label: "Guardian phone",
      type: "phone",
      sectionKey: "guardian_details",
      required: true,
      storage: "standard",
    },
  ],
}

test("default registration form schema is valid and includes standard and custom fields", () => {
  const result = validateRegistrationFormDefinition(DEFAULT_REGISTRATION_FORM_DEFINITION)
  assert.equal(result.schemaVersion, 1)
  assert.equal(result.fields.find((field) => field.fieldKey === "full_name").required, true)
  assert.equal(result.fields.find((field) => field.fieldKey === "previous_school").storage, "custom")
})

test("form metadata trims labels and generates a stable key", () => {
  assert.deepEqual(
    validateRegistrationFormMetadata({ formName: "  New Student Admission  " }),
    {
      formName: "New Student Admission",
      formKey: "new-student-admission",
      description: null,
    },
  )
  assert.equal(slugifyRegistrationFormName("École Saint Mary's"), "ecole-saint-mary-s")
})

test("create form validates metadata and uses the standard default schema when omitted", () => {
  const result = validateCreateRegistrationForm({ formName: "Student Admission" })
  assert.equal(result.formKey, "student-admission")
  assert.equal(result.formDefinition.schemaVersion, 1)
  assert.throws(
    () => validateCreateRegistrationForm({ formName: "Student Admission", unexpected: true }),
    /Unsupported registration form field/,
  )
})

test("form schemas require the standard student full-name field", () => {
  const missing = structuredClone(validDefinition)
  missing.fields = missing.fields.filter((field) => field.fieldKey !== "full_name")
  assert.throws(() => validateRegistrationFormDefinition(missing), /full name field/)

  const optional = structuredClone(validDefinition)
  optional.fields[0].required = false
  assert.throws(() => validateRegistrationFormDefinition(optional), /full name field/)
})

test("form schemas reject duplicate keys, missing sections, unsupported types and unsafe metadata shapes", () => {
  const duplicate = structuredClone(validDefinition)
  duplicate.fields.push({ ...duplicate.fields[1], label: "Another label" })
  assert.throws(() => validateRegistrationFormDefinition(duplicate), /Field keys must be unique/)

  const missingSection = structuredClone(validDefinition)
  missingSection.fields[1].sectionKey = "unknown_section"
  assert.throws(() => validateRegistrationFormDefinition(missingSection), /section that does not exist/)

  const invalidType = structuredClone(validDefinition)
  invalidType.fields[1].type = "script"
  assert.throws(() => validateRegistrationFormDefinition(invalidType), /unsupported field type/)

  const invalidOptions = structuredClone(validDefinition)
  invalidOptions.fields[1].type = "select"
  invalidOptions.fields[1].options = []
  assert.throws(() => validateRegistrationFormDefinition(invalidOptions), /at least one option/)

  const invalidStandardMapping = structuredClone(validDefinition)
  invalidStandardMapping.fields[0].storage = "custom"
  assert.throws(() => validateRegistrationFormDefinition(invalidStandardMapping), /standard\/custom field mapping/)
})

test("draft validation only accepts known metadata and a valid form definition", () => {
  const result = validateSaveRegistrationDraft({
    formName: " Revised Admission Form ",
    description: "School admission form",
    formDefinition: validDefinition,
  })
  assert.equal(result.formName, "Revised Admission Form")
  assert.equal(result.formDefinition.fields.length, 3)
  assert.throws(
    () => validateSaveRegistrationDraft({ formDefinition: validDefinition, schoolId: 22 }),
    /Unsupported registration draft field/,
  )
  assert.throws(
    () => validateSaveRegistrationDraft({ formName: "Missing schema" }),
    /form definition is required/,
  )
})
