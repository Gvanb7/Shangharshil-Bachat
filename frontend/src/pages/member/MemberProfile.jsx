import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../components/MemberLayout'
import ProfilePicture from '../../components/ProfilePicture'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import { toBS } from '../../lib/nepaliDate'
import {
  LuUser, LuPhone, LuMapPin, LuMail, LuShield, LuLogOut,
  LuPencil, 
} from 'react-icons/lu'

export default function MemberProfile() {
  const navigate               = useNavigate()
  const { user, updateUser, logout } = useAuthStore()

  const [editProfile,    setEditProfile]    = useState(false)
  const [profileForm,    setProfileForm]    = useState({
    full_name: '', phone: '', address: ''
  })
  const [profileErr,     setProfileErr]     = useState('')
  const [profileLoad,    setProfileLoad]    = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')

  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm,     setPwForm]     = useState({
    current_password: '', new_password: '', confirm_password: ''
  })
  const [pwErr,     setPwErr]     = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoad,    setPwLoad]    = useState(false)
  const [showPw,    setShowPw]    = useState(false)

  async function handleUpdateProfile(e) {
    e.preventDefault()
    setProfileErr('')
    setProfileSuccess('')
    setProfileLoad(true)
    try {
      const res = await api.patch('/auth/complete-profile/', profileForm)
      updateUser(res.data)
      setProfileSuccess('Profile updated successfully.')
      setEditProfile(false)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const first = Object.values(data)[0]
        setProfileErr(Array.isArray(first) ? first[0] : first)
      } else {
        setProfileErr('Failed to update profile.')
      }
    } finally {
      setProfileLoad(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwErr('')
    setPwSuccess('')
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwErr('Passwords do not match.')
      return
    }
    if (pwForm.new_password.length < 8) {
      setPwErr('Password must be at least 8 characters.')
      return
    }
    setPwLoad(true)
    try {
      await api.post('/auth/change-password/', pwForm)
      setPwSuccess('Password changed successfully.')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      setShowPwForm(false)
    } catch (err) {
      setPwErr(err.response?.data?.error || 'Failed to change password.')
    } finally {
      setPwLoad(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <MemberLayout>
      <div className="space-y-4">

        <h1 className="text-lg font-bold text-gray-800">My Profile</h1>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100
                        shadow-sm overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-700
                          px-5 py-6 text-white text-center relative">
            <div className="flex justify-center mb-3">
              <ProfilePicture />
            </div>
            <h2 className="text-lg font-bold">
              {user?.full_name || 'Member'}
            </h2>
            <p className="text-indigo-200 text-xs mt-0.5">{user?.email}</p>
            <p className="text-indigo-300 text-xs mt-1">
              Member since {toBS(user?.date_joined)}
            </p>
          </div>

          {/* Profile details */}
          {profileSuccess && (
            <div className="mx-4 mt-4 px-4 py-3 bg-emerald-50 border
                            border-emerald-200 text-emerald-700 rounded-xl
                            text-sm">
              {profileSuccess}
            </div>
          )}

          {!editProfile ? (
            <>
              <div className="divide-y divide-gray-50 px-1">
                {[
                  { label: 'Full name', value: user?.full_name, Icon: LuUser },
                  { label: 'Email',     value: user?.email,     Icon: LuMail },
                  { label: 'Phone',     value: user?.phone,     Icon: LuPhone },
                  { label: 'Address',   value: user?.address,   Icon: LuMapPin },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="px-4 py-3 flex justify-between items-start gap-4"
                  >
                    <span
                      className="flex items-center gap-1.5 text-xs font-medium
                                text-gray-400 uppercase tracking-wide w-24
                                flex-shrink-0 pt-0.5"
                    >
                      <Icon size={12} />
                      {label}
                    </span>

                    <span className="text-sm text-gray-800 font-medium text-right break-words">
                      {value || (
                        <span className="text-gray-400 italic text-xs">
                          Not set
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-50">
                <button
                  onClick={() => {
                    setProfileForm({
                      full_name: user?.full_name || '',
                      phone: user?.phone || '',
                      address: user?.address || '',
                    })
                    setProfileErr('')
                    setEditProfile(true)
                  }}
                  className="w-full py-2.5 rounded-xl border border-indigo-200
                            text-indigo-600 font-medium text-sm
                            hover:bg-indigo-50 transition-colors
                            flex items-center justify-center gap-1.5"
                >
                  <LuPencil size={14} />
                  Edit Profile
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleUpdateProfile} className="px-4 py-4 space-y-4">
              {profileErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">
                  {profileErr}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full name *
                </label>
                <input type="text" className="input-field w-full"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({
                    ...profileForm, full_name: e.target.value
                  })}
                  required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone
                </label>
                <input type="tel" className="input-field w-full"
                  placeholder="98XXXXXXXX"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({
                    ...profileForm, phone: e.target.value
                  })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address
                </label>
                <textarea className="input-field w-full resize-none" rows={2}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({
                    ...profileForm, address: e.target.value
                  })} />
              </div>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => { setEditProfile(false); setProfileErr('') }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={profileLoad}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600
                             hover:bg-indigo-700 text-white font-medium
                             text-sm disabled:opacity-50">
                  {profileLoad ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl border border-gray-100
                        shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <LuShield size={14} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">
                Security
              </h3>
            </div>
          </div>

          {!showPwForm ? (
            <div className="px-4 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Password</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Change your login password
                </p>
              </div>
              <button
                onClick={() => setShowPwForm(true)}
                className="text-xs font-medium text-indigo-600
                           hover:text-indigo-700 border border-indigo-200
                           px-3 py-1.5 rounded-lg hover:bg-indigo-50
                           transition-colors">
                Change
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="px-4 py-4 space-y-4">
              {pwErr && (
                <div className="px-3 py-2 bg-red-50 border border-red-200
                                text-red-700 rounded-lg text-sm">{pwErr}</div>
              )}
              {pwSuccess && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200
                                text-emerald-700 rounded-lg text-sm">{pwSuccess}</div>
              )}
              {['current_password', 'new_password', 'confirm_password'].map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field === 'current_password' ? 'Current password'
                      : field === 'new_password' ? 'New password'
                      : 'Confirm new password'}
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field w-full"
                    placeholder={field === 'new_password' ? 'Min. 8 characters' : ''}
                    value={pwForm[field]}
                    onChange={(e) => setPwForm({ ...pwForm, [field]: e.target.value })}
                    required
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="showpw" checked={showPw}
                  onChange={() => setShowPw(!showPw)}
                  className="cursor-pointer" />
                <label htmlFor="showpw"
                  className="text-xs text-gray-500 cursor-pointer">
                  Show passwords
                </label>
              </div>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => { setShowPwForm(false); setPwErr('') }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={pwLoad}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600
                             hover:bg-indigo-700 text-white font-medium
                             text-sm disabled:opacity-50">
                  {pwLoad ? 'Saving...' : 'Change password'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Logout button */}
        <button
        onClick={handleLogout}
        className="w-full py-3 rounded-2xl border border-red-200
                  text-red-600 font-medium text-sm hover:bg-red-50
                  transition-colors flex items-center justify-center gap-2"
      >
        <LuLogOut size={15} />
        Sign out
      </button>

      </div>
    </MemberLayout>
  )
}