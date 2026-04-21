import { useState, useRef } from 'react'
import useAuthStore from '../store/authStore'
import api from '../lib/api'

const API_BASE = import.meta.env.VITE_API_URL.replace('/api', '')

export default function ProfilePicture() {
  const { user, updateUser } = useAuthStore()
  const fileRef              = useRef(null)

  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const photoUrl = user?.profile_photo
    ? `${API_BASE}${user.profile_photo}`
    : null

  function flash(msg, isError = false) {
    if (isError) {
      setError(msg)
      setTimeout(() => setError(''), 4000)
    } else {
      setSuccess(msg)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    // client side validation
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      flash('Only JPEG, PNG or WebP images allowed.', true)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      flash('Image must be less than 2MB.', true)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('profile_photo', file)

      const res = await api.patch('/auth/profile-picture/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      updateUser(res.data)
      flash('Profile picture updated.')
    } catch (err) {
      flash(err.response?.data?.error || 'Upload failed.', true)
    } finally {
      setLoading(false)
      // reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!window.confirm('Remove your profile picture?')) return
    setLoading(true)
    setError('')
    try {
      await api.delete('/auth/profile-picture/delete/')
      updateUser({ ...user, profile_photo: null })
      flash('Profile picture removed.')
    } catch (err) {
      flash(err.response?.data?.error || 'Failed to remove picture.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">

      {/* Avatar */}
      <div className="relative">
        {photoUrl ? (
  <div className="w-24 h-24 rounded-full border-4 border-white
                  shadow-md overflow-hidden bg-gray-100">
    <img
      src={photoUrl}
      alt="Profile"
      className="w-full h-full object-cover object-center rounded-full"
    />
  </div>
) : (
  <div className="w-24 h-24 rounded-full bg-primary-100
                  border-4 border-white shadow-md
                  flex items-center justify-center">
    <span className="text-3xl text-primary-600 font-bold select-none">
      {user?.full_name?.[0]?.toUpperCase() || '?'}
    </span>
  </div>
)}

        {/* Upload button overlay */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Change photo"
          className="absolute bottom-1 right-1 w-7 h-7 rounded-full
                     bg-primary-600 hover:bg-primary-700
                     text-white flex items-center justify-center
                     shadow-md transition-colors disabled:opacity-50">
          {loading ? (
            <span className="text-xs">...</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Name below avatar */}
      <div className="text-center">
        <p className="font-semibold text-gray-800">
          {user?.full_name || '—'}
        </p>
        <p className="text-xs text-gray-500">{user?.email}</p>
      </div>

      {/* Remove button */}
      {photoUrl && (
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-500 hover:text-red-700
                     disabled:opacity-50 transition-colors">
          Remove photo
        </button>
      )}

      {/* Hint */}
      {!photoUrl && (
        <p className="text-xs text-gray-400 text-center">
          Click the camera button to upload.<br/>
          JPEG, PNG or WebP · Max 2MB
        </p>
      )}

      {/* Messages */}
      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-600 text-center">{success}</p>
      )}

    </div>
  )
}