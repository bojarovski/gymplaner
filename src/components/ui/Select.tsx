import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  /** Compact inline variant — no label, smaller trigger */
  compact?: boolean
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  compact = false,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const selected = options.find((o) => o.value === value)

  if (compact) {
    return (
      <div ref={ref} className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white outline-none transition-all ${
            open
              ? 'border-blue-400 text-blue-700 ring-2 ring-blue-400/20'
              : 'border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <span>{selected?.label ?? placeholder}</span>
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-[60] mt-1 left-0 min-w-[130px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="py-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    opt.value === value
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                  {opt.value === value && <Check size={12} className="text-blue-500 ml-2 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-slate-700">{label}</label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-sm bg-white text-left outline-none transition-all duration-200 ${
            open
              ? 'border-blue-500 ring-3 ring-blue-500/15'
              : 'border-slate-200 hover:border-slate-300'
          } ${!selected ? 'text-slate-400' : 'text-slate-900'}`}
        >
          <span className="truncate pr-2">{selected ? selected.label : placeholder}</span>
          <ChevronDown
            size={15}
            className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute z-[60] top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
              {options.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No options available</p>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left transition-colors ${
                      opt.value === value
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {opt.value === value && <Check size={14} className="text-blue-500 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
