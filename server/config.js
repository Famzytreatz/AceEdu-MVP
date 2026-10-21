import "dotenv/config"

const isProduction = process.env.NODE_ENV === "production"
const supabaseUrl = process.env.SUPABASE_URL?.trim()
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const sessionSecret = process.env.SESSION_SECRET

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Configure them in the server environment.")
}

let parsedSupabaseUrl
try {
  parsedSupabaseUrl = new URL(supabaseUrl)
} catch {
  throw new Error("SUPABASE_URL must be a valid absolute URL.")
}

if (!["http:", "https:"].includes(parsedSupabaseUrl.protocol)) {
  throw new Error("SUPABASE_URL must use HTTP or HTTPS.")
}
if (isProduction && parsedSupabaseUrl.protocol !== "https:") {
  throw new Error("SUPABASE_URL must use HTTPS in production.")
}

if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 bytes.")
}

const appOrigin = process.env.APP_ORIGIN || (isProduction ? "" : "http://localhost:8443")
if (!appOrigin) {
  throw new Error("APP_ORIGIN is required in production.")
}

let allowedOrigin
try {
  allowedOrigin = new URL(appOrigin).origin
} catch {
  throw new Error("APP_ORIGIN must be a valid absolute URL.")
}
if (isProduction && new URL(appOrigin).protocol !== "https:") {
  throw new Error("APP_ORIGIN must use HTTPS in production.")
}

const port = Number.parseInt(process.env.PORT || "3001", 10)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number.")
}

export const config = {
  appOrigin: allowedOrigin,
  isProduction,
  port,
  sessionSecret,
  supabaseServiceRoleKey,
  supabaseUrl: parsedSupabaseUrl.origin,
  trustProxy: process.env.TRUST_PROXY === "true",
}
