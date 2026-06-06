import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import { toBS } from '../../lib/nepaliDate'
import useAccounts from '../../hooks/useAccounts'

const EMPTY_FORM = {
  category: '', amount: '', description: '', expense_date: '', account_id: '',
  nepali_date: '',
}

export default function AdminExpenditure() {
  const [expenditures,     setExpenditures]     = useState([])
  const [categories,       setCategories]       = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')
  const [successMsg,       setSuccessMsg]       = useState('')
  const { accounts } = useAccounts()

  const [showForm,         setShowForm]         = useState(false)
  const [editItem,         setEditItem]         = useState(null)
  const [form,             setForm]             = useState(EMPTY_FORM)
  const [formErr,          setFormErr]          = useState('')
  const [formLoad,         setFormLoad]         = useState(false)

  const [search,           setSearch]           = useState('')
  const [catFilter,        setCatFilter]        = useState('all')
  const [showConfirm,      setShowConfirm]      = useState(null)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null)

  // category management
  const [showCatPanel, setShowCatPanel] = useState(false)
  const [newCatName,   setNewCatName]   = useState('')
  const [catErr,       setCatErr]       = useState('')
  const [catLoad,      setCatLoad]      = useState(false)
  const [editCat,      setEditCat]      = useState(null)
  const [editCatName,  setEditCatName]  = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    try {
      const [expRes, catRes] = await Promise.all([
        api.get('/expenditures/'),
        api.get('/expenditures/categories/'),
      ])
      setExpenditures(expRes.data)
      setCategories(catRes.data)
    } catch {
      setError('Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function openAdd() {
    setEditItem(null)
    setForm({
      ...EMPTY_FORM,
      expense_date: new Date().toISOString().split('T')[0],
    })
    setFormErr('')
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      category:     item.category,
      amount:       item.amount,
      description:  item.description,
      expense_date: item.expense_date,
    })
    setFormErr('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
    setForm(EMPTY_FORM)
    setFormErr('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')
    if (!form.category) {
      setFormErr('Please select a category.')
      return
    }
    if (parseFloat(form.amount) <= 0) {
      setFormErr('Amount must be greater than zero.')
      return
    }
    if (!form.account_id) {
      setFormErr('Please select an account.')
      return
    }
    if (!form.nepali_date) {
      setFormErr('Please enter the date.')
      return
    }
    setFormLoad(true)
    try {
      if (editItem) {
        await api.patch(`/expenditures/${editItem.id}/`, form)
        flash('Expenditure updated.')
      } else {
        await api.post('/expenditures/', form)
        flash('Expenditure recorded.')
      }
      closeForm()
      fetchAll()
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

  async function handleDelete(item) {
    try {
      await api.delete(`/expenditures/${item.id}/`)
      flash('Expenditure deleted.')
      setShowConfirm(null)
      fetchAll()
    } catch {
      setError('Failed to delete.')
      setShowConfirm(null)
    }
  }

  // ── Category management ───────────────────────────────────────────────────

  async function handleAddCategory(e) {
    e.preventDefault()
    setCatErr('')
    if (!newCatName.trim()) {
      setCatErr('Category name is required.')
      return
    }
    setCatLoad(true)
    try {
      await api.post('/expenditures/categories/', { name: newCatName.trim() })
      setNewCatName('')
      flash('Category added.')
      fetchAll()
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const first = Object.values(data)[0]
        setCatErr(Array.isArray(first) ? first[0] : first)
      } else {
        setCatErr('Failed to add category.')
      }
    } finally {
      setCatLoad(false)
    }
  }

  async function handleEditCategory(cat) {
    if (!editCatName.trim()) return
    try {
      await api.patch(`/expenditures/categories/${cat.id}/`, {
        name: editCatName.trim()
      })
      setEditCat(null)
      setEditCatName('')
      flash('Category updated.')
      fetchAll()
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const first = Object.values(data)[0]
        setCatErr(Array.isArray(first) ? first[0] : first)
      } else {
        setCatErr('Failed to update category.')
      }
    }
  }

  async function handleDeleteCategory(cat) {
    try {
      await api.delete(`/expenditures/categories/${cat.id}/`)
      flash(
        cat.expenditure_count > 0
          ? `Category "${cat.name}" deactivated.`
          : `Category "${cat.name}" deleted.`
      )
      setConfirmDeleteCat(null)
      fetchAll()
    } catch {
      setError('Failed to remove category.')
      setConfirmDeleteCat(null)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  const filtered = expenditures.filter((e) => {
    const matchCat    = catFilter === 'all' || e.category === catFilter
    const q           = search.toLowerCase()
    const matchSearch = !q ||
      e.description?.toLowerCase().includes(q) ||
      e.category_name?.toLowerCase().includes(q) ||
      e.recorded_by_name?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const totalFiltered = filtered.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0), 0
  )

  const totalAll = expenditures.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0), 0
  )

  const byCat = categories.map(cat => ({
    ...cat,
    total: expenditures
      .filter(e => e.category === cat.id)
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0),
  }))

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Expenditure
            </h2>
            <p className="text-sm text-gray-500">
              {expenditures.length} records · Total {fmt(totalAll)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCatPanel(true)}
              className="btn-secondary text-sm">
              Manage categories
            </button>
            <button onClick={openAdd} className="btn-primary text-sm">
              + Record expenditure
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

        {/* Category summary cards */}
        {byCat.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {byCat.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCatFilter(
                  catFilter === cat.id ? 'all' : cat.id
                )}
                className={`rounded-xl border p-3 text-left transition-colors
                  ${catFilter === cat.id
                    ? 'bg-primary-50 border-primary-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}>
                <p className="text-xs text-gray-500 truncate">{cat.name}</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">
                  {fmt(cat.total)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {cat.expenditure_count} record{cat.expenditure_count !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <select
            className="input-field max-w-xs text-sm"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            className="input-field max-w-xs text-sm"
            placeholder="Search description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(search || catFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setCatFilter('all') }}
              className="text-xs text-gray-500 hover:text-gray-700 underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {filtered.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200
                            flex justify-between items-center">
              <p className="text-xs text-gray-500">
                Showing {filtered.length} records
              </p>
              <p className="text-xs font-semibold text-gray-700">
                Total: {fmt(totalFiltered)}
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Category', 'Description',
                    'Amount', 'Recorded by', 'Actions'].map(h => (
                    <th key={h}
                      className="px-4 py-3 text-left text-xs font-semibold
                                 text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6}
                      className="px-4 py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}
                      className="px-4 py-10 text-center text-gray-400">
                      {search || catFilter !== 'all'
                        ? 'No records match your filters.'
                        : 'No expenditures recorded yet.'}
                    </td>
                  </tr>
                ) : filtered.map((item) => (
                  <tr key={item.id}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {toBS(item.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-info">
                        {item.category_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600
                                   whitespace-nowrap">
                      {fmt(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {item.recorded_by_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs text-primary-600
                                     hover:text-primary-800 font-medium">
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setShowConfirm(item)}
                          className="text-xs text-red-500
                                     hover:text-red-700 font-medium">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add / Edit expenditure modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {editItem ? 'Edit expenditure' : 'Record expenditure'}
              </h3>
              <button
                onClick={closeForm}
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
                <button
                  type="button"
                  onClick={() => { closeForm(); setShowCatPanel(true) }}
                  className="text-xs text-primary-600 hover:text-primary-700
                             mt-1 underline">
                  + Add new category
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (Rs.) <span className="text-red-500">*</span>
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
                      {a.name} (Rs. {parseFloat(a.balance).toLocaleString('en-NP')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date (BS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="2082-02-11"
                  value={form.nepali_date}
                  onChange={(e) => setForm({ ...form, nepali_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Describe the expenditure..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoad}
                  className="btn-primary flex-1">
                  {formLoad
                    ? 'Saving...'
                    : editItem ? 'Save changes' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category management panel */}
      {showCatPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                          max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-800">
                Manage categories
              </h3>
              <button
                onClick={() => {
                  setShowCatPanel(false)
                  setNewCatName('')
                  setCatErr('')
                  setEditCat(null)
                  setConfirmDeleteCat(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>

            {/* Add new category */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Add new category
              </p>
              {catErr && (
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-xs">
                  {catErr}
                </div>
              )}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1 text-sm"
                  placeholder="e.g. Training & Development"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value)
                    setCatErr('')
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={catLoad || !newCatName.trim()}
                  className="btn-primary text-sm px-4 flex-shrink-0">
                  {catLoad ? '...' : 'Add'}
                </button>
              </form>
            </div>

            {/* Existing categories */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase
                               tracking-wide">
                  {categories.length} categories
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {categories.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">
                    No categories yet. Add one above.
                  </div>
                ) : categories.map((cat) => (
                  <div key={cat.id}>
                    {editCat?.id === cat.id ? (
                      <div className="px-6 py-3 flex gap-2">
                        <input
                          type="text"
                          className="input-field flex-1 text-sm py-1.5"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditCategory(cat)}
                          disabled={!editCatName.trim()}
                          className="btn-primary text-xs px-3">
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditCat(null)
                            setEditCatName('')
                          }}
                          className="btn-secondary text-xs px-3">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="px-6 py-3 flex items-center
                                      justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {cat.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cat.expenditure_count} expenditure
                            {cat.expenditure_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditCat(cat)
                              setEditCatName(cat.name)
                              setCatErr('')
                              setConfirmDeleteCat(null)
                            }}
                            className="text-xs text-primary-600
                                       hover:text-primary-800 font-medium">
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setConfirmDeleteCat(cat)
                              setEditCat(null)
                            }}
                            className="text-xs text-red-500
                                       hover:text-red-700 font-medium">
                            {cat.expenditure_count > 0 ? 'Deactivate' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline delete confirmation */}
                    {confirmDeleteCat?.id === cat.id && (
                      <div className="mx-4 mb-3 border border-red-200
                                      bg-red-50 rounded-xl p-4">
                        <p className="text-sm font-medium text-red-800 mb-1">
                          {cat.expenditure_count > 0
                            ? `Deactivate "${cat.name}"?`
                            : `Delete "${cat.name}"?`
                          }
                        </p>
                        <p className="text-xs text-red-600 mb-3">
                          {cat.expenditure_count > 0
                            ? `This category has ${cat.expenditure_count} expenditure(s) and will be deactivated instead of deleted.`
                            : 'This action cannot be undone.'
                          }
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDeleteCat(null)}
                            className="btn-secondary text-xs flex-1 py-1.5">
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="btn-danger text-xs flex-1 py-1.5">
                            {cat.expenditure_count > 0 ? 'Deactivate' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => {
                  setShowCatPanel(false)
                  setNewCatName('')
                  setCatErr('')
                  setEditCat(null)
                  setConfirmDeleteCat(null)
                }}
                className="btn-secondary w-full">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete expenditure confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-2">
              Delete expenditure?
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{showConfirm.description}</strong>
            </p>
            <p className="text-sm text-red-600 font-semibold mb-4">
              {fmt(showConfirm.amount)}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showConfirm)}
                className="btn-danger flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}