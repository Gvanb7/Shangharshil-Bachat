import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',  'Ashwin', 'Kartik', 'Mangsir',
  'Poush',   'Magh',   'Falgun', 'Chaitra',
]

export default function AdminStatements() {
  const [statements,  setStatements]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [successMsg,  setSuccessMsg]  = useState('')
  const [activeTab,   setActiveTab]   = useState('monthly')
  const [selected,    setSelected]    = useState(null)
  const [selectLoad,  setSelectLoad]  = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fiscalYears,  setFiscalYears]  = useState([])
  const [monthOptions, setMonthOptions] = useState([])


  // settings
  const [settings,      setSettings]      = useState(null)
  const [showSettings,  setShowSettings]  = useState(false)
  const [openingEquity, setOpeningEquity] = useState('')
  const [settingsLoad,  setSettingsLoad]  = useState(false)
  const [settingsErr,   setSettingsErr]   = useState('')

  // generate form
  const [genForm, setGenForm] = useState({
   fiscal_year: '', bs_year: '', bs_month: ''
  })

  const printRef = useRef(null)

  useEffect(() => {
    fetchStatements()
    fetchSettings()
    fetchFiscalYears()
  }, [])

  async function fetchStatements() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/statements/?type=${activeTab}`)
      setStatements(res.data)
    } catch {
      setError('Failed to load statements.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSettings() {
    try {
      const res = await api.get('/settings/')
      setSettings(res.data)
      setOpeningEquity(res.data.opening_equity)
    } catch {}
  }

  async function fetchFiscalYears() {
    try {
      const res = await api.get('/fiscal-years/')
      setFiscalYears(res.data.fiscal_years)
    } catch {
      setError('Failed to load fiscal years.')
    }
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function fetchMonthsForFY(fy) {
  if (!fy) {
    setMonthOptions([])
    return
  }
  try {
    const res = await api.get(`/fiscal-years/months/?fy=${fy}`)
    setMonthOptions(res.data.months)
  } catch {
    setMonthOptions([])
  }
}


  async function selectStatement(s) {
    setSelectLoad(true)
    setError('')
    try {
      const res = await api.get(`/statements/${s.id}/`)
      setSelected(res.data)
    } catch {
      setError('Failed to load statement data.')
    } finally {
      setSelectLoad(false)
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setGenerating(true)
    setError('')
    try {
      const payload = {
        period_type: activeTab,
        force:       false,
        ...(activeTab === 'monthly'
          ? { bs_year: genForm.bs_year, bs_month: genForm.bs_month }
          : { fiscal_year: genForm.fiscal_year }
        ),
      }
      const res = await api.post('/statements/generate/', payload)
      flash(res.data.created
        ? 'Statement generated successfully.'
        : 'Statement already exists — showing latest data.'
      )
      setSelected(res.data.statement)
      fetchStatements()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate statement.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!selected) return
    setGenerating(true)
    setError('')
    try {
      const payload = {
        period_type: selected.period_type,
        force:       true,
        ...(selected.period_type === 'monthly'
          ? { bs_year: selected.bs_year, bs_month: selected.bs_month }
          : { fiscal_year: selected.fiscal_year }
        ),
      }
      const res     = await api.post('/statements/generate/', payload)
      const freshRes = await api.get(`/statements/${res.data.statement.id}/`)
      setSelected(freshRes.data)
      flash('Statement regenerated — showing latest live data.')
      fetchStatements()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      await api.delete(`/statements/${selected.id}/`)
      flash('Statement deleted.')
      setSelected(null)
      setShowConfirm(false)
      fetchStatements()
    } catch {
      setError('Failed to delete statement.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSettingsErr('')
    setSettingsLoad(true)
    try {
      const res = await api.patch('/settings/', {
        opening_equity: openingEquity
      })
      setSettings(res.data)
      setShowSettings(false)
      flash('Opening equity saved.')
    } catch (err) {
      setSettingsErr(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSettingsLoad(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  async function handleDownloadExcel() {
    if (!selected) return
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()
      const rows = buildExcelRows(selected)
      const ws   = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance')
      XLSX.writeFile(
        wb,
        `trial_balance_${
          selected.period_type === 'monthly'
            ? `${selected.bs_month_name}_${selected.bs_year}`
            : `FY_${selected.fiscal_year.replace('/', '-')}`
        }.xlsx`
      )
    } catch (err) {
      setError('Failed to download Excel file.')
    }
  }

  function buildExcelRows(tb) {
    const f = (n) => parseFloat(n || 0).toFixed(2)
    const rows = []

    rows.push(['SHREE SHANGHARSHIL BACHAT SAMUHA', '', '', ''])
    rows.push(['Receipts and Payments Report', '', '', ''])
    rows.push([
      tb.period_type === 'monthly'
        ? `${tb.bs_month_name} ${tb.bs_year} (FY ${tb.fiscal_year})`
        : `Fiscal Year ${tb.fiscal_year}`,
      '', '', '',
    ])
    rows.push([`Period: ${tb.start_date_ad} to ${tb.end_date_ad}`, '', '', ''])
    rows.push(['', '', '', ''])
    rows.push(['Income', 'Amount', 'Expenditure', 'Amount'])
    rows.push(['', '', '', ''])

    const incomeItems = tb.income_items || []
    const expItems     = tb.expenditure_items || []
    const maxRows       = Math.max(incomeItems.length, expItems.length)

    for (let i = 0; i < maxRows; i++) {
      const inc = incomeItems[i]
      const exp = expItems[i]
      rows.push([
        inc ? inc.name : '',
        inc ? f(inc.amount) : '',
        exp ? exp.name : '',
        exp ? f(exp.amount) : '',
      ])
    }

    rows.push(['', '', '', ''])
    rows.push([
      'Total Income', f(tb.total_income),
      'Total Expenditure', f(tb.total_expenditure),
    ])
    rows.push(['', '', '', ''])
    rows.push([`Generated: ${new Date(tb.generated_at).toLocaleString()}`, '', '', ''])

    return rows
  }

  function fmt(amount) {
    return `Rs. ${parseFloat(amount || 0).toLocaleString('en-NP', {
      minimumFractionDigits: 2,
    })}`
  }

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Statements
            </h2>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary text-sm">
            ⚙ Opening equity
          </button>
        </div>

        {/* Opening equity warning */}
        {settings && !settings.opening_equity_set && (
          <div className="px-4 py-3 bg-yellow-50 border border-yellow-200
                          rounded-lg text-sm text-yellow-800 flex items-center
                          justify-between">
            <span>
              ⚠ Opening equity not set. Set it before generating statements.
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs font-medium underline">
              Set now
            </button>
          </div>
        )}

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

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { key: 'monthly', label: 'Monthly'  },
            { key: 'annual',  label: 'Annual'   },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setSelected(null)
              }}
              className={`px-6 py-2.5 text-sm font-medium border-b-2
                          transition-colors
                          ${activeTab === tab.key
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left panel — generate + list */}
          <div className="space-y-4">

            {/* Generate form */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-gray-800">
                  Generate statement
                </h3>
              </div>
             <form onSubmit={handleGenerate} className="px-4 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Fiscal Year
                  </label>
                  <select
                    className="input-field text-sm"
                    value={genForm.fiscal_year}
                    onChange={(e) => {
                      const fy = e.target.value
                      setGenForm({ ...genForm, fiscal_year: fy, bs_year: '', bs_month: '' })
                      fetchMonthsForFY(fy)
                    }}
                    required>
                    <option value="">Select fiscal year...</option>
                    {fiscalYears.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>

                {activeTab === 'monthly' && genForm.fiscal_year && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Month
                    </label>
                    <select
                      className="input-field text-sm"
                      value={genForm.bs_month && genForm.bs_year
                        ? `${genForm.bs_year}-${genForm.bs_month}` : ''}
                      onChange={(e) => {
                        const [y, m] = e.target.value.split('-')
                        setGenForm({ ...genForm, bs_year: y, bs_month: m })
                      }}
                      required>
                      <option value="">Select month...</option>
                      {monthOptions.map(m => (
                        <option key={`${m.bs_year}-${m.bs_month}`}
                          value={`${m.bs_year}-${m.bs_month}`}>
                          {m.month_name} {m.bs_year}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={generating}
                  className="btn-primary w-full text-sm">
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </form>
            </div>

            {/* Statements list */}
            <div className="card overflow-hidden">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-gray-800">
                  {statements.length} statement
                  {statements.length !== 1 ? 's' : ''}
                </h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    Loading...
                  </div>
                ) : statements.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    No statements yet.
                  </div>
                ) : statements.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => selectStatement(s)}
                    className={`px-4 py-3 cursor-pointer transition-colors
                                hover:bg-gray-50
                      ${selected?.id === s.id
                        ? 'bg-primary-50 border-l-4 border-primary-500'
                        : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {s.period_type === 'monthly'
                            ? `${s.bs_month_name} ${s.bs_year}`
                            : `FY ${s.fiscal_year}`
                          }
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.is_auto_generated ? 'Auto' : 'Manual'} ·{' '}
                          {new Date(s.generated_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectLoad && selected?.id === s.id ? (
                        <span className="text-xs text-gray-400">...</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right panel — statement detail */}
          <div className="lg:col-span-2">
            {selectLoad ? (
              <div className="card flex items-center justify-center h-64
                              text-gray-400 text-sm">
                Loading statement data...
              </div>
            ) : !selected ? (
              <div className="card flex items-center justify-center h-64
                              text-gray-400 text-sm">
                ← Select a statement to view
              </div>
            ) : (
              <div className="card overflow-hidden">

                {/* Actions bar */}
                <div className="px-6 py-3 border-b border-gray-200 flex
                                items-center justify-between flex-wrap gap-2
                                no-print">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handlePrint}
                      className="btn-secondary text-xs py-1.5">
                      🖨 Print
                    </button>
                    <button
                      onClick={handleDownloadExcel}
                      className="btn-secondary text-xs py-1.5">
                      ⬇ Excel
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={generating}
                      className="btn-secondary text-xs py-1.5">
                      {generating ? '...' : '↺ Regenerate'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(true)}
                      className="text-xs text-red-500 hover:text-red-700
                                 font-medium px-2">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Statement content */}
                <div ref={printRef} className="px-6 py-5 print-area
                                               overflow-x-auto">
                  <StatementContent statement={selected} fmt={fmt} />
                </div>

              </div>
            )}
          </div>

        </div>
      </div>

      {/* Opening equity modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between">
              <h3 className="font-semibold text-gray-800">Opening equity</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveSettings}
              className="px-6 py-5 space-y-4">
              {settingsErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {settingsErr}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Opening equity (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  placeholder="0.00"
                  value={openingEquity}
                  onChange={(e) => setOpeningEquity(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Total equity before using this system. Set once —
                  used as base for all statements.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingsLoad}
                  className="btn-primary flex-1">
                  {settingsLoad ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-2">
              Delete statement?
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              {selected?.period_type === 'monthly'
                ? `${selected?.bs_month_name} ${selected?.bs_year}`
                : `FY ${selected?.fiscal_year}`
              }
            </p>
            <p className="text-xs text-gray-400 mb-4">
              The period record will be deleted. You can regenerate
              it later from the same transaction data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger flex-1">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}

// ── Statement content ─────────────────────────────────────────────────────────

// Replace the entire StatementContent function with this updated version

function StatementContent({ statement: s, fmt }) {
  const isMonthly = s.period_type === 'monthly'
  const maxRows = Math.max(
    s.income_items?.length || 0,
    s.expenditure_items?.length || 0
  )

  return (
    <div className="text-xs text-gray-800 space-y-4">

      {/* Header */}
      <div className="text-center space-y-1 border-b-2 border-gray-800 pb-3">
        <p className="text-base font-bold uppercase tracking-wide">
          Shree Shangharshil Bachat Samuha
        </p>
        <p className="text-sm font-semibold">Receipts and Payments Report</p>
        <p className="text-sm">
          {isMonthly
            ? `${s.bs_month_name} ${s.bs_year} (FY ${s.fiscal_year})`
            : `Fiscal Year ${s.fiscal_year}`
          }
        </p>
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-2 gap-4 font-bold
                      border-b border-gray-400 pb-1">
        <div className="grid grid-cols-2 gap-2">
          <span>Income</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span>Expenditure</span>
          <span className="text-right">Amount</span>
        </div>
      </div>

      {/* Two column layout — stacked on mobile, side by side on larger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">

        {/* Income column */}
        <div>
          <p className="font-bold uppercase border-b-2 border-gray-700
                        pb-1 mb-2 sm:hidden">
            Income
          </p>
          <div className="space-y-1">
            {(s.income_items || []).length === 0 ? (
              <p className="text-gray-400 italic">No entries</p>
            ) : s.income_items.map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="flex-shrink-0">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 font-bold
                          border-t-2 border-gray-700 mt-2 pt-1.5">
            <span>Total Income</span>
            <span>{fmt(s.total_income)}</span>
          </div>
        </div>

        {/* Expenditure column */}
        <div>
          <p className="font-bold uppercase border-b-2 border-gray-700
                        pb-1 mb-2 sm:hidden">
            Expenditure
          </p>
          <div className="space-y-1">
            {(s.expenditure_items || []).length === 0 ? (
              <p className="text-gray-400 italic">No entries</p>
            ) : s.expenditure_items.map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="flex-shrink-0">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 font-bold
                          border-t-2 border-gray-700 mt-2 pt-1.5">
            <span>Total Expenditure</span>
            <span>{fmt(s.total_expenditure)}</span>
          </div>
        </div>

      </div>

      {/* Signature section */}
      <div className="border-t border-gray-300 pt-8 mt-8">
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="border-t border-gray-500 pt-1 mt-10">
              <p className="font-medium">Prepared By</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-500 pt-1 mt-10">
              <p className="font-medium">Verified By</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-500 pt-1 mt-10">
              <p className="font-medium">Date</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}