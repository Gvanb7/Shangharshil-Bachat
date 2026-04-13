import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, AdminRoute, MemberRoute, GuestRoute } from './components/ProtectedRoute'
import useAuthStore from './store/authStore'

import LoginPage        from './pages/loginPage'
import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminMembers     from './pages/admin/AdminMembers'
import AdminSavings     from './pages/admin/AdminSavings'
import AdminLoans       from './pages/admin/AdminLoans'
import AdminExpenditure from './pages/admin/AdminExpenditure'
import MemberDashboard  from './pages/member/MemberDashboard'

function RootRedirect() {
  const { isAuth, user } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/login" element={
          <GuestRoute><LoginPage /></GuestRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <AdminRoute><AdminDashboard /></AdminRoute>
        } />
        <Route path="/admin/members" element={
          <AdminRoute><AdminMembers /></AdminRoute>
        } />
        <Route path="/admin/savings" element={
          <AdminRoute><AdminSavings /></AdminRoute>
        } />
        <Route path="/admin/loans" element={
          <AdminRoute><AdminLoans /></AdminRoute>
        } />
        <Route path="/admin/expenditure" element={
          <AdminRoute><AdminExpenditure /></AdminRoute>
        } />

        {/* Member routes */}
        <Route path="/member" element={
          <MemberRoute><MemberDashboard /></MemberRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}