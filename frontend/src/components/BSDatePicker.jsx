import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import NepaliDate from 'nepali-date-converter'

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra',  'Ashwin', 'Kartik', 'Mangsir',
  'Poush',   'Magh',   'Falgun', 'Chaitra',
]

// ── helpers using nepali-date-converter only ──────────────────────────────

function todayBS() {
  const nd = new NepaliDate()
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() }
}

function formatBS(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInBSMonth(year, month) {
  try {
    const start     = new NepaliDate(year, month, 1).toJsDate()
    let nextYear    = year
    let nextMonth   = month + 1
    if (nextMonth > 11) { nextMonth = 0; nextYear = year + 1 }
    const nextStart = new NepaliDate(nextYear, nextMonth, 1).toJsDate()
    const diff      = Math.round((nextStart - start) / 86400000)
    return diff > 0 ? diff : 30
  } catch {
    return 30
  }
}

function getStartingWeekday(year, month) {
  try {
    return new NepaliDate(year, month, 1).toJsDate().getDay()
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BSDatePicker({
  value,
  onChange,
  label,
  required    = false,
  placeholder = 'Select BS date',
}) {
  const today = todayBS()
  const [show,      setShow]      = useState(false)
  const [viewYear,  setViewYear]  = useState(
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseInt(value.split('-')[0]) : today.year
  )
  const [viewMonth, setViewMonth] = useState(
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseInt(value.split('-')[1]) - 1 : today.month
  )
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  const triggerRef = useRef(null)
  const popupRef   = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popupRef.current   && !popupRef.current.contains(e.target)
      ) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!show) return
    function updatePos() {
      if (!triggerRef.current) return
      const rect        = triggerRef.current.getBoundingClientRect()
      const popupHeight = 360
      const top         = rect.bottom + popupHeight > window.innerHeight
        ? rect.top  + window.scrollY - popupHeight - 4
        : rect.bottom + window.scrollY + 4
      setCoords({ top, left: rect.left + window.scrollX, width: rect.width })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [show])

  function openCalendar() {
    if (triggerRef.current) {
      const rect        = triggerRef.current.getBoundingClientRect()
      const popupHeight = 360
      const top         = rect.bottom + popupHeight > window.innerHeight
        ? rect.top  + window.scrollY - popupHeight - 4
        : rect.bottom + window.scrollY + 4
      setCoords({ top, left: rect.left + window.scrollX, width: rect.width })
    }
    setShow(s => !s)
  }

  function selectDay(day) {
    onChange(formatBS(viewYear, viewMonth, day))
    setShow(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else                   setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else                    setViewMonth(m => m + 1)
  }

  const daysInMonth    = getDaysInBSMonth(viewYear, viewMonth)
  const startingOffset = getStartingWeekday(viewYear, viewMonth)

  let selYear = null, selMonth = null, selDay = null
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    selYear  = parseInt(value.split('-')[0])
    selMonth = parseInt(value.split('-')[1]) - 1
    selDay   = parseInt(value.split('-')[2])
  }

  const displayValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? (() => {
        const [y, m, d] = value.split('-')
        return `${BS_MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
      })()
    : ''

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        type="button"
        ref={triggerRef}
        onClick={openCalendar}
        className={`input-field w-full text-left flex items-center
                    justify-between
                    ${!value ? 'text-gray-400' : 'text-gray-800'}`}>
        <span>{displayValue || placeholder}</span>
        <span className="text-gray-400 ml-2">📅</span>
      </button>

      {show && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            top:      coords.top,
            left:     coords.left,
            minWidth: Math.max(coords.width, 280),
            zIndex:   9999,
          }}
          className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3">

          {/* Month/year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="p-1 hover:bg-gray-100 rounded-lg text-gray-600
                         font-bold text-lg leading-none">
              ‹
            </button>
            <div className="flex items-center gap-2">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className="text-sm font-semibold text-gray-800 border-none
                           outline-none bg-transparent cursor-pointer">
                {BS_MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value) || viewYear)}
                className="w-16 text-sm font-semibold text-gray-800
                           border border-gray-200 rounded px-1 py-0.5
                           text-center"
              />
            </div>
            <button type="button" onClick={nextMonth}
              className="p-1 hover:bg-gray-100 rounded-lg text-gray-600
                         font-bold text-lg leading-none">
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d}
                className="text-center text-xs text-gray-400
                           font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty offset cells */}
            {Array.from({ length: startingOffset }, (_, i) => (
              <div key={`e-${i}`} />
            ))}
            {/* Day buttons */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const isSelected = (
                selYear === viewYear && selMonth === viewMonth && selDay === day
              )
              const isToday = (
                today.year === viewYear && today.month === viewMonth && today.day === day
              )
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`text-xs py-1.5 rounded-lg transition-colors
                              font-medium text-center
                    ${isSelected
                      ? 'bg-primary-600 text-white'
                      : isToday
                        ? 'bg-primary-100 text-primary-700 font-bold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}>
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setViewYear(today.year)
                setViewMonth(today.month)
                selectDay(today.day)
              }}
              className="w-full text-xs text-primary-600
                         hover:text-primary-700 font-medium py-1">
              Today — {BS_MONTHS[today.month]} {today.day}, {today.year}
            </button>
          </div>

        </div>,
        document.body
      )}
    </div>
  )
}