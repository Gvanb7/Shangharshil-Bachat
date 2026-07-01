import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import { formatBS } from '../../lib/nepaliDate'
import BSDatePicker from '../../components/BSDatePicker'
import { LuPin, LuPinOff, LuMegaphone, LuFileText, LuX, LuPaperclip } from 'react-icons/lu'

const EMPTY_FORM = {
  title: '', body: '', nepali_date: '', is_pinned: false,
}

export default function AdminNotices() {
  const [notices,    setNotices]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showForm,   setShowForm]   = useState(false)
  const [editNotice, setEditNotice] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [formErr,    setFormErr]    = useState('')
  const [formLoad,   setFormLoad]   = useState(false)

  const [file,       setFile]       = useState(null)
  const [filePreview,setFilePreview]= useState(null)
  const fileRef = useRef(null)

  const [selected,   setSelected]   = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoad, setDeleteLoad] = useState(false)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/notices/')
      setNotices(res.data)
    } catch {
      setError('Failed to load notices.')
    } finally {
      setLoading(false)
    }
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function openAdd() {
    setEditNotice(null)
    setForm(EMPTY_FORM)
    setFile(null)
    setFilePreview(null)
    setFormErr('')
    setShowForm(true)
  }

  function openEdit(notice) {
    setEditNotice(notice)
    setForm({
      title:       notice.title,
      body:        notice.body || '',
      nepali_date: notice.nepali_date || '',
      fiscal_year: '',
      is_pinned:   notice.is_pinned,
    })
    setFile(null)
    setFilePreview(notice.attachment_url || null)
    setFormErr('')
    setShowForm(true)
  }

  function handleFileChange(f) {
    if (!f) return
    setFile(f)
    if (f.type === 'application/pdf') {
      setFilePreview('pdf')
    } else {
      setFilePreview(URL.createObjectURL(f))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')

    if (!form.title.trim()) {
      setFormErr('Title is required.')
      return
    }
    if (!form.nepali_date && !editNotice) {
      setFormErr('Please select a date.')
      return
    }

    setFormLoad(true)
    try {
      const fd = new FormData()
      fd.append('title',       form.title)
      fd.append('body',        form.body)
      fd.append('nepali_date', form.nepali_date || editNotice?.nepali_date || '')
      fd.append('is_pinned',   form.is_pinned)
      if (file) fd.append('attachment', file)

      if (editNotice) {
        fd.append('is_active', editNotice.is_active)
        await api.patch(`/notices/${editNotice.id}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        flash('Notice updated.')
      } else {
        await api.post('/notices/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        flash('Notice published.')
      }
      setShowForm(false)
      fetchNotices()
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Failed to save notice.')
    } finally {
      setFormLoad(false)
    }
  }

  async function toggleActive(notice) {
    try {
      const fd = new FormData()
      fd.append('title',       notice.title)
      fd.append('nepali_date', notice.nepali_date)
      fd.append('is_active',   !notice.is_active)
      fd.append('is_pinned',   notice.is_pinned)
      await api.patch(`/notices/${notice.id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      flash(`Notice ${notice.is_active ? 'deactivated' : 'activated'}.`)
      fetchNotices()
    } catch {
      setError('Failed to update notice.')
    }
  }

  async function togglePin(notice) {
    try {
      const fd = new FormData()
      fd.append('title',       notice.title)
      fd.append('nepali_date', notice.nepali_date)
      fd.append('is_active',   notice.is_active)
      fd.append('is_pinned',   !notice.is_pinned)
      await api.patch(`/notices/${notice.id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      flash(`Notice ${notice.is_pinned ? 'unpinned' : 'pinned'}.`)
      fetchNotices()
    } catch {
      setError('Failed to update notice.')
    }
  }

  async function handleDelete() {
    if (!selected) return
    setDeleteLoad(true)
    try {
      await api.delete(`/notices/${selected.id}/`)
      flash('Notice deleted.')
      setShowDelete(false)
      setSelected(null)
      fetchNotices()
    } catch {
      setError('Failed to delete notice.')
    } finally {
      setDeleteLoad(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <LuMegaphone size={20} className="text-primary-600" />
              Notices
            </h2>
            <p className="text-sm text-gray-500">
              {notices.length} total ·{' '}
              {notices.filter(n => n.is_active).length} active ·{' '}
              {notices.filter(n => n.is_pinned).length} pinned
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary text-sm">
            + Post notice
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

        {/* Notice list */}
        {loading ? (
          <div className="card px-6 py-10 text-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : notices.length === 0 ? (
          <div className="card px-6 py-10 text-center text-gray-400 text-sm">
            No notices yet. Post one above.
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(notice => (
              <div key={notice.id}
                className={`bg-white rounded-2xl shadow-sm border
                            overflow-hidden transition-all
                  ${notice.is_pinned
                    ? 'border-amber-300'
                    : notice.is_active
                      ? 'border-gray-100'
                      : 'border-gray-200 opacity-60'
                  }`}>

                {/* Pinned banner */}
                {notice.is_pinned && (
                  <div className="bg-amber-50 px-4 py-1.5 border-b
                                  border-amber-200 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-amber-700">
                      <LuPin size={16} className="text-amber-700" />
                      Pinned notice
                    </span>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-gray-800">
                          {notice.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full
                                         font-medium
                          ${notice.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                          {notice.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mb-2">
                        {notice.nepali_date
                          ? formatBS(notice.nepali_date)
                          : notice.published_at
                        }
                        {' · '}By {notice.created_by_name || 'Admin'}
                        {' · '}{notice.unread_count} member
                        {notice.unread_count !== 1 ? 's' : ''} haven't read
                      </p>

                      {notice.body && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {notice.body}
                        </p>
                      )}

                      {/* Attachment indicator */}
                      {notice.attachment_url && (
                        <div className="mt-2">
                          {notice.attachment_type === 'pdf' ? (
                            <div>
                              <a
                                href={notice.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5
                                           text-xs text-red-600 hover:text-red-700
                                           font-medium">
                                <LuFileText size={16} className="inline mr-1" />
                                View PDF attachment
                              </a>
                            </div>
                          ) : (
                            <div>
                              <a
                                href={notice.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block">
                                <img
                                  src={notice.attachment_url}
                                  alt="attachment"
                                  className="h-16 w-auto rounded-lg
                                             border border-gray-200
                                             object-cover"
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3 pt-3
                                  border-t border-gray-100 flex-wrap">
                    <button
                      onClick={() => openEdit(notice)}
                      className="text-xs text-primary-600
                                 hover:text-primary-800 font-medium">
                      Edit
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => togglePin(notice)}
                      className="text-xs text-amber-600
                                 hover:text-amber-800 font-medium">
                      {notice.is_pinned
                        ? <><LuPinOff size={12} className="inline mr-1" />Unpin</>
                        : <><LuPin size={12} className="inline mr-1" />Pin</>
                      }
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => toggleActive(notice)}
                      className={`text-xs font-medium
                        ${notice.is_active
                          ? 'text-orange-500 hover:text-orange-700'
                          : 'text-green-600 hover:text-green-800'
                        }`}>
                      {notice.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        setSelected(notice)
                        setShowDelete(true)
                      }}
                      className="text-xs text-red-500
                                 hover:text-red-700 font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit notice modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
                          max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between sticky top-0
                            bg-white z-10">
              <h3 className="font-semibold text-gray-800">
                {editNotice ? 'Edit notice' : 'Post new notice'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xl">
                <LuX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {formErr}
                </div>
              )}

              {/* Date */}
              <BSDatePicker
                label="Notice date (BS)"
                value={form.nepali_date}
                onChange={(val) => setForm({ ...form, nepali_date: val })}
                required={!editNotice}
              />

              {/* Title */}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Notice title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Body (optional)
                </label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Notice details..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-sm font-medium
                                  text-gray-700 mb-1">
                  Attachment (optional — PDF or image)
                </label>

                {filePreview && filePreview !== 'pdf' ? (
                  <div className="relative">
                    <img
                      src={filePreview}
                      alt="preview"
                      className="w-full h-36 object-cover rounded-lg
                                 border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setFilePreview(null)
                        if (fileRef.curret) fileRef.current.value = ''
                      }}
                      className="absolute top-2 right-2 bg-red-500
                                 text-white rounded-full w-6 h-6 flex
                                 items-center justify-center text-xs">
                      <LuX size={12} />
                    </button>
                  </div>
                ) : filePreview === 'pdf' || (editNotice?.attachment_type === 'pdf' && !file) ? (
                  <div className="flex items-center gap-3 px-4 py-3
                                  bg-red-50 border border-red-100
                                  rounded-lg">
                    <span className="text-2xl"><LuFileText className="text-red-600 text-2xl" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-red-700 font-medium truncate">
                        PDF attached
                      </p>
                      {editNotice?.attachment_url && (
                        <div>
                          <a
                            href={editNotice.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-red-500 underline">
                            View current file
                          </a>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setFilePreview(null)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                      className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300
                               rounded-lg h-28 flex flex-col items-center
                               justify-center cursor-pointer
                               hover:border-primary-400 hover:bg-primary-50
                               transition-colors">
                    <span className="text-2xl mb-1"><LuPaperclip size={24} className="text-2xl mb-1 text-gray-500" /></span>
                    <p className="text-xs text-gray-500">
                      Click to upload PDF or image
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Max 10MB
                    </p>
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
              </div>

              {/* Pin toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={form.is_pinned}
                  onChange={(e) => setForm({
                    ...form, is_pinned: e.target.checked
                  })}
                  className="cursor-pointer"
                />
                <label htmlFor="is_pinned"
                  className="text-sm text-gray-700 cursor-pointer">
                  <LuPin size={16} className="inline mr-1" />
                  Pin this notice (appears at top for all members)
                </label>
              </div>

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
                    : editNotice ? 'Save changes' : 'Post notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-2">
              Delete notice?
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              "{selected.title}"
            </p>
            <p className="text-xs text-gray-400 mb-4">
              This will permanently delete the notice and remove it
              from all member dashboards.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoad}
                className="flex-1 py-2 rounded-lg bg-red-600
                           hover:bg-red-700 text-white font-medium text-sm">
                {deleteLoad ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}