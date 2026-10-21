require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", "..", "..", ".env") })

const { verifySupabaseConnection } = require("../../database")
const app = require("../../server")
const PORT = Number.parseInt(process.env.EIS_PORT || "3000", 10)

if (require.main === module) {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be a valid TCP port.")
  }
  verifySupabaseConnection()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`EIS server listening on port ${PORT} with Supabase.`)
      })
    })
    .catch((error) => {
      console.error("EIS server startup failed:", error.code || error.message || "Unknown database error")
      process.exitCode = 1
    })
}

module.exports = app
