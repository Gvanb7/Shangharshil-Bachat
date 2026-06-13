import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

export default function ResetPasswordPage() {
  const navigate             = useNavigate()
  const [searchParams]       = useSearchParams()
  const token                = searchParams.get('token')

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState('')
  const [form,       setForm]       = useState({
    new_password: '', confirm_password: ''
  })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  useEffect(() => {
    validateToken()
  }, [token])

  async function validateToken() {
    if (!token) {
      setValidating(false)
      setTokenValid(false)
      return
    }
    try {
      const res = await api.get(
        `/auth/validate-reset-token/?token=${token}`
      )
      setTokenValid(res.data.valid)
      setTokenEmail(res.data.email || '')
    } catch {
      setTokenValid(false)
    } finally {
      setValidating(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password/', {
        token:            token,
        new_password:     form.new_password,
        confirm_password: form.confirm_password,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900
                    via-primary-700 to-primary-500 flex items-center
                    justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16
                          bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Reset Password
          </h1>
          <p className="text-primary-100 mt-1 text-sm">
            Shangharshil Bachat Samuha
          </p>
        </div>

        <div className="card shadow-2xl">
          <div className="card-body">

            {validating ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Validating reset link...
              </div>

            ) : !tokenValid ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">❌</div>
                <p className="text-sm text-gray-700 font-medium">
                  This reset link is invalid or has expired.
                </p>
                <p className="text-xs text-gray-500">
                  Reset links expire after 15 minutes.
                  Please request a new one.
                </p>
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="btn-primary w-full">
                  Request new reset link
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700">
                  Back to login
                </button>
              </div>

            ) : success ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">✅</div>
                <p className="text-sm text-gray-700 font-medium">
                  Password reset successfully!
                </p>
                <p className="text-xs text-gray-500">
                  You can now log in with your new password.
                </p>
                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="btn-primary w-full">
                  Go to login
                </button>
              </div>

            ) : (
              <>
                {tokenEmail && (
                  <div className="mb-4 px-4 py-3 bg-blue-50 border
                                  border-blue-100 rounded-lg text-sm
                                  text-blue-700">
                    Resetting password for <strong>{tokenEmail}</strong>
                  </div>
                )}

                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border
                                  border-red-200 text-red-700 rounded-lg
                                  text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                      autoFocus
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
                    className="btn-primary w-full">
                    {loading ? 'Resetting...' : 'Reset password'}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}