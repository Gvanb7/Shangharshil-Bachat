import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login/', {
        email:    email.trim().toLowerCase(),
        password: password,
      })
      
      const { tokens, role, user } = res.data
      setAuth(user, tokens.access, tokens.refresh)
      navigate(role === 'admin' ? '/admin' : '/member', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700
                    to-primary-500 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16
                          bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🏦</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Shangharshil Bachat Samuha
          </h1>
          <p className="text-primary-100 mt-1 text-sm">
            Member Management System
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-800">Sign in</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter your credentials to continue
            </p>
          </div>

          <div className="card-body">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200
                              text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600 text-xs">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full py-2.5">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          © {new Date().getFullYear()} Shangharshil Yuva Bachat Samuha
        </p>

      </div>
    </div>
  )
}