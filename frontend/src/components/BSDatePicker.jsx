import Calendar from '@sbmdkl/nepali-datepicker-reactjs'
import '@sbmdkl/nepali-datepicker-reactjs/dist/index.css'

export default function BSDatePicker({
  value,
  onChange,
  label,
  required = false,
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && (
            <span className="text-red-500 ml-0.5">*</span>
          )}
        </label>
      )}

      <Calendar
        className="input-field w-full"
        value={value}
        onChange={({ bsDate }) => onChange(bsDate)}
      />
    </div>
  )
}