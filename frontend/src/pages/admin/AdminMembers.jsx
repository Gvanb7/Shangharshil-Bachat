import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'

const EMPTY_FORM = {
  email: '', password: '', full_name: '', phone: '', address: '',
}

export default function AdminMembers() {
  const [members,    setMembers]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editMember, setEditMember] = useState(null)   // null = add mode
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [formErr,    setFormErr]    = useState('')
  const [formLoad,   setFormLoad]   = useState(false)
  const [search,     setSearch]     = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/admin/members/')
      setMembers(res.data)
    } catch {
      setError('Failed to load members.')
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditMember(null)
    setForm(EMPTY_FORM)
    setFormErr('')
    setShowForm(true)
  }

  function openEditForm(member) {
    setEditMember(member)
    setForm({
      email:     member.email,
      full_name: member.full_name || '',
      phone:     member.phone     || '',
      address:   member.address   || '',
      password:  '',
    })
    setFormErr('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditMember(null)
    setForm(EMPTY_FORM)
    setFormErr('')
  }

  function flash(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')

    if (!editMember && !form.password) {
      setFormErr('Password is required when adding a member.')
      return
    }
    if (!editMember && form.password.length < 8) {
      setFormErr('Password must be at least 8 characters.')
      return
    }

    setFormLoad(true)
    try {
      if (editMember) {
        // edit mode — only send changed fields
        const payload = {
          full_name: form.full_name,
          phone:     form.phone,
          address:   form.address,
        }
        await api.patch(`/admin/members/${editMember.id}/`, payload)
        flash('Member updated successfully.')
      } else {
        // add mode
        await api.post('/admin/members/register/', {
          email:     form.email.trim().toLowerCase(),
          password:  form.password,
          full_name: form.full_name,
          phone:     form.phone,
          address:   form.address,
        })
        flash('Member added successfully.')
      }
      closeForm()
      fetchMembers()
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

  async function toggleActive(member) {
    try {
      await api.patch(`/admin/members/${member.id}/`, {
        is_active: !member.is_active,
      })
      flash(`Member ${member.is_active ? 'deactivated' : 'activated'}.`)
      fetchMembers()
    } catch {
      setError('Failed to update member status.')
    }
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    return (
      m.email?.toLowerCase().includes(q) ||
      m.full_name?.toLowerCase().includes(q) ||
      m.phone?.includes(q)
    )
  })

  return (
    <AdminLayout>
      <div className="space-y-4">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Members</h2>
            <p className="text-sm text-gray-500">
              {members.length} total · {members.filter(m => m.is_active).length} active
            </p>
          </div>
          <button onClick={openAddForm} className="btn-primary">
            + Add member
          </button>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="px-4 py-3 bg-green-50 border border-green-200
                          text-green-700 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200
                          text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="text"
            className="input-field max-w-sm"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Email', 'Phone', 'Joined', 'Status', 'Actions'].map(h => (
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
                      {search ? 'No members match your search.' : 'No members yet. Add one above.'}
                    </td>
                  </tr>
                ) : filtered.map((m) => (
                  <tr key={m.id}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {m.full_name || <span className="text-gray-400 italic">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.phone || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(m.date_joined).toLocaleDateString('en-NP')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={m.is_active ? 'badge-success' : 'badge-danger'}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditForm(m)}
                          className="text-xs text-primary-600 hover:text-primary-800
                                     font-medium">
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => toggleActive(m)}
                          className={`text-xs font-medium
                            ${m.is_active
                              ? 'text-red-500 hover:text-red-700'
                              : 'text-green-600 hover:text-green-800'
                            }`}>
                          {m.is_active ? 'Deactivate' : 'Activate'}
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black bg-opacity-40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
                          max-h-screen overflow-y-auto">

            <div className="px-6 py-4 border-b border-gray-200 flex
                            items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {editMember ? 'Edit member' : 'Add new member'}
              </h3>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">
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

              {/* Email — only shown when adding */}
              {!editMember && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="Type email address of member"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* Password — only shown when adding */}
              {!editMember && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input-field pr-16"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2
                                 text-gray-400 hover:text-gray-600 text-xs">
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Full name of member"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  className="input-field resize-none"
                  placeholder="Address of member"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {/* Buttons */}
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
                    : editMember ? 'Save changes' : 'Add member'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}