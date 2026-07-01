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

      const { tokens, role, user, must_change_password } = res.data
      setAuth(user, tokens.access, tokens.refresh, must_change_password)

      if (must_change_password && role === 'member') {
        navigate('/change-password', { replace: true })
      } else if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/member', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">

      {/* ── Left panel — branding / info (hidden on mobile) ────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-visible
                bg-gradient-to-br from-emerald-800 via-emerald-700
                to-teal-600">

        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full
                        bg-white/5"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full
                        bg-white/5 -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute top-1/3 left-1/4 w-40 h-40 rounded-full
                        bg-emerald-400/10"></div>

        <div className="relative z-10 flex flex-col justify-between
                        px-12 py-12 text-white w-full">

          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur
                              flex items-center justify-center flex-shrink-0
                              overflow-hidden">
                <img
                  src="/Bachat.jpeg"
                  alt="Shangharshil Yuva Bachat Samuha Logo"
                  className="w-10 h-10 object-contain"
                />
              </div>

              <div>
                <p className="font-bold text-lg leading-tight">
                  Shree Shangharshil
                </p>
                <p className="font-bold text-lg leading-tight">
                  Bachat Samuha
                </p>
              </div>
            </div>
            <p className="text-emerald-100 text-sm mt-1">
              श्री संघर्षशील बचत समूह
            </p>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Saving together,<br />growing together.
            </h1>
            <p className="text-emerald-100 text-base leading-relaxed">
              A community-driven cooperative helping members build
              savings discipline, access fair loans, and achieve
              financial independence — one deposit at a time.
            </p>

            <div className="mt-8 space-y-3">
              {[
                ['💰', 'Track your savings & monthly interest'],
                ['📋', 'Apply for loans and view repayment schedules'],
                ['📅', 'Everything runs on the Nepali (BS) calendar'],
                ['🔒', 'Secure, role-based access for members & admin'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-white/10
                                   flex items-center justify-center
                                   text-lg flex-shrink-0">
                    {icon}
                  </span>
                  <span className="text-sm text-emerald-50">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-emerald-200 text-xs">
            © {new Date().getFullYear()} Shree Shangharshil Bachat Samuha ·
            All rights reserved
          </p>
          {/* S-shaped divider */}
          <div className="absolute top-0 -right-32 h-full w-64 z-20 pointer-events-none">
            <svg
              viewBox="0 0 200 1000"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <path
                d="
                  M0,0
                  C170,80 170,220 60,320
                  C-40,420 -40,580 60,680
                  C170,780 170,920 0,1000
                  L0,1000
                  L0,0
                  Z
                "
                fill="#ffffff"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Mobile top banner (visible only on small screens) ───────────── */}
      <div className="lg:hidden bg-gradient-to-r from-emerald-800 to-teal-600 
                text-white px-6 py-8 text-center">
        <div className="flex flex-col items-center justify-center gap-3">  {/* Added flex-col, justify-center */}
          <img src="/Bachat.jpeg" alt="logo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Shree Shangharshil Bachat Samuha
            </h1>
            <p className="text-emerald-100 text-xs mt-1">
              श्री संघर्षशील बचत समूह
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center
                bg-slate-50 px-4 sm:px-6 py-8 sm:py-12
                relative z-10">
        <div className="w-full max-w-sm">

          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to access your account
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200
                            text-red-700 rounded-lg text-sm break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium
                                text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                className="input-field w-full"
                placeholder="your@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5
                              gap-2 flex-wrap">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-emerald-700 hover:text-emerald-800
                             font-medium whitespace-nowrap">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field w-full pr-12"
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
                             text-gray-400 hover:text-gray-600 text-xs
                             font-medium">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-lg bg-emerald-700
                         hover:bg-emerald-800 disabled:opacity-50
                         disabled:cursor-not-allowed text-white font-medium
                         text-sm transition-colors shadow-sm">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 px-4 py-3 bg-emerald-50 border
                          border-emerald-100 rounded-lg">
            <p className="text-xs text-emerald-800 leading-relaxed">
              <span className="font-semibold">New member?</span>{' '}
              Your account is created by the administrator. Use the
              email and temporary password shared with you — you'll
              be asked to set a new password on first login.
            </p>
          </div>

          <p className="text-center text-gray-400 text-xs mt-6 sm:mt-8">
            © {new Date().getFullYear()} Shree Shangharshil Bachat Samuha
          </p>

        </div>
      </div>

    </div>
  )
}