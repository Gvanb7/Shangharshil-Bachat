import { useEffect, useState } from 'react'
import MemberLayout from '../../components/MemberLayout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import ProfilePicture from '../../components/ProfilePicture'
import { toBS, formatBS } from '../../lib/nepaliDate'

export default function MemberDashboard() {
  const { user, updateUser } = useAuthStore()
  const [savings, setSavings] = useState(null)
  const [loans,   setLoans]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm,     setPwForm]     = useState({
    current_password: '', new_password: '', confirm_password: ''
  })
  const [pwErr,     setPwErr]     = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoad,    setPwLoad]    = useState(false)
  const [showPw,    setShowPw]    = useState(false)

  const [editProfile,    setEditProfile]    = useState(false)
  const [profileForm,    setProfileForm]    = useState({
    full_name: '', phone: '', address: ''
  })
  const [profileErr,     setProfileErr]     = useState('')
  const [profileLoad,    setProfileLoad]    = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')

  const [showLoanForm, setShowLoanForm] = useState(false)
  const [loanForm,     setLoanForm]     = useState({ principal: '', purpose: '' })
  const [loanFormErr,  setLoanFormErr]  = useState('')
  const [loanFormLoad, setLoanFormLoad] = useState(false)
  const [loanSuccess,  setLoanSuccess]  = useState('')
  const [cancelLoad,   setCancelLoad]   = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [savRes, loanRes, profileRes] = await Promise.all([
        api.get('/member/savings/').catch(() => null),
        api.get('/member/loans/').catch(() => null),
        api.get('/auth/me/'),
      ])
      if (savRes)     setSavings(savRes.data)
      if (loanRes)    setLoans(loanRes.data)
      if (profileRes) updateUser(profileRes.data)
    } catch {
      setError('Failed to load your data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    setProfileErr('')
    setProfileSuccess('')
    setProfileLoad(true)
    try {
      const res = await api.patch('/auth/complete-profile/', profileForm)
      updateUser(res.data)
      setProfileSuccess('Profile updated successfully.')
      setEditProfile(false)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const first = Object.values(data)[0]
        setProfileErr(Array.isArray(first) ? first[0] : first)
      } else {
        setProfileErr('Failed to update profile.')
      }
    } finally {
      setProfileLoad(false)
    }
  }

  async function handleApplyLoan(e) {
    e.preventDefault()
    setLoanFormErr('')
    if (!loanForm.principal || parseFloat(loanForm.principal) <= 0) {
      setLoanFormErr('Enter a valid principal amount.')
      return
    }
    if (!loanForm.purpose.trim()) {
      setLoanFormErr('Purpose is required.')
      return
    }
    setLoanFormLoad(true)
    try {
      await api.post('/member/loans/apply/', loanForm)
      setLoanSuccess('Loan application submitted successfully.')
      setShowLoanForm(false)
      setLoanForm({ principal: '', purpose: '' })
      fetchData()
      setTimeout(() => setLoanSuccess(''), 4000)
    } catch (err) {
      setLoanFormErr(err.response?.data?.error || 'Failed to submit application.')
    } finally {
      setLoanFormLoad(false)
    }
  }

  async function handleCancelLoan(loanId) {
    setCancelLoad(loanId)
    try {
      await api.delete(`/member/loans/${loanId}/cancel/`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel application.')
    } finally {
      setCancelLoad(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwErr('')
    setPwSuccess('')
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwErr('New passwords do not match.')
      return
    }
    if (pwForm.new_password.length < 8) {
      setPwErr('Password must be at least 8 characters.')
      return
    }
    setPwLoad(true)
    try {
      await api.post('/auth/change-password/', pwForm)
      setPwSuccess('Password changed successfully.')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      setShowPwForm(false)
    } catch (err) {
      setPwErr(err.response?.data?.error || 'Failed to change password.')
    } finally {
      setPwLoad(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const activeLoans = loans.filter(l => l.status === 'active')

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="space-y-6">

        {/* ── Profile header card ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100
                        p-5 sm:p-6 flex flex-col sm:flex-row items-center
                        gap-4 sm:gap-5">
          <ProfilePicture />
          <div className="text-center sm:text-left flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase
                          tracking-wide">
              Welcome back
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800
                           truncate">
              {user?.full_name || user?.email}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* ── Summary cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard
            icon="💰"
            label="Savings Balance"
            value={fmt(savings?.account?.balance)}
            accent="emerald"
          />
          <SummaryCard
            icon="📋"
            label="Active Loans"
            value={activeLoans.length}
            accent="blue"
          />
          <SummaryCard
            icon="📁"
            label="Total Loans"
            value={loans.length}
            accent="amber"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600
                          px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ── Savings section ──────────────────────────────────────────── */}
        <Section title="Savings" icon="💰">
          {!savings ? (
            <EmptyState text="No savings account available" />
          ) : (
            <>
              <div className="bg-gradient-to-br from-emerald-700 to-teal-600
                              text-white rounded-2xl p-5 sm:p-6 shadow-sm
                              mb-4">
                <p className="text-xs uppercase tracking-wide text-emerald-100
                              font-medium">
                  Current Balance
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                  {fmt(savings.account.balance)}
                </h2>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Pill>{savings.account.interest_rate}% interest p.a.</Pill>
                  <Pill>
                    {savings.account.is_active ? 'Active account' : 'Inactive'}
                  </Pill>
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-500
                            uppercase tracking-wide mb-2">
                Recent transactions
              </p>

              {savings.transactions.length === 0 ? (
                <EmptyState text="No transactions yet" small />
              ) : (
                <div className="space-y-1.5">
                  {savings.transactions.map((t) => (
                    <div key={t.id}
                      className="flex justify-between items-center
                                 px-4 py-3 rounded-xl bg-gray-50
                                 border border-gray-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800
                                      capitalize">
                          {t.type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {toBS(t.created_at)}
                        </p>
                      </div>
                      <p className={`font-semibold text-sm flex-shrink-0
                        ${t.type === 'withdrawal'
                          ? 'text-red-500' : 'text-emerald-700'}`}>
                        {t.type === 'withdrawal' ? '-' : '+'}{fmt(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Loans section ─────────────────────────────────────────────── */}
        <Section
          title="Loans"
          icon="📋"
          action={
            !loans.some(l => l.status === 'pending') && (
              <button
                onClick={() => {
                  setShowLoanForm(true)
                  setLoanFormErr('')
                  setLoanForm({ principal: '', purpose: '' })
                }}
                className="text-xs font-medium bg-emerald-700
                           hover:bg-emerald-800 text-white px-3 py-1.5
                           rounded-lg transition-colors">
                + Apply for loan
              </button>
            )
          }>

          {loanSuccess && (
            <div className="mb-3 px-4 py-3 bg-emerald-50 border
                            border-emerald-200 text-emerald-700
                            rounded-xl text-sm">
              {loanSuccess}
            </div>
          )}

          {loans.length === 0 ? (
            <EmptyState text='No loans on record. Click "Apply for loan" to get started.' />
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  fmt={fmt}
                  onCancel={handleCancelLoan}
                  cancelLoad={cancelLoad}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Loan application modal */}
        {showLoanForm && (
          <Modal
            title="Apply for loan"
            onClose={() => setShowLoanForm(false)}>
            <form onSubmit={handleApplyLoan} className="space-y-4">
              {loanFormErr && <ErrorBox msg={loanFormErr} />}

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Principal amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="input-field w-full"
                  placeholder="e.g. 50000"
                  value={loanForm.principal}
                  onChange={(e) => setLoanForm({
                    ...loanForm, principal: e.target.value
                  })}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Interest rate and term will be set by the administrator.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input-field w-full resize-none"
                  rows={3}
                  placeholder="Describe why you need this loan..."
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({
                    ...loanForm, purpose: e.target.value
                  })}
                  required
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-100
                              rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-700">
                  ℹ️ Your application will be reviewed by the administrator.
                  You will be notified once approved or rejected.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLoanForm(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanFormLoad}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-700
                             hover:bg-emerald-800 disabled:opacity-50
                             text-white font-medium text-sm
                             transition-colors">
                  {loanFormLoad ? 'Submitting...' : 'Submit application'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Profile section ──────────────────────────────────────────── */}
        <Section title="Profile" icon="👤">
          {profileSuccess && (
            <div className="mb-3 px-4 py-3 bg-emerald-50 border
                            border-emerald-200 text-emerald-700
                            rounded-xl text-sm">
              {profileSuccess}
            </div>
          )}

          {!editProfile ? (
            <>
              <div className="space-y-1.5">
                {[
                  ['Full name', user?.full_name],
                  ['Email',     user?.email],
                  ['Phone',     user?.phone],
                  ['Address',   user?.address],
                ].map(([label, value]) => (
                  <div key={label}
                    className="flex justify-between items-start gap-4
                               px-4 py-2.5 rounded-xl bg-gray-50
                               border border-gray-100">
                    <span className="text-gray-400 text-xs font-medium
                                     uppercase tracking-wide pt-0.5
                                     w-20 flex-shrink-0">
                      {label}
                    </span>
                    <span className="text-gray-800 font-medium text-sm
                                     text-right break-words">
                      {value || (
                        <span className="text-gray-400 italic text-xs">
                          Not set
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setProfileForm({
                    full_name: user?.full_name || '',
                    phone:     user?.phone     || '',
                    address:   user?.address   || '',
                  })
                  setProfileErr('')
                  setProfileSuccess('')
                  setEditProfile(true)
                }}
                className="btn-secondary text-sm w-full mt-3">
                Edit profile
              </button>
            </>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileErr && <ErrorBox msg={profileErr} />}

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({
                    ...profileForm, full_name: e.target.value
                  })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  className="input-field w-full"
                  placeholder="98XXXXXXXX"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({
                    ...profileForm, phone: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Address
                </label>
                <textarea
                  className="input-field w-full resize-none"
                  rows={2}
                  placeholder="Your address"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({
                    ...profileForm, address: e.target.value
                  })}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditProfile(false)
                    setProfileErr('')
                  }}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileLoad}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-700
                             hover:bg-emerald-800 disabled:opacity-50
                             text-white font-medium text-sm
                             transition-colors">
                  {profileLoad ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </Section>

        {/* ── Security section ─────────────────────────────────────────── */}
        <Section title="Security" icon="🔒">
          {!showPwForm ? (
            <div className="flex items-center justify-between gap-4
                            flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-900">Password</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Change your login password
                </p>
              </div>
              <button
                onClick={() => setShowPwForm(true)}
                className="btn-secondary text-sm">
                Change password
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwErr && <ErrorBox msg={pwErr} />}
              {pwSuccess && (
                <div className="px-3 py-2 bg-emerald-50 border
                                border-emerald-200 text-emerald-700
                                rounded-lg text-sm">
                  {pwSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Current password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field w-full"
                  value={pwForm.current_password}
                  onChange={(e) => setPwForm({
                    ...pwForm, current_password: e.target.value
                  })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  New password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field w-full"
                  placeholder="Min. 8 characters"
                  value={pwForm.new_password}
                  onChange={(e) => setPwForm({
                    ...pwForm, new_password: e.target.value
                  })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Confirm new password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field w-full"
                  value={pwForm.confirm_password}
                  onChange={(e) => setPwForm({
                    ...pwForm, confirm_password: e.target.value
                  })}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showpw"
                  checked={showPw}
                  onChange={() => setShowPw(!showPw)}
                  className="cursor-pointer"
                />
                <label htmlFor="showpw"
                  className="text-xs text-gray-500 cursor-pointer">
                  Show passwords
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPwForm(false)
                    setPwErr('')
                    setPwForm({
                      current_password: '',
                      new_password: '',
                      confirm_password: '',
                    })
                  }}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoad}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-700
                             hover:bg-emerald-800 disabled:opacity-50
                             text-white font-medium text-sm
                             transition-colors">
                  {pwLoad ? 'Saving...' : 'Change password'}
                </button>
              </div>
            </form>
          )}
        </Section>

      </div>
    </MemberLayout>
  )
}

// ── Reusable pieces ──────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, accent }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue:    'bg-blue-50 text-blue-700 border-blue-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100
                    p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center
                       text-xl flex-shrink-0 border ${colors[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase
                      tracking-wide truncate">
          {label}
        </p>
        <p className="text-lg font-bold text-gray-800 truncate">
          {value}
        </p>
      </div>
    </div>
  )
}

function Section({ title, icon, action, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border
                        border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-800 flex
                       items-center gap-2">
          <span className="text-lg">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text, small }) {
  return (
    <div className={`text-center text-gray-400 text-sm bg-gray-50
                     rounded-xl border border-gray-100
                     ${small ? 'py-5' : 'py-8'}`}>
      {text}
    </div>
  )
}

function Pill({ children }) {
  return (
    <span className="text-xs font-medium bg-white/15 backdrop-blur
                     px-2.5 py-1 rounded-full">
      {children}
    </span>
  )
}

function ErrorBox({ msg }) {
  return (
    <div className="px-3 py-2 bg-red-50 border border-red-200
                    text-red-700 rounded-lg text-sm">
      {msg}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                      max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex
                        items-center justify-between sticky top-0
                        bg-white z-10">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl
                       leading-none">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Loan Card ────────────────────────────────────────────────────────────────

function LoanCard({ loan, fmt, onCancel, cancelLoad }) {
  const STATUS_BADGE = {
    pending:  'badge-warning',
    approved: 'badge-info',
    active:   'badge-success',
    closed:   'badge-gray',
    rejected: 'badge-danger',
  }

  const STATUS_COLORS = {
    pending:  'bg-amber-50 border-amber-200',
    approved: 'bg-blue-50 border-blue-200',
    active:   'bg-emerald-50 border-emerald-200',
    closed:   'bg-gray-50 border-gray-200',
    rejected: 'bg-red-50 border-red-200',
  }

  const progress = loan.total_payable > 0
    ? (parseFloat(loan.amount_paid) / parseFloat(loan.total_payable)) * 100
    : 0

  return (
    <div className={`rounded-2xl border overflow-hidden
                     ${STATUS_COLORS[loan.status] || 'bg-white border-gray-200'}`}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between
                      border-b border-inherit gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {fmt(loan.principal)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {loan.interest_rate}% p.a. · {loan.term_months} months
          </p>
        </div>
        <span className={STATUS_BADGE[loan.status] || 'badge-gray'}>
          {loan.status}
        </span>
      </div>

      {loan.status === 'pending' && (
        <div className="px-4 py-3">
          <p className="text-xs text-amber-700 mb-2">
            ⏳ Your application is under review by the administrator.
          </p>
          {loan.purpose && (
            <p className="text-xs text-gray-500 mb-3">
              Purpose: {loan.purpose}
            </p>
          )}
          <button
            onClick={() => onCancel(loan.id)}
            disabled={cancelLoad === loan.id}
            className="text-xs text-red-500 hover:text-red-700
                       font-medium underline">
            {cancelLoad === loan.id ? 'Cancelling...' : 'Cancel application'}
          </button>
        </div>
      )}

      {loan.status === 'rejected' && (
        <div className="px-4 py-3">
          <p className="text-xs text-red-600">
            ✗ Your loan application was rejected.
            Contact the administrator for more information.
          </p>
          {loan.purpose && (
            <p className="text-xs text-gray-500 mt-1">
              Purpose: {loan.purpose}
            </p>
          )}
        </div>
      )}

      {loan.status === 'approved' && (
        <div className="px-4 py-3">
          <p className="text-xs text-blue-700">
            ✓ Your loan is approved and will be disbursed soon.
          </p>
          {loan.purpose && (
            <p className="text-xs text-gray-500 mt-1">
              Purpose: {loan.purpose}
            </p>
          )}
        </div>
      )}

      {loan.status === 'active' && (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Monthly EMI', fmt(loan.monthly_installment)],
              ['Amount paid', fmt(loan.amount_paid)],
              ['Remaining',   fmt(loan.amount_remaining)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-800
                              truncate">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Repayment progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {loan.due_date && (
            <p className="text-xs text-gray-400">
              Due date: <strong>{toBS(loan.due_date)}</strong>
            </p>
          )}
        </div>
      )}

      {loan.status === 'closed' && (
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500">
            ✓ This loan has been fully repaid.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Total paid: {fmt(loan.amount_paid)}
          </p>
        </div>
      )}
    </div>
  )
}