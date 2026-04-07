import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export function ProtectedRoute({ children }) {
  const isAuth = useAuthStore((s) => s.isAuth)
  if (!isAuth) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ children }) {
  const { isAuth, user } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/member" replace />
  return children
}

export function MemberRoute({ children }) {
  const { isAuth, user } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  if (user?.role !== 'member') return <Navigate to="/admin" replace />
  return children
}

export function GuestRoute({ children }) {
  const { isAuth, user } = useAuthStore()
  if (isAuth) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />
  }
  return children
}