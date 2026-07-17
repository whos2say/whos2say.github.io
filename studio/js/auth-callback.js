import { supabase } from '../../../js/supabase.js'

const message = document.getElementById('studio-callback-message')
let redirected = false

function finish(session) {
  if (!session || redirected) return false
  redirected = true
  window.location.replace('/studio/')
  return true
}

async function completeSignIn() {
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('error_description') || params.get('error')
  if (oauthError) {
    if (message) message.textContent = `Sign in was not completed: ${oauthError}`
    return
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    if (message) message.textContent = error.message || 'The sign-in session could not be confirmed.'
    return
  }
  if (!finish(data?.session) && message) {
    message.textContent = 'No active session was found. Return to Studio and try again.'
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  finish(session)
})

completeSignIn().catch((error) => {
  if (message) message.textContent = error?.message || 'The sign-in session could not be confirmed.'
})
