import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function MemberLayout({ children, title }) {
  const navigate       = useNavigate()
  const { user, logout } = useAuthStore()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top header */}
      <header className="bg-primary-900 text-white px-6 py-4
                         flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏦</span>
          <div>
            <p className="font-semibold text-sm leading-tight">
              Shangharshil Bachat Samuha
            </p>
            <p className="text-primary-300 text-xs">Member Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">
              {user?.full_name || 'Member'}
            </p>
            <p className="text-primary-300 text-xs">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-primary-700 hover:bg-red-700
                       px-3 py-1.5 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {title && (
          <h1 className="text-lg font-semibold text-gray-800 mb-4">{title}</h1>
        )}
        {children}
      </main>

    </div>
    
  )
}