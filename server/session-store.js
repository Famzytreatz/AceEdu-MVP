import session from "express-session"
import { supabase } from "./supabase.js"

function sessionExpiry(sessionData) {
  const expiry = sessionData.cookie?.expires
    ? new Date(sessionData.cookie.expires)
    : new Date(Date.now() + (sessionData.cookie?.maxAge ?? 8 * 60 * 60 * 1000))
  if (!Number.isFinite(expiry.getTime())) throw new Error("Session expiration is invalid.")
  return expiry.toISOString()
}

function complete(operation, callback) {
  operation.then(
    (value) => callback?.(null, value),
    (error) => callback?.(error),
  )
}

async function cleanupExpiredSessions(client, now) {
  const { error } = await client.from("sessions").delete().lte("expire", new Date(now).toISOString())
  if (error) throw error
}

export class SupabaseSessionStore extends session.Store {
  constructor(client = supabase) {
    super()
    this.client = client
    this.lastCleanupAt = 0
  }

  get(sid, callback) {
    complete(
      (async () => {
        const { data, error } = await this.client
          .from("sessions")
          .select("sess")
          .eq("sid", sid)
          .gt("expire", new Date().toISOString())
          .maybeSingle()
        if (error) throw error
        return data?.sess ?? null
      })(),
      callback,
    )
  }

  set(sid, sessionData, callback) {
    complete(
      (async () => {
        const now = Date.now()
        if (now - this.lastCleanupAt > 15 * 60 * 1000) {
          await cleanupExpiredSessions(this.client, now)
          this.lastCleanupAt = now
        }

        const { error } = await this.client.from("sessions").upsert(
          { sid, sess: sessionData, expire: sessionExpiry(sessionData) },
          { onConflict: "sid" },
        )
        if (error) throw error
      })(),
      callback,
    )
  }

  touch(sid, sessionData, callback) {
    complete(
      (async () => {
        const now = Date.now()
        if (now - this.lastCleanupAt > 15 * 60 * 1000) {
          await cleanupExpiredSessions(this.client, now)
          this.lastCleanupAt = now
        }

        const { error } = await this.client
          .from("sessions")
          .update({ expire: sessionExpiry(sessionData) })
          .eq("sid", sid)
        if (error) throw error
      })(),
      callback,
    )
  }

  destroy(sid, callback) {
    complete(
      (async () => {
        const { error } = await this.client.from("sessions").delete().eq("sid", sid)
        if (error) throw error
      })(),
      callback,
    )
  }
}
