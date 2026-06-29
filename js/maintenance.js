// Maintenance-mode flag helper.
// Reads/writes the `maintenance_enabled` row in Supabase `site_settings`.
// Public read is allowed by RLS; writes are restricted to the admin email.
import { supabase } from '/js/supabase.js'

const KEY = 'maintenance_enabled'
const CACHE = 'wts_maint'

// Returns true (on) / false (off) / null (unknown — e.g. network error).
export async function readFlag() {
  try {
    const { data, error } = await supabase
      .from('site_settings').select('value').eq('key', KEY).maybeSingle()
    if (error) throw error
    const on = data ? data.value === 'true' : false
    try { localStorage.setItem(CACHE, on ? '1' : '0') } catch (e) {}
    return on
  } catch (e) {
    console.warn('[maintenance] read failed:', e.message)
    return null
  }
}

// Admin-only (enforced by RLS). Throws on failure (e.g. not authorized).
export async function writeFlag(on) {
  const { error } = await supabase
    .from('site_settings').update({ value: on ? 'true' : 'false' }).eq('key', KEY)
  if (error) throw error
  try { localStorage.setItem(CACHE, on ? '1' : '0') } catch (e) {}
}

// Reconcile a public page against the live flag.
//   mode 'home'        → if maintenance is ON, send visitors to the maintenance page
//   mode 'maintenance' → if maintenance is OFF, send visitors to the live site
// Fail-open: on unknown (network error) we leave the visitor where they are.
export async function enforce(mode) {
  const on = await readFlag()
  if (on === null) return
  if (mode === 'home' && on) location.replace('/maintenance.html')
  if (mode === 'maintenance' && !on) location.replace('/')
}
