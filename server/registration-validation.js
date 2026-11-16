const standardFieldTypes = {
  full_name: "text",
  date_of_birth: "date",
  guardian_name: "text",
  guardian_phone: "phone",
  home_address: "textarea",
  state_of_origin: "text",
  student_phone: "phone",
  passport: "file",
}

const supportedFieldTypes = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "date",
  "number",
  "boolean",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "file",
])

const allowedClassifications = new Set(["standard", "sensitive", "restricted"])

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function ensureOnlyKeys(value, allowed, label) {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key))
  if (unsupported.length) {
    throw new Error(`Unsupported ${label} field(s): ${unsupported.join(", ")}.`)
  }
}

function cleanText(value, label, maxLength, { optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return null
    throw new Error(`${label} is required.`)
  }
  if (typeof value !== "string") throw new Error(`${label} must be text.`)
  const normalized = value.trim()
  if (!normalized && !optional) throw new Error(`${label} is required.`)
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`)
  return normalized || null
}

function cleanOrder(value, fallback, label) {
  if (value === undefined || value === null) return fallback
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new Error(`${label} must be a whole number between 0 and 10000.`)
  }
  return value
}

function cleanOptions(value, fieldType, label) {
  if (value === undefined) value = []
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error(`${label} must contain no more than 50 options.`)
  }
  const options = value.map((option, index) =>
    cleanText(option, `${label} option ${index + 1}`, 120),
  )
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
    throw new Error(`${label} cannot contain duplicate options.`)
  }
  if (["select", "multiselect", "radio"].includes(fieldType) && options.length === 0) {
    throw new Error(`${label} needs at least one option.`)
  }
  return options
}

function cleanValidationRules(value, label) {
  if (value === undefined) return {}
  if (!isRecord(value)) throw new Error(`${label} must be an object.`)
  ensureOnlyKeys(
    value,
    new Set(["minLength", "maxLength", "min", "max", "maxFileSizeMb"]),
    label,
  )
  const rules = {}
  for (const key of ["minLength", "maxLength", "min", "max", "maxFileSizeMb"]) {
    if (value[key] === undefined) continue
    const number = Number(value[key])
    if (!Number.isFinite(number) || number < 0 || number > 1000000) {
      throw new Error(`${label}.${key} must be a non-negative number.`)
    }
    rules[key] = number
  }
  if (
    rules.minLength !== undefined &&
    rules.maxLength !== undefined &&
    rules.minLength > rules.maxLength
  ) {
    throw new Error(`${label} minimum length cannot exceed maximum length.`)
  }
  if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) {
    throw new Error(`${label} minimum value cannot exceed maximum value.`)
  }
  return rules
}

export const DEFAULT_REGISTRATION_FORM_DEFINITION = Object.freeze({
  schemaVersion: 1,
  settings: {
    formTitle: "Student Admission Form",
    introText: "Please provide the student's information and parent or guardian details.",
    submitLabel: "Submit application",
    successMessage: "Your application has been received by the school.",
    allowDraftSave: true,
    showProgress: true,
  },
  sections: [
    {
      sectionKey: "student_information",
      title: "Student information",
      description: "Basic information about the student.",
      order: 10,
    },
    {
      sectionKey: "parent_guardian",
      title: "Parent or guardian information",
      description: "Contact details for the student's parent or guardian.",
      order: 20,
    },
    {
      sectionKey: "additional_information",
      title: "Additional information",
      description: "Other information requested by the school.",
      order: 30,
    },
  ],
  fields: [
    {
      fieldKey: "full_name",
      label: "Student's full name",
      type: "text",
      sectionKey: "student_information",
      required: true,
      storage: "standard",
      dataClassification: "standard",
      order: 10,
    },
    {
      fieldKey: "date_of_birth",
      label: "Date of birth",
      type: "date",
      sectionKey: "student_information",
      required: false,
      storage: "standard",
      dataClassification: "sensitive",
      order: 20,
    },
    {
      fieldKey: "previous_school",
      label: "Previous school attended",
      type: "text",
      sectionKey: "student_information",
      required: false,
      storage: "custom",
      dataClassification: "standard",
      order: 30,
    },
    {
      fieldKey: "guardian_name",
      label: "Parent or guardian's full name",
      type: "text",
      sectionKey: "parent_guardian",
      required: true,
      storage: "standard",
      dataClassification: "standard",
      order: 40,
    },
    {
      fieldKey: "guardian_phone",
      label: "Parent or guardian's phone number",
      type: "phone",
      sectionKey: "parent_guardian",
      required: true,
      storage: "standard",
      dataClassification: "sensitive",
      order: 50,
    },
    {
      fieldKey: "home_address",
      label: "Residential address",
      type: "textarea",
      sectionKey: "additional_information",
      required: false,
      storage: "standard",
      dataClassification: "sensitive",
      order: 60,
    },
    {
      fieldKey: "state_of_origin",
      label: "State of origin",
      type: "text",
      sectionKey: "additional_information",
      required: false,
      storage: "standard",
      dataClassification: "standard",
      order: 70,
    },
  ],
})

export function slugifyRegistrationFormName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "student-admission"
}

export function validateRegistrationFormMetadata(body = {}) {
  if (!isRecord(body)) throw new Error("Registration form details must be an object.")
  ensureOnlyKeys(body, new Set(["formName", "formKey", "description"]), "registration form")

  const formName = cleanText(body.formName, "Form name", 160)
  const description = cleanText(body.description, "Description", 1000, { optional: true })
  const formKey = body.formKey === undefined || body.formKey === ""
    ? slugifyRegistrationFormName(formName)
    : cleanText(body.formKey, "Form key", 80)

  if (!/^[a-z][a-z0-9_-]{1,79}$/.test(formKey)) {
    throw new Error("Form key must start with a lowercase letter and contain only lowercase letters, numbers, hyphens or underscores.")
  }

  return { formName, formKey, description }
}

export function validateRegistrationFormDefinition(definition) {
  if (!isRecord(definition)) throw new Error("The form definition must be an object.")
  ensureOnlyKeys(definition, new Set(["schemaVersion", "settings", "sections", "fields"]), "form definition")
  if (definition.schemaVersion !== 1) throw new Error("This registration form schema version is not supported.")
  if (!Array.isArray(definition.sections) || definition.sections.length < 1 || definition.sections.length > 30) {
    throw new Error("A registration form must contain between 1 and 30 sections.")
  }
  if (!Array.isArray(definition.fields) || definition.fields.length < 1 || definition.fields.length > 100) {
    throw new Error("A registration form must contain between 1 and 100 fields.")
  }

  const sections = definition.sections.map((section, index) => {
    if (!isRecord(section)) throw new Error(`Section ${index + 1} must be an object.`)
    ensureOnlyKeys(section, new Set(["sectionKey", "title", "description", "order"]), `section ${index + 1}`)
    const sectionKey = cleanText(section.sectionKey, `Section ${index + 1} key`, 60)
    if (!/^[a-z][a-z0-9_]{1,59}$/.test(sectionKey)) {
      throw new Error(`Section ${index + 1} key must use lowercase letters, numbers and underscores.`)
    }
    return {
      sectionKey,
      title: cleanText(section.title, `Section ${index + 1} title`, 120),
      description: cleanText(section.description, `Section ${index + 1} description`, 500, { optional: true }),
      order: cleanOrder(section.order, (index + 1) * 10, `Section ${index + 1} order`),
    }
  })
  if (new Set(sections.map((section) => section.sectionKey)).size !== sections.length) {
    throw new Error("Section keys must be unique within a form.")
  }
  const sectionKeys = new Set(sections.map((section) => section.sectionKey))

  const fields = definition.fields.map((field, index) => {
    if (!isRecord(field)) throw new Error(`Field ${index + 1} must be an object.`)
    ensureOnlyKeys(
      field,
      new Set([
        "fieldKey", "label", "type", "sectionKey", "required", "storage",
        "dataClassification", "description", "placeholder", "helpText", "options",
        "validationRules", "order",
      ]),
      `field ${index + 1}`,
    )
    const fieldKey = cleanText(field.fieldKey, `Field ${index + 1} key`, 100)
    if (!/^[a-z][a-z0-9_]{0,99}$/.test(fieldKey)) {
      throw new Error(`Field ${index + 1} key must use lowercase letters, numbers and underscores.`)
    }
    const label = cleanText(field.label, `Field ${index + 1} label`, 160)
    const type = cleanText(field.type, `Field ${index + 1} type`, 20)
    if (!supportedFieldTypes.has(type)) throw new Error(`Field ${label} uses an unsupported field type.`)

    const sectionKey = cleanText(field.sectionKey, `Field ${label} section`, 60)
    if (!sectionKeys.has(sectionKey)) throw new Error(`Field ${label} references a section that does not exist.`)

    if (typeof field.required !== "boolean") throw new Error(`Field ${label} must specify whether it is required.`)
    const expectedStorage = Object.hasOwn(standardFieldTypes, fieldKey) ? "standard" : "custom"
    const storage = field.storage === undefined ? expectedStorage : field.storage
    if (!["standard", "custom"].includes(storage)) throw new Error(`Field ${label} has an invalid storage type.`)
    if (storage !== expectedStorage) {
      throw new Error(`Field ${label} has an invalid standard/custom field mapping.`)
    }

    const dataClassification = field.dataClassification || (storage === "standard" ? "standard" : "standard")
    if (!allowedClassifications.has(dataClassification)) {
      throw new Error(`Field ${label} has an invalid data classification.`)
    }
    if (storage === "standard" && fieldKey === "full_name" && type !== "text") {
      throw new Error("The student's full name must use a text field.")
    }
    if (storage === "standard" && fieldKey === "date_of_birth" && type !== "date") {
      throw new Error("Date of birth must use a date field.")
    }

    return {
      fieldKey,
      label,
      type,
      sectionKey,
      required: field.required,
      storage,
      dataClassification,
      description: cleanText(field.description, `Field ${label} description`, 500, { optional: true }),
      placeholder: cleanText(field.placeholder, `Field ${label} placeholder`, 160, { optional: true }),
      helpText: cleanText(field.helpText, `Field ${label} help text`, 500, { optional: true }),
      options: cleanOptions(field.options, type, `Field ${label}`),
      validationRules: cleanValidationRules(field.validationRules, `Field ${label} validation rules`),
      order: cleanOrder(field.order, (index + 1) * 10, `Field ${label} order`),
    }
  })

  if (new Set(fields.map((field) => field.fieldKey)).size !== fields.length) {
    throw new Error("Field keys must be unique within a form.")
  }
  const fullNameField = fields.find((field) => field.fieldKey === "full_name" && field.storage === "standard")
  if (!fullNameField || !fullNameField.required) {
    throw new Error("The standard student's full name field must be included and required.")
  }

  const settingsInput = definition.settings === undefined ? {} : definition.settings
  if (!isRecord(settingsInput)) throw new Error("Form settings must be an object.")
  ensureOnlyKeys(
    settingsInput,
    new Set(["formTitle", "introText", "submitLabel", "successMessage", "allowDraftSave", "showProgress"]),
    "form settings",
  )
  const settings = {
    formTitle: cleanText(settingsInput.formTitle, "Form title", 160, { optional: true }) || "Student Admission Form",
    introText: cleanText(settingsInput.introText, "Introduction", 1000, { optional: true }) || "",
    submitLabel: cleanText(settingsInput.submitLabel, "Submit button label", 60, { optional: true }) || "Submit application",
    successMessage: cleanText(settingsInput.successMessage, "Success message", 500, { optional: true }) || "Your application has been received by the school.",
    allowDraftSave: settingsInput.allowDraftSave === undefined ? true : settingsInput.allowDraftSave,
    showProgress: settingsInput.showProgress === undefined ? true : settingsInput.showProgress,
  }
  if (typeof settings.allowDraftSave !== "boolean" || typeof settings.showProgress !== "boolean") {
    throw new Error("Form draft and progress settings must be true or false.")
  }

  return {
    schemaVersion: 1,
    settings,
    sections: sections.sort((a, b) => a.order - b.order),
    fields: fields.sort((a, b) => a.order - b.order),
  }
}

export function validateCreateRegistrationForm(body = {}) {
  if (!isRecord(body)) throw new Error("Registration form details must be an object.")
  ensureOnlyKeys(body, new Set(["formName", "formKey", "description", "formDefinition"]), "registration form")
  const metadata = validateRegistrationFormMetadata({
    formName: body.formName,
    ...(body.formKey !== undefined ? { formKey: body.formKey } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
  })
  const formDefinition = body.formDefinition === undefined
    ? validateRegistrationFormDefinition(DEFAULT_REGISTRATION_FORM_DEFINITION)
    : validateRegistrationFormDefinition(body.formDefinition)
  return { ...metadata, formDefinition }
}

export function validateSaveRegistrationDraft(body = {}) {
  if (!isRecord(body)) throw new Error("Draft details must be an object.")
  ensureOnlyKeys(body, new Set(["formName", "description", "formDefinition"]), "registration draft")
  if (!Object.hasOwn(body, "formDefinition")) throw new Error("A form definition is required to save a draft.")
  const metadata = {}
  if (Object.hasOwn(body, "formName")) metadata.formName = cleanText(body.formName, "Form name", 160)
  if (Object.hasOwn(body, "description")) metadata.description = cleanText(body.description, "Description", 1000, { optional: true })
  return {
    ...metadata,
    formDefinition: validateRegistrationFormDefinition(body.formDefinition),
  }
}
