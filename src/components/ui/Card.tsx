import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  color?: 'white' | 'blue' | 'orange' | 'purple' | 'emerald'
}

export default function Card({ children, className = '', onClick, color = 'white' }: CardProps) {
  const colors = {
    white: 'bg-white border border-slate-200/80',
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600 border-0 text-white',
    orange: 'bg-gradient-to-br from-orange-500 to-orange-600 border-0 text-white',
    purple: 'bg-gradient-to-br from-violet-500 to-purple-600 border-0 text-white',
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white',
  }

  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ${colors[color]} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
