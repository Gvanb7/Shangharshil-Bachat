import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import NepaliDatePicker from '../../components/NepaliDatePicker'
import { toBS, formatBS } from '../../lib/nepaliDate'
import useAccounts from '../../hooks/useAccounts'

const EMPTY_LOAN_FORM = {
  member: '', principal: '', interest_rate: '12.00',
  term_months: '', purpose: '',
}

export default function AdminLoans() {
  const [loans,        setLoans]        = useState([])
  const [members,      setMembers]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [successMsg,   setSuccessMsg]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search,       setSearch]       = useState('')
  const { accounts } = useAccounts()

  const [selected,   setSelected]   = useState(null)
  const [repayments, setRepayments] = useState([])
  const [repayLoad,  setRepayLoad]  = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [loanForm,   setLoanForm]   = useState(EMPTY_LOAN_FORM)
  const [formErr,    setFormErr]    = useState('')
  const [formLoad,   setFormLoad]   = useState(false)
  const [emiPreview, setEmiPreview] = useState(null)

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveTarget,    setApproveTarget]    = useState(null)
  const [approveForm,      setApproveForm]      = useState({
    interest_rate: '12.00', term_months: '12'
  })
  const [approveErr,  setApproveErr]  = useState('')
  const [approveLoad, setApproveLoad] = useState(false)
  const [showDisburse,  setShowDisburse]  = useState(false)
  const [disburseTarget,setDisburseTarget]= useState(null)
  const [disburseForm,  setDisburseForm]  = useState({
    account_id: '', nepali_date: ''
  })
  const [disburseErr,  setDisburseErr]  = useState('')
  const [disburseLoad, setDisburseLoad] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [loansRes, membersRes] = await Promise.all([
        api.get('/loans/'),
        api.get('/admin/members/'),
      ])
      setLoans(loansRes.data)
      setMembers(membersRes.data.filter(m => m.is_active))
    } catch {
      setError('Failed to load loans.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRepayments(loanId) {
    setRepayLoad(true)
    try {
      const res = await api.get(`/loans/${loanId}/repayments/`)
      setRepayments(res.data)
    } catch {
      setRepayments([])
    } finally {
      setRepayLoad(false)
    }
  }

  function selectLoan(loan) {
    setSelected(loan)
    fetchRepayments(loan.id)
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  function closeAll() {
    setShowCreate(false)
    setLoanForm(EMPTY_LOAN_FORM)
    setFormErr('')
    setEmiPreview(null)
  }

  function updateLoanForm(updated) {
    setLoanForm(updated)
    const { principal, interest_rate, term_months } = updated
    if (principal && interest_rate && term_months &&
        parseFloat(principal) > 0 && parseInt(term_months) > 0) {
      const p = parseFloat(principal)
      const r = parseFloat(interest_rate) / 100 / 12
      const n = parseInt(term_months)
      if (r === 0) {
        setEmiPreview({ emi: p / n, total: p, interest: 0 })
      } else {
        const factor = Math.pow(1 + r, n)
        const emi    = p * r * factor / (factor - 1)
        setEmiPreview({ emi, total: emi * n, interest: emi * n - p })
      }
    } else {
      setEmiPreview(null)
    }
  }

  async function handleCreateLoan(e) {
    e.preventDefault()
    setFormErr('')
    setFormLoad(true)
    try {
      const res = await api.post('/loans/create/', loanForm)
      flash('Loan created successfully.')
      closeAll()
      fetchAll()
      selectLoan(res.data)
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const first = Object.values(data)[0]
        setFormErr(Array.isArray(first) ? first[0] : first)
      } else {
        setFormErr('Failed to create loan.')
      }
    } finally {
      setFormLoad(false)
    }
  }

  async function handleApprove(loan) {
    setApproveTarget(loan)
    setApproveForm({ interest_rate: '12.00', term_months: '12' })
    setApproveErr('')
    setShowApproveModal(true)
  }

  async function submitApprove(e) {
    e.preventDefault()
    setApproveErr('')
    setApproveLoad(true)
    try {
      // first update the loan terms
      await api.patch(`/loans/${approveTarget.id}/`, {
        interest_rate: approveForm.interest_rate,
        term_months:   parseInt(approveForm.term_months),
      })
      // then approve
      await api.post(`/loans/${approveTarget.id}/approve/`)
      flash('Loan approved.')
      setShowApproveModal(false)
      setApproveTarget(null)
      fetchAll()
      if (selected?.id === approveTarget.id) {
        const res = await api.get(`/loans/${approveTarget.id}/`)
        setSelected(res.data)
      }
    } catch (err) {
      setApproveErr(err.response?.data?.error || 'Failed to approve loan.')
    } finally {
      setApproveLoad(false)
    }
  }

  async function handleReject(loan) {
    if (!window.confirm(
      `Reject loan of Rs. ${loan.principal} for ${loan.member_name}?`
    )) return
    try {
      await api.post(`/loans/${loan.id}/reject/`)
      flash('Loan rejected.')
      fetchAll()
      if (selected?.id === loan.id) {
        const res = await api.get(`/loans/${loan.id}/`)
        setSelected(res.data)
      }
    } catch {
      setError('Failed to reject loan.')
    }
  }

  function handleDisburse(loan) {
  setDisburseTarget(loan)
  setDisburseForm({ account_id: '', nepali_date: '' })
  setDisburseErr('')
  setShowDisburse(true)
  }

  async function submitDisburse(e) {
    e.preventDefault()
    setDisburseErr('')
    if (!disburseForm.account_id) {
      setDisburseErr('Please select an account.')
      return
    }
    if (!disburseForm.nepali_date) {
      setDisburseErr('Please enter the date.')
      return
    }
    setDisburseLoad(true)
    try {
      await api.post(`/loans/${disburseTarget.id}/disburse/`, disburseForm)
      flash('Loan disbursed and is now active.')
      setShowDisburse(false)
      fetchAll()
      if (selected?.id === disburseTarget.id) {
        const res = await api.get(`/loans/${disburseTarget.id}/`)
        setSelected(res.data)
      }
    } catch (err) {
      setDisburseErr(err.response?.data?.error || 'Failed to disburse loan.')
    } finally {
      setDisburseLoad(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const STATUS_BADGE = {
    pending:  'badge-warning',
    approved: 'badge-info',
    active:   'badge-success',
    closed:   'badge-gray',
    rejected: 'badge-danger',
  }

  const STATUS_FILTERS = ['all', 'pending', 'approved', 'active', 'closed', 'rejected']

  const filtered = loans.filter((l) => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const q           = search.toLowerCase()
    const matchSearch = !q ||
      l.member_name?.toLowerCase().includes(q) ||
      l.purpose?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const totalActive = loans
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + parseFloat(l.amount_remaining || 0), 0)

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Loans</h2>
            <p className="text-sm text-gray-500">
              {loans.filter(l => l.status === 'active').length} active ·
              Outstanding {fmt(totalActive)}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm">
            + New loan
          </button>
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

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium
                            transition-colors capitalize
                            ${statusFilter === s
                              ? 'bg-primary-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}>
                {s}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="input-field max-w-xs text-sm"
            placeholder="Search member or purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Loans list */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold text-gray-800 text-sm">
                {filtered.length} loan{filtered.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
              {loading ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  No loans found.
                </div>
              ) : filtered.map((loan) => (
                <div
                  key={loan.id}
                  onClick={() => selectLoan(loan)}
                  className={`px-4 py-3 cursor-pointer transition-colors
                              hover:bg-gray-50
                    ${selected?.id === loan.id
                      ? 'bg-primary-50 border-l-4 border-primary-500'
                      : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {loan.member_name || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmt(loan.principal)} · {loan.term_months}mo ·
                        {loan.interest_rate}% p.a.
                      </p>
                      {loan.purpose && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {loan.purpose}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={STATUS_BADGE[loan.status] || 'badge-gray'}>
                        {loan.status}
                      </span>
                      {loan.status === 'active' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Rem: {fmt(loan.amount_remaining)}
                        </p>
                      )}
                    </div>
                  </div>

                  {loan.status === 'pending' && (
                    <div className="flex gap-2 mt-2"
                      onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleApprove(loan)}
                        className="text-xs btn-primary py-1 px-3">
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(loan)}
                        className="text-xs btn-danger py-1 px-3">
                        Reject
                      </button>
                    </div>
                  )}
                  {loan.status === 'approved' && (
                    <div className="mt-2"
                      onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDisburse(loan)}
                        className="text-xs btn-primary py-1 px-3">
                        Disburse
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Loan detail panel */}
          <div className="card overflow-hidden">
            {!selected ? (
              <div className="flex items-center justify-center h-48
                              text-gray-400 text-sm">
                ← Select a loan to view details
              </div>
            ) : (
              <LoanDetailPanel
                selected={selected}
                repayments={repayments}
                repayLoad={repayLoad}
                accounts={accounts}
                onRepay={() => {
                  fetchAll()
                  fetchRepayments(selected.id)
                  api.get(`/loans/${selected.id}/`).then(res => setSelected(res.data))
                }}
                fmt={fmt}
                STATUS_BADGE={STATUS_BADGE}
              />
            )}
          </div>

        </div>
      </div>

      {/* Create loan modal */}
      {showCreate && (
        <Modal title="New loan" onClose={closeAll}>
          <form onSubmit={handleCreateLoan} className="space-y-4">
            {formErr && <ErrorBox msg={formErr} />}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={loanForm.member}
                onChange={(e) => updateLoanForm({
                  ...loanForm, member: e.target.value
                })}
                required>
                <option value="">Select member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Principal (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="input-field"
                  placeholder="10000.00"
                  value={loanForm.principal}
                  onChange={(e) => updateLoanForm({
                    ...loanForm, principal: e.target.value
                  })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest rate (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  placeholder="12.00"
                  value={loanForm.interest_rate}
                  onChange={(e) => updateLoanForm({
                    ...loanForm, interest_rate: e.target.value
                  })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Term (months) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="360"
                className="input-field"
                placeholder="12"
                value={loanForm.term_months}
                onChange={(e) => updateLoanForm({
                  ...loanForm, term_months: e.target.value
                })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose
              </label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="e.g. Business expansion"
                value={loanForm.purpose}
                onChange={(e) => updateLoanForm({
                  ...loanForm, purpose: e.target.value
                })}
              />
            </div>

            {emiPreview && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg
                              px-4 py-3 grid grid-cols-3 gap-3">
                {[
                  ['Monthly EMI',    `Rs. ${emiPreview.emi.toFixed(2)}`],
                  ['Total payable',  `Rs. ${emiPreview.total.toFixed(2)}`],
                  ['Total interest', `Rs. ${emiPreview.interest.toFixed(2)}`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-blue-600">{label}</p>
                    <p className="text-sm font-semibold text-blue-800">{val}</p>
                  </div>
                ))}
              </div>
            )}

            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Create loan"
            />
          </form>
        </Modal>
      )}

      {/* Approve loan modal */}
      {showApproveModal && approveTarget && (
        <Modal
          title={`Approve loan — ${approveTarget.member_name}`}
          onClose={() => setShowApproveModal(false)}>
          <form onSubmit={submitApprove} className="space-y-4">
            {approveErr && <ErrorBox msg={approveErr} />}

            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">Principal requested</p>
              <p className="text-sm font-semibold text-gray-800">
                {fmt(approveTarget.principal)}
              </p>
              {approveTarget.purpose && (
                <>
                  <p className="text-xs text-gray-500 mt-2">Purpose</p>
                  <p className="text-sm text-gray-700">{approveTarget.purpose}</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest rate (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  value={approveForm.interest_rate}
                  onChange={(e) => setApproveForm({
                    ...approveForm, interest_rate: e.target.value
                  })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term (months) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  className="input-field"
                  value={approveForm.term_months}
                  onChange={(e) => setApproveForm({
                    ...approveForm, term_months: e.target.value
                  })}
                  required
                />
              </div>
            </div>

            <ModalButtons
              onCancel={() => setShowApproveModal(false)}
              loading={approveLoad}
              label="Approve loan"
            />
          </form>
        </Modal>
      )}

      {showDisburse && disburseTarget && (
        <Modal
          title={`Disburse loan — ${disburseTarget.member_name}`}
          onClose={() => setShowDisburse(false)}>
          <form onSubmit={submitDisburse} className="space-y-4">
            {disburseErr && <ErrorBox msg={disburseErr} />}

            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">Disbursement amount</p>
              <p className="text-lg font-bold text-gray-800">
                {fmt(disburseTarget.principal)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                To: {disburseTarget.member_name}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disburse from account <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={disburseForm.account_id}
                onChange={(e) => setDisburseForm({
                  ...disburseForm, account_id: e.target.value
                })}
                required>
                <option value="">Select account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} (Rs. {parseFloat(a.balance).toLocaleString('en-NP')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disbursement date (BS) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="2082-02-11"
                value={disburseForm.nepali_date}
                onChange={(e) => setDisburseForm({
                  ...disburseForm, nepali_date: e.target.value
                })}
                required
              />
            </div>

            <ModalButtons
              onCancel={() => setShowDisburse(false)}
              loading={disburseLoad}
              label="Disburse loan"
            />
          </form>
        </Modal>
      )}


    </AdminLayout>
  )
}

// ── Loan detail panel ─────────────────────────────────────────────────────────

function LoanDetailPanel({
  selected, repayments, repayLoad, onRepay, fmt, STATUS_BADGE, accounts = []
}) {
  const [schedule,     setSchedule]     = useState([])
  const [scheduleLoad, setScheduleLoad] = useState(false)
  const [activeTab,    setActiveTab]    = useState('history')
  const [payingMonth,  setPayingMonth]  = useState(null)  // which month Pay Now was clicked

  useEffect(() => {
    if (selected?.status === 'active' || selected?.status === 'closed') {
      fetchSchedule()
    }
    setActiveTab('history')
    setPayingMonth(null)
  }, [selected?.id])

  async function fetchSchedule() {
    setScheduleLoad(true)
    try {
      const res = await api.get(`/loans/${selected.id}/schedule/`)
      setSchedule(res.data)
    } catch {
      setSchedule([])
    } finally {
      setScheduleLoad(false)
    }
  }

  const progress = parseFloat(selected.total_payable) > 0
    ? (parseFloat(selected.amount_paid) /
       parseFloat(selected.total_payable)) * 100
    : 0

  const paidMonths   = schedule.filter(s => s.is_paid).length
  const unpaidMonths = schedule.filter(s => !s.is_paid).length
  const showTabs     = selected.status === 'active' || selected.status === 'closed'

  return (
    <>
      {/* Header — removed Record repayment button from here */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">
              {selected.member_name}
            </h3>
            <span className={`${STATUS_BADGE[selected.status]} mt-1`}>
              {selected.status}
            </span>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2 border-b border-gray-100">
        {[
          ['Principal',     fmt(selected.principal),           'text-gray-800'],
          ['Interest rate', `${selected.interest_rate}% p.a.`, 'text-gray-800'],
          ['Term',          `${selected.term_months} months`,  'text-gray-800'],
          ['Monthly EMI',   fmt(selected.monthly_installment), 'text-blue-700'],
          ['Total payable', fmt(selected.total_payable),       'text-gray-800'],
          ['Amount paid',   fmt(selected.amount_paid),         'text-green-700'],
          ['Remaining',     fmt(selected.amount_remaining),    'text-red-600'],
          ['Due date', selected.due_date ? toBS(selected.due_date) : '—', 'text-gray-800'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-sm font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {showTabs && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              {paidMonths} of {selected.term_months} installments paid
            </span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {unpaidMonths > 0 && selected.status === 'active' && (
            <p className="text-xs text-red-500 mt-1">
              {unpaidMonths} installment{unpaidMonths > 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      {showTabs && (
        <div className="flex border-b border-gray-200">
          {[
            { key: 'history',  label: 'Repayment history' },
            { key: 'schedule', label: 'Monthly schedule'  },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors
                          border-b-2
                          ${activeTab === tab.key
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="max-h-72 overflow-y-auto">

        {/* Repayment history */}
        {(!showTabs || activeTab === 'history') && (
          <div className="divide-y divide-gray-100">
            {!showTabs && (
              <div className="px-4 py-2 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500
                               uppercase tracking-wide">
                  Repayment history
                </p>
              </div>
            )}
            {repayLoad ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : repayments.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                No repayments yet.
              </div>
            ) : repayments.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {fmt(r.amount_paid)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Principal: {fmt(r.principal_portion)} ·
                      Interest: {fmt(r.interest_portion)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.nepali_date
                        ? formatBS(r.nepali_date)
                        : toBS(r.paid_at)
                      }
                      {r.note && ` · ${r.note}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {fmt(r.balance_after)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Monthly schedule */}
        {showTabs && activeTab === 'schedule' && (
          <>
            {scheduleLoad ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                Loading schedule...
              </div>
            ) : schedule.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                No schedule available.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {['Mo.', 'Due date', 'EMI', 'Principal',
                      'Interest', 'Balance', 'Status'].map(h => (
                      <th key={h}
                        className="px-2 py-2 text-left text-gray-500
                                   font-semibold uppercase tracking-wide
                                   whitespace-nowrap border-b border-gray-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.map((s) => {
                    const isOverdue = !s.is_paid &&
                      new Date(s.due_date) < new Date()
                    return (
                      <tr key={s.month}
                        className={`transition-colors
                          ${s.is_paid
                            ? 'bg-green-50'
                            : isOverdue
                              ? 'bg-red-50'
                              : 'hover:bg-gray-50'
                          }`}>
                        <td className="px-2 py-2 font-medium text-gray-700">
                          {s.month}
                        </td>
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                          {toBS(s.due_date)}
                        </td>
                        <td className="px-2 py-2 font-semibold text-gray-800
                                       whitespace-nowrap">
                          {fmt(s.emi)}
                        </td>
                        <td className="px-2 py-2 text-blue-700 whitespace-nowrap">
                          {fmt(s.principal_portion)}
                        </td>
                        <td className="px-2 py-2 text-orange-600 whitespace-nowrap">
                          {fmt(s.interest_portion)}
                        </td>
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                          {fmt(s.balance_after)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {s.is_paid ? (
                            <div>
                              <span className="badge-success">✓ Paid</span>
                              <p className="text-gray-400 mt-0.5 text-xs">
                                {s.nepali_date ? formatBS(s.nepali_date) : toBS(s.paid_at)}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className={
                                isOverdue ? 'badge-danger' : 'badge-warning'
                              }>
                                {isOverdue ? 'Overdue' : 'Upcoming'}
                              </span>
                              {selected.status === 'active' && (
                                <button
                                  onClick={() => setPayingMonth(s)}
                                  className="text-xs bg-primary-600
                                             hover:bg-primary-700 text-white
                                             px-2 py-0.5 rounded-md
                                             transition-colors">
                                  Pay now
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Pay now modal */}
      {payingMonth && (
        <PayNowModal
          month={payingMonth}
          loan={selected}
          fmt={fmt}
          accounts={accounts}
          onClose={() => setPayingMonth(null)}
          onSuccess={() => {
            setPayingMonth(null)
            onRepay()
            fetchSchedule()
          }}
        />
      )}
    </>
  )
}

// ── Reusable components ───────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
                      max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex
                        items-center justify-between sticky top-0 bg-white z-10">
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

function ModalButtons({ onCancel, loading, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="btn-secondary flex-1">
        Cancel
      </button>
      <button type="submit" disabled={loading} className="btn-primary flex-1">
        {loading ? 'Saving...' : label}
      </button>
    </div>
  )
}

function PayNowModal({ month, loan, fmt, onClose, onSuccess, accounts }) {
  const [amount,     setAmount]     = useState(month.emi)
  const [note,       setNote]       = useState('')
  const [nepaliDate, setNepaliDate] = useState('')
  const [accountId,  setAccountId]  = useState('')
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!accountId) {
      setErr('Please select an account.')
      return
    }
    if (!nepaliDate.trim()) {
      setErr('Please enter the payment date.')
      return
    }
    const bsPattern = /^\d{4}-\d{2}-\d{2}$/
    if (!bsPattern.test(nepaliDate.trim())) {
      setErr('Date must be YYYY-MM-DD format (e.g. 2082-02-11)')
      return
    }
    if (parseFloat(amount) <= 0) {
      setErr('Amount must be greater than zero.')
      return
    }
    const adDate = new Date().toISOString().split('T')[0]
    setLoading(true)
    try {
      await api.post(`/loans/${loan.id}/repay/`, {
        amount:      amount,
        note:        note,
        paid_at:     adDate,
        nepali_date: nepaliDate.trim(),
        account_id:  accountId,
      })
      onSuccess()
    } catch (error) {
      setErr(error.response?.data?.error || 'Payment failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex
                        items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Record repayment</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Month {month.month} · Due: {month.due_date}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && <ErrorBox msg={err} />}

          <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">Scheduled EMI</p>
              <p className="text-sm font-semibold text-gray-800">
                {fmt(month.emi)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Remaining balance</p>
              <p className="text-sm font-semibold text-red-600">
                {fmt(loan.amount_remaining)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount paid (Rs.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.01" min="0.01"
              className="input-field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Received in account <span className="text-red-500">*</span>
            </label>
            <select
              className="input-field"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required>
              <option value="">Select account...</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} (Rs. {parseFloat(a.balance).toLocaleString('en-NP')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment date (BS) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field font-mono"
              placeholder="2082-02-11"
              value={nepaliDate}
              onChange={(e) => setNepaliDate(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter BS date in YYYY-MM-DD format
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note (optional)
            </label>
            <input
              type="text" className="input-field"
              placeholder={`Month ${month.month} installment`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading}
              className="btn-primary flex-1">
              {loading ? 'Recording...' : 'Confirm payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}