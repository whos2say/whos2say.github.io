import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const SUPABASE_URL = 'https://oiiluqrpzhujbvrblsko.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_BZ6oBk-5wHOMxr_Bw52dvA_7tuU0pHu'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default supabase
