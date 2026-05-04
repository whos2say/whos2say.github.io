import { createPhotoComment, deletePhotoComment, getPhotoComments } from '../../services/commentService.js'
import { escapeHtmlString } from '../../utils/html.js'
import { canDeleteComment } from './permissions.js'

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export function createCommentsController({
  state,
  getCurrentPhotoId,
  showToast,
} = {}) {
  async function loadComments(photoId) {
    const listEl = document.getElementById('lc-list')
    const countEl = document.getElementById('lc-count')
    const formEl = document.getElementById('lc-form')
    const signinEl = document.getElementById('lc-signin')
    if (!listEl) return

    if (state.currentUser) {
      formEl.style.display = 'flex'
      signinEl.style.display = 'none'
      const loginLink = document.getElementById('lc-login-link')
      if (loginLink) loginLink.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
    } else {
      formEl.style.display = 'none'
      signinEl.style.display = 'block'
    }

    listEl.innerHTML = '<div class="lc-loading">Loading…</div>'

    try {
      const { data: comments, error } = await getPhotoComments(photoId)
      if (error) throw error

      countEl.textContent = comments?.length ? `(${comments.length})` : ''
      listEl.innerHTML = ''

      if (!comments || comments.length === 0) {
        listEl.innerHTML = '<div class="lc-empty">No comments yet.</div>'
        return
      }

      comments.forEach(c => listEl.appendChild(buildCommentEl(c)))
      listEl.scrollTop = listEl.scrollHeight
    } catch (err) {
      console.error('loadComments error:', err)
      listEl.innerHTML = '<div class="lc-empty">Could not load comments.</div>'
    }
  }

  function buildCommentEl(comment) {
    const canDel = canDeleteComment(state.currentUser, comment)

    const item = document.createElement('div')
    item.className = 'lc-item'
    item.dataset.commentId = comment.id

    const shortName = escapeHtmlString(comment.user_email.split('@')[0])
    const timeStr = escapeHtmlString(timeAgo(comment.created_at))
    const text = escapeHtmlString(comment.comment)

    item.innerHTML = `
    <div class="lc-item-meta">
      <span class="lc-author">${shortName}</span>
      <span class="lc-time">${timeStr}</span>
    </div>
    <p class="lc-text">${text}</p>
    ${canDel ? `<button class="lc-del" title="Delete comment">✕</button>` : ''}
  `

    if (canDel) {
      item.querySelector('.lc-del').addEventListener('click', () => deleteComment(comment.id, item))
    }
    return item
  }

  async function postComment() {
    const photoId = getCurrentPhotoId()
    if (!state.currentUser || !photoId) return

    const input = document.getElementById('lc-input')
    const submitBtn = document.getElementById('lc-submit')
    const text = input.value.trim()
    if (!text) return

    submitBtn.disabled = true
    try {
      const { error } = await createPhotoComment({
        photoId,
        userId: state.currentUser.id,
        userEmail: state.currentUser.email,
        comment: text,
      })
      if (error) throw error
      input.value = ''
      await loadComments(photoId)
    } catch (err) {
      showToast('Failed to post comment: ' + err.message, true)
    } finally {
      submitBtn.disabled = false
    }
  }

  async function deleteComment(commentId, itemEl) {
    try {
      const { error } = await deletePhotoComment(commentId)
      if (error) throw error
      itemEl.remove()

      const listEl = document.getElementById('lc-list')
      const countEl = document.getElementById('lc-count')
      const remaining = listEl.querySelectorAll('.lc-item').length
      countEl.textContent = remaining ? `(${remaining})` : ''
      if (remaining === 0) listEl.innerHTML = '<div class="lc-empty">No comments yet.</div>'
      showToast('Comment deleted')
    } catch (err) {
      showToast('Delete failed: ' + err.message, true)
    }
  }

  function bindCommentForm() {
    const submitBtn = document.getElementById('lc-submit')
    const inputEl = document.getElementById('lc-input')
    if (submitBtn) submitBtn.addEventListener('click', postComment)
    if (inputEl) {
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          postComment()
        }
      })
    }
  }

  return {
    loadComments,
    buildCommentEl,
    postComment,
    deleteComment,
    bindCommentForm,
  }
}
