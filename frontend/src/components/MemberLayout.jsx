import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function MemberLayout({ children }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.full_name || user?.email || '?')
    .trim()
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <header className="bg-gradient-to-r from-emerald-800 to-teal-600
                          text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center
                        justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-3">
              <img
                src="/Bachat.jpeg"
                alt="logo"
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">
                Shree Shangharshil Bachat Samuha
              </p>
              <p className="text-emerald-100 text-[11px] leading-tight">
                Member Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur
                              flex items-center justify-center text-xs
                              font-bold">
                {initials}
              </div>
              <span className="text-sm font-medium max-w-[140px] truncate">
                {user?.full_name || user?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-medium bg-white/10 hover:bg-white/20
                         px-3 py-1.5 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6">
        © {new Date().getFullYear()} Shree Shangharshil Bachat Samuha
      </footer>
    </div>
  )
}