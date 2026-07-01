import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import {
  LuLayoutDashboard, LuUsers,
  LuWallet, LuPiggyBank, LuHandshake, LuTrendingUp, LuTrendingDown,
  LuFileSpreadsheet, LuMegaphone, LuUser,LuLogOut, LuX, LuMenu,
} from 'react-icons/lu'

const NAV_ITEMS = [
  { path: '/admin',             label: 'Dashboard',       Icon: LuLayoutDashboard },
  { path: '/admin/members',     label: 'Members',         Icon: LuUsers           },
  { path: '/admin/accounts',    label: 'Manage Accounts', Icon: LuWallet          },
  { path: '/admin/savings',     label: 'Savings',         Icon: LuPiggyBank       },
  { path: '/admin/loans',       label: 'Loans',           Icon: LuHandshake       },
  { path: '/admin/income',      label: 'Income',          Icon: LuTrendingUp      },
  { path: '/admin/expenditure', label: 'Expenditure',     Icon: LuTrendingDown    },
  { path: '/admin/statements',  label: 'Statements',      Icon: LuFileSpreadsheet },
  { path: '/admin/notices',     label: 'Notices',         Icon: LuMegaphone       },
  { path: '/admin/borrowers',   label: 'Borrowers',       Icon: LuUser            },
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
    <div className="min-h-screen bg-slate-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-primary-600 shadow-xl
        flex flex-col transform transition-transform duration-300
        lg:relative lg:translate-x-0 lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="p-5 border-b border-primary-700 flex items-center
                        justify-between">
          <div className="flex items-center gap-3">
            <img src="/Bachat.jpeg" alt="logo"
            className='w-14 h-14 rounded-lg object-contain' />
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
            <LuX size={24} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl
                            transition-all duration-200 
                            border-l-4
                            ${isActive
                              ? "bg-primary-500 border-emerald-300 text-white shadow-md"
                              : "border-transparent text-primary-100 hover:bg-primary-700 hover:border-emerald-400 hover:text-white"
                            }`}>
                <span className="text-base flex-shrink-0"><item.Icon size={20} /></span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="p-4 border-t border-primary-700">
          <div className="mb-2 px-2">
            <p className="text-sm font-semibold text-white ">
              {user?.full_name || 'Administrator'}
            </p>
            <p className="text-xs text-primary-200">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center
            gap-3 px-4 py-3 rounded-xl
            text-primary-100 hover:bg-red-600 hover:text-white
            transition-all duration-200">
            <span className="flex-shrink-0"><LuLogOut size={20} /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 shadow-sm px-4 py-3
                           flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none
                       lg:hidden">
            <LuMenu size={24} />
          </button>
          {/* Desktop toggle */}
          <h1 className="text-gray-800 text-xl font-semibold tracking-tight flex-1">
            {currentPage}
          </h1>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
              Admin</span>
            <span className="text-sm text-gray-600 hidden sm:block truncate max-w-32">
              {user?.full_name || user?.email}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-slate-50 p-6 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  )
}