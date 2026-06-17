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

  // settings
  const [settings,      setSettings]      = useState(null)
  const [showSettings,  setShowSettings]  = useState(false)
  const [openingEquity, setOpeningEquity] = useState('')
  const [settingsLoad,  setSettingsLoad]  = useState(false)
  const [settingsErr,   setSettingsErr]   = useState('')

  // generate form
  const [genForm, setGenForm] = useState({
    bs_year: '', bs_month: '', fiscal_year: '',
  })

  const printRef = useRef(null)

  useEffect(() => {
    fetchStatements()
    fetchSettings()
  }, [activeTab])

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

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
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
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 18 }]
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
    const f    = (n) => parseFloat(n || 0).toFixed(2)
    const rows = []

    rows.push(['Shree Shangharshil Bachat Samuha', '', '', ''])
    rows.push(['Trial Balance', '', '', ''])
    rows.push([
      tb.period_type === 'monthly'
        ? `${tb.bs_month_name} ${tb.bs_year}`
        : `Fiscal Year ${tb.fiscal_year}`,
      '', '', '',
    ])
    rows.push([`Period: ${tb.start_date_ad} to ${tb.end_date_ad}`, '', '', ''])
    rows.push(['', '', '', ''])
    rows.push(['Code', 'Account', 'Debit (Rs.)', 'Credit (Rs.)'])
    rows.push(['', '', '', ''])

    // Assets
    let assetTotal = 0
    rows.push(['1000', 'ASSETS', '', ''])
    for (const item of tb.line_items?.assets || []) {
      rows.push([item.code || '', `  ${item.name}`, f(item.debit), ''])
      assetTotal += parseFloat(item.debit || 0)
    }
    rows.push(['', '  TOTAL ASSETS', f(assetTotal), ''])
    rows.push(['', '', '', ''])

    // Liabilities
    let liabTotal = 0
    rows.push(['2000', 'LIABILITIES', '', ''])
    for (const item of tb.line_items?.liabilities || []) {
      rows.push([item.code || '', `  ${item.name}`, '', f(item.credit)])
      liabTotal += parseFloat(item.credit || 0)
    }
    rows.push(['', '  TOTAL LIABILITIES', '', f(liabTotal)])
    rows.push(['', '', '', ''])

    // Income
    let incTotal = 0
    if ((tb.line_items?.income || []).length > 0) {
      rows.push(['3000', 'INCOME', '', ''])
      for (const item of tb.line_items?.income || []) {
        rows.push([item.code || '', `  ${item.name}`, '', f(item.credit)])
        incTotal += parseFloat(item.credit || 0)
      }
      rows.push(['', '  TOTAL INCOME', '', f(incTotal)])
      rows.push(['', '', '', ''])
    }

    // Expenses
    let expTotal = 0
    if ((tb.line_items?.expenses || []).length > 0) {
      rows.push(['4000', 'EXPENSES', '', ''])
      for (const item of tb.line_items?.expenses || []) {
        rows.push([item.code || '', `  ${item.name}`, f(item.debit), ''])
        expTotal += parseFloat(item.debit || 0)
      }
      rows.push(['', '  TOTAL EXPENSES', f(expTotal), ''])
      rows.push(['', '', '', ''])
    }

    // Equity
    rows.push(['', 'EQUITY', '', ''])
    rows.push(['', '  Opening Equity', '', f(tb.opening_equity)])
    const surplus = parseFloat(tb.net_surplus || 0)
    rows.push([
      '',
      `  Net ${surplus >= 0 ? 'Surplus' : 'Deficit'}`,
      surplus < 0 ? f(Math.abs(surplus)) : '',
      surplus >= 0 ? f(surplus) : '',
    ])
    rows.push(['', '  TOTAL EQUITY', '', f(tb.closing_equity)])
    rows.push(['', '', '', ''])

    // Grand Total
    rows.push([
      '',
      'GRAND TOTAL',
      f(tb.line_items?.totals?.debit),
      f(tb.line_items?.totals?.credit),
    ])

    if (!tb.is_balanced) {
      rows.push(['', `Difference: Rs. ${f(tb.difference)}`, '', ''])
    } else {
      rows.push(['', '✓ BALANCED', '', ''])
    }

    rows.push(['', '', '', ''])
    rows.push(['Prepared by: _____________    Approved by: _____________    Date: _____________', '', '', ''])
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
            <p className="text-sm text-gray-500">
              Trial balance — always shows live data
            </p>
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
                {activeTab === 'monthly' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium
                                        text-gray-700 mb-1">
                        BS Year
                      </label>
                      <input
                        type="number"
                        className="input-field text-sm"
                        placeholder="e.g. 2082"
                        value={genForm.bs_year}
                        onChange={(e) => setGenForm({
                          ...genForm, bs_year: e.target.value
                        })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium
                                        text-gray-700 mb-1">
                        BS Month
                      </label>
                      <select
                        className="input-field text-sm"
                        value={genForm.bs_month}
                        onChange={(e) => setGenForm({
                          ...genForm, bs_month: e.target.value
                        })}
                        required>
                        <option value="">Select month...</option>
                        {BS_MONTHS.map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium
                                      text-gray-700 mb-1">
                      Fiscal Year
                    </label>
                    <input
                      type="text"
                      className="input-field text-sm"
                      placeholder="e.g. 2081/82"
                      value={genForm.fiscal_year}
                      onChange={(e) => setGenForm({
                        ...genForm, fiscal_year: e.target.value
                      })}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Format: YYYY/YY (e.g. 2081/82)
                    </p>
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 italic">
                      Live data
                    </span>
                    <span className={`text-xs font-semibold
                      ${selected.is_balanced
                        ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {selected.is_balanced ? '✓ Balanced' : '✗ Not balanced'}
                    </span>
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
  const netSurplus = parseFloat(s.net_surplus || 0)

  return (
    <div className="font-mono text-xs text-gray-800 print:text-black">

      {/* Header */}
      <div className="text-center space-y-1 border-b-2 border-gray-800 pb-3 mb-4">
        <p className="text-base font-bold uppercase tracking-wide">
          Shree Shangharshil Bachat Samuha
        </p>
        <p className="text-sm font-semibold">Trial Balance</p>
        <p className="text-sm">
          {isMonthly
            ? `${s.bs_month_name} ${s.bs_year}`
            : `Fiscal Year ${s.fiscal_year}`
          }
        </p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-xs table-fixed"> 
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-1.5 pr-2 font-bold w-[55%]">Account</th>
            <th className="text-right py-1.5 pl-2 font-bold w-[22.5%]">Debit (Rs.)</th>
            <th className="text-right py-1.5 pl-2 font-bold w-[22.5%]">Credit (Rs.)</th>
          </tr>
        </thead>
        <tbody>

          {/* ASSETS */}
          <tr className="border-b border-gray-300">
            <td className="py-1.5 pr-2 font-bold uppercase">ASSETS</td>
            <td className="py-1.5 pl-2"></td>
            <td className="py-1.5 pl-2"></td>
          </tr>
          {(s.line_items?.assets || []).map((item, i) => (
            <tr key={`a-${i}`} className="border-b border-gray-100">
              <td className="py-1 pr-2 pl-4">{item.name}</td>
              <td className="py-1 pl-2 text-right">{fmt(item.debit)}</td>
              <td className="py-1 pl-2 text-right"></td>
            </tr>
          ))}
          <tr className="border-b border-gray-300 font-bold">
            <td className="py-1.5 pr-2 pl-4">TOTAL ASSETS</td>
            <td className="py-1.5 pl-2 text-right">{fmt(s.total_assets)}</td>
            <td className="py-1.5 pl-2 text-right"></td>
          </tr>

          {/* LIABILITIES */}
          <tr className="border-b border-gray-300">
            <td className="py-1.5 pr-2 font-bold uppercase">LIABILITIES</td>
            <td className="py-1.5 pl-2"></td>
            <td className="py-1.5 pl-2"></td>
          </tr>
          {(s.line_items?.liabilities || []).map((item, i) => (
            <tr key={`l-${i}`} className="border-b border-gray-100">
              <td className="py-1 pr-2 pl-4">{item.name}</td>
              <td className="py-1 pl-2 text-right"></td>
              <td className="py-1 pl-2 text-right">{fmt(item.credit)}</td>
            </tr>
          ))}
          <tr className="border-b border-gray-300 font-bold">
            <td className="py-1.5 pr-2 pl-4">TOTAL LIABILITIES</td>
            <td className="py-1.5 pl-2 text-right"></td>
            <td className="py-1.5 pl-2 text-right">{fmt(s.total_liabilities)}</td>
          </tr>

          {/* INCOME (if present) */}
          {(s.line_items?.income || []).length > 0 && (
            <>
              <tr className="border-b border-gray-300">
                <td className="py-1.5 pr-2 font-bold uppercase">INCOME</td>
                <td className="py-1.5 pl-2"></td>
                <td className="py-1.5 pl-2"></td>
              </tr>
              {(s.line_items?.income || []).map((item, i) => (
                <tr key={`i-${i}`} className="border-b border-gray-100">
                  <td className="py-1 pr-2 pl-4">{item.name}</td>
                  <td className="py-1 pl-2 text-right"></td>
                  <td className="py-1 pl-2 text-right">{fmt(item.credit)}</td>
                </tr>
              ))}
              <tr className="border-b border-gray-300 font-bold">
                <td className="py-1.5 pr-2 pl-4">TOTAL INCOME</td>
                <td className="py-1.5 pl-2 text-right"></td>
                <td className="py-1.5 pl-2 text-right">{fmt(s.total_income)}</td>
              </tr>
            </>
          )}

          {/* EXPENSES (if present) */}
          {(s.line_items?.expenses || []).length > 0 && (
            <>
              <tr className="border-b border-gray-300">
                <td className="py-1.5 pr-2 font-bold uppercase">EXPENSES</td>
                <td className="py-1.5 pl-2"></td>
                <td className="py-1.5 pl-2"></td>
              </tr>
              {(s.line_items?.expenses || []).map((item, i) => (
                <tr key={`e-${i}`} className="border-b border-gray-100">
                  <td className="py-1 pr-2 pl-4">{item.name}</td>
                  <td className="py-1 pl-2 text-right">{fmt(item.debit)}</td>
                  <td className="py-1 pl-2 text-right"></td>
                </tr>
              ))}
              <tr className="border-b border-gray-300 font-bold">
                <td className="py-1.5 pr-2 pl-4">TOTAL EXPENSES</td>
                <td className="py-1.5 pl-2 text-right">{fmt(s.total_expenses)}</td>
                <td className="py-1.5 pl-2 text-right"></td>
              </tr>
            </>
          )}

          {/* EQUITY */}
          <tr className="border-b border-gray-300">
            <td className="py-1.5 pr-2 font-bold uppercase">EQUITY</td>
            <td className="py-1.5 pl-2"></td>
            <td className="py-1.5 pl-2"></td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1 pr-2 pl-4">Opening Equity</td>
            <td className="py-1 pl-2 text-right"></td>
            <td className="py-1 pl-2 text-right">{fmt(s.opening_equity)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-1 pr-2 pl-4">
              Net {netSurplus >= 0 ? 'Surplus' : 'Deficit'}
            </td>
            <td className="py-1 pl-2 text-right">
              {netSurplus < 0 ? fmt(Math.abs(netSurplus)) : ''}
            </td>
            <td className="py-1 pl-2 text-right">
              {netSurplus >= 0 ? fmt(netSurplus) : ''}
            </td>
          </tr>
          <tr className="border-b border-gray-300 font-bold">
            <td className="py-1.5 pr-2 pl-4">TOTAL EQUITY</td>
            <td className="py-1.5 pl-2 text-right"></td>
            <td className="py-1.5 pl-2 text-right">{fmt(s.closing_equity)}</td>
          </tr>

          {/* GRAND TOTAL */}
          <tr className="border-t-2 border-gray-800 font-bold">
            <td className="py-2 pr-2">GRAND TOTAL</td>
            <td className="py-2 pl-2 text-right">{fmt(s.line_items?.totals?.debit)}</td>
            <td className="py-2 pl-2 text-right">{fmt(s.line_items?.totals?.credit)}</td>
          </tr>

          {/* Balanced / Difference */}
          {s.is_balanced ? (
            <tr>
              <td className="py-1 pr-2 text-green-700 font-bold">✓ BALANCED</td>
              <td className="py-1 pl-2"></td>
              <td className="py-1 pl-2"></td>
            </tr>
          ) : (
            <tr className="text-red-600">
              <td className="py-1 pr-2">Difference</td>
              <td className="py-1 pl-2 text-right">{fmt(s.difference)}</td>
              <td className="py-1 pl-2"></td>
            </tr>
          )}

        </tbody>
      </table>

      {/* Signature Lines */}
      <div className="mt-8 pt-4 border-t border-gray-300">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="border-b border-gray-400 pb-8 mb-1"></div>
            <p className="text-xs font-medium">Prepared by</p>
          </div>
          <div>
            <div className="border-b border-gray-400 pb-8 mb-1"></div>
            <p className="text-xs font-medium">Approved by</p>
          </div>
          <div>
            <div className="border-b border-gray-400 pb-8 mb-1"></div>
            <p className="text-xs font-medium">Date</p>
          </div>
        </div>
      </div>
    </div>
  )
}