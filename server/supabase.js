import { createClient } from "@supabase/supabase-js"
import { config } from "./config.js"

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function verifySupabaseConnection() {
  const { error } = await supabase.from("schools").select("id").limit(1)
  if (error) throw error
}
