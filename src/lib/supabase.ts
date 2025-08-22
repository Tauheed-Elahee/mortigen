import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.'
  )
}

if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  throw new Error(
    'Please replace the placeholder Supabase credentials in your .env file with your actual project credentials from the Supabase Dashboard.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)