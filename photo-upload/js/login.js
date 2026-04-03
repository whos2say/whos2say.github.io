import { supabase } from './supabase.js'

const form = document.getElementById('auth-form')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const submitBtn = document.getElementById('submit-btn')
const messageEl = document.getElementById('message')
const tabs = document.querySelectorAll('.tab-btn')

let mode = 'login' // 'login' | 'signup'

// Redirect if already signed in
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  const params = new URLSearchParams(window.location.search)
  window.location.href = params.get('next') || 'index.html'
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false') })
    tab.classList.add('active')
    tab.setAttribute('aria-selected', 'true')
    mode = tab.dataset.tab
    submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account'
    passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password'
    clearMessage()
  })
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!email || !password) {
    showMessage('Please enter your email and password.', 'error')
    return
  }

  setLoading(true)
  clearMessage()

  if (mode === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showMessage(error.message, 'error')
      setLoading(false)
    } else {
      const params = new URLSearchParams(window.location.search)
      window.location.href = params.get('next') || 'index.html'
    }
  } else {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      showMessage(error.message, 'error')
      setLoading(false)
    } else {
      showMessage('Account created! Check your email to confirm, then sign in.', 'success')
      setLoading(false)
    }
  }
})

function setLoading(loading) {
  submitBtn.disabled = loading
  submitBtn.textContent = loading
    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
    : (mode === 'login' ? 'Sign In' : 'Create Account')
}

function showMessage(text, type) {
  messageEl.textContent = text
  messageEl.className = `message ${type}`
  messageEl.style.display = 'block'
}

function clearMessage() {
  messageEl.style.display = 'none'
  messageEl.textContent = ''
  messageEl.className = 'message'
}
