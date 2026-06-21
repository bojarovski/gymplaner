interface BadgeProps {
  label: string
  color?: 'blue' | 'orange' | 'purple' | 'emerald' | 'rose' | 'gray' | 'gold' | 'navy' | 'green' | 'red'
}

export default function Badge({ label, color = 'gray' }: BadgeProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    purple: 'bg-violet-100 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-600 border-rose-200',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
    gold: 'bg-amber-100 text-amber-700 border-amber-200',
    navy: 'bg-slate-800 text-white border-slate-700',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-rose-100 text-rose-600 border-rose-200',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[color]}`}>
      {label}
    </span>
  )
}
