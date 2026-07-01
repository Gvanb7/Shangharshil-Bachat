import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../lib/api'
import {
  LuHouse, LuBell, LuClipboard, LuUser, LuLogOut, LuMapPin,
  LuPhone, LuMail, LuCalendar, LuBuilding2, LuClock, LuClipboardList,
} from 'react-icons/lu'

const NAV_ITEMS = [
  { path: '/member',           label: 'Home',      Icon: LuHouse },
  { path: '/member/notices',   label: 'Notices',   Icon: LuBell  },
  { path: '/member/statement', label: 'Statement', Icon: LuClipboardList },
  { path: '/member/profile',   label: 'Profile',   Icon: LuUser },
]

export default function MemberLayout({ children }) {
  const navigate              = useNavigate()
  const location              = useLocation()
  const { user, logout }      = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { fetchUnreadCount() }, [])

  async function fetchUnreadCount() {
    try {
      const res = await api.get('/member/notices/unread-count/')
      setUnreadCount(res.data.unread_count || 0)
    } catch {}
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.full_name || user?.email || '?')
    .trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0
                          z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex
                        items-center justify-between">

          <Link to="/member" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex
                            items-center justify-center text-white
                            text-sm font-bold flex-shrink-0">
              स
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-tight
                            truncate">
                Shree Shangharshil Bachat Samuha
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">
                Member Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/member/profile"
              className="hidden sm:flex items-center gap-2 pl-1 pr-3 py-1
                         rounded-full hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex
                              items-center justify-center text-xs
                              font-bold text-indigo-700">
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-700
                               max-w-[140px] truncate">
                {user?.full_name || user?.email}
              </span>
            </Link>
            
             <Link
                to="/member/notices"
                className="relative text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <LuBell size={18} />

                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px]
                                  bg-red-500 text-white text-[9px]
                                  rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            <button
              onClick={handleLogout}
              className="flex items-center text-xs font-medium text-gray-500
                        hover:text-red-600 px-3 py-1.5 rounded-lg
                        hover:bg-red-50 transition-colors"
            >
              <LuLogOut size={14} className="mr-1" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6
                       py-6 pb-24 sm:pb-10">
        {children}
      </main>

      {/* Bottom tab bar — all screens */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white
                      border-t border-gray-200 z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-5xl mx-auto grid grid-cols-4 sm:grid-cols-4
                        sm:max-w-xs sm:mx-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center
                            py-2.5 px-1 transition-colors relative
                  ${isActive
                    ? 'text-indigo-600'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}>
                <span className="relative">
                  <item.Icon size={22} />
                  {item.label === 'Notices' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px]
                                    h-[14px] bg-red-500 text-white text-[9px]
                                    font-bold rounded-full flex items-center
                                    justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2
                                  w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex
                                items-center justify-center text-white
                                text-xs font-bold">
                  स
                </div>
                <p className="text-sm font-bold text-gray-800">
                  Shree Shangharshil Bachat Samuha
                </p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                A community cooperative dedicated to financial
                empowerment through savings and lending.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700
                             uppercase tracking-wide mb-2">
                Contact
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <p className="flex items-center">
                  <LuMapPin size={12} className="mr-2 text-gray-400" />
                  [Address placeholder]
                </p>
                <p className="flex items-center">
                  <LuPhone size={12} className="mr-2 text-gray-400" />
                  [Phone placeholder]
                </p>
                <p className="flex items-center">
                  <LuMail size={12} className="mr-2 text-gray-400" />
                  [Email placeholder]
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700
                             uppercase tracking-wide mb-2">
                Quick Info
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <p className="flex items-center">
                  <LuCalendar size={12} className="mr-2 text-gray-400" />
                  Established: 2073 BS
                </p>
                <p className="flex items-center">
                  <LuBuilding2 size={12} className="mr-2 text-gray-400" />
                  Registered Cooperative
                </p>
                <p className="flex items-center">
                  <LuClock size={12} className="mr-2 text-gray-400" />
                  Office: Sun–Fri, 10am–4pm
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-4 pt-4 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} Shree Shangharshil Bachat Samuha.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}