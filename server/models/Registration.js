import { supabase } from "../supabase.js"
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from "../registration-validation.js"

const formColumns =
  "id,school_id,form_key,form_name,description,form_purpose,is_default,is_active,created_at,updated_at"
const versionColumns =
  "id,school_id,form_id,version_number,schema_version,status,form_definition,published_at,created_at,updated_at"

function mapForm(row) {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    formKey: row.form_key,
    formName: row.form_name,
    description: row.description,
    purpose: row.form_purpose,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVersion(row) {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    formId: String(row.form_id),
    versionNumber: row.version_number,
    schemaVersion: row.schema_version,
    status: row.status,
    definition: row.form_definition,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function throwIfError(error) {
  if (error) throw error
}

async function findForm(schoolId, formId) {
  const { data, error } = await supabase
    .from("school_registration_forms")
    .select(formColumns)
    .eq("school_id", schoolId)
    .eq("id", formId)
    .maybeSingle()
  throwIfError(error)
  return data
}

export async function listRegistrationForms(schoolId) {
  const { data: forms, error: formsError } = await supabase
    .from("school_registration_forms")
    .select(formColumns)
    .eq("school_id", schoolId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
  throwIfError(formsError)
  if (!forms.length) return []

  const formIds = forms.map((form) => form.id)
  const { data: versions, error: versionsError } = await supabase
    .from("school_registration_form_versions")
    .select(versionColumns)
    .eq("school_id", schoolId)
    .in("form_id", formIds)
    .order("version_number", { ascending: false })
  throwIfError(versionsError)

  const versionsByForm = new Map()
  for (const row of versions) {
    const key = String(row.form_id)
    if (!versionsByForm.has(key)) versionsByForm.set(key, [])
    versionsByForm.get(key).push(mapVersion(row))
  }

  return forms.map((row) => {
    const formVersions = versionsByForm.get(String(row.id)) || []
    return {
      ...mapForm(row),
      latestVersion: formVersions[0] || null,
      publishedVersion: formVersions.find((version) => version.status === "published") || null,
      draftVersion: formVersions.find((version) => version.status === "draft") || null,
      versionCount: formVersions.length,
    }
  })
}

export async function getRegistrationForm(schoolId, formId) {
  const form = await findForm(schoolId, formId)
  if (!form) return null

  const { data: versions, error } = await supabase
    .from("school_registration_form_versions")
    .select(versionColumns)
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .order("version_number", { ascending: false })
  throwIfError(error)

  const mappedVersions = versions.map(mapVersion)
  return {
    ...mapForm(form),
    versions: mappedVersions,
    latestVersion: mappedVersions[0] || null,
    publishedVersion: mappedVersions.find((version) => version.status === "published") || null,
    draftVersion: mappedVersions.find((version) => version.status === "draft") || null,
  }
}

export async function createRegistrationForm({
  schoolId,
  formName,
  formKey,
  description,
  formDefinition,
}) {
  const { data: currentDefault, error: defaultError } = await supabase
    .from("school_registration_forms")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle()
  throwIfError(defaultError)

  const { data: form, error: formError } = await supabase
    .from("school_registration_forms")
    .insert({
      school_id: schoolId,
      form_key: formKey,
      form_name: formName,
      description,
      form_purpose: "student_admission",
      is_default: !currentDefault,
      is_active: true,
    })
    .select(formColumns)
    .single()
  throwIfError(formError)

  const { data: version, error: versionError } = await supabase
    .from("school_registration_form_versions")
    .insert({
      school_id: schoolId,
      form_id: form.id,
      version_number: 1,
      schema_version: 1,
      status: "draft",
      form_definition: formDefinition,
    })
    .select(versionColumns)
    .single()

  if (versionError) {
    const { error: rollbackError } = await supabase
      .from("school_registration_forms")
      .delete()
      .eq("school_id", schoolId)
      .eq("id", form.id)
    if (rollbackError) {
      versionError.rollbackError = rollbackError.message
    }
    throw versionError
  }

  return {
    ...mapForm(form),
    versions: [mapVersion(version)],
    latestVersion: mapVersion(version),
    draftVersion: mapVersion(version),
    publishedVersion: null,
  }
}

export async function ensureDefaultRegistrationForm(schoolId) {
  const { data: defaultForm, error: defaultError } = await supabase
    .from("school_registration_forms")
    .select(formColumns)
    .eq("school_id", schoolId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle()
  throwIfError(defaultError)
  if (defaultForm) return getRegistrationForm(schoolId, String(defaultForm.id))

  const { data: existingForm, error: existingError } = await supabase
    .from("school_registration_forms")
    .select(formColumns)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  throwIfError(existingError)

  if (existingForm) {
    const { error: updateError } = await supabase
      .from("school_registration_forms")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("id", existingForm.id)
    throwIfError(updateError)
    return getRegistrationForm(schoolId, String(existingForm.id))
  }

  try {
    return await createRegistrationForm({
      schoolId,
      formName: "Student Admission Form",
      formKey: "student-admission",
      description: "The school's standard student admission form.",
      formDefinition: JSON.parse(JSON.stringify(DEFAULT_REGISTRATION_FORM_DEFINITION)),
    })
  } catch (error) {
    // Concurrent first visits can race to create the default. Re-read the winner.
    if (error?.code === "23505") {
      const { data: racedDefault, error: racedError } = await supabase
        .from("school_registration_forms")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle()
      throwIfError(racedError)
      if (racedDefault) return getRegistrationForm(schoolId, String(racedDefault.id))
    }
    throw error
  }
}

export async function saveRegistrationFormDraft({
  schoolId,
  formId,
  formName,
  description,
  formDefinition,
}) {
  const form = await findForm(schoolId, formId)
  if (!form || !form.is_active) return null

  const { data: latestVersion, error: latestError } = await supabase
    .from("school_registration_form_versions")
    .select(versionColumns)
    .eq("school_id", schoolId)
    .eq("form_id", formId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  throwIfError(latestError)

  if (!latestVersion) throw new Error("This registration form has no version history.")

  const formUpdates = { updated_at: new Date().toISOString() }
  if (formName !== undefined) formUpdates.form_name = formName
  if (description !== undefined) formUpdates.description = description

  const { data: updatedForm, error: formUpdateError } = await supabase
    .from("school_registration_forms")
    .update(formUpdates)
    .eq("school_id", schoolId)
    .eq("id", formId)
    .select(formColumns)
    .single()
  throwIfError(formUpdateError)

  let savedVersion
  if (latestVersion.status === "draft") {
    const { data, error } = await supabase
      .from("school_registration_form_versions")
      .update({
        form_definition: formDefinition,
        updated_at: new Date().toISOString(),
      })
      .eq("school_id", schoolId)
      .eq("form_id", formId)
      .eq("id", latestVersion.id)
      .eq("status", "draft")
      .select(versionColumns)
      .single()
    throwIfError(error)
    savedVersion = data
  } else {
    const { data, error } = await supabase
      .from("school_registration_form_versions")
      .insert({
        school_id: schoolId,
        form_id: formId,
        version_number: latestVersion.version_number + 1,
        schema_version: 1,
        status: "draft",
        form_definition: formDefinition,
      })
      .select(versionColumns)
      .single()
    throwIfError(error)
    savedVersion = data
  }

  const mappedVersion = mapVersion(savedVersion)
  return {
    ...mapForm(updatedForm),
    latestVersion: mappedVersion,
    draftVersion: mappedVersion,
    publishedVersion: latestVersion.status === "published" ? mapVersion(latestVersion) : null,
  }
}

export async function publishRegistrationFormVersion({ schoolId, formId, versionId }) {
  const { data, error } = await supabase.rpc("publish_school_registration_form", {
    target_school_id: schoolId,
    target_form_id: formId,
    target_version_id: versionId,
  })
  throwIfError(error)
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error("The selected draft could not be published.")
  }
  return getRegistrationForm(schoolId, formId)
}
