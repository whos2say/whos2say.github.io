import { supabase } from './supabase.js'

// Get initial session
const { data: { session } } = await supabase.auth.getSession()
let user = session?.user ?? null

// Listen to auth changes
const authStateListeners = []

supabase.auth.onAuthStateChange((_event, s) => {
  user = s?.user ?? null
  authStateListeners.forEach(fn => fn(user))
})

export function getUser() {
  return user
}

export function onAuthChange(callback) {
  authStateListeners.push(callback)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export function requireAuth() {
  if (!user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `login.html?next=${next}`
    throw new Error('Not authenticated')
  }
}

export function redirectIfAuth(defaultPath = 'index.html') {
  if (user) {
    const params = new URLSearchParams(window.location.search)
    window.location.href = params.get('next') || defaultPath
  }
}
