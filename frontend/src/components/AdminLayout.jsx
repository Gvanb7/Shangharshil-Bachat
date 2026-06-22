import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const NAV_ITEMS = [
  { path: '/admin',             label: 'Dashboard',   icon: '▦' },
  { path: '/admin/members',     label: 'Members',     icon: '👥' },
  { path: '/admin/accounts',    label: 'Manage Accounts',  icon: '🏦' },
  { path: '/admin/savings',     label: 'Savings',     icon: '💰' },
  { path: '/admin/loans',       label: 'Loans',       icon: '📋' },
  { path: '/admin/expenditure', label: 'Expenditure', icon: '📊' },
  { path: '/admin/income',      label:  'Income',     icon: '📈' },
  { path: '/admin/statements', label: 'Statements', icon: '📄' },
  { path: '/admin/borrowers', label: 'Borrowers', icon: '🧑‍💼' },
]

export default function AdminLayout({ children }) {
  const navigate         = useNavigate()
  const location         = useLocation()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const currentPage = NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'Admin'

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 bg-primary-500
        flex flex-col transform transition-transform duration-300
        lg:relative lg:translate-x-0 lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="p-4 border-b border-primary-700 flex items-center
                        justify-between">
          <div className="flex items-center gap-3">
            <img src="/Bachat.jpeg" alt="logo"
            className='w-16 h-16 object-contain' />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">
                Shree Shangharshil Bachat Samuha
              </p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-primary-300 hover:text-white text-xl">
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                            transition-colors duration-150
                            ${isActive
                              ? 'bg-primary-600 text-white'
                              : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                            }`}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-primary-700">
          <div className="mb-2 px-2">
            <p className="text-white text-xs font-medium truncate">
              {user?.full_name || 'Administrator'}
            </p>
            <p className="text-primary-300 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                       text-primary-200 hover:bg-red-700 hover:text-white
                       transition-colors duration-150 text-sm">
            <span className="flex-shrink-0">⏻</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3
                           flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none
                       lg:hidden">
            ☰
          </button>
          {/* Desktop toggle */}
          <h1 className="text-gray-800 font-semibold text-sm flex-1">
            {currentPage}
          </h1>
          <div className="flex items-center gap-2">
            <span className="badge-info hidden sm:inline-flex">Admin</span>
            <span className="text-sm text-gray-600 hidden sm:block truncate max-w-32">
              {user?.full_name || user?.email}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  )
}