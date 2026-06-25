import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import { toBS } from '../../lib/nepaliDate'
import BSDatePicker from '../../components/BSDatePicker'
import useAccounts from '../../hooks/useAccounts'
import FiscalYearDatePicker from '../../components/FiscalYearDatePicker'
import EditTransactionModal from '../../components/EditTransactionModels'

const EMPTY_ACCOUNT_FORM = { member_id: '', interest_rate: '6.00' }
const EMPTY_TXN_FORM = { fiscal_year: '',amount: '', note: '', account_id: '', nepali_date: '' }

export default function AdminSavings() {
  const [savingsAccounts, setSavingsAccounts] = useState([])  // renamed to avoid conflict
  const [members,         setMembers]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [successMsg,      setSuccessMsg]       = useState('')
  const [showInterestModal, setShowInterestModal] = useState(false)
  const [interestResult,    setInterestResult]    = useState(null)
  const [showPenalty, setShowPenalty] = useState(false) 
  const [penaltyForm, setPenaltyForm] = useState({
  amount: '', account_id: '', nepali_date: '', reason: '', fiscal_year: ''
  })
  const [penaltyErr,  setPenaltyErr]  = useState('')
  const [penaltyLoad, setPenaltyLoad] = useState(false)

  const [selected,   setSelected]   = useState(null)
  const [txns,       setTxns]       = useState([])
  const [txnLoading, setTxnLoading] = useState(false)

  const [showCreate,   setShowCreate]   = useState(false)
  const [showDeposit,  setShowDeposit]  = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [txnForm,     setTxnForm]     = useState(EMPTY_TXN_FORM)
  const [formErr,     setFormErr]     = useState('')
  const [formLoad,    setFormLoad]    = useState(false)

  const [search,       setSearch]       = useState('')
  const [interestLoad, setInterestLoad] = useState(false)

  const [editTxn,     setEditTxn]     = useState(null)  // {transaction, type}

  const [showReverseInterest,  setShowReverseInterest]  = useState(false)
  const [reverseForm,          setReverseForm]           = useState({
    fiscal_year: '', bs_year: '', bs_month: ''
  })
  const [reverseLoad,  setReverseLoad]  = useState(false)
  const [reverseErr,   setReverseErr]   = useState('')
  const [reverseMsg,   setReverseMsg]   = useState('')
  const [revMonthOpts, setRevMonthOpts] = useState([])

  // cash/bank accounts from useAccounts hook
  const { accounts: cashAccounts } = useAccounts()

  // ── report tab state ──────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('accounts')  // 'accounts' | 'report'

  const [reportFilters, setReportFilters] = useState({
    member_id:   '',
    fiscal_year: '',
    bs_year:     '',
    bs_month:    '',
    type:        '',
  })
  const [reportData,    setReportData]    = useState(null)
  const [reportLoad,    setReportLoad]    = useState(false)
  const [reportErr,     setReportErr]     = useState('')

  const [fiscalYears,   setFiscalYears]   = useState([])
  const [monthOptions,  setMonthOptions]  = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [accRes, memRes] = await Promise.all([
        api.get('/savings/'),
        api.get('/admin/members/'),
      ])
      setSavingsAccounts(accRes.data)
      setMembers(memRes.data.filter(m => m.is_active))
    } catch {
      setError('Failed to load savings data.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTxns(accountId) {
    setTxnLoading(true)
    try {
      const res = await api.get(`/savings/${accountId}/transactions/`)
      setTxns(res.data)
    } catch {
      setTxns([])
    } finally {
      setTxnLoading(false)
    }
  }

  useEffect(() => {
    fetchFiscalYears()
  }, [])

  async function fetchFiscalYears() {
    try {
      const res = await api.get('/fiscal-years/')
      setFiscalYears(res.data.fiscal_years || [])
    } catch {}
  }

  async function fetchMonthsForFY(fy) {
    if (!fy) { setMonthOptions([]); return }
    try {
      const res = await api.get(`/fiscal-years/months/?fy=${fy}`)
      setMonthOptions(res.data.months || [])
    } catch { setMonthOptions([]) }
  }

  async function fetchReport() {
    setReportLoad(true)
    setReportErr('')
    try {
      const params = new URLSearchParams()
      if (reportFilters.member_id)   params.append('member',       reportFilters.member_id)
      if (reportFilters.fiscal_year) params.append('fiscal_year',  reportFilters.fiscal_year)
      if (reportFilters.bs_month)    params.append('bs_month',     reportFilters.bs_month)
      if (reportFilters.bs_year)     params.append('bs_year',      reportFilters.bs_year)
      if (reportFilters.type)        params.append('type',         reportFilters.type)

      const res = await api.get(`/savings/report/?${params.toString()}`)
      setReportData(res.data)
    } catch (err) {
      setReportErr(err.response?.data?.error || 'Failed to load report.')
    } finally {
      setReportLoad(false)
    }
  }

  async function handleDownloadSavingsExcel() {
    if (!reportData) return
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()
      const rows = buildSavingsExcelRows(reportData)
      const ws   = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [
        { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Savings Report')
      XLSX.writeFile(wb, `savings_report.xlsx`)
    } catch {
      setReportErr('Failed to download.')
    }
  }

  function buildSavingsExcelRows(data) {
    const f = (n) => parseFloat(n || 0).toFixed(2)
    const rows = []
    rows.push(['Shree SHANGHARSHIL BACHAT SAMUHA', '', '', '', ''])
    rows.push(['Savings Report', '', '', '', ''])
    if (data.filters.fiscal_year) rows.push([`Fiscal Year: ${data.filters.fiscal_year}`, '', '', '', ''])
    rows.push(['', '', '', '', ''])
    rows.push(['Date (BS)', 'Member', 'Type', 'Amount (Rs.)', 'Note'])
    rows.push(['', '', '', '', ''])

    for (const r of data.rows) {
      rows.push([
        r.nepali_date ? formatBS(r.nepali_date) : toBS(r.date_ad),
        r.member_name,
        r.type_label,
        f(r.amount),
        r.note || '',
      ])
    }

    rows.push(['', '', '', '', ''])
    rows.push(['SUMMARY', '', '', '', ''])
    rows.push(['Total Deposits',    '', '', f(data.summary.total_deposits),    ''])
    rows.push(['Total Withdrawals', '', '', f(data.summary.total_withdrawals), ''])
    rows.push(['Total Interest',    '', '', f(data.summary.total_interest),    ''])
    rows.push(['Total Penalty',     '', '', f(data.summary.total_penalty),     ''])
    rows.push(['Total Rows',        '', '', data.summary.total_rows,           ''])

    return rows
  }

  function selectAccount(acc) {
    setSelected(acc)
    fetchTxns(acc.id)
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function closeAll() {
    setShowCreate(false)
    setShowDeposit(false)
    setShowWithdraw(false)
    setAccountForm(EMPTY_ACCOUNT_FORM)
    setTxnForm(EMPTY_TXN_FORM)
    setFormErr('')
  }

  async function openDeposit() {
    setShowDeposit(true)
    setFormErr('')
    let currentFY = ''
    try {
      const res = await api.get('/fiscal-years/current/')
      currentFY = res.data.fiscal_year
    } catch {}
    setTxnForm({ ...EMPTY_TXN_FORM, fiscal_year: currentFY })
  }

  async function openWithdraw() {
    setShowWithdraw(true)
    setFormErr('')
    let currentFY = ''
    try {
      const res = await api.get('/fiscal-years/current/')
      currentFY = res.data.fiscal_year
    } catch {}
    setTxnForm({ ...EMPTY_TXN_FORM, fiscal_year: currentFY })
  }

  const membersWithoutAccount = members.filter(
    m => !savingsAccounts.find(a => a.member === m.id)
  )

  async function handleCreateAccount(e) {
    e.preventDefault()
    setFormErr('')
    setFormLoad(true)
    try {
      await api.post('/savings/create/', accountForm)
      flash('Savings account created.')
      closeAll()
      fetchAll()
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const first = Object.values(data)[0]
        setFormErr(Array.isArray(first) ? first[0] : first)
      } else {
        setFormErr('Failed to create account.')
      }
    } finally {
      setFormLoad(false)
    }
  }

  async function handleDeposit(e) {
    e.preventDefault()
    setFormErr('')
    if (!txnForm.fiscal_year) {
      setFormErr('Please select a fiscal year.')
      return
    }

    if (!txnForm.account_id) {
      setFormErr('Please select an account.')
      return
    }
    if (!txnForm.nepali_date) {
      setFormErr('Please enter the date.')
      return
    }
    if (parseFloat(txnForm.amount) <= 0) {
      setFormErr('Amount must be greater than zero.')
      return
    }
    setFormLoad(true)
    try {
      await api.post(`/savings/${selected.id}/deposit/`, txnForm)
      flash(`Rs. ${txnForm.amount} deposited successfully.`)
      closeAll()
      fetchAll()
      fetchTxns(selected.id)
      const res = await api.get(`/savings/${selected.id}/`)
      setSelected(res.data)
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Deposit failed.')
    } finally {
      setFormLoad(false)
    }
  }

  async function handleWithdraw(e) {
    e.preventDefault()
    setFormErr('')
    if (!txnForm.fiscal_year) {
      setFormErr('Please select a fiscal year.')
      return
    }
    if (!txnForm.nepali_date) {
      setFormErr('Please enter the date.')
      return
    }
    if (parseFloat(txnForm.amount) <= 0) {
      setFormErr('Amount must be greater than zero.')
      return
    }
    setFormLoad(true)
    try {
      await api.post(`/savings/${selected.id}/withdraw/`, txnForm)
      flash(`Rs. ${txnForm.amount} withdrawn successfully.`)
      closeAll()
      fetchAll()
      fetchTxns(selected.id)
      const res = await api.get(`/savings/${selected.id}/`)
      setSelected(res.data)
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Withdrawal failed.')
    } finally {
      setFormLoad(false)
    }
  }

  async function handleApplyPenalty(e) {
    e.preventDefault()
    setPenaltyErr('')
    if (!penaltyForm.account_id) {
      setPenaltyErr('Please select an account.')
      return
    }
    if (!penaltyForm.nepali_date) {
      setPenaltyErr('Please select a date.')
      return
    }
    if (parseFloat(penaltyForm.amount) <= 0) {
      setPenaltyErr('Amount must be greater than zero.')
      return
    }
    setPenaltyLoad(true)
    try {
      await api.post(`/savings/${selected.id}/penalty/`, penaltyForm)
      flash(`Penalty of Rs. ${penaltyForm.amount} applied successfully.`)
      setShowPenalty(false)
      setPenaltyForm({ amount: '', account_id: '', nepali_date: '', reason: '' })
      fetchAll()
      fetchTxns(selected.id)
    } catch (err) {
      setPenaltyErr(err.response?.data?.error || 'Failed to apply penalty.')
    } finally {
      setPenaltyLoad(false)
    }
  }

  async function handleApplyInterest() {
    setInterestLoad(true)
    setError('')
    try {
      const res = await api.post('/savings/apply-interest/')
      setInterestResult(res.data)
      setShowInterestModal(true)
      fetchAll()
      if (selected) fetchTxns(selected.id)
    } catch (err) {
      const data = err.response?.data
      if (data?.status === 'already_applied') {
        setInterestResult(data)
        setShowInterestModal(true)
      } else {
        setError('Failed to apply interest.')
      }
    } finally {
      setInterestLoad(false)
    }
  }

  async function handleReverseInterest(e) {
    e.preventDefault()
    setReverseErr('')
    if (!reverseForm.bs_year || !reverseForm.bs_month) {
      setReverseErr('Please select a fiscal year and month.')
      return
    }
    setReverseLoad(true)
    try {
      const res = await api.post('/savings/reverse-interest/', {
        bs_year:  reverseForm.bs_year,
        bs_month: reverseForm.bs_month,
      })
      setReverseMsg(res.data.message)
      setShowReverseInterest(false)
      fetchAll()
      if (selected) fetchTxns(selected.id)
      flash(res.data.message)
    } catch (err) {
      setReverseErr(err.response?.data?.error || 'Failed to reverse interest.')
    } finally {
      setReverseLoad(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const txnBadge = {
    deposit:         'badge-success',
    withdrawal:      'badge-danger',
    interest_credit: 'badge-info',
  }

  const filtered = savingsAccounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.member_name?.toLowerCase().includes(q) ||
      a.member_email?.toLowerCase().includes(q)
    )
  })

  const totalSavings = savingsAccounts.reduce(
    (sum, a) => sum + parseFloat(a.balance || 0), 0
  )

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Savings</h2>
            <p className="text-sm text-gray-500">
              {savingsAccounts.length} accounts · Total {fmt(totalSavings)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setInterestResult(null)
                setShowInterestModal(true)
              }}
              disabled={interestLoad}
              className="btn-secondary text-sm">
              {interestLoad ? 'Applying...' : '+ Apply monthly interest'}
            </button>

            <button
              onClick={() => {
                setReverseErr('')
                setReverseMsg('')
                setReverseForm({ fiscal_year: '', bs_year: '', bs_month: '' })
                setRevMonthOpts([])
                setShowReverseInterest(true)
              }}
              className="btn-secondary text-sm">
              ↺ Reverse interest
            </button>
            <button
              onClick={() => { setShowCreate(true); setFormErr('') }}
              className="btn-primary text-sm">
              + Open account
            </button>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 mt-2">
          {[
            { key: 'accounts', label: 'Accounts'      },
            { key: 'report',   label: 'Savings Report' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {successMsg && (
          <div className="px-4 py-3 bg-green-50 border border-green-200
                          text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200
                          text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {activeTab === 'accounts' && (
          <>
        <input
          type="text"
          className="input-field max-w-sm"
          placeholder="Search by member name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Savings accounts list */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800 text-sm">
                All accounts
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  No savings accounts yet.
                </div>
              ) : filtered.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => selectAccount(acc)}
                  className={`px-4 py-3 cursor-pointer transition-colors
                    hover:bg-gray-50
                    ${selected?.id === acc.id
                      ? 'bg-primary-50 border-l-4 border-primary-500'
                      : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {acc.member_name || acc.member_email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {acc.interest_rate}% p.a. · Opened {toBS(acc.opened_on)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">
                        {fmt(acc.balance)}
                      </p>
                      <span className={acc.is_active
                        ? 'badge-success' : 'badge-danger'}>
                        {acc.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction panel */}
          <div className="card overflow-hidden">
            {!selected ? (
              <div className="flex items-center justify-center h-48
                              text-gray-400 text-sm">
                ← Select an account to view transactions
              </div>
            ) : (
              <>
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        {selected.member_name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Balance:{' '}
                        <strong className="text-green-700">
                          {fmt(selected.balance)}
                        </strong>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDeposit(true)
                          setFormErr('')
                          setTxnForm(EMPTY_TXN_FORM)
                        }}
                        className="btn-primary text-xs py-1.5">
                        Deposit
                      </button>
                      <button
                        onClick={() => {
                          setShowWithdraw(true)
                          setFormErr('')
                          setTxnForm(EMPTY_TXN_FORM)
                        }}
                        className="btn-secondary text-xs py-1.5">
                        Withdraw
                      </button>
                      <button
                        onClick={() => {
                          setShowPenalty(true)
                          setPenaltyErr('')
                          setPenaltyForm({ amount: '', account_id: '', nepali_date: '', reason: '', fiscal_year: '' })
                        }}
                        className="text-xs py-1.5 px-3 rounded-lg bg-amber-100 text-amber-700
                                  hover:bg-amber-200 font-medium transition-colors">
                        Apply penalty
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100
                                max-h-96 overflow-y-auto">
                  {txnLoading ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      Loading transactions...
                    </div>
                  ) : txns.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      No transactions yet.
                    </div>
                  ) : txns.map((t) => (
                    <div key={t.id}
                      className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={txnBadge[t.type] || 'badge-gray'}>
                            {t.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {toBS(t.created_at)}
                          {t.note && ` · ${t.note}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm font-semibold
                            ${t.type === 'withdrawal'
                              ? 'text-red-600' : 'text-green-700'}`}>
                            {t.type === 'withdrawal' ? '-' : '+'}
                            {fmt(t.amount)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Bal: {fmt(t.balance_after)}
                          </p>
                        </div>
                        {/* Only show edit for deposit and withdrawal — not interest */}
                        {(t.type === 'deposit' || t.type === 'withdrawal') && (
                          <button
                            onClick={() => setEditTxn({
                              transaction: t,
                              type: t.type === 'deposit'
                                ? 'savings_deposit' : 'savings_withdrawal'
                            })}
                            className="text-xs text-primary-600 hover:text-primary-800
                                       font-medium">
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          </div>
          </>
        )}
        {activeTab === 'report' && (
          <div className="space-y-4">

            {/* Filter panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Filter transactions
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Member filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Member (optional)
                  </label>
                  <select
                    className="input-field text-sm"
                    value={reportFilters.member_id}
                    onChange={(e) => setReportFilters({
                      ...reportFilters, member_id: e.target.value
                    })}>
                    <option value="">All members</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fiscal year filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Fiscal Year (optional)
                  </label>
                  <select
                    className="input-field text-sm"
                    value={reportFilters.fiscal_year}
                    onChange={(e) => {
                      const fy = e.target.value
                      setReportFilters({
                        ...reportFilters, fiscal_year: fy,
                        bs_year: '', bs_month: ''
                      })
                      fetchMonthsForFY(fy)
                    }}>
                    <option value="">All years</option>
                    {fiscalYears.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>

                {/* Month filter — only enabled after fiscal year selected */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Month (optional)
                  </label>
                  <select
                    className="input-field text-sm"
                    value={reportFilters.bs_month && reportFilters.bs_year
                      ? `${reportFilters.bs_year}-${reportFilters.bs_month}` : ''}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setReportFilters({ ...reportFilters, bs_year: '', bs_month: '' })
                        return
                      }
                      const [y, m] = e.target.value.split('-')
                      setReportFilters({ ...reportFilters, bs_year: y, bs_month: m })
                    }}
                    disabled={!reportFilters.fiscal_year}>
                    <option value="">All months</option>
                    {monthOptions.map(m => (
                      <option key={`${m.bs_year}-${m.bs_month}`}
                        value={`${m.bs_year}-${m.bs_month}`}>
                        {m.month_name} {m.bs_year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transaction type filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Type (optional)
                  </label>
                  <select
                    className="input-field text-sm"
                    value={reportFilters.type}
                    onChange={(e) => setReportFilters({
                      ...reportFilters, type: e.target.value
                    })}>
                    <option value="">All types</option>
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="interest_credit">Interest</option>
                    <option value="penalty">Penalty</option>
                  </select>
                </div>

              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={fetchReport}
                  disabled={reportLoad}
                  className="btn-primary text-sm">
                  {reportLoad ? 'Loading...' : '🔍 Generate report'}
                </button>
                <button
                  onClick={() => {
                    setReportFilters({
                      member_id: '', fiscal_year: '', bs_year: '',
                      bs_month: '', type: '',
                    })
                    setReportData(null)
                    setMonthOptions([])
                  }}
                  className="btn-secondary text-sm">
                  Clear filters
                </button>
                {reportData && (
                  <>
                    <button
                      onClick={() => window.print()}
                      className="btn-secondary text-sm">
                      🖨 Print
                    </button>
                    <button
                      onClick={handleDownloadSavingsExcel}
                      className="btn-secondary text-sm">
                      ⬇ Excel
                    </button>
                  </>
                )}
              </div>

              {reportErr && (
                <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {reportErr}
                </div>
              )}
            </div>

            {/* Results */}
            {reportData && (
              <div className="print-area">

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Deposits',    value: reportData.summary.total_deposits,    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                    { label: 'Total Withdrawals', value: reportData.summary.total_withdrawals, color: 'text-red-600',     bg: 'bg-red-50 border-red-100'         },
                    { label: 'Total Interest',    value: reportData.summary.total_interest,    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100'        },
                    { label: 'Total Penalty',     value: reportData.summary.total_penalty,     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-100'      },
                  ].map(card => (
                    <div key={card.label}
                      className={`rounded-xl border p-3 sm:p-4 ${card.bg}`}>
                      <p className="text-xs text-gray-500 font-medium truncate">
                        {card.label}
                      </p>
                      <p className={`text-sm sm:text-base font-bold mt-0.5 ${card.color}`}>
                        {fmt(card.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100
                                overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center
                                  justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {reportData.summary.total_rows} transaction
                      {reportData.summary.total_rows !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {reportData.rows.length === 0 ? (
                    <div className="px-5 py-12 text-center text-gray-400 text-sm">
                      No transactions found for the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Date (BS)', 'Member', 'Type', 'Amount', 'Note'].map(h => (
                              <th key={h}
                                className="px-4 py-3 text-left text-xs font-semibold
                                          text-gray-500 uppercase tracking-wide">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {reportData.rows.map((row, i) => (
                            <tr key={`${row.source}-${row.id}-${i}`}
                              className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {row.nepali_date
                                  ? toBS(row.nepali_date)
                                  : toBS(row.date_ad)
                                }
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {row.member_name}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5
                                                  rounded-full text-xs font-medium
                                  ${row.type === 'deposit'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : row.type === 'withdrawal'
                                      ? 'bg-red-100 text-red-700'
                                      : row.type === 'interest_credit'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {row.type_label}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-semibold whitespace-nowrap
                                ${row.type === 'withdrawal'
                                  ? 'text-red-600'
                                  : row.type === 'penalty'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}>
                                {row.type === 'withdrawal' ? '-' : '+'}
                                {fmt(row.amount)}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                                {row.note || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {/* Create account modal */}
      {showCreate && (
        <Modal title="Open savings account" onClose={closeAll}>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            {formErr && <ErrorBox msg={formErr} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={accountForm.member_id}
                onChange={(e) => setAccountForm({
                  ...accountForm, member_id: e.target.value
                })}
                required>
                <option value="">Select a member...</option>
                {membersWithoutAccount.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
              {membersWithoutAccount.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  All active members already have accounts.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual interest rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={accountForm.interest_rate}
                onChange={(e) => setAccountForm({
                  ...accountForm, interest_rate: e.target.value
                })}
                required
              />
            </div>
            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Open account"
            />
          </form>
        </Modal>
      )}

      {/* Deposit modal */}
      {showDeposit && (
        <Modal
          title={`Deposit — ${selected?.member_name}`}
          onClose={closeAll}>
          <form onSubmit={handleDeposit} className="space-y-4">
            {formErr && <ErrorBox msg={formErr} />}
            <AmountNoteFields
              form={txnForm}
              setForm={setTxnForm}
              label="Deposit amount"
              accounts={cashAccounts}
            />
            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Confirm deposit"
            />
          </form>
        </Modal>
      )}

      {/* Withdraw modal */}
      {showWithdraw && (
        <Modal
          title={`Withdraw — ${selected?.member_name}`}
          onClose={closeAll}>
          <form onSubmit={handleWithdraw} className="space-y-4">
            {formErr && <ErrorBox msg={formErr} />}
            <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              Available balance:
              <strong className="text-green-700 ml-1">
                {fmt(selected?.balance)}
              </strong>
            </p>
            <AmountNoteFields
              form={txnForm}
              setForm={setTxnForm}
              label="Withdrawal amount"
              accounts={cashAccounts}
            />
            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Confirm withdrawal"
            />
          </form>
        </Modal>
      )}

      {showPenalty && (
        <Modal
          title={`Apply penalty — ${selected?.member_name}`}
          onClose={() => setShowPenalty(false)}>
          <form onSubmit={handleApplyPenalty} className="space-y-4">
            {penaltyErr && <ErrorBox msg={penaltyErr} />}
            <div className="bg-amber-50 border border-amber-100 rounded-lg
                            px-4 py-3">
              <p className="text-xs text-amber-700">
                ⚠️ This penalty is recorded as income for the cooperative.
                It does not affect the member's savings balance.
              </p>
            </div>
            <FiscalYearDatePicker
              fiscalYear={penaltyForm.fiscal_year}
              onFiscalYearChange={(fy) => setPenaltyForm({ ...penaltyForm, fiscal_year: fy })}
              dateValue={penaltyForm.nepali_date}
              onDateChange={(val) => setPenaltyForm({ ...penaltyForm, nepali_date: val })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Penalty amount (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                value={penaltyForm.amount}
                onChange={(e) => setPenaltyForm({
                  ...penaltyForm, amount: e.target.value
                })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collected in account <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={penaltyForm.account_id}
                onChange={(e) => setPenaltyForm({
                  ...penaltyForm, account_id: e.target.value
                })}
                required>
                <option value="">Select account...</option>
                {cashAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type_display}) — Rs.{' '}
                    {parseFloat(a.balance).toLocaleString('en-NP')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Missed Jestha deposit"
                value={penaltyForm.reason}
                onChange={(e) => setPenaltyForm({
                  ...penaltyForm, reason: e.target.value
                })}
              />
            </div>
            <ModalButtons
              onCancel={() => setShowPenalty(false)}
              loading={penaltyLoad}
              label="Apply penalty"
            />
          </form>
        </Modal>
      )}

      {/* Interest modal */}
      {showInterestModal && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-screen flex justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
            {!interestResult ? (
              <>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">
                    Apply monthly interest
                  </h3>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200
                                  rounded-lg px-4 py-3">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⚠️ This will credit interest to all active savings accounts.
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Each account can only receive interest once per month.
                      This action cannot be undone.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Active accounts:{' '}
                    <strong>
                      {savingsAccounts.filter(a => a.is_active).length}
                    </strong>
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowInterestModal(false)}
                      className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setShowInterestModal(false)
                        await handleApplyInterest()
                      }}
                      disabled={interestLoad}
                      className="btn-primary flex-1">
                      {interestLoad ? 'Applying...' : 'Confirm & Apply'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-200 flex
                                items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    Interest application result
                  </h3>
                  <button
                    onClick={() => {
                      setShowInterestModal(false)
                      setInterestResult(null)
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xl">
                    ✕
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4 max-h-96 overflow-y-auto">
                  {interestResult.status === 'already_applied' ? (
                    <div className="bg-yellow-50 border border-yellow-200
                                    rounded-lg px-4 py-3">
                      <p className="text-sm text-yellow-800 font-medium">
                        ⚠️ Already applied this month
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Interest has already been credited to all accounts
                        this month.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200
                                    rounded-lg px-4 py-3">
                      <p className="text-sm text-green-800 font-medium">
                        ✓ {interestResult.message}
                      </p>
                    </div>
                  )}

                  {interestResult.applied?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500
                                    uppercase tracking-wide mb-2">
                        Interest credited
                      </p>
                      <div className="space-y-1">
                        {interestResult.applied.map((a, i) => (
                          <div key={i}
                            className="flex justify-between text-sm
                                       py-1.5 border-b border-gray-100">
                            <span className="text-gray-700">{a.member}</span>
                            <span className="text-green-600 font-medium">
                              +Rs. {a.interest}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {interestResult.already_done?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500
                                    uppercase tracking-wide mb-2">
                        Already applied this month
                      </p>
                      <div className="space-y-1">
                        {interestResult.already_done.map((name, i) => (
                          <p key={i} className="text-sm text-gray-500 py-1">
                            {name}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowInterestModal(false)
                      setInterestResult(null)
                    }}
                    className="btn-primary w-full">
                    Done
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
        </div>
      )}

      {editTxn && (
        <EditTransactionModal
          type={editTxn.type}
          transaction={editTxn.transaction}
          accounts={cashAccounts}
          onClose={() => setEditTxn(null)}
          onSuccess={() => {
            setEditTxn(null)
            fetchAll()
            if (selected) fetchTxns(selected.id)
          }}
        />
      )}

      {showReverseInterest && (
        <Modal title="Reverse interest application" onClose={() => setShowReverseInterest(false)}>
          <form onSubmit={handleReverseInterest} className="space-y-4">
            {reverseErr && <ErrorBox msg={reverseErr} />}

            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <p className="text-xs text-red-700">
                ⚠️ This will permanently remove all interest credits for the
                selected month and restore savings balances to their
                pre-interest state. Use only if interest was applied in error.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={reverseForm.fiscal_year}
                onChange={async (e) => {
                  const fy = e.target.value
                  setReverseForm({ ...reverseForm, fiscal_year: fy, bs_year: '', bs_month: '' })
                  if (fy) {
                    try {
                      const res = await api.get(`/fiscal-years/months/?fy=${fy}`)
                      setRevMonthOpts(res.data.months || [])
                    } catch { setRevMonthOpts([]) }
                  }
                }}
                required>
                <option value="">Select fiscal year...</option>
                {fiscalYears.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={reverseForm.bs_month && reverseForm.bs_year
                  ? `${reverseForm.bs_year}-${reverseForm.bs_month}` : ''}
                onChange={(e) => {
                  if (!e.target.value) return
                  const [y, m] = e.target.value.split('-')
                  setReverseForm({ ...reverseForm, bs_year: y, bs_month: m })
                }}
                disabled={!reverseForm.fiscal_year}
                required>
                <option value="">Select month...</option>
                {revMonthOpts.map(m => (
                  <option key={`${m.bs_year}-${m.bs_month}`}
                    value={`${m.bs_year}-${m.bs_month}`}>
                    {m.month_name} {m.bs_year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowReverseInterest(false)}
                className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={reverseLoad}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700
                          text-white font-medium text-sm">
                {reverseLoad ? 'Reversing...' : 'Reverse interest'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  )
}

// ── Reusable components ───────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
     <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
      <div className="min-h-screen flex justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
          <div
            className="px-6 py-4 border-b border-gray-200 flex
                       items-center justify-between"
          >
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
    </div>
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

function AmountNoteFields({ form, setForm, label, accounts = [] }) {
  return (
    <>
      <FiscalYearDatePicker
        fiscalYear={form.fiscal_year}
        onFiscalYearChange={(fy) => setForm({ ...form, fiscal_year: fy })}
        dateValue={form.nepali_date}
        onDateChange={(val) => setForm({ ...form, nepali_date: val })}
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="input-field"
          placeholder="0.00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Account <span className="text-red-500">*</span>
        </label>
        <select
          className="input-field"
          value={form.account_id}
          onChange={(e) => setForm({ ...form, account_id: e.target.value })}
          required>
          <option value="">Select account...</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.account_type_display}) — Rs.{' '}
              {parseFloat(a.balance).toLocaleString('en-NP', {
                minimumFractionDigits: 2
              })}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="e.g. Monthly deposit"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
    </>
  )
}

function ModalButtons({ onCancel, loading, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="btn-secondary flex-1">
        Cancel
      </button>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary flex-1">
        {loading ? 'Saving...' : label}
      </button>
    </div>
  )
}