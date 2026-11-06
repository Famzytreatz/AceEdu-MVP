export function normalizePhone(value) {
  return value.trim().replace(/[\s().-]/g, "")
}

export function isValidPhone(value) {
  return /^\+?[0-9]{7,20}$/.test(value)
}
