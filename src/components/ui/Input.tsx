import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-semibold text-slate-700">{label}</label>
      )}
      <input
        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : 'border-slate-200'} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  )
}
