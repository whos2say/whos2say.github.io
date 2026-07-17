import { supabase } from '../../js/supabase.js'

const loading = document.getElementById('studio-auth-loading')
const signedOut = document.getElementById('studio-signed-out')
const signedIn = document.getElementById('studio-signed-in')
const email = document.getElementById('studio-user-email')
const message = document.getElementById('studio-auth-message')
const googleButton = document.getElementById('studio-google-sign-in')
const signOutButton = document.getElementById('studio-sign-out')

function showMessage(value) {
  if (!message) return
  message.textContent = value || ''
  message.hidden = !value
}

function renderSession(session) {
  const user = session?.user || null
  if (loading) loading.hidden = true
  if (signedOut) signedOut.hidden = Boolean(user)
  if (signedIn) signedIn.hidden = !user
  if (email) email.textContent = user?.email || 'authenticated user'
}

async function signInWithGoogle() {
  showMessage('')
  if (googleButton) googleButton.disabled = true
  try {
    const redirectTo = new URL('/studio/auth/callback/', window.location.origin).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile',
      },
    })
    if (error) throw error
  } catch (error) {
    showMessage(error?.message || 'Google sign-in could not be started.')
    if (googleButton) googleButton.disabled = false
  }
}

async function signOut() {
  showMessage('')
  if (signOutButton) signOutButton.disabled = true
  const { error } = await supabase.auth.signOut()
  if (signOutButton) signOutButton.disabled = false
  if (error) showMessage(error.message || 'Sign out failed.')
}

async function initialize() {
  const { data, error } = await supabase.auth.getSession()
  if (error) showMessage(error.message || 'Sign-in status is unavailable.')
  renderSession(data?.session || null)
}

if (googleButton) googleButton.addEventListener('click', signInWithGoogle)
if (signOutButton) signOutButton.addEventListener('click', signOut)

supabase.auth.onAuthStateChange((_event, session) => {
  renderSession(session)
})

initialize().catch((error) => {
  renderSession(null)
  showMessage(error?.message || 'Sign-in status is unavailable.')
})
