import { supabase } from './supabase.js'

const emailInput = document.getElementById('auth-email')
const submitBtn = document.getElementById('auth-submit')
const messageEl = document.getElementById('auth-message')
const authForm = document.getElementById('auth-form')

async function show(msg, isError = false) {
  messageEl.textContent = msg
  messageEl.style.color = isError ? '#ff6b6b' : 'inherit'
  messageEl.style.display = 'block'
}

async function handleSignIn(e) {
  e.preventDefault()
  const email = emailInput.value.trim()
  
  if (!email) {
    show('Please enter a valid email', true)
    return
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'Sending link...'
  
  try {
    // Get redirect target from URL or default to upload
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    const redirectTo = redirectParam 
      ? new URL(redirectParam, window.location.origin).href 
      : window.location.origin + '/upload.html'

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    })

    if (error) throw error

    show('✓ Magic link sent! Check your email and click the link to sign in.')
    emailInput.value = ''
  } catch (err) {
    console.error('Auth error:', err)
    show(err.message || 'Failed to send magic link', true)
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = 'Send Magic Link'
  }
}

// Check if already signed in
async function checkSession() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Already logged in — redirect to upload or specified destination
      const redirectParam = new URLSearchParams(window.location.search).get('redirect')
      const redirectTo = redirectParam 
        ? new URL(redirectParam, window.location.origin).href 
        : '/upload.html'
      window.location.href = redirectTo
    }
  } catch (err) {
    console.error('Session check error:', err)
  }
}

// Set up event listeners
if (authForm) authForm.addEventListener('submit', handleSignIn)

// Run on load
document.addEventListener('DOMContentLoaded', checkSession)
