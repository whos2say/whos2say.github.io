import { supabase } from '../../../js/supabase.js'
import { STUDIO_PATH, resolveOAuthCallback } from './studio-auth-core.js'

const message = document.getElementById('studio-callback-message')
let callbackComplete = false

function finish(session) {
  if (!session || callbackComplete) return false
  callbackComplete = true
  window.history.replaceState({}, document.title, window.location.pathname)
  window.location.replace(STUDIO_PATH)
  return true
}

async function completeSignIn() {
  const result = await resolveOAuthCallback(supabase, window.location.search)
  if (!finish(result.session) && message) message.textContent = result.error?.message || 'Studio could not establish a session.'
}

supabase.auth.onAuthStateChange((_event, session) => {
  finish(session)
})

completeSignIn().catch((error) => {
  if (message) message.textContent = error?.message || 'The sign-in session could not be confirmed.'
})
