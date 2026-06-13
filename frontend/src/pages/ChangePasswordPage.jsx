import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../lib/api'

export default function ChangePasswordPage() {
  const navigate              = useNavigate()
  const { user, logout,
          clearMustChangePassword } = useAuthStore()

  const [form,    setForm]    = useState({
    current_password: '', new_password: '', confirm_password: ''
  })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.new_password !== form.confirm_password) {
      setError('New passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.current_password === form.new_password) {
      setError('New password must be different from your current password.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password/', form)
      clearMustChangePassword()
      navigate('/member', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900
                    via-primary-700 to-primary-500 flex items-center
                    justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16
                          bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Change Your Password
          </h1>
          <p className="text-primary-100 mt-1 text-sm">
            You must change your password before continuing.
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl">
          <div className="card-header">
            <p className="text-sm text-gray-700">
              Hi <strong>{user?.full_name || user?.email}</strong>, your
              account was created by the administrator with a temporary
              password. Please set a new secure password to continue.
            </p>
          </div>
          <div className="card-body">

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200
                              text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Current (temporary) password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  value={form.current_password}
                  onChange={(e) => setForm({
                    ...form, current_password: e.target.value
                  })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  New password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Min. 8 characters"
                  value={form.new_password}
                  onChange={(e) => setForm({
                    ...form, new_password: e.target.value
                  })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Confirm new password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  value={form.confirm_password}
                  onChange={(e) => setForm({
                    ...form, confirm_password: e.target.value
                  })}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showpw"
                  checked={showPw}
                  onChange={() => setShowPw(!showPw)}
                  className="cursor-pointer"
                />
                <label htmlFor="showpw"
                  className="text-xs text-gray-500 cursor-pointer">
                  Show passwords
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5">
                {loading ? 'Saving...' : 'Set new password & continue'}
              </button>
            </form>

          </div>
        </div>

        {/* Logout option */}
        <p className="text-center text-primary-200 text-xs mt-4">
          Wrong account?{' '}
          <button
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            className="underline hover:text-white">
            Sign out
          </button>
        </p>

      </div>
    </div>
  )
}