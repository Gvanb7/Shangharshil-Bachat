import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function ForgotPasswordPage() {
  const navigate  = useNavigate()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/', {
        email: email.trim().toLowerCase()
      })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.')
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
            <span className="text-3xl">🏦</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Forgot Password
          </h1>
          <p className="text-primary-100 mt-1 text-sm">
            Shangharshil Bachat Samuha
          </p>
        </div>

        <div className="card shadow-2xl">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-800">
              Reset your password
            </h2>
          </div>
          <div className="card-body">

            {sent ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">📧</div>
                <p className="text-sm text-gray-700">
                  If <strong>{email}</strong> is registered,
                  a password reset link has been sent.
                </p>
                <p className="text-xs text-gray-500">
                  The link expires in 15 minutes.
                  Check your inbox (or ask your administrator
                  if you don't receive it).
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full">
                  Back to login
                </button>
              </div>
            ) : (
              <>
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
                      Your email address
                    </label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Enter the email registered by your administrator.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="btn-primary w-full">
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full text-sm text-gray-500
                               hover:text-gray-700">
                    ← Back to login
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