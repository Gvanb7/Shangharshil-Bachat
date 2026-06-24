import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import NepaliDatePicker from '../../components/NepaliDatePicker'
import { toBS, formatBS } from '../../lib/nepaliDate'
import BSDatePicker from '../../components/BSDatePicker'
import FiscalYearDatePicker from '../../components/FiscalYearDatePicker'
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
    interest_rate: '12.00', term_months: '12', fiscal_year: '', 
    first_due_date: '',
  })
  const [approveErr,  setApproveErr]  = useState('')
  const [approveLoad, setApproveLoad] = useState(false)
  const [showDisburse,  setShowDisburse]  = useState(false)
  const [disburseTarget,setDisburseTarget]= useState(null)
  const [disburseForm,  setDisburseForm]  = useState({
    account_id: ''
  })
  const [disburseErr,  setDisburseErr]  = useState('')
  const [disburseLoad, setDisburseLoad] = useState(false)

  const [showBorrowerLoan,   setShowBorrowerLoan]   = useState(false)
  const [borrowerStep,       setBorrowerStep]        = useState('select')  // 'select' | 'new' | 'terms'
  const [borrowerSearch,     setBorrowerSearch]      = useState('')
  const [borrowerResults,    setBorrowerResults]     = useState([])
  const [borrowerSearchLoad, setBorrowerSearchLoad]  = useState(false)
  const [selectedBorrower,   setSelectedBorrower]    = useState(null)

  const [newBorrowerForm,    setNewBorrowerForm]     = useState({
    full_name: '', phone: '', address: ''
  })
  const [newBorrowerFiles,   setNewBorrowerFiles]    = useState({
    citizenship_front: null, citizenship_back: null,
    signature: null, photo: null,
  })
  const [newBorrowerPreviews, setNewBorrowerPreviews] = useState({
    citizenship_front: null, citizenship_back: null,
    signature: null, photo: null,
  })

  const [borrowerLoanForm, setBorrowerLoanForm] = useState({
    principal: '', purpose: '', interest_rate: '', term_months: '',
    fiscal_year: '', first_due_date: '',
  })
  const [borrowerLoanErr,  setBorrowerLoanErr]  = useState('')
  const [borrowerLoanLoad, setBorrowerLoanLoad] = useState(false)

  // ── report tabs ───────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('loans')  // 'loans'|'member_report'|'borrower_report'

  // shared report state
  const [reportFilters,  setReportFilters]  = useState({
    person_id: '', fiscal_year: '', bs_year: '', bs_month: '', type: ''
  })
  const [reportData,     setReportData]     = useState(null)
  const [reportLoad,     setReportLoad]     = useState(false)
  const [reportErr,      setReportErr]      = useState('')
  const [fiscalYears,    setFiscalYears]    = useState([])
  const [monthOptions,   setMonthOptions]   = useState([])
  const [personOptions,  setPersonOptions]  = useState([])  // members or borrowers

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

  useEffect(() => {
    fetchFiscalYearsForReport()
  }, [])

  async function fetchFiscalYearsForReport() {
    try {
      const res = await api.get('/fiscal-years/')
      setFiscalYears(res.data.fiscal_years || [])
    } catch {}
  }

  async function fetchMonthsForReport(fy) {
    if (!fy) { setMonthOptions([]); return }
    try {
      const res = await api.get(`/fiscal-years/months/?fy=${fy}`)
      setMonthOptions(res.data.months || [])
    } catch { setMonthOptions([]) }
  }

  async function fetchPersonOptions(kind) {
    try {
      if (kind === 'member') {
        const res = await api.get('/admin/members/')
        setPersonOptions(res.data.filter(m => m.is_active))
      } else {
        const res = await api.get('/borrowers/')
        setPersonOptions(res.data)
      }
    } catch { setPersonOptions([]) }
  }

  async function fetchLoanReport(kind) {
    setReportLoad(true)
    setReportErr('')
    try {
      const params = new URLSearchParams()
      params.append('kind', kind)
      if (reportFilters.person_id)   params.append('person',       reportFilters.person_id)
      if (reportFilters.fiscal_year) params.append('fiscal_year',  reportFilters.fiscal_year)
      if (reportFilters.bs_month)    params.append('bs_month',     reportFilters.bs_month)
      if (reportFilters.bs_year)     params.append('bs_year',      reportFilters.bs_year)
      if (reportFilters.type)        params.append('type',         reportFilters.type)

      const res = await api.get(`/loans/report/?${params.toString()}`)
      setReportData(res.data)
    } catch (err) {
      setReportErr(err.response?.data?.error || 'Failed to load report.')
    } finally {
      setReportLoad(false)
    }
  }

  async function handleDownloadLoanExcel(kind) {
    if (!reportData) return
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()
      const rows = buildLoanExcelRows(reportData, kind)
      const ws   = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [
        { wch: 14 }, { wch: 22 }, { wch: 16 },
        { wch: 14 }, { wch: 14 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Loans Report')
      XLSX.writeFile(wb, `loans_report_${kind}.xlsx`)
    } catch {
      setReportErr('Failed to download.')
    }
  }

  function buildLoanExcelRows(data, kind) {
    const f    = (n) => parseFloat(n || 0).toFixed(2)
    const rows = []

    rows.push(['SHANGHARSHIL YUVA BACHAT SAMUHA', '', '', '', '', ''])
    rows.push([
      `Loans Report — ${kind === 'member' ? 'Members' : 'Non-Members'}`,
      '', '', '', '', ''
    ])
    if (data.filters.fiscal_year) {
      rows.push([`Fiscal Year: ${data.filters.fiscal_year}`, '', '', '', '', ''])
    }
    rows.push(['', '', '', '', '', ''])
    rows.push(['Date (BS)', 'Name', 'Type', 'Principal (Rs.)', 'Interest (Rs.)', 'Penalty (Rs.)'])
    rows.push(['', '', '', '', '', ''])

    for (const r of data.rows) {
      rows.push([
        r.nepali_date ? formatBS(r.nepali_date) : toBS(r.date_ad),
        r.name,
        r.type_label,
        f(r.principal),
        f(r.interest),
        f(r.penalty),
      ])
    }

    rows.push(['', '', '', '', '', ''])
    rows.push(['SUMMARY', '', '', '', '', ''])
    rows.push(['Total Disbursed',         '', '', f(data.summary.total_disbursed),        '', ''])
    rows.push(['Total Principal Repaid',  '', '', f(data.summary.total_principal_repaid), '', ''])
    rows.push(['Total Interest Collected','', '', '',  f(data.summary.total_interest),    ''])
    rows.push(['Total Penalty Collected', '', '', '',  '', f(data.summary.total_penalty) ])

    return rows
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

      if (!approveForm.fiscal_year) {
        setApproveErr('Please select a fiscal year.')
        return
      }
      if (!approveForm.first_due_date) {
        setApproveErr('Please select the first due date.')
        return
      }

      setApproveLoad(true)
      try {
        await api.post(`/loans/${approveTarget.id}/approve/`, {
          interest_rate:  approveForm.interest_rate,
          term_months:    approveForm.term_months,
          fiscal_year:    approveForm.fiscal_year,
          first_due_date: approveForm.first_due_date,
        })
        flash('Loan approved successfully.')
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
  setDisburseForm({ account_id: '', nepali_date: '', fiscal_year: '' })
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

  function openBorrowerLoanFlow() {
    setBorrowerStep('select')
    setBorrowerSearch('')
    setBorrowerResults([])
    setSelectedBorrower(null)
    setNewBorrowerForm({ full_name: '', phone: '', address: '' })
    setNewBorrowerFiles({ citizenship_front: null, citizenship_back: null, signature: null, photo: null })
    setNewBorrowerPreviews({ citizenship_front: null, citizenship_back: null, signature: null, photo: null })
    setBorrowerLoanForm({
      principal: '', purpose: '', interest_rate: '', term_months: '',
      fiscal_year: '', first_due_date: '',
    })
    setBorrowerLoanErr('')
    setShowBorrowerLoan(true)
    setTimeout(() => searchBorrowers(''), 0)
  }

  async function searchBorrowers(query) {
    const q = query !== undefined ? query : borrowerSearch
    setBorrowerSearchLoad(true)
    try {
      const res = await api.get(`/borrowers/?search=${q}`)
      setBorrowerResults(res.data)
    } catch {
      setBorrowerResults([])
    } finally {
      setBorrowerSearchLoad(false)
    }
  }

  function pickExistingBorrower(borrower) {
    setSelectedBorrower(borrower)
    setBorrowerStep('terms')
    setBorrowerLoanErr('')
    //prefill fiscal year with current FY
    api.get('/fiscal-years/current/')
      .then(res => setBorrowerLoanForm(prev => ({
        ...prev, fiscal_year: res.data.fiscal_year
      })))
      .catch(() => {})
  }

  function handleNewBorrowerFile(key, file) {
    if (!file) return
    setNewBorrowerFiles(prev => ({ ...prev, [key]: file }))
    setNewBorrowerPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }))
  }

  async function submitNewBorrower(e) {
    e.preventDefault()
    setBorrowerLoanErr('')

    if (!newBorrowerFiles.citizenship_front || !newBorrowerFiles.citizenship_back ||
        !newBorrowerFiles.signature || !newBorrowerFiles.photo) {
      setBorrowerLoanErr('All documents are required.')
      return
    }

    setBorrowerLoanLoad(true)
    try {
      const fd = new FormData()
      fd.append('full_name', newBorrowerForm.full_name)
      fd.append('phone',     newBorrowerForm.phone)
      fd.append('address',   newBorrowerForm.address)
      fd.append('citizenship_front', newBorrowerFiles.citizenship_front)
      fd.append('citizenship_back',  newBorrowerFiles.citizenship_back)
      fd.append('signature',          newBorrowerFiles.signature)
      fd.append('photo',                newBorrowerFiles.photo)

      const res = await api.post('/borrowers/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSelectedBorrower(res.data)
      setBorrowerStep('terms')
      // pre-fill current fiscal year
      api.get('/fiscal-years/current/')
        .then(r => setBorrowerLoanForm(prev => ({
          ...prev, fiscal_year: r.data.fiscal_year
        })))
        .catch(() => {})
    } catch (err) {
      setBorrowerLoanErr(err.response?.data?.error || 'Failed to add borrower.')
    } finally {
      setBorrowerLoanLoad(false)
    }
  }

  async function submitBorrowerLoan(e) {
    e.preventDefault()
    setBorrowerLoanErr('')

    if (!selectedBorrower) {
      setBorrowerLoanErr('No borrower selected.')
      return
    }
    if (!borrowerLoanForm.fiscal_year) {
      setBorrowerLoanErr('Please select a fiscal year.')
      return
    }
    if (!borrowerLoanForm.first_due_date) {
      setBorrowerLoanErr('Please select the first due date.')
      return
    }
    if (!borrowerLoanForm.principal || parseFloat(borrowerLoanForm.principal) <= 0) {
      setBorrowerLoanErr('Enter a valid principal amount.')
      return
    }
    if (!borrowerLoanForm.interest_rate) {
      setBorrowerLoanErr('Interest rate is required.')
      return
    }
    if (!borrowerLoanForm.term_months) {
      setBorrowerLoanErr('Term (months) is required.')
      return
    }

    setBorrowerLoanLoad(true)
    try {
      await api.post('/loans/borrower/create/', {
        borrower_id:     selectedBorrower.id,
        principal:       borrowerLoanForm.principal,
        purpose:         borrowerLoanForm.purpose,
        interest_rate:   borrowerLoanForm.interest_rate,
        term_months:     borrowerLoanForm.term_months,
        first_due_date:  borrowerLoanForm.first_due_date,
      })
      flash('Loan created for borrower. You can now disburse it.')
      setShowBorrowerLoan(false)
      fetchAll()
    } catch (err) {
      setBorrowerLoanErr(err.response?.data?.error || 'Failed to create loan.')
    } finally {
      setBorrowerLoanLoad(false)
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
            + Member Loan
          </button>
          <button
            onClick={openBorrowerLoanFlow}
            className="btn-primary text-sm">
            + Non-member Loan
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-200 mt-2">
          {[
            { key: 'loans',           label: 'Loans'           },
            { key: 'member_report',   label: 'Member Report'   },
            { key: 'borrower_report', label: 'Borrower Report' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setReportData(null)
                setReportErr('')
                setReportFilters({
                  person_id: '', fiscal_year: '', bs_year: '', bs_month: '', type: ''
                })
                setMonthOptions([])
                if (tab.key === 'member_report')   fetchPersonOptions('member')
                if (tab.key === 'borrower_report') fetchPersonOptions('borrower')
              }}
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

        {activeTab === 'loans' && (
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
      )}

      {(activeTab === 'member_report' || activeTab === 'borrower_report') && (
        <div className="space-y-4">
          {/* Filter panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Filter loan transactions —{' '}
              {activeTab === 'member_report' ? 'Members' : 'Non-Members'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Person filter */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {activeTab === 'member_report' ? 'Member' : 'Borrower'} (optional)
                </label>
                <select
                  className="input-field text-sm"
                  value={reportFilters.person_id}
                  onChange={(e) => setReportFilters({
                    ...reportFilters, person_id: e.target.value
                  })}>
                  <option value="">
                    All {activeTab === 'member_report' ? 'members' : 'borrowers'}
                  </option>
                  {personOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fiscal year */}
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
                    fetchMonthsForReport(fy)
                  }}>
                  <option value="">All years</option>
                  {fiscalYears.map(fy => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
              </div>

              {/* Month */}
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

              {/* Type */}
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
                  <option value="disbursement">Disbursement</option>
                  <option value="repayment">Repayment</option>
                  <option value="penalty">Penalty collected</option>
                </select>
              </div>

            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={() => fetchLoanReport(
                  activeTab === 'member_report' ? 'member' : 'borrower'
                )}
                disabled={reportLoad}
                className="btn-primary text-sm">
                {reportLoad ? 'Loading...' : '🔍 Generate report'}
              </button>
              <button
                onClick={() => {
                  setReportFilters({
                    person_id: '', fiscal_year: '', bs_year: '',
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
                    onClick={() => handleDownloadLoanExcel(
                      activeTab === 'member_report' ? 'member' : 'borrower'
                    )}
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
            <div className="print-area space-y-4">

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Total Disbursed',
                    value: reportData.summary.total_disbursed,
                    color: 'text-blue-700',
                    bg:    'bg-blue-50 border-blue-100',
                  },
                  {
                    label: 'Principal Repaid',
                    value: reportData.summary.total_principal_repaid,
                    color: 'text-emerald-700',
                    bg:    'bg-emerald-50 border-emerald-100',
                  },
                  {
                    label: 'Interest Collected',
                    value: reportData.summary.total_interest,
                    color: 'text-purple-700',
                    bg:    'bg-purple-50 border-purple-100',
                  },
                  {
                    label: 'Penalty Collected',
                    value: reportData.summary.total_penalty,
                    color: 'text-amber-700',
                    bg:    'bg-amber-50 border-amber-100',
                  },
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
              <div className="bg-white rounded-2xl shadow-sm border
                              border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
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
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {[
                            'Date (BS)', 'Name', 'Type',
                            'Principal', 'Interest', 'Penalty'
                          ].map(h => (
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
                          <tr key={i}
                            className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {row.nepali_date
                                ? formatBS(row.nepali_date)
                                : toBS(row.date_ad)
                              }
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {row.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5
                                                rounded-full text-xs font-medium
                                ${row.type === 'disbursement'
                                  ? 'bg-blue-100 text-blue-700'
                                  : row.type === 'repayment'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                {row.type_label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                              {parseFloat(row.principal) > 0
                                ? fmt(row.principal) : '—'}
                            </td>
                            <td className="px-4 py-3 text-purple-700 whitespace-nowrap">
                              {parseFloat(row.interest) > 0
                                ? fmt(row.interest) : '—'}
                            </td>
                            <td className="px-4 py-3 text-amber-700 whitespace-nowrap">
                              {parseFloat(row.penalty) > 0
                                ? fmt(row.penalty) : '—'}
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

            <FiscalYearDatePicker
              fiscalYear={approveForm.fiscal_year}
              onFiscalYearChange={(fy) => setApproveForm({ ...approveForm, fiscal_year: fy })}
              dateValue={approveForm.first_due_date}
              onDateChange={(val) => setApproveForm({ ...approveForm, first_due_date: val })}
              dateLabel="Select first due date"  
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interest rate (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0"
                  className="input-field"
                  value={approveForm.interest_rate}
                  onChange={(e) => setApproveForm({ ...approveForm, interest_rate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term (months) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1"
                  className="input-field"
                  value={approveForm.term_months}
                  onChange={(e) => setApproveForm({ ...approveForm, term_months: e.target.value })}
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
                    {a.name} ({a.account_type_display})
                  </option>
                ))}
              </select>
            </div>

            <ModalButtons
              onCancel={() => setShowDisburse(false)}
              loading={disburseLoad}
              label="Disburse loan"
            />
          </form>
        </Modal>
      )}

      {showBorrowerLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
                          max-h-[90vh] overflow-y-auto">

            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-800">
                Issue loan to non-member
              </h3>
              <button onClick={() => setShowBorrowerLoan(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-5">
              {borrowerLoanErr && (
                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {borrowerLoanErr}
                </div>
              )}

              {/* Step 1a — search/select existing borrower */}
              {borrowerStep === 'select' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Search by name or phone..."
                      value={borrowerSearch}
                      onChange={(e) => {
                        setBorrowerSearch(e.target.value)
                        searchBorrowers(e.target.value)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>searchBorrowers(borrowerSearch)}
                      className="btn-secondary text-sm px-4">
                      Search
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5">
                    {borrowerSearchLoad ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Searching...
                      </p>
                    ) : borrowerResults.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No results. Search above or add a new borrower.
                      </p>
                    ) : borrowerResults.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => pickExistingBorrower(b)}
                        className="w-full text-left px-3 py-2.5 rounded-lg
                                  border border-gray-200 hover:border-primary-400
                                  hover:bg-primary-50 transition-colors flex
                                  items-center gap-3">
                        {b.photo_url ? (
                          <img src={b.photo_url} alt={b.full_name}
                            className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {b.full_name}
                          </p>
                          <p className="text-xs text-gray-500">{b.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setBorrowerStep('new')}
                    className="btn-primary w-full text-sm">
                    + Add new borrower
                  </button>
                </div>
              )}

              {/* Step 1b — add new borrower */}
              {borrowerStep === 'new' && (
                <form onSubmit={submitNewBorrower} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" className="input-field"
                      value={newBorrowerForm.full_name}
                      onChange={(e) => setNewBorrowerForm({
                        ...newBorrowerForm, full_name: e.target.value
                      })}
                      required autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input type="tel" className="input-field"
                      placeholder="98XXXXXXXX"
                      value={newBorrowerForm.phone}
                      onChange={(e) => setNewBorrowerForm({
                        ...newBorrowerForm, phone: e.target.value
                      })}
                      required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea className="input-field resize-none" rows={2}
                      value={newBorrowerForm.address}
                      onChange={(e) => setNewBorrowerForm({
                        ...newBorrowerForm, address: e.target.value
                      })}
                      required />
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Required documents
                    </p>
                    <BorrowerDocField label="Passport-size photo" fieldKey="photo"
                      preview={newBorrowerPreviews.photo} onChange={handleNewBorrowerFile} />
                    <BorrowerDocField label="Citizenship — Front" fieldKey="citizenship_front"
                      preview={newBorrowerPreviews.citizenship_front} onChange={handleNewBorrowerFile} />
                    <BorrowerDocField label="Citizenship — Back" fieldKey="citizenship_back"
                      preview={newBorrowerPreviews.citizenship_back} onChange={handleNewBorrowerFile} />
                    <BorrowerDocField label="Signature" fieldKey="signature"
                      preview={newBorrowerPreviews.signature} onChange={handleNewBorrowerFile} />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setBorrowerStep('select')}
                      className="btn-secondary flex-1">Back</button>
                    <button type="submit" disabled={borrowerLoanLoad}
                      className="btn-primary flex-1">
                      {borrowerLoanLoad ? 'Saving...' : 'Continue'}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2 — loan terms */}
              {borrowerStep === 'terms' && selectedBorrower && (
                <form onSubmit={submitBorrowerLoan} className="space-y-4">
                  <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
                    {selectedBorrower.photo_url ? (
                      <img src={selectedBorrower.photo_url} alt={selectedBorrower.full_name}
                        className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedBorrower.full_name}
                      </p>
                      <p className="text-xs text-gray-500">{selectedBorrower.phone}</p>
                    </div>
                  </div>

                  <FiscalYearDatePicker
                    fiscalYear={borrowerLoanForm.fiscal_year}
                    onFiscalYearChange={(fy) => setBorrowerLoanForm({
                      ...borrowerLoanForm, fiscal_year: fy
                    })}
                    dateValue={borrowerLoanForm.first_due_date}
                    onDateChange={(val) => setBorrowerLoanForm({
                      ...borrowerLoanForm, first_due_date: val
                    })}
                    dateLabel="Select first due date"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Principal amount (Rs.) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" step="0.01" min="1" className="input-field"
                      value={borrowerLoanForm.principal}
                      onChange={(e) => setBorrowerLoanForm({
                        ...borrowerLoanForm, principal: e.target.value
                      })}
                      required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interest rate (% p.a.) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" step="0.01" min="0" className="input-field"
                      value={borrowerLoanForm.interest_rate}
                      onChange={(e) => setBorrowerLoanForm({
                        ...borrowerLoanForm, interest_rate: e.target.value
                      })}
                      required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Term (months) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" min="1" className="input-field"
                      value={borrowerLoanForm.term_months}
                      onChange={(e) => setBorrowerLoanForm({
                        ...borrowerLoanForm, term_months: e.target.value
                      })}
                      required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purpose (optional)
                    </label>
                    <textarea className="input-field resize-none" rows={2}
                      value={borrowerLoanForm.purpose}
                      onChange={(e) => setBorrowerLoanForm({
                        ...borrowerLoanForm, purpose: e.target.value
                      })} />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setBorrowerStep('select')}
                      className="btn-secondary flex-1">Back</button>
                    <button type="submit" disabled={borrowerLoanLoad}
                      className="btn-primary flex-1">
                      {borrowerLoanLoad ? 'Creating...' : 'Create loan'}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
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

  // Penalty states
  const [showPenalty, setShowPenalty] = useState(false)

  const [penaltyForm, setPenaltyForm] = useState({
    amount: '',
    nepali_date: '',
    reason: '',
    fiscal_year: '',
  })

  const [penaltyErr, setPenaltyErr] = useState('')
  const [penaltyLoad, setPenaltyLoad] = useState(false)

  async function handleApplyPenalty(e) {
    e.preventDefault()
    setPenaltyErr('')
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
      await api.post(`/loans/${selected.id}/penalty/`, penaltyForm)
      setPenaltyForm({ amount: '', nepali_date: '', reason: '' })
      setShowPenalty(false)
      onRepay()  // refresh loan data
    } catch (err) {
      setPenaltyErr(err.response?.data?.error || 'Failed to apply penalty.')
    } finally {
      setPenaltyLoad(false)
    }
  }

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
          {selected.status === 'active' && (
            <button
              onClick={() => {
                setShowPenalty(true)
                setPenaltyErr('')
                setPenaltyForm({ amount: '', nepali_date: '', reason: '', fiscal_year: '' })
              }}
              className="text-xs py-1.5 px-3 rounded-lg bg-amber-100 text-amber-700
                        hover:bg-amber-200 font-medium transition-colors">
              Apply penalty
            </button>
          )}
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
       {/* Apply penalty modal */}
      {showPenalty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Apply penalty — {selected.member_name}
              </h3>
              <button onClick={() => setShowPenalty(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleApplyPenalty} className="px-6 py-5 space-y-4">
              {penaltyErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {penaltyErr}
                </div>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-lg
                              px-4 py-3">
                <p className="text-xs text-amber-700">
                  ⚠️ This penalty will be added to the loan's outstanding balance.
                  It will be collected automatically with future EMI payments
                  (penalty is paid off first, before interest and principal).
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
                  type="number" step="0.01" min="0.01"
                  className="input-field"
                  value={penaltyForm.amount}
                  onChange={(e) => setPenaltyForm({
                    ...penaltyForm, amount: e.target.value
                  })}
                  required autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text" className="input-field"
                  placeholder="e.g. Missed Jestha EMI"
                  value={penaltyForm.reason}
                  onChange={(e) => setPenaltyForm({
                    ...penaltyForm, reason: e.target.value
                  })}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPenalty(false)}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={penaltyLoad}
                  className="flex-1 py-2 rounded-lg bg-amber-600
                            hover:bg-amber-700 text-white font-medium text-sm">
                  {penaltyLoad ? 'Applying...' : 'Apply penalty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function BorrowerDocField({ label, fieldKey, preview, onChange }) {
  const inputRef = useRef(null)
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label}
            className="w-full h-28 object-cover rounded-lg border border-gray-200" />
          <button type="button"
            onClick={() => { onChange(fieldKey, null); if (inputRef.current) inputRef.current.value = '' }}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full
                       w-6 h-6 flex items-center justify-center text-xs">✕</button>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg h-28
                     flex flex-col items-center justify-center cursor-pointer
                     hover:border-primary-400 hover:bg-primary-50">
          <span className="text-xl mb-1">📎</span>
          <p className="text-xs text-gray-500">Click to upload</p>
        </div>
      )}
      <input ref={inputRef} type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
        onChange={(e) => onChange(fieldKey, e.target.files[0] || null)} />
    </div>
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

function PayNowModal({ month, loan, fmt, onClose, onSuccess, accounts = [] }) {
  const [fiscalYear, setFiscalYear] = useState('')
  const [nepaliDate, setNepaliDate] = useState('')
  const [amount,     setAmount]     = useState('')
  const [accountId,  setAccountId]  = useState('')
  const [note,       setNote]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')

  useEffect(() => {
    api.get('/fiscal-years/current/')
      .then(res => setFiscalYear(res.data.fiscal_year))
      .catch(() => {})
  }, [])

  // once fiscal year + date are both selected, auto-fill EMI amount
  useEffect(() => {
    if (fiscalYear && nepaliDate && !amount) {
      setAmount(month.emi)
    }
  }, [fiscalYear, nepaliDate])

  const readyForAmount = fiscalYear && nepaliDate

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!fiscalYear) {
      setErr('Please select a fiscal year.')
      return
    }
    if (!nepaliDate) {
      setErr('Please select the payment date.')
      return
    }
    if (!accountId) {
      setErr('Please select an account.')
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
        amount, note, paid_at: adDate,
        nepali_date: nepaliDate, account_id: accountId,
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
          {err && (
            <div className="px-3 py-2 bg-red-50 border border-red-200
                            text-red-700 rounded-lg text-sm">
              {err}
            </div>
          )}

          <FiscalYearDatePicker
            fiscalYear={fiscalYear}
            onFiscalYearChange={setFiscalYear}
            dateValue={nepaliDate}
            onDateChange={setNepaliDate}
            required
          />

          {readyForAmount && (
            <>
              <div className="bg-gray-50 rounded-lg px-4 py-3
                              grid grid-cols-2 gap-3">
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
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Amount paid (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01"
                  className="input-field"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
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
                      {a.name} ({a.account_type_display}) — Rs.{' '}
                      {parseFloat(a.balance).toLocaleString('en-NP')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Note (optional)
                </label>
                <input
                  type="text" className="input-field"
                  placeholder={`Month ${month.month} installment`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !readyForAmount}
              className="btn-primary flex-1">
              {loading ? 'Recording...' : 'Confirm payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}