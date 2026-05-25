import { useEffect, useState } from 'react'
import MemberLayout from '../../components/MemberLayout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import ProfilePicture from '../../components/ProfilePicture'

export default function MemberDashboard() {
  const { user, updateUser } = useAuthStore()
  const [savings, setSavings] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showPwForm,  setShowPwForm]  = useState(false)
  const [pwForm,      setPwForm]      = useState({
    current_password: '', new_password: '', confirm_password: ''
  })
  const [pwErr,       setPwErr]       = useState('')
  const [pwSuccess,   setPwSuccess]   = useState('')
  const [pwLoad,      setPwLoad]      = useState(false)
  const [showPw,      setShowPw]      = useState(false)

  const [editProfile,    setEditProfile]    = useState(false)
  const [profileForm,    setProfileForm]    = useState({
    full_name: '', phone: '', address: ''
    })
  const [profileErr,     setProfileErr]     = useState('')
  const [profileLoad,    setProfileLoad]    = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')

  const [showLoanForm,  setShowLoanForm]  = useState(false)
  const [loanForm,      setLoanForm]      = useState({ principal: '', purpose: '' })
  const [loanFormErr,   setLoanFormErr]   = useState('')
  const [loanFormLoad,  setLoanFormLoad]  = useState(false)
  const [loanSuccess,   setLoanSuccess]   = useState('')
  const [cancelLoad,    setCancelLoad]    = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [savRes, loanRes, profileRes] = await Promise.all([
        api.get('/member/savings/').catch(() => null),
        api.get('/member/loans/').catch(() => null),
        api.get('/auth/me/'),
      ])

      if (savRes) setSavings(savRes.data)
      if (loanRes) setLoans(loanRes.data)
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

  const activeLoans = loans.filter((l) => l.status === 'active')

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
        <div className="bg-white rounded-2xl shadow p-6 flex justify-center"><ProfilePicture /> </div>

        {/* Welcome + Summary */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow">
          <p className="text-sm opacity-80">Welcome back,</p>
          <h1 className="text-2xl font-bold">
            {user?.full_name || user?.email}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5">
            <div className="bg-white/10 p-4 rounded-xl">
              <p className="text-xs opacity-80">Balance</p>
              <p className="text-lg font-semibold">
                {fmt(savings?.account?.balance)}
              </p>
            </div>

            <div className="bg-white/10 p-4 rounded-xl">
              <p className="text-xs opacity-80">Active Loans</p>
              <p className="text-lg font-semibold">
                {activeLoans.length}
              </p>
            </div>

            <div className="bg-white/10 p-4 rounded-xl">
              <p className="text-xs opacity-80">Total Loans</p>
              <p className="text-lg font-semibold">
                {loans.length}
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Savings */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Savings Overview
          </h2>

          {!savings ? (
            <div className="bg-gray-50 p-6 text-center rounded-xl text-gray-400">
              No savings account available
            </div>
          ) : (
            <>
              {/* Balance Card */}
              <div className="bg-green-600 text-white rounded-2xl p-6 shadow mb-4">
                <p className="text-sm opacity-80">Current Balance</p>
                <h2 className="text-3xl font-bold mt-1">
                  {fmt(savings.account.balance)}
                </h2>

                <div className="flex gap-4 mt-3 text-sm opacity-90">
                  <span>{savings.account.interest_rate}% interest</span>
                  <span>
                    {savings.account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Transactions */}
              <div className="bg-white rounded-2xl shadow divide-y">
                <div className="p-4 font-semibold text-gray-700">
                  Recent Transactions
                </div>

                {savings.transactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No transactions yet
                  </div>
                ) : (
                  savings.transactions.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {t.type.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('en-NP')}
                        </p>
                      </div>

                      <p
                        className={`font-semibold ${
                          t.type === 'withdrawal'
                            ? 'text-red-500'
                            : 'text-green-600'
                        }`}
                      >
                        {t.type === 'withdrawal' ? '-' : '+'}
                        {fmt(t.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        {/* Loans section */}
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Loans</h2>
        {/* Only show apply button if no pending application */}
        {!loans.some(l => l.status === 'pending') && (
          <button
            onClick={() => {
              setShowLoanForm(true)
              setLoanFormErr('')
              setLoanForm({ principal: '', purpose: '' })
            }}
            className="btn-primary text-sm">
            Apply for loan
          </button>
        )}
      </div>

      {loanSuccess && (
        <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200
                        text-green-700 rounded-lg text-sm">
          {loanSuccess}
        </div>
      )}

      {loans.length === 0 ? (
        <div className="card px-6 py-8 text-center text-gray-400 text-sm">
          No loans on record. Click "Apply for loan" to get started.
        </div>
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
    </section>

    {/* Loan application modal */}
    {showLoanForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center
                      bg-black bg-opacity-40 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 flex
                          items-center justify-between">
            <h3 className="font-semibold text-gray-800">Apply for loan</h3>
            <button
              onClick={() => setShowLoanForm(false)}
              className="text-gray-400 hover:text-gray-600 text-xl">
              ✕
            </button>
          </div>
          <form onSubmit={handleApplyLoan} className="px-6 py-5 space-y-4">
            {loanFormErr && (
              <div className="px-3 py-2 bg-red-50 border border-red-200
                              text-red-700 rounded-lg text-sm">
                {loanFormErr}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Principal amount (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="input-field"
                placeholder="e.g. 50000"
                value={loanForm.principal}
                onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })}
                required
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Interest rate and term will be set by the administrator.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Describe why you need this loan..."
                value={loanForm.purpose}
                onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-700">
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
                className="btn-primary flex-1">
                {loanFormLoad ? 'Submitting...' : 'Submit application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

        {/* Profile */}
 <section>
  <h2 className="text-lg font-semibold text-gray-800 mb-3">
    Profile
  </h2>

  {profileSuccess && (
    <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200
                    text-green-700 rounded-lg text-sm">
      {profileSuccess}
    </div>
  )}

  <div className="bg-white rounded-2xl shadow overflow-hidden">
    {!editProfile ? (
      <>
        <div className="divide-y divide-gray-100">
          {[
            ['Full name', user?.full_name],
            ['Email',     user?.email],
            ['Phone',     user?.phone],
            ['Address',   user?.address],
          ].map(([label, value]) => (
            <div key={label} className="p-4 flex justify-between items-start gap-4">
              <span className="text-gray-500 text-sm w-24 flex-shrink-0">
                {label}
              </span>
              <span className="text-gray-800 font-medium text-sm text-right">
                {value || (
                  <span className="text-gray-400 italic text-xs">Not set</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
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
            className="btn-secondary text-sm w-full">
            Edit profile
          </button>
        </div>
      </>
    ) : (
      <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
        {profileErr && (
          <div className="px-3 py-2 bg-red-50 border border-red-200
                          text-red-700 rounded-lg text-sm">
            {profileErr}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input-field"
            value={profileForm.full_name}
            onChange={(e) => setProfileForm({
              ...profileForm, full_name: e.target.value
            })}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            className="input-field"
            placeholder="98XXXXXXXX"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({
              ...profileForm, phone: e.target.value
            })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            className="input-field resize-none"
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
            className="btn-primary flex-1">
            {profileLoad ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    )}
  </div>
 </section>


        {/* Security */}
<section>
  <h2 className="text-lg font-semibold text-gray-800 mb-3">
    Security
  </h2>

  <div className="bg-white rounded-2xl shadow">
    {!showPwForm ? (
      <div className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Password</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Change your login password
          </p>
        </div>
        <button
          onClick={() => setShowPwForm(true)}
          className="btn-secondary text-sm hover:bg-slate-400">
          Change password
        </button>
      </div>
    ) : (
      <form onSubmit={handleChangePassword} className="p-5 space-y-4">
        {pwErr && (
          <div className="px-3 py-2 bg-red-50 border border-red-200
                          text-red-700 rounded-lg text-sm">
            {pwErr}
          </div>
        )}
        {pwSuccess && (
          <div className="px-3 py-2 bg-green-50 border border-green-200
                          text-green-700 rounded-lg text-sm">
            {pwSuccess}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current password
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            className="input-field"
            value={pwForm.current_password}
            onChange={(e) => setPwForm({
              ...pwForm, current_password: e.target.value
            })}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            className="input-field"
            placeholder="Min. 8 characters"
            value={pwForm.new_password}
            onChange={(e) => setPwForm({
              ...pwForm, new_password: e.target.value
            })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            className="input-field"
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
          <label htmlFor="showpw" className="text-xs text-gray-500 cursor-pointer">
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
            className="btn-primary flex-1">
            {pwLoad ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </form>
    )}
  </div>
</section>

      </div>

    </MemberLayout>
  )
}

/* Loan Card Component */
function LoanCard({ loan, fmt, onCancel, cancelLoad }) {
  const STATUS_BADGE = {
    pending:  'badge-warning',
    approved: 'badge-info',
    active:   'badge-success',
    closed:   'badge-gray',
    rejected: 'badge-danger',
  }

  const statusColors = {
    pending:  'bg-yellow-50 border-yellow-200',
    approved: 'bg-blue-50  border-blue-200',
    active:   'bg-green-50 border-green-200',
    closed:   'bg-gray-50  border-gray-200',
    rejected: 'bg-red-50   border-red-200',
  }

  const progress = loan.total_payable > 0
    ? (parseFloat(loan.amount_paid) / parseFloat(loan.total_payable)) * 100
    : 0

  return (
    <div className={`rounded-2xl border overflow-hidden
                     ${statusColors[loan.status] || 'bg-white border-gray-200'}`}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between
                      border-b border-inherit">
        <div>
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

      {/* Pending — show cancel option */}
      {loan.status === 'pending' && (
        <div className="px-4 py-3">
          <p className="text-xs text-yellow-700 mb-2">
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

      {/* Rejected */}
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

      {/* Approved — waiting for disbursal */}
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

      {/* Active loan details */}
      {loan.status === 'active' && (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Monthly EMI',  fmt(loan.monthly_installment)],
              ['Amount paid',  fmt(loan.amount_paid)],
              ['Remaining',    fmt(loan.amount_remaining)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
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
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {loan.due_date && (
            <p className="text-xs text-gray-400">
              Due date: <strong>{loan.due_date}</strong>
            </p>
          )}
        </div>
      )}

      {/* Closed loan */}
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