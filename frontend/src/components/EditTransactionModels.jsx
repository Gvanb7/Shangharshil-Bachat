import { useState, useEffect } from 'react'
import FiscalYearDatePicker from './FiscalYearDatePicker'
import api from '../lib/api'

export default function EditTransactionModal({
  type,           // 'savings_deposit'|'savings_withdrawal'|'savings_penalty'|'income'|'expenditure'
  transaction,    // current transaction data
  accounts,       // cash/bank accounts
  onClose,
  onSuccess,
}) {
  const [form,    setForm]    = useState({})
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    initForm()
    if (type === 'income')       fetchCategories('income')
    if (type === 'expenditure')  fetchCategories('expenditure')
  }, [transaction])

  function initForm() {
    const base = {
      fiscal_year: '',
      nepali_date: transaction.nepali_date || '',
      account_id:  '',
      reason:      '',
    }

    if (type === 'savings_deposit' || type === 'savings_withdrawal') {
      setForm({ ...base, amount: transaction.amount, note: transaction.note || '' })
    } else if (type === 'savings_penalty') {
      setForm({ ...base, amount: transaction.amount, reason: transaction.reason || '' })
    } else if (type === 'income') {
      setForm({
        ...base,
        amount:      transaction.amount,
        category:    transaction.category,
        description: transaction.description || '',
      })
    } else if (type === 'expenditure') {
      setForm({
        ...base,
        amount:      transaction.amount,
        category:    transaction.category,
        description: transaction.description || '',
      })
    }
  }

  async function fetchCategories(kind) {
    try {
      const url = kind === 'income'
        ? '/income/categories/' : '/expenditures/categories/'
      const res = await api.get(url)
      setCategories(res.data)
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')

    if (!form.nepali_date) {
      setErr('Please select a date.')
      return
    }
    if (!form.account_id) {
      setErr('Please select an account.')
      return
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setErr('Enter a valid amount.')
      return
    }

    setLoading(true)
    try {
      let url, payload

      if (type === 'savings_deposit' || type === 'savings_withdrawal') {
        url     = `/savings/transactions/${transaction.id}/edit/`
        payload = {
          amount:      form.amount,
          note:        form.note,
          nepali_date: form.nepali_date,
          account_id:  form.account_id,
          reason:      form.reason,
        }
      } else if (type === 'savings_penalty') {
        url     = `/savings/penalties/${transaction.id}/edit/`
        payload = {
          amount:      form.amount,
          reason:      form.reason,
          nepali_date: form.nepali_date,
          account_id:  form.account_id,
        }
      } else if (type === 'income') {
        url     = `/income/${transaction.id}/edit/`
        payload = {
          amount:      form.amount,
          category:    form.category,
          description: form.description,
          nepali_date: form.nepali_date,
          account_id:  form.account_id,
          reason:      form.reason,
        }
      } else if (type === 'expenditure') {
        url     = `/expenditures/${transaction.id}/edit/`
        payload = {
          amount:      form.amount,
          category:    form.category,
          description: form.description,
          nepali_date: form.nepali_date,
          account_id:  form.account_id,
          reason:      form.reason,
        }
      }

      await api.patch(url, payload)
      onSuccess()
    } catch (err) {
      setErr(err.response?.data?.error || 'Failed to save changes.')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    savings_deposit:    'Edit deposit',
    savings_withdrawal: 'Edit withdrawal',
    savings_penalty:    'Edit savings penalty',
    income:             'Edit income',
    expenditure:        'Edit expenditure',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                      max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex
                        items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">
            {titles[type] || 'Edit transaction'}
          </h3>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && (
            <div className="px-3 py-2 bg-red-50 border border-red-200
                            text-red-700 rounded-lg text-sm">
              {err}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg
                          px-4 py-3">
            <p className="text-xs text-amber-700">
              ⚠️ Editing this transaction will reverse the original entry
              and create a corrected one. Account balances will be
              automatically updated. This action is logged.
            </p>
          </div>

          {/* Fiscal year + date */}
          <FiscalYearDatePicker
            fiscalYear={form.fiscal_year}
            onFiscalYearChange={(fy) => setForm({ ...form, fiscal_year: fy })}
            dateValue={form.nepali_date}
            onDateChange={(val) => setForm({ ...form, nepali_date: val })}
            required
          />

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (Rs.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.01" min="0.01"
              className="input-field"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>

          {/* Account */}
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
                  {parseFloat(a.balance).toLocaleString('en-NP')}
                </option>
              ))}
            </select>
          </div>

          {/* Category — income and expenditure only */}
          {(type === 'income' || type === 'expenditure') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required>
                <option value="">Select category...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description — income and expenditure only */}
          {(type === 'income' || type === 'expenditure') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text" className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          )}

          {/* Note — savings deposit/withdrawal */}
          {(type === 'savings_deposit' || type === 'savings_withdrawal') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <input
                type="text" className="input-field"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          )}

          {/* Reason — penalty */}
          {type === 'savings_penalty' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <input
                type="text" className="input-field"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          )}

          {/* Edit reason — all types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for edit (optional)
            </label>
            <input
              type="text" className="input-field"
              placeholder="e.g. Wrong amount entered"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading}
              className="btn-primary flex-1">
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}