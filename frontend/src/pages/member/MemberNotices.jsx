import { useEffect, useState } from 'react'
import MemberLayout from '../../components/MemberLayout'
import api from '../../lib/api'
import { formatBS } from '../../lib/nepaliDate'
import {
  LuMegaphone,LuPin, LuChevronDown, LuFileText, LuImage, LuExternalLink,
} from 'react-icons/lu'

export default function MemberNotices() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    try {
      const res = await api.get('/member/notices/')
      setNotices(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function markRead(noticeId) {
    try {
      await api.post(`/member/notices/${noticeId}/read/`)
      setNotices(prev => prev.map(n =>
        n.id === noticeId ? { ...n, is_read: true } : n
      ))
    } catch {}
  }

  function toggleExpand(notice) {
    if (expanded === notice.id) {
      setExpanded(null)
    } else {
      setExpanded(notice.id)
      if (!notice.is_read) markRead(notice.id)
    }
  }

  const unread = notices.filter(n => !n.is_read).length
  const pinned = notices.filter(n => n.is_pinned)
  const regular = notices.filter(n => !n.is_pinned)

  return (
    <MemberLayout>
      <div className="space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-gray-800">Notices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {notices.length} notices
            {unread > 0 && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700
                               px-2 py-0.5 rounded-full font-medium">
                {unread} unread
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600
                            border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100
                          shadow-sm px-6 py-12 text-center">
            <p className="text-4xl mb-3">📢</p>
            <p className="text-gray-500 text-sm">No notices at this time.</p>
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500
                               uppercase tracking-wide">
                  <LuPin size={14} className="inline text-amber-500" />
                  Pinned Notices
                </p>
                {pinned.map(notice => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    expanded={expanded === notice.id}
                    onToggle={() => toggleExpand(notice)}
                  />
                ))}
              </div>
            )}

            {/* Regular */}
            {regular.length > 0 && (
              <div className="space-y-2">
                {pinned.length > 0 && (
                  <p className="text-xs font-semibold text-gray-500
                                 uppercase tracking-wide">
                    All Notices
                  </p>
                )}
                {regular.map(notice => (
                  <NoticeCard
                    key={notice.id}
                    notice={notice}
                    expanded={expanded === notice.id}
                    onToggle={() => toggleExpand(notice)}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </MemberLayout>
  )
}

function NoticeCard({ notice, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className={`bg-white rounded-2xl border shadow-sm cursor-pointer
                  transition-all overflow-hidden
        ${notice.is_pinned
          ? 'border-amber-200'
          : notice.is_read
            ? 'border-gray-100'
            : 'border-indigo-200'
        }`}>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center
                           justify-center text-base flex-shrink-0
            ${notice.is_pinned
              ? 'bg-amber-50'
              : notice.is_read
                ? 'bg-gray-50'
                : 'bg-indigo-50'
            }`}>
            {notice.is_pinned ? <LuPin size={16} className="text-amber-600" /> 
            : <LuMegaphone size={16} className="text-indigo-600" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold truncate
                ${notice.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                {notice.title}
              </p>
              {!notice.is_read && (
                <span className="w-2 h-2 bg-indigo-500 rounded-full
                                 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {notice.nepali_date
                ? formatBS(notice.nepali_date)
                : notice.published_at
              }
              {notice.created_by_name && ` · ${notice.created_by_name}`}
            </p>
          </div>

          <span className={`text-gray-400 text-xs flex-shrink-0
                            transition-transform duration-200
            ${expanded ? 'rotate-180' : ''}`}>
            <LuChevronDown
              size={16}
              className={`text-gray-400 flex-shrink-0 transition-transform duration-200
                ${expanded ? 'rotate-180' : ''}`}
            />
          </span>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            {notice.body && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {notice.body}
              </p>
            )}

            {notice.attachment_url && (
              <div>
                {notice.attachment_type === 'pdf' ? (
                  <a
                    href={notice.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 text-xs
                               text-indigo-600 hover:text-indigo-700
                               font-medium bg-indigo-50 px-3 py-2
                               rounded-lg">
                    <LuFileText size={14} className="text-indigo-600" />
                     View attached PDF
                  </a>
                ) : (
                  <a
                    href={notice.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}>
                    <img
                      src={notice.attachment_url}
                      alt="attachment"
                      className="w-full max-h-64 object-contain rounded-xl
                                 border border-gray-100"
                    />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}