import { useEffect, useState } from 'react'
import MemberLayout from '../../components/MemberLayout'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'

export default function MemberDashboard() {
  const { user } = useAuthStore()

  const [savings, setSavings] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [savRes, loanRes] = await Promise.all([
        api.get('/member/savings/').catch(() => null),
        api.get('/member/loans/').catch(() => null),
      ])

      if (savRes) setSavings(savRes.data)
      if (loanRes) setLoans(loanRes.data)
    } catch {
      setError('Failed to load your data.')
    } finally {
      setLoading(false)
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

        {/* 🔥 Welcome + Summary */}
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

        {/* ❌ Error */}
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

        {/* Loans */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Loans
          </h2>

          {loans.length === 0 ? (
            <div className="bg-gray-50 p-6 text-center rounded-xl text-gray-400">
              No loans available
            </div>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} fmt={fmt} />
              ))}
            </div>
          )}
        </section>

        {/* Profile */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Profile
          </h2>

          <div className="bg-blue-100 rounded-2xl shadow divide-y">
            {[
              ['Full Name', user?.full_name],
              ['Email', user?.email],
              ['Phone', user?.phone],
              ['Address', user?.address],
            ].map(([label, value]) => (
              <div key={label} className="p-4 flex justify-between">
                <span className="text-gray-500 text-sm">{label}</span>
                <span className="text-gray-800 font-medium text-sm">
                  {value || '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </MemberLayout>
  )
}

/* Loan Card Component */
function LoanCard({ loan, fmt }) {
  const progress =
    loan.total_payable > 0
      ? (loan.amount_paid / loan.total_payable) * 100
      : 0

  return (
    <div className="bg-gray-200 rounded-2xl shadow p-5 space-y-3">

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">
          {fmt(loan.principal)}
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
          {loan.status}
        </span>
      </div>

      <div className="text-sm text-gray-500">
        {loan.interest_rate}% · {loan.term_months} months
      </div>

      {loan.status === 'active' && (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">EMI</p>
              <p className="font-semibold">
                {fmt(loan.monthly_installment)}
              </p>
            </div>

            <div>
              <p className="text-gray-400 text-xs">Paid</p>
              <p className="font-semibold">
                {fmt(loan.amount_paid)}
              </p>
            </div>

            <div>
              <p className="text-gray-400 text-xs">Remaining</p>
              <p className="font-semibold">
                {fmt(loan.amount_remaining)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(0)}%</span>
            </div>

            <div className="bg-white h-2 rounded-full">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}