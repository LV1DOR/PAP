import { createClient } from '@supabase/supabase-js';

// Reads public environment variables. Ensure they are set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only

if (!supabaseUrl || !supabaseAnonKey) {
  // Warn during development so setup issues are caught early
  console.warn('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Export a singleton public client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let _serviceClient = null;
export function getServiceClient() {
  if (!_serviceClient) {
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Service role client requested but SUPABASE_SERVICE_ROLE_KEY missing');
      return supabase; // fallback to public client
    }
    _serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return _serviceClient;
}

// Simple helper (optional usage later) to get the current session (public client)
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session', error.message);
    return null;
  }
  return data.session;
}
