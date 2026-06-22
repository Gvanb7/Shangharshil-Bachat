import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import NepaliDate from 'nepali-date-converter'
import api from '../lib/api'

const BS_MONTHS = [
  'Baisakh','Jestha','Ashadh','Shrawan',
  'Bhadra','Ashwin','Kartik','Mangsir',
  'Poush','Magh','Falgun','Chaitra',
]

function todayBS() {
  const nd = new NepaliDate()
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() }
}

function formatBS(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInBSMonth(year, month) {
  try {
    const start = new NepaliDate(year, month, 1).toJsDate()
    let nextYear  = year
    let nextMonth = month + 1
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear  = year + 1
    }
    const nextStart = new NepaliDate(nextYear, nextMonth, 1).toJsDate()
    const diffDays  = Math.round((nextStart - start) / 86400000)
    return diffDays > 0 ? diffDays : 30
  } catch {
    return 30
  }
}

/** Get (year, month) boundaries for a fiscal year string like "2081/82" */
function getFYBounds(fyString) {
  if (!fyString) return null
  const fyStart = parseInt(fyString.split('/')[0])
  return {
    minYear:  fyStart,
    minMonth: 3,            // Shrawan (0-indexed = 3)
    maxYear:  fyStart + 1,
    maxMonth: 2,             // Ashadh (0-indexed = 2)
  }
}

function isBeforeMin(year, month, bounds) {
  if (!bounds) return false
  if (year < bounds.minYear) return true
  if (year === bounds.minYear && month < bounds.minMonth) return true
  return false
}

function isAfterMax(year, month, bounds) {
  if (!bounds) return false
  if (year > bounds.maxYear) return true
  if (year === bounds.maxYear && month > bounds.maxMonth) return true
  return false
}

export default function FiscalYearDatePicker({
  fiscalYear,
  onFiscalYearChange,
  dateValue,
  onDateChange,
  required = false,
  dateLabel = 'Date (BS)',   // ← NEW PROP with default
}) {
  const [fiscalYears, setFiscalYears] = useState([])
  const today = todayBS()

  const bounds = getFYBounds(fiscalYear)

  const [show, setShow] = useState(false)
  const [viewYear,  setViewYear]  = useState(bounds ? bounds.minYear  : today.year)
  const [viewMonth, setViewMonth] = useState(bounds ? bounds.minMonth : today.month)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  const triggerRef = useRef(null)
  const popupRef    = useRef(null)

  useEffect(() => {
    api.get('/fiscal-years/')
      .then(res => setFiscalYears(res.data.fiscal_years || []))
      .catch(() => setFiscalYears([]))
  }, [])

  // when fiscal year changes, reset view to start of that FY and clear date
  // if it falls outside the new FY
  useEffect(() => {
    if (!bounds) return
    setViewYear(bounds.minYear)
    setViewMonth(bounds.minMonth)

    if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const y = parseInt(dateValue.split('-')[0])
      const m = parseInt(dateValue.split('-')[1]) - 1
      if (isBeforeMin(y, m, bounds) || isAfterMax(y, m, bounds)) {
        onDateChange('')
      }
    }
  }, [fiscalYear])

  useEffect(() => {
    function handleClick(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setShow(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!show) return
    function updatePosition() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const popupHeight = 340
      let top = rect.bottom + window.scrollY + 4
      if (rect.bottom + popupHeight > window.innerHeight) {
        top = rect.top + window.scrollY - popupHeight - 4
      }
      setCoords({ top, left: rect.left + window.scrollX, width: rect.width })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [show])

  function openCalendar() {
    if (!fiscalYear) return  // can't open date picker without fiscal year
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popupHeight = 340
      let top = rect.bottom + window.scrollY + 4
      if (rect.bottom + popupHeight > window.innerHeight) {
        top = rect.top + window.scrollY - popupHeight - 4
      }
      setCoords({ top, left: rect.left + window.scrollX, width: rect.width })
    }
    setShow(s => !s)
  }

  function selectDay(day) {
    onDateChange(formatBS(viewYear, viewMonth, day))
    setShow(false)
  }

  function prevMonth() {
    let y = viewYear, m = viewMonth
    if (m === 0) { m = 11; y -= 1 } else { m -= 1 }
    if (isBeforeMin(y, m, bounds)) return  // blocked at FY boundary
    setViewYear(y)
    setViewMonth(m)
  }

  function nextMonth() {
    let y = viewYear, m = viewMonth
    if (m === 11) { m = 0; y += 1 } else { m += 1 }
    if (isAfterMax(y, m, bounds)) return  // blocked at FY boundary
    setViewYear(y)
    setViewMonth(m)
  }

  const daysInMonth = getDaysInBSMonth(viewYear, viewMonth)

  let selYear = null, selMonth = null, selDay = null
  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    selYear  = parseInt(dateValue.split('-')[0])
    selMonth = parseInt(dateValue.split('-')[1]) - 1
    selDay   = parseInt(dateValue.split('-')[2])
  }

  const displayValue = dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? (() => {
        const parts = dateValue.split('-')
        const m = parseInt(parts[1]) - 1
        return `${BS_MONTHS[m]} ${parts[2]}, ${parts[0]}`
      })()
    : ''

  const atMinBoundary = isBeforeMin(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
    bounds
  )
  const atMaxBoundary = isAfterMax(
    viewMonth === 11 ? viewYear + 1 : viewYear,
    viewMonth === 11 ? 0 : viewMonth + 1,
    bounds
  )

  return (
    <>
      {/* Fiscal year selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fiscal Year {required && <span className="text-red-500">*</span>}
        </label>
        <select
          className="input-field"
          value={fiscalYear}
          onChange={(e) => onFiscalYearChange(e.target.value)}
          required={required}>
          <option value="">Select fiscal year...</option>
          {fiscalYears.map(fy => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>
      </div>

      {/* Date picker — disabled until fiscal year is chosen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {dateLabel} {required && <span className="text-red-500">*</span>}   {/* ← USE dateLabel HERE */}
        </label>
        <button
          type="button"
          ref={triggerRef}
          onClick={openCalendar}
          disabled={!fiscalYear}
          className={`input-field w-full text-left flex items-center
                      justify-between
                      ${!fiscalYear ? 'opacity-50 cursor-not-allowed' : ''}
                      ${!dateValue ? 'text-gray-400' : 'text-gray-800'}`}>
          <span>
            {!fiscalYear
              ? 'Select fiscal year first'
              : (displayValue || 'Select date')
            }
          </span>
          <span className="text-gray-400 ml-2">📅</span>
        </button>

        {show && fiscalYear && createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'absolute',
              top:      coords.top,
              left:     coords.left,
              minWidth: Math.max(coords.width, 280),
              zIndex:   9999,
            }}
            className="bg-white rounded-xl shadow-2xl border
                       border-gray-200 p-3">

            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                disabled={atMinBoundary}
                className={`p-1 rounded-lg font-bold text-lg leading-none
                  ${atMinBoundary
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'}`}>
                ‹
              </button>

              <div className="text-sm font-semibold text-gray-800">
                {BS_MONTHS[viewMonth]} {viewYear}
              </div>

              <button
                type="button"
                onClick={nextMonth}
                disabled={atMaxBoundary}
                className={`p-1 rounded-lg font-bold text-lg leading-none
                  ${atMaxBoundary
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'}`}>
                ›
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mb-2">
              FY {fiscalYear} only
            </p>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i}
                  className="text-center text-xs text-gray-400
                             font-medium py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
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
                                font-medium
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

            {/* Today button — only shown if today falls within this FY */}
            {bounds &&
             !isBeforeMin(today.year, today.month, bounds) &&
             !isAfterMax(today.year, today.month, bounds) && (
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
                  Today ({BS_MONTHS[today.month]} {today.day}, {today.year})
                </button>
              </div>
            )}

          </div>,
          document.body
        )}
      </div>
    </>
  )
}