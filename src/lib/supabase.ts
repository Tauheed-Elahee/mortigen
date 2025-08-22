import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file with your actual Supabase project credentials.'
  )
}

if (supabaseUrl.includes('your_supabase') || supabaseAnonKey.includes('your_supabase') || 
    supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  throw new Error(
    'Please replace the placeholder values in your .env file with your actual Supabase project URL and anon key from your Supabase Dashboard (Project Settings -> API).'
  )
}

// Log connection details for debugging (without exposing sensitive keys)
console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key (first 10 chars):', supabaseAnonKey.substring(0, 10) + '...')
export const supabase = createClient(supabaseUrl, supabaseAnonKey)