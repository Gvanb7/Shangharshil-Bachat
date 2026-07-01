import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import { toBS, formatBS } from '../../lib/nepaliDate'
import BSDatePicker from '../../components/BSDatePicker'
import FiscalYearDatePicker from '../../components/FiscalYearDatePicker'

const ACCOUNT_TYPES = [
  { value: 'cash',    label: 'Cash'           },
  { value: 'bank',    label: 'Bank'           },
  { value: 'digital', label: 'Digital Wallet' },
  { value: 'other',   label: 'Other'          },
]

const EMPTY_FORM = {
  name: '', account_type: 'cash', bank_name: '',
  account_number: '', branch: '', opening_balance: '0', 
}

export default function AdminAccounts() {
  const [accounts,    setAccounts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [successMsg,  setSuccessMsg]  = useState('')

  const [showForm,    setShowForm]    = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [formErr,     setFormErr]     = useState('')
  const [formLoad,    setFormLoad]    = useState(false)

  const [selected,    setSelected]    = useState(null)
  const [txns,        setTxns]        = useState([])
  const [txnLoad,     setTxnLoad]     = useState(false)

  const [showAdjust,  setShowAdjust]  = useState(false)
  const [adjForm,     setAdjForm]     = useState({
    type: 'add', amount: '', note: '', nepali_date: '', fiscal_year: ''
  })
  const [adjErr,      setAdjErr]      = useState('')
  const [adjLoad,     setAdjLoad]     = useState(false)

  const [showTransfer, setShowTransfer] = useState(false)
  const [transferForm, setTransferForm] = useState({
    from_account: '', to_account: '', amount: '', note: '', nepali_date: '',
    fiscal_year: ''
  })
  const [transferErr,  setTransferErr]  = useState('')
  const [transferLoad, setTransferLoad] = useState(false)

  useEffect(() => { fetchAccounts() }, [])

  async function fetchAccounts() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/accounts/')
      setAccounts(res.data)
    } catch {
      setError('Failed to load accounts.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchTxns(accountId) {
    setTxnLoad(true)
    try {
      const res = await api.get(`/accounts/${accountId}/transactions/`)
      setTxns(res.data)
    } catch {
      setTxns([])
    } finally {
      setTxnLoad(false)
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

  function openAddForm() {
    setEditAccount(null)
    setForm(EMPTY_FORM)
    setFormErr('')
    setShowForm(true)
  }

  function openEditForm(acc) {
    setEditAccount(acc)
    setForm({
      name:            acc.name,
      account_type:    acc.account_type,
      bank_name:       acc.bank_name       || '',
      account_number:  acc.account_number  || '',
      branch:          acc.branch          || '',
      opening_balance: acc.opening_balance || '0',
    })
    setFormErr('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')
    setFormLoad(true)
    try {
      if (editAccount) {
        const res = await api.patch(
          `/accounts/${editAccount.id}/`,
          { name: form.name, bank_name: form.bank_name,
            account_number: form.account_number, branch: form.branch }
        )
        setAccounts(prev =>
          prev.map(a => a.id === editAccount.id ? res.data : a)
        )
        if (selected?.id === editAccount.id) setSelected(res.data)
        flash('Account updated.')
      } else {
        await api.post('/accounts/', form)
        flash('Account created.')
        fetchAccounts()
      }
      setShowForm(false)
      setEditAccount(null)
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const first = Object.values(data)[0]
        setFormErr(Array.isArray(first) ? first[0] : first)
      } else {
        setFormErr('Something went wrong.')
      }
    } finally {
      setFormLoad(false)
    }
  }

  async function handleAdjust(e) {
    e.preventDefault()
    setAdjErr('')
    if (!adjForm.amount || parseFloat(adjForm.amount) <= 0) {
      setAdjErr('Enter a valid amount.')
      return
    }
    setAdjLoad(true)
    try {
      const res = await api.post(
        `/accounts/${selected.id}/adjust/`, adjForm
      )
      flash(`Balance ${adjForm.type === 'add' ? 'increased' : 'reduced'} successfully.`)
      setShowAdjust(false)
      setAdjForm({ type: 'add', amount: '', note: '', nepali_date: '', fiscal_year: '' })
      setSelected(res.data)
      fetchAccounts()
      fetchTxns(selected.id)
    } catch (err) {
      setAdjErr(err.response?.data?.error || 'Adjustment failed.')
    } finally {
      setAdjLoad(false)
    }
  }

  async function handleTransfer(e) {
    e.preventDefault()
    setTransferErr('')
    if (!transferForm.amount || parseFloat(transferForm.amount) <= 0) {
      setTransferErr('Enter a valid amount.')
      return
    }
    setTransferLoad(true)
    try {
      await api.post('/accounts/transfer/', transferForm)
      flash('Transfer completed successfully.')
      setShowTransfer(false)
      setTransferForm({
        from_account: '', to_account: '', amount: '', note: '', nepali_date: ''
      })
      fetchAccounts()
      if (selected) fetchTxns(selected.id)
    } catch (err) {
      setTransferErr(err.response?.data?.error || 'Transfer failed.')
    } finally {
      setTransferLoad(false)
    }
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const totalBalance = accounts.reduce(
    (sum, a) => sum + parseFloat(a.balance || 0), 0
  )

  const REF_LABELS = {
    savings_deposit:    'Savings Deposit',
    savings_withdrawal: 'Savings Withdrawal',
    loan_disbursement:  'Loan Disbursement',
    loan_repayment:     'Loan Repayment',
    income:             'Income',
    expenditure:        'Expenditure',
    transfer_in:        'Transfer In',
    transfer_out:       'Transfer Out',
    adjustment_add:     'Manual Adjustment',
    adjustment_reduce:  'Manual Adjustment',
  }

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Manage Accounts
            </h2>
            <p className="text-sm text-gray-500">
              {accounts.length} accounts · Total {fmt(totalBalance)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setTransferErr('')
                let currentFY = ''
                try {
                  const res = await api.get('/fiscal-years/current/')
                  currentFY = res.data.fiscal_year
                } catch {}
                setTransferForm({
                  from_account: '', to_account: '',
                  amount: '', note: '', nepali_date: '', fiscal_year: currentFY
                })  
                setShowTransfer(true)
              }}
              className="btn-secondary text-sm">
              ⇄ Transfer
            </button>
            <button onClick={openAddForm} className="btn-primary text-sm">
              + Add account
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Accounts list */}
          <div className="space-y-3">
            {loading ? (
              <div className="card px-6 py-10 text-center text-gray-400">
                Loading...
              </div>
            ) : accounts.length === 0 ? (
              <div className="card px-6 py-10 text-center text-gray-400">
                No accounts yet. Add one above.
              </div>
            ) : accounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => selectAccount(acc)}
                className={`card cursor-pointer transition-colors hover:shadow-md
                  ${selected?.id === acc.id
                    ? 'ring-2 ring-primary-500'
                    : ''}`}>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center
                                    justify-center text-lg flex-shrink-0
                      ${acc.account_type === 'cash'
                        ? 'bg-green-100'
                        : acc.account_type === 'bank'
                          ? 'bg-blue-100'
                          : 'bg-purple-100'
                      }`}>
                      {acc.account_type === 'cash'  ? '💵' :
                       acc.account_type === 'bank'  ? '🏛️' :
                       acc.account_type === 'digital'? '📱' : '💼'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {acc.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {acc.account_type_display}
                        {acc.bank_name && ` · ${acc.bank_name}`}
                        {acc.account_number && (
                          acc.account_type === 'digital'
                            ? ` · 📱 ${acc.account_number}`
                            : ` · ${acc.account_number}`
                        )}
                        {acc.branch && ` · ${acc.branch}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">
                      {fmt(acc.balance)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Opening: {fmt(acc.opening_balance)}
                    </p>
                  </div>
                </div>

                {/* Account actions */}
                <div className="px-4 py-2 border-t border-gray-100
                                flex gap-3"
                  onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditForm(acc)}
                    className="text-xs text-primary-600
                               hover:text-primary-800 font-medium">
                    Edit
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={async () => {
                      selectAccount(acc)
                      let currentFY = ''
                      try {
                        const res = await api.get('/fiscal-years/current/')
                        currentFY = res.data.fiscal_year
                      } catch {}
                      setAdjForm({
                        type: 'add', amount: '', note: '', nepali_date: '', fiscal_year: currentFY
                      })
                      setAdjErr('')
                      setShowAdjust(true)
                    }}
                    className="text-xs text-yellow-600
                              hover:text-yellow-800 font-medium">
                    Adjust balance
                  </button>
                  <span className="text-gray-300">|</span>
                </div>
              </div>
            ))}
          </div>

          {/* Transaction history panel */}
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
                        {selected.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Balance:{' '}
                        <strong className="text-gray-800">
                          {fmt(selected.balance)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100
                                max-h-[32rem] overflow-y-auto">
                  {txnLoad ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      Loading...
                    </div>
                  ) : txns.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      No transactions yet.
                    </div>
                  ) : txns.map((t) => (
                    <div key={t.id} className="px-4 py-3 flex items-center
                                               justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {REF_LABELS[t.reference_type] || t.reference_type}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.nepali_date
                            ? formatBS(t.nepali_date)
                            : toBS(t.created_at)
                          }
                          {t.note && ` · ${t.note}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          By: {t.created_by_name || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold
                          ${t.transaction_type === 'credit'
                            ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {t.transaction_type === 'credit' ? '+' : '-'}
                          {fmt(t.amount)}
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

      {/* Add / Edit account modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                          max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between sticky top-0
                            bg-white z-10">
              <h3 className="font-semibold text-gray-800">
                {editAccount ? 'Edit account' : 'Add new account'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {formErr}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Account name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Shangharshil Savings Account"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {!editAccount && (
                <div>
                  <label className="block text-sm font-medium
                                    text-gray-700 mb-1">
                    Account type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input-field"
                    value={form.account_type}
                    onChange={(e) => setForm({
                      ...form, account_type: e.target.value
                    })}>
                    {ACCOUNT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bank details */}
              {(form.account_type === 'bank' ||
                editAccount?.account_type === 'bank') && (
                <>
                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-1">
                      Bank name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. NIC Asia Bank"
                      value={form.bank_name}
                      onChange={(e) => setForm({
                        ...form, bank_name: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-1">
                      Account number
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 0123456789"
                      value={form.account_number}
                      onChange={(e) => setForm({
                        ...form, account_number: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium
                                      text-gray-700 mb-1">
                      Branch
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Kathmandu"
                      value={form.branch}
                      onChange={(e) => setForm({
                        ...form, branch: e.target.value
                      })}
                    />
                  </div>
                </>
              )}

              {/* Digital wallet details */}
              {(form.account_type === 'digital' ||
                editAccount?.account_type === 'digital') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wallet name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. eSewa, Khalti, IME Pay"
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile number
                    </label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="98XXXXXXXX"
                      value={form.account_number}
                      onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    />
                  </div>
                  </>
                )}

              {/* Opening balance — only for new accounts */}
              {!editAccount && (
                <div>
                  <label className="block text-sm font-medium
                                    text-gray-700 mb-1">
                    Opening balance (Rs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    placeholder="0.00"
                    value={form.opening_balance}
                    onChange={(e) => setForm({
                      ...form, opening_balance: e.target.value
                    })}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Current balance in this account before using this system
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoad}
                  className="btn-primary flex-1">
                  {formLoad
                    ? 'Saving...'
                    : editAccount ? 'Save changes' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust balance modal */}
      {showAdjust && selected && (
         <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-screen flex justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">

              <div className="px-6 py-4 border-b border-gray-200 flex
                              items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Adjust balance — {selected.name}
              </h3>
              <button
                onClick={() => setShowAdjust(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <form onSubmit={handleAdjust} className="px-6 py-5 space-y-4">
              {adjErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {adjErr}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500">Current balance</p>
                <p className="text-lg font-bold text-gray-800">
                  {fmt(selected.balance)}
                </p>
              </div>

              <FiscalYearDatePicker
                fiscalYear={adjForm.fiscal_year}
                onFiscalYearChange={(fy) => setAdjForm({ ...adjForm, fiscal_year: fy })}
                dateValue={adjForm.nepali_date}
                onDateChange={(val) => setAdjForm({ ...adjForm, nepali_date: val })}
                required
              />

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Adjustment type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['add', 'reduce'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjForm({ ...adjForm, type: t })}
                      className={`py-2 rounded-lg text-sm font-medium border
                        transition-colors
                        ${adjForm.type === t
                          ? t === 'add'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}>
                      {t === 'add' ? '+ Add money' : '− Reduce money'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={adjForm.amount}
                  onChange={(e) => setAdjForm({
                    ...adjForm, amount: e.target.value
                  })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Reason for adjustment..."
                  value={adjForm.note}
                  onChange={(e) => setAdjForm({
                    ...adjForm, note: e.target.value
                  })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjust(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjLoad}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium
                    text-white transition-colors
                    ${adjForm.type === 'add'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                    }`}>
                  {adjLoad
                    ? 'Saving...'
                    : adjForm.type === 'add'
                      ? 'Add money'
                      : 'Reduce money'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-screen flex justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">

              <div className="px-6 py-4 border-b border-gray-200 flex
                              items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Transfer between accounts
              </h3>
              <button
                onClick={() => setShowTransfer(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <form onSubmit={handleTransfer} className="px-6 py-5 space-y-4">
              {transferErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {transferErr}
                </div>
              )}

              <FiscalYearDatePicker
                fiscalYear={transferForm.fiscal_year}
                onFiscalYearChange={(fy) => setTransferForm({ ...transferForm, fiscal_year: fy })}
                dateValue={transferForm.nepali_date}
                onDateChange={(val) => setTransferForm({ ...transferForm, nepali_date: val })}
                required
              />

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  From account <span className="text-red-500">*</span>
                </label>
                <select
                  className="input-field"
                  value={transferForm.from_account}
                  onChange={(e) => setTransferForm({
                    ...transferForm, from_account: e.target.value
                  })}
                  required>
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.account_type_display})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  To account <span className="text-red-500">*</span>
                </label>
                <select
                  className="input-field"
                  value={transferForm.to_account}
                  onChange={(e) => setTransferForm({
                    ...transferForm, to_account: e.target.value
                  })}
                  required>
                  <option value="">Select account...</option>
                  {accounts
                    .filter(a => a.id !== transferForm.from_account)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.account_type_display})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({
                    ...transferForm, amount: e.target.value
                  })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Cash deposited to bank"
                  value={transferForm.note}
                  onChange={(e) => setTransferForm({
                    ...transferForm, note: e.target.value
                  })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransfer(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoad}
                  className="btn-primary flex-1">
                  {transferLoad ? 'Transferring...' : 'Confirm transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}
    </AdminLayout>
  )
}