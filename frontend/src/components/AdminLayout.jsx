import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const NAV_ITEMS = [
  { path: '/admin',             label: 'Dashboard',   icon: '▦' },
  { path: '/admin/members',     label: 'Members',     icon: '👥' },
  { path: '/admin/savings',     label: 'Savings',     icon: '💰' },
  { path: '/admin/loans',       label: 'Loans',       icon: '📋' },
  { path: '/admin/expenditure', label: 'Expenditure', icon: '📊' },
]

export default function AdminLayout({ children }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-primary-900 
                         transition-all duration-300 flex flex-col flex-shrink-0`}>

        {/* Logo */}
        <div className="p-4 border-b border-primary-700 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🏦</span>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-xl leading-tight">
                Shangharshil
              </p>
              <p className="text-primary-400 font-semibold text-xl">Bachat Samuha</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                            transition-colors duration-150 group
                            ${isActive
                              ? 'bg-primary-600 text-white'
                              : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                            }`}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-primary-700">
          {sidebarOpen && (
            <div className="mb-2 px-2">
              <p className="text-white text-xs font-medium truncate">
                {user?.full_name || 'Administrator'}
              </p>
              <p className="text-black text-xs truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                       text-primary-200 hover:bg-red-400 hover:text-white
                       transition-colors duration-150 text-sm">
            <span className="flex-shrink-0">⏻</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3
                           flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none">
            ☰
          </button>
          <h1 className="text-gray-800 font-semibold text-sm">
            {NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'Admin'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge-info">Admin</span>
            <span className="text-sm text-gray-600">
              {user?.full_name || user?.email}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  )
}