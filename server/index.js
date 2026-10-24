import { config } from "./config.js"
import { createApp } from "./app.js"
import { logError } from "./error-logging.js"
import { verifySupabaseConnection } from "./supabase.js"

async function start() {
  await verifySupabaseConnection()
  const app = createApp()
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`AceEdu server listening on port ${config.port}`)
  })
}

start().catch((error) => {
  logError("AceEdu API startup failed:", error)
  process.exitCode = 1
})
