import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'

const EMPTY_LOAN_FORM = {
  member: '', principal: '', interest_rate: '12.00',
  term_months: '', purpose: '',
}
const EMPTY_REPAY_FORM = { amount: '', note: '' }

export default function AdminLoans() {
  const [loans,       setLoans]       = useState([])
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [successMsg,  setSuccessMsg]  = useState('')
  const [statusFilter,setStatusFilter]= useState('all')
  const [search,      setSearch]      = useState('')

  const [selected,    setSelected]    = useState(null)
  const [repayments,  setRepayments]  = useState([])
  const [repayLoad,   setRepayLoad]   = useState(false)

  const [showCreate,  setShowCreate]  = useState(false)
  const [showRepay,   setShowRepay]   = useState(false)
  const [loanForm,    setLoanForm]    = useState(EMPTY_LOAN_FORM)
  const [repayForm,   setRepayForm]   = useState(EMPTY_REPAY_FORM)
  const [formErr,     setFormErr]     = useState('')
  const [formLoad,    setFormLoad]    = useState(false)
  const [emiPreview,  setEmiPreview]  = useState(null)

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
    setShowRepay(false)
    setLoanForm(EMPTY_LOAN_FORM)
    setRepayForm(EMPTY_REPAY_FORM)
    setFormErr('')
    setEmiPreview(null)
  }

  // live EMI preview
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
        setEmiPreview({
          emi,
          total:    emi * n,
          interest: emi * n - p,
        })
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
    if (!window.confirm(`Approve loan of Rs. ${loan.principal} for ${loan.member_name}?`)) return
    try {
      await api.post(`/loans/${loan.id}/approve/`)
      flash('Loan approved.')
      fetchAll()
      if (selected?.id === loan.id) {
        const res = await api.get(`/loans/${loan.id}/`)
        setSelected(res.data)
      }
    } catch {
      setError('Failed to approve loan.')
    }
  }

  async function handleReject(loan) {
    if (!window.confirm(`Reject loan of Rs. ${loan.principal} for ${loan.member_name}?`)) return
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

  async function handleDisburse(loan) {
    if (!window.confirm(
      `Disburse Rs. ${loan.principal} to ${loan.member_name}? This will activate the loan.`
    )) return
    try {
      await api.post(`/loans/${loan.id}/disburse/`)
      flash('Loan disbursed and is now active.')
      fetchAll()
      if (selected?.id === loan.id) {
        const res = await api.get(`/loans/${loan.id}/`)
        setSelected(res.data)
      }
    } catch {
      setError('Failed to disburse loan.')
    }
  }

  async function handleRepay(e) {
    e.preventDefault()
    setFormErr('')
    if (parseFloat(repayForm.amount) <= 0) {
      setFormErr('Amount must be greater than zero.')
      return
    }
    setFormLoad(true)
    try {
      await api.post(`/loans/${selected.id}/repay/`, repayForm)
      flash(`Repayment of Rs. ${repayForm.amount} recorded.`)
      closeAll()
      fetchAll()
      fetchRepayments(selected.id)
      const res = await api.get(`/loans/${selected.id}/`)
      setSelected(res.data)
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Repayment failed.')
    } finally {
      setFormLoad(false)
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
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
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
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50
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

                  {/* Action buttons inline */}
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
              <>
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
                    {selected.status === 'active' && (
                      <button
                        onClick={() => { setShowRepay(true); setFormErr('') }}
                        className="btn-primary text-xs py-1.5">
                        Record repayment
                      </button>
                    )}
                  </div>
                </div>

                {/* Loan summary */}
                <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b
                                border-gray-100 bg-gray-50">
                  {[
                    ['Principal',     fmt(selected.principal)],
                    ['Interest rate', `${selected.interest_rate}% p.a.`],
                    ['Term',          `${selected.term_months} months`],
                    ['Monthly EMI',   fmt(selected.monthly_installment)],
                    ['Total payable', fmt(selected.total_payable)],
                    ['Amount paid',   fmt(selected.amount_paid)],
                    ['Remaining',     fmt(selected.amount_remaining)],
                    ['Due date',      selected.due_date || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {selected.status === 'active' && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Repayment progress</span>
                      <span>
                        {((parseFloat(selected.amount_paid) /
                          parseFloat(selected.total_payable)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (parseFloat(selected.amount_paid) /
                             parseFloat(selected.total_payable)) * 100, 100
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Repayments */}
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  <div className="px-4 py-2 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Repayment history
                    </p>
                  </div>
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
                            {new Date(r.paid_at).toLocaleDateString('en-NP')}
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
              </>
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
                onChange={(e) => updateLoanForm({ ...loanForm, member: e.target.value })}
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
                  onChange={(e) => updateLoanForm({ ...loanForm, principal: e.target.value })}
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
                  onChange={(e) => updateLoanForm({ ...loanForm, interest_rate: e.target.value })}
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
                onChange={(e) => updateLoanForm({ ...loanForm, term_months: e.target.value })}
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
                onChange={(e) => updateLoanForm({ ...loanForm, purpose: e.target.value })}
              />
            </div>

            {/* Live EMI preview */}
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

            <ModalButtons onCancel={closeAll} loading={formLoad} label="Create loan" />
          </form>
        </Modal>
      )}

      {/* Repayment modal */}
      {showRepay && selected && (
        <Modal
          title={`Record repayment — ${selected.member_name}`}
          onClose={closeAll}>
          <form onSubmit={handleRepay} className="space-y-4">
            {formErr && <ErrorBox msg={formErr} />}
            <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Monthly EMI</p>
                <p className="text-sm font-semibold text-gray-800">
                  {fmt(selected.monthly_installment)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Remaining balance</p>
                <p className="text-sm font-semibold text-red-600">
                  {fmt(selected.amount_remaining)}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount paid (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                placeholder={selected.monthly_installment}
                value={repayForm.amount}
                onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. April installment"
                value={repayForm.note}
                onChange={(e) => setRepayForm({ ...repayForm, note: e.target.value })}
              />
            </div>
            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Record repayment"
            />
          </form>
        </Modal>
      )}

    </AdminLayout>
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