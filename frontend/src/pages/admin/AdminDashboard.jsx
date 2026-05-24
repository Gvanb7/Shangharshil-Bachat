import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import StatCard    from '../../components/StatCard'
import api         from '../../lib/api'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function loadStats() {
      try {
        const [membersRes, savingsRes, loansRes, expendRes, incomeRes] = await Promise.all([
          api.get('/admin/members/'),
          api.get('/savings/'),
          api.get('/loans/'),
          api.get('/expenditures/'),
          api.get('/income/'),
        ])

        const members      = membersRes.data
        const savings      = savingsRes.data
        const loans        = loansRes.data
        const expenditures = expendRes.data
        const incomes      = incomeRes.data

        const totalSavings = savings.reduce(
          (sum, a) => sum + parseFloat(a.balance || 0), 0
        )
        const activeLoans = loans.filter(l => l.status === 'active')
        const totalLoaned = activeLoans.reduce(
          (sum, l) => sum + parseFloat(l.principal || 0), 0
        )
        const totalExpend = expenditures.reduce(
          (sum, e) => sum + parseFloat(e.amount || 0), 0
        )
        const totalIncome = incomes.reduce(
          (sum, i) => sum + parseFloat(i.amount || 0), 0
        )
        const pendingLoans = loans.filter(l => l.status === 'pending').length

        setStats({
          totalMembers:  members.length,
          activeMembers: members.filter(m => m.is_active).length,
          totalSavings,
          totalLoaned,
          activeLoans:   activeLoans.length,
          pendingLoans,
          totalExpend,
          totalIncome,
          recentMembers: members.slice(0, 5),
          recentLoans:   loans.slice(0, 5),
        })
      } catch (err) {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  function fmt(amount) {
    return `Rs. ${parseFloat(amount).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const loanStatusBadge = {
    pending:  'badge-warning',
    approved: 'badge-info',
    active:   'badge-success',
    closed:   'badge-gray',
    rejected: 'badge-danger',
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    </AdminLayout>
  )

  if (error) return (
    <AdminLayout>
      <div className="bg-red-50 border border-red-200 text-red-700
                      rounded-lg px-4 py-3 text-sm">{error}</div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            label="Total members"
            value={stats.totalMembers}
            sub={`${stats.activeMembers} active`}
            color="blue"
          />
          <StatCard
            label="Total savings"
            value={fmt(stats.totalSavings)}
            sub="across all accounts"
            color="green"
          />
          <StatCard
            label="Active loans"
            value={stats.activeLoans}
            sub={fmt(stats.totalLoaned) + ' disbursed'}
            color="yellow"
          />
          <StatCard
            label="Total income"
            value={fmt(stats.totalIncome)}
            sub="all time"
            color="green"
          />
          <StatCard
            label="Total expenditure"
            value={fmt(stats.totalExpend)}
            sub="all time"
            color="red"
          />
        </div>

        {/* Pending loans alert */}
        {stats.pendingLoans > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg
                          px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <span>⚠</span>
              <span>
                <strong>{stats.pendingLoans}</strong> loan
                {stats.pendingLoans > 1 ? 's' : ''} pending approval
              </span>
            </div>
            <button
              onClick={() => navigate('/admin/loans')}
              className="text-xs font-medium text-yellow-700
                         hover:text-yellow-900 underline">
              Review →
            </button>
          </div>
        )}

        {/* Two column tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent members */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">
                Recent members
              </h2>
              <button
                onClick={() => navigate('/admin/members')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {stats.recentMembers.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No members yet
                </div>
              ) : stats.recentMembers.map((m) => (
                <div key={m.id}
                  className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {m.full_name || '—'}
                    </p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <span className={m.is_active ? 'badge-success' : 'badge-danger'}>
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent loans */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">
                Recent loans
              </h2>
              <button
                onClick={() => navigate('/admin/loans')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {stats.recentLoans.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No loans yet
                </div>
              ) : stats.recentLoans.map((l) => (
                <div key={l.id}
                  className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {l.member_name || '—'}
                    </p>
                    <p className="text-xs text-gray-500">{fmt(l.principal)}</p>
                  </div>
                  <span className={loanStatusBadge[l.status] || 'badge-gray'}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  )
}