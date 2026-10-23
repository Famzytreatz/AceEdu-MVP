import { config } from "./config.js"

function redact(value) {
  let result = String(value)
  for (const secret of [config.supabaseServiceRoleKey, config.sessionSecret]) {
    if (secret) result = result.replaceAll(secret, "[REDACTED]")
  }
  return result.replace(
    /\b(authorization|cookie|set-cookie|password|access_token|refresh_token|id_token|token|secret|service_role_key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|Bearer\s+)?[^\s,;]+/gi,
    "$1=[REDACTED]",
  )
}

function errorName(error) {
  if (typeof error?.name === "string") return error.name
  const constructorName = error?.constructor?.name
  return constructorName && constructorName !== "Object"
    ? constructorName
    : "UnknownError"
}

function errorDetails(error, depth = 0) {
  if (error === null || typeof error !== "object") {
    return { name: "UnknownError", message: redact(error ?? "No error details.") }
  }

  const details = {
    name: errorName(error),
    message:
      typeof error.message === "string"
        ? redact(error.message)
        : "No error message provided.",
  }
  if (typeof error.code === "string" || typeof error.code === "number") {
    details.code = redact(error.code)
  }
  if (typeof error.status === "string" || typeof error.status === "number") {
    details.status = error.status
  }
  if (!config.isProduction && typeof error.stack === "string") {
    details.stack = redact(error.stack)
  }
  if (depth < 3 && error.cause !== undefined) {
    details.cause = errorDetails(error.cause, depth + 1)
  }
  return details
}

export function logError(context, error, request) {
  const metadata = request
    ? { method: request.method, path: request.path }
    : undefined
  console.error(context, metadata, errorDetails(error))
}
