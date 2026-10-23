import bcrypt from "bcryptjs"
import { createPlatformOperator } from "../models/PlatformOperator.js"
import { normalizeEmail } from "../validation.js"

async function main() {
  if (typeof process.env.PLATFORM_OPERATOR_PASSWORD !== "string") {
    throw new Error("Set PLATFORM_OPERATOR_EMAIL and PLATFORM_OPERATOR_PASSWORD in this process.")
  }
  const email = normalizeEmail(process.env.PLATFORM_OPERATOR_EMAIL)
  const password = process.env.PLATFORM_OPERATOR_PASSWORD
  if (Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) {
    throw new Error("The operator password must be between 12 and 72 UTF-8 bytes.")
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await createPlatformOperator(email, passwordHash)
  console.log("Platform operator account created.")
}

main().catch((error) => {
  console.error(`Could not create platform operator: ${error.message}`)
  process.exitCode = 1
})
