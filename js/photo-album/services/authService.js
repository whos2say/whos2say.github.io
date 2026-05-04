import { supabase } from '../../supabase.js'
import { PHOTO_ALBUM_CONFIG } from '../config.js'

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user || null
}

export function isAdminUser(user) {
  return user?.email === PHOTO_ALBUM_CONFIG.adminEmail
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function requireUser({ redirectToLogin = true } = {}) {
  const user = await getCurrentUser()
  if (!user && redirectToLogin) {
    const currentUrl = window.location.pathname + window.location.search
    window.location.href = `/login.html?redirect=${encodeURIComponent(currentUrl)}`
  }
  return user
}
