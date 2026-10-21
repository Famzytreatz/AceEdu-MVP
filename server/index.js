import { config } from "./config.js"
import { createApp } from "./app.js"
import { verifySupabaseConnection } from "./supabase.js"

async function start() {
  await verifySupabaseConnection()
  const app = createApp()
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`AceEdu API listening on port ${config.port}`)
  })
}

start().catch((error) => {
  console.error("AceEdu API startup failed:", error.name || "UnknownError", error.code || "")
  process.exitCode = 1
})
