export default function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50   border-blue-100   text-blue-700',
    green:  'bg-green-50  border-green-100  text-green-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    red:    'bg-red-50    border-red-100    text-red-700',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}