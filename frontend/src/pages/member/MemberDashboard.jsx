import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MemberLayout from '../../components/MemberLayout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import { toBS, formatBS } from '../../lib/nepaliDate'
import {
  LuClock, LuTrendingUp, LuTrendingDown, LuSparkles, LuFileText,
  LuMegaphone, LuHandshake, LuUser, LuPin, LuCreditCard, 
  LuArrowUpRight, LuArrowDownLeft, LuChevronRight, 
} from 'react-icons/lu'

export default function MemberDashboard() {
  const { user }         = useAuthStore()
  const [savings,        setSavings]        = useState(null)
  const [loans,          setLoans]          = useState([])
  const [notices,        setNotices]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [showLoanModal,  setShowLoanModal]  = useState(false)
  const [loanForm,       setLoanForm]       = useState({ principal: '', purpose: '' })
  const [loanErr,        setLoanErr]        = useState('')
  const [loanLoad,       setLoanLoad]       = useState(false)
  const [loanSuccess,    setLoanSuccess]    = useState('')
  const [cancelLoad,     setCancelLoad]     = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [savRes, loanRes, noticeRes] = await Promise.all([
        api.get('/member/savings/').catch(() => null),
        api.get('/member/loans/').catch(() => null),
        api.get('/member/notices/').catch(() => null),
      ])
      if (savRes)    setSavings(savRes.data)
      if (loanRes)   setLoans(loanRes.data)
      if (noticeRes) setNotices(noticeRes.data.slice(0, 4))
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyLoan(e) {
    e.preventDefault()
    setLoanErr('')
    if (!loanForm.principal || parseFloat(loanForm.principal) <= 0) {
      setLoanErr('Enter a valid amount.')
      return
    }
    if (!loanForm.purpose.trim()) {
      setLoanErr('Purpose is required.')
      return
    }
    setLoanLoad(true)
    try {
      await api.post('/member/loans/apply/', loanForm)
      setLoanSuccess('Loan application submitted successfully.')
      setShowLoanModal(false)
      setLoanForm({ principal: '', purpose: '' })
      fetchData()
      setTimeout(() => setLoanSuccess(''), 4000)
    } catch (err) {
      setLoanErr(err.response?.data?.error || 'Failed to submit.')
    } finally {
      setLoanLoad(false)
    }
  }

  async function handleCancelLoan(loanId) {
    setCancelLoad(loanId)
    try {
      await api.delete(`/member/loans/${loanId}/cancel/`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel.')
    } finally {
      setCancelLoad(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  function getGreeting() {
    const hour = new Date().getHours()

    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    if (hour < 20) return 'Good Evening'
    return 'Good Night'
  }

  const activeLoans   = loans.filter(l => l.status === 'active')
  const closedLoans   = loans.filter(l => l.status === 'closed')
  const pendingLoans  = loans.filter(l => l.status === 'pending')
  const unreadNotices = notices.filter(n => !n.is_read).length

  // total ever borrowed and total ever paid — real stats for this member
  const totalBorrowed = loans.reduce(
    (sum, l) => sum + parseFloat(l.principal || 0), 0
  )
  const totalPaidAllLoans = loans.reduce(
    (sum, l) => sum + parseFloat(l.amount_paid || 0), 0
  )
  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + parseFloat(l.amount_remaining || 0), 0
  )

  const nextEMI = (() => {
    for (const loan of activeLoans) {
      if (loan.due_date && loan.amount_remaining > 0) {
        return { amount: loan.monthly_installment, due_date: loan.due_date }
      }
    }
    return null
  })()

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600
                            border-t-transparent rounded-full animate-spin
                            mx-auto" />
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ══════════════ LEFT COLUMN (2/3) ══════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Welcome hero */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700
                          to-blue-800 rounded-2xl p-6 text-white shadow-lg
                          relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full
                            bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full
                            bg-white/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">
                    {getGreeting()}
                  </p>

                  <h1 className="text-2xl sm:text-3xl font-bold mt-1 leading-tight">
                    {user?.full_name || user?.email}
                  </h1>

                  <p className="text-indigo-300 text-xs mt-1.5">
                    Member since {toBS(user?.date_joined)}
                  </p>
                </div>
              </div>

              {/* Real statistics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatPill label="Savings Balance" value={fmt(savings?.account?.balance)} />
                <StatPill label="Total Borrowed" value={fmt(totalBorrowed)} />
                <StatPill label="Total Repaid" value={fmt(totalPaidAllLoans)} />
                <StatPill
                  label="Outstanding"
                  value={fmt(totalOutstanding)}
                  highlight={totalOutstanding > 0}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600
                            px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          {loanSuccess && (
            <div className="bg-emerald-50 border border-emerald-200
                            text-emerald-700 px-4 py-3 rounded-xl text-sm">
              ✓ {loanSuccess}
            </div>
          )}

          {/* Next EMI reminder */}
          {nextEMI && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl
                            p-4 flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex
                              items-center justify-center text-xl
                              flex-shrink-0">
                <LuClock size={20} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  Next EMI due
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {fmt(nextEMI.amount)} · {toBS(nextEMI.due_date)}
                </p>
              </div>
              <span className="text-xs text-amber-600 font-medium
                               flex-shrink-0">
                Contact admin <LuChevronRight size={14} />
              </span>
            </div>
          )}

          {/* Savings card */}
          {savings ? (
            <section className="bg-white rounded-2xl border border-gray-100
                                shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500
                              to-teal-500 p-5 text-white flex items-center
                              justify-between gap-4">
                <div>
                  <p className="text-emerald-100 text-xs font-semibold
                                 uppercase tracking-wide">
                    Savings Balance
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {fmt(savings.account.balance)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-emerald-100">
                      {savings.account.interest_rate}% p.a.
                    </span>
                    <span className="w-1 h-1 bg-emerald-300 rounded-full" />
                    <span className="text-xs text-emerald-100">
                      {savings.account.is_active ? '✓ Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="text-5xl opacity-20"><LuCreditCard size={48} className="opacity-20" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between
                                px-5 pt-4 pb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase
                                 tracking-wide">
                    Recent Transactions
                  </p>
                  <Link to="/member/statement"
                    className="text-xs text-indigo-600 font-medium
                               hover:text-indigo-700">
                    See all →
                  </Link>
                </div>

                {savings.transactions.length === 0 ? (
                  <div className="px-5 pb-5 text-center text-gray-400
                                  text-sm py-6">
                    No transactions yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {savings.transactions.slice(0, 6).map(t => (
                      <div key={t.id}
                        className="px-5 py-3 flex items-center
                                   justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex
                                           items-center justify-center
                                           text-sm flex-shrink-0
                            ${t.type === 'withdrawal'
                              ? 'bg-red-50'
                              : t.type === 'interest_credit'
                                ? 'bg-blue-50'
                                : 'bg-emerald-50'
                            }`}>
                            {t.type === 'withdrawal' ? <LuArrowUpRight size={16} className="text-red-500" />:
                             t.type === 'interest_credit' ? <LuSparkles size={16} className="text-blue-500" /> : <LuArrowDownLeft size={16} className="text-emerald-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800
                                          capitalize truncate">
                              {t.type.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {toBS(t.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className={`text-sm font-bold flex-shrink-0
                          ${t.type === 'withdrawal'
                            ? 'text-red-500' : 'text-emerald-600'}`}>
                          {t.type === 'withdrawal' ? '-' : '+'}{fmt(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl
                            shadow-sm p-8 text-center">
              <p className="text-4xl mb-2"><LuCreditCard size={40} className="text-gray-300 mx-auto mb-2" /></p>
              <p className="text-sm text-gray-500">
                No savings account yet. Contact your administrator.
              </p>
            </div>
          )}

          {/* Active loans */}
          {activeLoans.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase
                             tracking-wide mb-2.5">
                Active Loans
              </p>
              <div className="space-y-3">
                {activeLoans.map(loan => (
                  <ActiveLoanCard key={loan.id} loan={loan} fmt={fmt} />
                ))}
              </div>
            </section>
          )}

          {/* Pending loan applications */}
          {pendingLoans.map(loan => (
            <div key={loan.id}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs bg-amber-100 text-amber-700
                                   px-2 py-0.5 rounded-full font-medium">
                    Pending
                  </span>
                  <p className="text-sm font-semibold text-gray-800 mt-1.5">
                    {fmt(loan.principal)}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    <LuLoader size={14} className="inline mr-1 text-amber-600" />
                    Application under review by administrator
                  </p>
                </div>
                <button
                  onClick={() => handleCancelLoan(loan.id)}
                  disabled={cancelLoad === loan.id}
                  className="text-xs text-red-500 hover:text-red-700
                             font-medium underline flex-shrink-0">
                  {cancelLoad === loan.id ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          ))}

        </div>

        {/* ══════════════ RIGHT COLUMN (1/3) ══════════════ */}
        <div className="space-y-5">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100
                          shadow-sm p-4">
            <p className="text-xs font-bold text-gray-500 uppercase
                           tracking-wide mb-3">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction Icon={LuFileText} label="Statement" to="/member/statement" />
              <QuickAction Icon={LuMegaphone} label="Notices" to="/member/notices" />
              <QuickAction
                Icon={LuHandshake}
                label="Apply Loan"
                onClick={() => { setShowLoanModal(true); setLoanErr('') }}
                disabled={loans.some(l => l.status === 'pending')}
              />
              <QuickAction Icon={LuUser} label="Profile" to="/member/profile" />
            </div>
          </div>

          {/* Recent notices */}
          <div className="bg-white rounded-2xl border border-gray-100
                          shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4
                            pb-2">
              <p className="text-xs font-bold text-gray-500 uppercase
                             tracking-wide flex items-center gap-1.5">
                Notices
                {unreadNotices > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-[10px]
                                   font-bold px-1.5 py-0.5 rounded-full">
                    {unreadNotices} new
                  </span>
                )}
              </p>
              <Link to="/member/notices"
                className="text-xs text-indigo-600 font-medium
                           hover:text-indigo-700">
                All →
              </Link>
            </div>

            {notices.length === 0 ? (
              <div className="px-4 pb-4 text-center text-gray-400 text-sm
                              py-6">
                No notices yet
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notices.map(notice => (
                  <Link key={notice.id} to="/member/notices"
                    className="block px-4 py-3 hover:bg-gray-50
                               transition-colors">
                    <div className="mb-5">
                      <span className="text-base flex-shrink-0">
                        {notice.is_pinned ? '📌' : '📢'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-800
                                        truncate">
                            {notice.title}
                          </p>
                          {!notice.is_read && (
                            <span className="w-1.5 h-1.5 bg-indigo-500
                                             rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {notice.nepali_date
                            ? formatBS(notice.nepali_date)
                            : notice.published_at}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Apply loan prompt — only if no active/pending */}
          {!loans.some(l => l.status === 'pending') &&
           activeLoans.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-100
                            rounded-2xl p-4">
              <p className="text-sm font-semibold text-indigo-900">
                Need a loan?
              </p>
              <p className="text-xs text-indigo-600 mt-1 leading-relaxed">
                Apply and the administrator will review your request.
              </p>
              <button
                onClick={() => { setShowLoanModal(true); setLoanErr('') }}
                className="w-full mt-3 bg-indigo-600 text-white text-xs
                           font-semibold py-2.5 rounded-xl
                           hover:bg-indigo-700 transition-colors">
                Apply now
              </button>
            </div>
          )}

          {/* Cooperative info strip */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900
                          rounded-2xl p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wide
                          text-slate-300">
              About Us
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Shangharshil Yuva Bachat Samuha is a community-driven
              cooperative helping members build savings discipline and
              access fair loans since 2073 BS.
            </p>
          </div>

        </div>
      </div>

      {/* ── Loan application modal ────────────────────────────────── */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center
                        justify-center bg-black bg-opacity-40 px-4 pb-4
                        sm:pb-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex
                            items-center justify-between">
              <h3 className="font-semibold text-gray-800">Apply for loan</h3>
              <button onClick={() => setShowLoanModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <form onSubmit={handleApplyLoan} className="px-5 py-4 space-y-4">
              {loanErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {loanErr}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Principal amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="1"
                  className="input-field w-full"
                  placeholder="e.g. 50000"
                  value={loanForm.principal}
                  onChange={(e) => setLoanForm({
                    ...loanForm, principal: e.target.value
                  })}
                  required autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Interest rate and term will be set by administrator.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1.5">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input-field w-full resize-none" rows={3}
                  placeholder="Why do you need this loan?"
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({
                    ...loanForm, purpose: e.target.value
                  })}
                  required
                />
              </div>
              <div className="bg-indigo-50 border border-indigo-100
                              rounded-xl px-4 py-3">
                <p className="text-xs text-indigo-700">
                  ℹ️ Your application will be reviewed by the administrator.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowLoanModal(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loanLoad}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600
                             hover:bg-indigo-700 text-white font-medium
                             text-sm disabled:opacity-50">
                  {loanLoad ? 'Submitting...' : 'Submit application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </MemberLayout>
  )
}

// ── Reusable components ───────────────────────────────────────────────────────

function StatPill({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-amber-400/20' : 'bg-white/10'}`}>
      <p className="text-indigo-200 text-[10px] font-medium uppercase
                    tracking-wide leading-none truncate">
        {label}
      </p>
      <p className="text-sm font-bold mt-1.5 leading-none truncate">
        {value}
      </p>
    </div>
  )
}

function QuickAction({ Icon, label, to, onClick, disabled }) {
  const content = (
    <>
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center
                      justify-center group-hover:bg-indigo-100
                      transition-colors">
        <Icon size={20} className="text-indigo-600" />
      </div>
      <span className="text-[11px] font-medium text-gray-600 text-center
                       leading-tight">
        {label}
      </span>
    </>
  )

  const className = `group flex flex-col items-center justify-center
                      bg-gray-50 hover:bg-indigo-50/50 border border-gray-100
                      hover:border-indigo-200 rounded-xl py-3.5 px-2
                      transition-all gap-2
                      disabled:opacity-50 disabled:cursor-not-allowed`

  if (to) return <Link to={to} className={className}>{content}</Link>
  return <button onClick={onClick} disabled={disabled} className={className}>{content}</button>
}

function ActiveLoanCard({ loan, fmt }) {
  const progress = loan.total_payable > 0
    ? (parseFloat(loan.amount_paid) / parseFloat(loan.total_payable)) * 100
    : 0

  return (
    <div className="bg-white border border-gray-100 rounded-2xl
                    shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center
                      justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">
            {fmt(loan.principal)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {loan.interest_rate}% p.a. · {loan.term_months} months
          </p>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5
                         py-1 rounded-full font-medium">
          Active
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ['Monthly EMI', fmt(loan.monthly_installment), 'text-indigo-600'],
            ['Paid',        fmt(loan.amount_paid),         'text-emerald-600'],
            ['Remaining',   fmt(loan.amount_remaining),    'text-red-500'],
          ].map(([label, val, color]) => (
            <div key={label}
              className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase
                            truncate">
                {label}
              </p>
              <p className={`text-xs font-bold mt-1 ${color}`}>{val}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Repayment progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {loan.due_date && (
          <p className="text-xs text-gray-400">
            Next due: <strong className="text-gray-600">
              {toBS(loan.due_date)}
            </strong>
          </p>
        )}
      </div>
    </div>
  )
}