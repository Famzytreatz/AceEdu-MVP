export function isValidDatabaseId(value) {
  if (typeof value !== "string" && typeof value !== "number") return false
  const id = String(value)
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
}
