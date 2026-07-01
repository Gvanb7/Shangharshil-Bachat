import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, AdminRoute, GuestRoute } from './components/ProtectedRoute'
import useAuthStore from './store/authStore'

import LoginPage        from './pages/loginPage'
import AdminDashboard   from './pages/admin/AdminDashboard'
import AdminMembers     from './pages/admin/AdminMembers'
import AdminBorrowers from './pages/admin/AdminBorrowers'
import AdminSavings     from './pages/admin/AdminSavings'
import AdminLoans       from './pages/admin/AdminLoans'
import AdminExpenditure from './pages/admin/AdminExpenditure'
import MemberDashboard  from './pages/member/MemberDashboard'
import AdminIncome      from './pages/admin/AdminIncome'
import AdminAccounts from './pages/admin/AdminAccounts'
import AdminStatements from './pages/admin/AdminStatements'
import ChangePasswordPage  from './pages/ChangePasswordPage'
import ForgotPasswordPage  from './pages/ForgotPasswordPage'
import ResetPasswordPage   from './pages/ResetPasswordPage'
import AdminNotices from './pages/admin/AdminNotices'
import MemberNotices   from './pages/member/MemberNotices'
import MemberStatement from './pages/member/MemberStatement'
import MemberProfile   from './pages/member/MemberProfile'

function RootRedirect() {
  const { isAuth, user } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/member'} replace />
}

function MustChangePasswordRoute({ children }) {
  const { isAuth, mustChangePassword } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  if (!mustChangePassword) return <Navigate to="/member" replace />
  return children
}

function MemberRoute({ children }) {
  const { isAuth, user, mustChangePassword } = useAuthStore()
  if (!isAuth) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (mustChangePassword) return <Navigate to="/change-password" replace />
  return children
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
        <Route path="/admin/income" element={
          <AdminRoute><AdminIncome /></AdminRoute>
        } />
        <Route path="/admin/accounts" element={
          <AdminRoute><AdminAccounts /></AdminRoute>
        } />
        <Route path="/admin/statements" element={
          <AdminRoute><AdminStatements /></AdminRoute>
        } />
        <Route path="/admin/borrowers" element={
          <AdminRoute><AdminBorrowers /></AdminRoute>}
        />
        <Route path="/admin/notices" element={
          <AdminRoute><AdminNotices /></AdminRoute>}
        />
        {/* Member routes */}
        <Route path="/member" element={
          <MemberRoute><MemberDashboard /></MemberRoute>
        } />
        <Route path="/member/notices" element={
          <MemberRoute><MemberNotices /></MemberRoute>
        } />
        <Route path="/member/statement" element={
          <MemberRoute><MemberStatement /></MemberRoute>
        } />
        <Route path="/member/profile" element={
          <MemberRoute><MemberProfile /></MemberRoute>
        } />

        <Route path="/change-password" element={
          <MustChangePasswordRoute>
            <ChangePasswordPage />
          </MustChangePasswordRoute>
        } />

        <Route path="/forgot-password" element={
          <GuestRoute><ForgotPasswordPage /></GuestRoute>
        } />

        <Route path="/reset-password" element={
          <GuestRoute><ResetPasswordPage /></GuestRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}