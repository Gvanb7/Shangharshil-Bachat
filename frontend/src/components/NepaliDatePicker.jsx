import { useRef } from 'react'
import { NepaliDatePicker as NepaliDatePickerLib } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'

export default function NepaliDatePicker({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  required = false,
  label = '',
  className = '',
}) {
  const wrapperRef = useRef(null)

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div
        ref={wrapperRef}
        className={`relative flex items-center ${className}`}
      >
        <NepaliDatePickerLib
          value={value || ''}
          onChange={(val) => onChange(val)}
          inputClassName="input-field pr-10 w-full cursor-pointer"
          className="w-full"
          placeholder={placeholder}
          options={{ calenderLocale: 'ne', valueLocale: 'en' }}
        />

        <button
          type="button"
          className="absolute right-3 text-gray-400 hover:text-gray-600"
          onClick={() => {
            const input = wrapperRef.current?.querySelector('input')
            input?.focus()
            input?.click()
          }}
          aria-label="Open date picker"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
            />
          </svg>
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        Click the field or the calendar icon to open Nepali calendar (Bikram Sambat)
      </p>
    </div>
  )
} 