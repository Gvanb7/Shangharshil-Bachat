import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'

const EMPTY_FORM = { full_name: '', phone: '', address: '' }

export default function AdminBorrowers() {
  const [borrowers,  setBorrowers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [files,      setFiles]      = useState({
    citizenship_front: null, citizenship_back: null,
    signature: null, photo: null,
  })
  const [previews,   setPreviews]   = useState({
    citizenship_front: null, citizenship_back: null,
    signature: null, photo: null,
  })
  const [formErr,    setFormErr]    = useState('')
  const [formLoad,   setFormLoad]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchBorrowers() }, [search])

  async function fetchBorrowers() {
    setLoading(true)
    try {
      const res = await api.get(`/borrowers/?search=${search}`)
      setBorrowers(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setFiles({ citizenship_front: null, citizenship_back: null, signature: null, photo: null })
    setPreviews({ citizenship_front: null, citizenship_back: null, signature: null, photo: null })
    setFormErr('')
    setShowForm(true)
  }

  function handleFileChange(key, file) {
    if (!file) return
    setFiles(prev => ({ ...prev, [key]: file }))
    setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')

    if (!files.citizenship_front || !files.citizenship_back ||
        !files.signature || !files.photo) {
      setFormErr('All documents are required.')
      return
    }

    setFormLoad(true)
    try {
      const fd = new FormData()
      fd.append('full_name', form.full_name)
      fd.append('phone',     form.phone)
      fd.append('address',   form.address)
      fd.append('citizenship_front', files.citizenship_front)
      fd.append('citizenship_back',  files.citizenship_back)
      fd.append('signature',          files.signature)
      fd.append('photo',                files.photo)

      await api.post('/borrowers/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      flash('Borrower added successfully.')
      setShowForm(false)
      fetchBorrowers()
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Failed to add borrower.')
    } finally {
      setFormLoad(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Non-Member Borrowers
            </h2>
            <p className="text-sm text-gray-500">
              {borrowers.length} borrowers on record
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary text-sm">
            + Add borrower
          </button>
        </div>

        {successMsg && (
          <div className="px-4 py-3 bg-green-50 border border-green-200
                          text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        <input
          type="text"
          className="input-field max-w-sm"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Photo', 'Name', 'Phone', 'Address', 'Added'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs
                                           font-semibold text-gray-500
                                           uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center
                                                 text-gray-400">Loading...</td></tr>
                ) : borrowers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center
                                                 text-gray-400">
                    No borrowers yet. Add one above.
                  </td></tr>
                ) : borrowers.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {b.photo_url ? (
                        <img src={b.photo_url} alt={b.full_name}
                          className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {b.full_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.phone}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-xs">
                      {b.address}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(b.created_at).toLocaleDateString('en-NP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
                          max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between sticky top-0
                            bg-white z-10">
              <h3 className="font-semibold text-gray-800">Add borrower</h3>
              <button onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
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
                  Full name <span className="text-red-500">*</span>
                </label>
                <input type="text" className="input-field"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required autoFocus />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input type="tel" className="input-field"
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea className="input-field resize-none" rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Required documents
                </p>
                <DocUpload label="Passport-size photo" fieldKey="photo"
                  preview={previews.photo} onChange={handleFileChange} />
                <DocUpload label="Citizenship — Front" fieldKey="citizenship_front"
                  preview={previews.citizenship_front} onChange={handleFileChange} />
                <DocUpload label="Citizenship — Back" fieldKey="citizenship_back"
                  preview={previews.citizenship_back} onChange={handleFileChange} />
                <DocUpload label="Signature on white paper" fieldKey="signature"
                  preview={previews.signature} onChange={handleFileChange} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoad}
                  className="btn-primary flex-1">
                  {formLoad ? 'Saving...' : 'Add borrower'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function DocUpload({ label, fieldKey, preview, onChange }) {
  const inputRef = useRef(null)
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label}
            className="w-full h-32 object-cover rounded-lg border border-gray-200" />
          <button type="button"
            onClick={() => { onChange(fieldKey, null); if (inputRef.current) inputRef.current.value = '' }}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full
                       w-6 h-6 flex items-center justify-center text-xs">✕</button>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg h-32
                     flex flex-col items-center justify-center cursor-pointer
                     hover:border-primary-400 hover:bg-primary-50">
          <span className="text-2xl mb-1">📎</span>
          <p className="text-xs text-gray-500">Click to upload</p>
        </div>
      )}
      <input ref={inputRef} type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
        onChange={(e) => onChange(fieldKey, e.target.files[0] || null)} />
    </div>
  )
}