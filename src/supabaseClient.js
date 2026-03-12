
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

console.log("Initializing Supabase Client...", {
    url: supabaseUrl ? supabaseUrl.substring(0, 20) + "..." : "MISSING",
    keyLen: supabaseAnonKey ? supabaseAnonKey.length : 0
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase URL or Key is missing. Check your .env file or environment variables.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Separate client with service role for admin tasks like seeding (only if needed, careful with exposure)
// Only expose this if really necessary for client-side seeding in prototype
export const supabaseAdmin = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
    : null
