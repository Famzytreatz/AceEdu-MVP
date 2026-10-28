function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export function validateAcademicYearPayload(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const startsOn = body?.startsOn
  const endsOn = body?.endsOn
  const termCount = Number(body?.termCount)

  if (!name || name.length > 80) {
    throw new Error("Academic year name must contain 1 to 80 characters.")
  }
  if (!validDate(startsOn) || !validDate(endsOn) || endsOn <= startsOn) {
    throw new Error("Enter a valid academic year date range.")
  }
  if (!Number.isInteger(termCount) || termCount < 1 || termCount > 12) {
    throw new Error("Choose between 1 and 12 terms.")
  }

  const days =
    (Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) /
      86400000 +
    1
  if (termCount > days) {
    throw new Error("The academic year is too short for that number of terms.")
  }

  return { name, startsOn, endsOn, termCount }
}

export function validateAcademicName(value, label, maxLength) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new Error(`${label} must contain 1 to ${maxLength} characters.`)
  }
  return value.trim()
}
