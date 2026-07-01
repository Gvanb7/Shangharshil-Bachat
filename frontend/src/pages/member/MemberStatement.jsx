import { useEffect, useState } from 'react'
import MemberLayout from '../../components/MemberLayout'
import api from '../../lib/api'
import { toBS, formatBS } from '../../lib/nepaliDate'
import {
  LuArrowDownLeft, LuArrowUpRight, LuSparkles, LuCircleAlert, LuFilter,
} from 'react-icons/lu'

export default function MemberStatement() {
  const [fiscalYears,  setFiscalYears]  = useState([])
  const [monthOptions, setMonthOptions] = useState([])
  const [filters,      setFilters]      = useState({
    fiscal_year: '', bs_year: '', bs_month: '', type: ''
  })
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetchFiscalYears()
  }, [])

  async function fetchFiscalYears() {
    try {
      const res = await api.get('/fiscal-years/')
      setFiscalYears(res.data.fiscal_years || [])
    } catch {}
  }

  async function fetchMonths(fy) {
    if (!fy) { setMonthOptions([]); return }
    try {
      const res = await api.get(`/fiscal-years/months/?fy=${fy}`)
      setMonthOptions(res.data.months || [])
    } catch { setMonthOptions([]) }
  }

  async function fetchStatement() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.fiscal_year) params.append('fiscal_year', filters.fiscal_year)
      if (filters.bs_month)    params.append('bs_month',    filters.bs_month)
      if (filters.bs_year)     params.append('bs_year',     filters.bs_year)
      if (filters.type)        params.append('type',        filters.type)

      const res = await api.get(`/member/statement/?${params.toString()}`)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load statement.')
    } finally {
      setLoading(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const TYPE_CONFIG = {
    deposit:         { label: 'Deposit',    Icon: LuArrowDownLeft, color: 'bg-emerald-50 text-emerald-700' },
    withdrawal:      { label: 'Withdrawal', Icon: LuArrowUpRight,  color: 'bg-red-50 text-red-700'         },
    interest_credit: { label: 'Interest',   Icon: LuSparkles,      color: 'bg-blue-50 text-blue-700'       },
    penalty:         { label: 'Penalty',    Icon: LuCircleAlert, color: 'bg-amber-50 text-amber-700'     },
  }

  return (
    <MemberLayout>
      <div className="space-y-4">

        <div>
          <h1 className="text-lg font-bold text-gray-800">
            My Statement
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View your savings transaction history
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100
                        shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <LuFilter size={14} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Filters
              </p>
            </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Fiscal year */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fiscal Year
              </label>
              <select
                className="input-field text-sm"
                value={filters.fiscal_year}
                onChange={(e) => {
                  const fy = e.target.value
                  setFilters({ ...filters, fiscal_year: fy, bs_year: '', bs_month: '' })
                  fetchMonths(fy)
                }}>
                <option value="">All years</option>
                {fiscalYears.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Month
              </label>
              <select
                className="input-field text-sm"
                value={filters.bs_month && filters.bs_year
                  ? `${filters.bs_year}-${filters.bs_month}` : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    setFilters({ ...filters, bs_year: '', bs_month: '' })
                    return
                  }
                  const [y, m] = e.target.value.split('-')
                  setFilters({ ...filters, bs_year: y, bs_month: m })
                }}
                disabled={!filters.fiscal_year}>
                <option value="">All months</option>
                {monthOptions.map(m => (
                  <option key={`${m.bs_year}-${m.bs_month}`}
                    value={`${m.bs_year}-${m.bs_month}`}>
                    {m.month_name} {m.bs_year}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Transaction Type
              </label>
              <select
                className="input-field text-sm"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="interest_credit">Interest</option>
                <option value="penalty">Penalty</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchStatement}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600
                       hover:bg-indigo-700 disabled:opacity-50
                       text-white font-medium text-sm transition-colors">
            {loading ? 'Loading...' : 'View statement'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600
                          px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-4">

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Deposits',    value: data.summary.total_deposits,    color: 'text-emerald-600' },
                { label: 'Withdrawals', value: data.summary.total_withdrawals, color: 'text-red-500'     },
                { label: 'Interest',    value: data.summary.total_interest,    color: 'text-blue-600'    },
                { label: 'Penalty',     value: data.summary.total_penalty,     color: 'text-amber-600'   },
              ].map(card => (
                <div key={card.label}
                  className="bg-white rounded-2xl border border-gray-100
                             shadow-sm p-3">
                  <p className="text-xs text-gray-400 font-medium">
                    {card.label}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${card.color}`}>
                    {fmt(card.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-2xl border border-gray-100
                            shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-700">
                  {data.summary.total_rows} transaction
                  {data.summary.total_rows !== 1 ? 's' : ''}
                </p>
              </div>

              {data.rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-400 text-sm">
                  No transactions found.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.rows.map((row, i) => {
                    const config = TYPE_CONFIG[row.type] || {
                      label: row.type_label,
                      Icon: LuArrowDownLeft,
                      color: 'bg-gray-50 text-gray-600',
                    }
                    const TypeIcon = config.Icon

                    return (
                      <div key={i} className="px-4 py-3 flex items-center
                                              justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5
                                        rounded-full font-medium ${config.color}`}
                          >
                            <TxnIcon size={11} />
                            {config.label}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            {row.nepali_date
                              ? formatBS(row.nepali_date)
                              : toBS(row.date_ad)
                            }
                            {row.note && ` · ${row.note}`}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold flex-shrink-0
                          ${row.type === 'withdrawal'
                            ? 'text-red-500'
                            : row.type === 'penalty'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}>
                          {row.type === 'withdrawal' ? '-' : '+'}
                          {fmt(row.amount)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </MemberLayout>
  )
}