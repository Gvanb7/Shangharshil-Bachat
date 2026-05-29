import NepaliDate from 'nepali-date-converter'

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra', 'Ashwin', 'Kartik', 'Mangsir',
  'Poush', 'Magh', 'Falgun', 'Chaitra',
]

const BS_MONTHS_NP = [
  'बैशाख', 'जेष्ठ', 'असार', 'श्रावण',
  'भाद्र', 'आश्विन', 'कार्तिक', 'मंसिर',
  'पौष', 'माघ', 'फाल्गुण', 'चैत्र',
]

/**
 * Convert AD date string to BS formatted string
 * @param {string} dateStr — AD date string (YYYY-MM-DD or any valid date)
 * @param {object} options
 * @param {boolean} options.nepali — use Nepali month names (default false)
 * @param {boolean} options.short  — short format: 2082-02-11 (default false)
 * @returns {string} formatted BS date
 */
export function toBS(dateStr, options = {}) {
  if (!dateStr) return '—'

  try {
    const adDate = new Date(dateStr)

    // check for invalid date
    if (isNaN(adDate.getTime())) return '—'

    const nepDate = new NepaliDate(adDate)
    const year    = nepDate.getYear()
    const month   = nepDate.getMonth()   // 0-indexed
    const day     = nepDate.getDate()

    if (options.short) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      return `${year}-${mm}-${dd}`
    }

    const monthName = options.nepali
      ? BS_MONTHS_NP[month]
      : BS_MONTHS[month]

    return `${year} ${monthName} ${day}`
  } catch {
    return '—'
  }
}

/**
 * Convert BS date string (YYYY-MM-DD) to display format
 * @param {string} bsDateStr — BS date in YYYY-MM-DD format
 * @param {boolean} nepali   — use Nepali month names
 */
export function formatBS(bsDateStr, nepali = false) {
  if (!bsDateStr) return '—'
  try {
    const parts = bsDateStr.split('-')
    if (parts.length !== 3) return bsDateStr

    const year      = parseInt(parts[0])
    const monthIdx  = parseInt(parts[1]) - 1
    const day       = parseInt(parts[2])
    const monthName = nepali ? BS_MONTHS_NP[monthIdx] : BS_MONTHS[monthIdx]

    return `${year} ${monthName} ${day}`
  } catch {
    return bsDateStr
  }
}

/**
 * Get today's date in BS format
 */
export function todayBS(options = {}) {
  return toBS(new Date().toISOString(), options)
}