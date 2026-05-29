import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import { toBS } from '../../lib/nepaliDate'

const EMPTY_ACCOUNT_FORM = { member_id: '', interest_rate: '6.00' }
const EMPTY_TXN_FORM     = { amount: '', note: '' }

export default function AdminSavings() {
  const [accounts,    setAccounts]    = useState([])
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [successMsg,  setSuccessMsg]  = useState('')
  const [showInterestModal, setShowInterestModal] = useState(false)
  const [interestResult,    setInterestResult]    = useState(null)

  // selected account for transactions
  const [selected,    setSelected]    = useState(null)
  const [txns,        setTxns]        = useState([])
  const [txnLoading,  setTxnLoading]  = useState(false)

  // modals
  const [showCreate,  setShowCreate]  = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw,setShowWithdraw]= useState(false)

  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [txnForm,     setTxnForm]     = useState(EMPTY_TXN_FORM)
  const [formErr,     setFormErr]     = useState('')
  const [formLoad,    setFormLoad]    = useState(false)

  const [search,      setSearch]      = useState('')
  const [interestLoad,setInterestLoad]= useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [accRes, memRes] = await Promise.all([
        api.get('/savings/'),
        api.get('/admin/members/'),
      ])
      setAccounts(accRes.data)
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

  // members without savings account
  const membersWithoutAccount = members.filter(
    m => !accounts.find(a => a.member === m.id)
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
      // refresh selected account balance
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

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.member_name?.toLowerCase().includes(q) ||
      a.member_email?.toLowerCase().includes(q)
    )
  })

  const totalSavings = accounts.reduce(
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
              {accounts.length} accounts · Total {fmt(totalSavings)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() =>{
                setInterestResult(null)
                setShowInterestModal(true)
              }}
              disabled={interestLoad}
              className="btn-secondary text-sm">
              {interestLoad ? 'Applying...' : '+ Apply monthly interest'}
            </button>
            <button
              onClick={() => { setShowCreate(true); setFormErr('') }}
              className="btn-primary text-sm">
              + Open account
            </button>
          </div>
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

        <input
          type="text"
          className="input-field max-w-sm"
          placeholder="Search by member name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Accounts list */}
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
                    ${selected?.id === acc.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''}`}>
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
                      <span className={acc.is_active ? 'badge-success' : 'badge-danger'}>
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
                        Balance: <strong className="text-green-700">
                          {fmt(selected.balance)}
                        </strong>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowDeposit(true); setFormErr('') }}
                        className="btn-primary text-xs py-1.5">
                        Deposit
                      </button>
                      <button
                        onClick={() => { setShowWithdraw(true); setFormErr('') }}
                        className="btn-secondary text-xs py-1.5">
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {txnLoading ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      Loading transactions...
                    </div>
                  ) : txns.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                      No transactions yet.
                    </div>
                  ) : txns.map((t) => (
                    <div key={t.id} className="px-4 py-3 flex items-center
                                               justify-between">
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
                      <div className="text-right">
                        <p className={`text-sm font-semibold
                          ${t.type === 'withdrawal' ? 'text-red-600' : 'text-green-700'}`}>
                          {t.type === 'withdrawal' ? '-' : '+'}{fmt(t.amount)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Bal: {fmt(t.balance_after)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
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
            />
            <ModalButtons
              onCancel={closeAll}
              loading={formLoad}
              label="Confirm withdrawal"
            />
          </form>
        </Modal>
      )}

          {/* Interest modal — confirm or show result */}
    {showInterestModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center
                      bg-black bg-opacity-40 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

          {!interestResult ? (
            // confirmation screen
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
                  Active accounts: <strong>{accounts.filter(a => a.is_active).length}</strong>
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
            // result screen
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

                {/* Status banner */}
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

                {/* Applied accounts */}
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

                {/* Already done */}
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
    )}

  </AdminLayout>
  )
}

// ── small reusable pieces ─────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex
                        items-center justify-between">
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

function AmountNoteFields({ form, setForm, label }) {
  return (
    <>
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
          placeholder="Purpose of withdraw"
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