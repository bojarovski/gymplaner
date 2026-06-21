import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../store/authStore'
import Input from './ui/Input'
import Select from './ui/Select'
import { Plus, ChevronDown, ChevronUp, ImageIcon, X, Search, Dumbbell } from 'lucide-react'
import type { Exercise } from '../types'

const CATEGORIES = ['Strength', 'Cardio', 'Flexibility', 'Balance', 'HIIT', 'Olympic', 'Bodyweight']
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Glutes', 'Full Body']

interface Props {
  value: string
  onChange: (id: string) => void
  exercises: Exercise[]
}

export default function ExercisePicker({ value, onChange, exercises }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'Strength',
    muscleGroups: [] as string[],
    description: '',
    imageUrl: '',
  })
  const [preview, setPreview] = useState(false)

  const selected = exercises.find((e) => e.id === value)

  const filtered = search.trim()
    ? exercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase())
      )
    : exercises

  const createExercise = useMutation({
    mutationFn: async () => {
      const ref = await addDoc(collection(db, 'exercises'), {
        name: form.name.trim(),
        category: form.category,
        muscleGroups: form.muscleGroups,
        description: form.description || null,
        imageUrl: form.imageUrl.trim() || null,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: async (newId) => {
      await qc.invalidateQueries({ queryKey: ['exercises'] })
      onChange(newId)
      setCreating(false)
      setForm({ name: '', category: 'Strength', muscleGroups: [], description: '', imageUrl: '' })
      setPreview(false)
    },
  })

  const toggleMuscle = (m: string) =>
    setForm((f) => ({
      ...f,
      muscleGroups: f.muscleGroups.includes(m)
        ? f.muscleGroups.filter((g) => g !== m)
        : [...f.muscleGroups, m],
    }))

  const selectExercise = (ex: Exercise) => {
    onChange(ex.id)
    setSearch('')
    setOpen(false)
  }

  const clearSelection = () => {
    onChange('')
    setSearch('')
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="space-y-3">
      {!creating ? (
        <>
          <div>
            <label className="text-sm font-medium text-[#16213E] block mb-1.5">Exercise</label>

            {/* Selected state */}
            {selected ? (
              <div className="flex items-center gap-3 p-3 bg-[#F7F5F1] border border-[#C9A84C] rounded-xl">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt={selected.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-[#E5E0D8]" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#16213E] flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={16} className="text-[#C9A84C]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#16213E] truncate">{selected.name}</p>
                  <p className="text-xs text-[#9E998F]">{selected.category}{selected.muscleGroups?.length ? ` · ${selected.muscleGroups.slice(0, 2).join(', ')}` : ''}</p>
                </div>
                <button type="button" onClick={clearSelection} className="p-1.5 rounded-lg text-[#9E998F] hover:bg-[#E5E0D8] hover:text-[#16213E] transition-colors flex-shrink-0">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E998F] pointer-events-none" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                  placeholder="Search exercises..."
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E5E0D8] rounded-xl text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 bg-white"
                />
                {open && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-[#E5E0D8] rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[#9E998F]">No exercises found</p>
                    ) : (
                      filtered.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onMouseDown={() => selectExercise(ex)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F7F5F1] transition-colors text-left"
                        >
                          {ex.imageUrl ? (
                            <img src={ex.imageUrl} alt={ex.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-[#E5E0D8]" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-[#F0EDE8] flex items-center justify-center flex-shrink-0">
                              <Dumbbell size={13} className="text-[#9E998F]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#16213E] truncate">{ex.name}</p>
                            <p className="text-xs text-[#9E998F]">{ex.category}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-xs text-blue-500 font-medium hover:text-blue-700 transition-colors"
          >
            <Plus size={13} />
            Create custom exercise
          </button>
        </>
      ) : (
        <div className="border border-blue-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-sm font-semibold text-blue-800">New Exercise</p>
            <button
              type="button"
              onClick={() => { setCreating(false); setPreview(false) }}
              className="p-1 rounded-lg text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-4 space-y-3 bg-white">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Cable Fly, Nordic Curl…"
              autoFocus
            />

            <Select
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />

            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Muscle Groups</label>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMuscle(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      form.muscleGroups.includes(m)
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo URL */}
            <div className="space-y-2">
              <Input
                label="Photo URL (optional)"
                value={form.imageUrl}
                onChange={(e) => { setForm({ ...form, imageUrl: e.target.value }); setPreview(false) }}
                placeholder="https://example.com/exercise.jpg"
              />
              {form.imageUrl.trim() && (
                <button
                  type="button"
                  onClick={() => setPreview(!preview)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ImageIcon size={12} />
                  {preview ? 'Hide preview' : 'Preview image'}
                  {preview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {preview && form.imageUrl.trim() && (
                <img
                  src={form.imageUrl.trim()}
                  alt="Preview"
                  className="w-full max-h-40 object-cover rounded-xl border border-slate-200"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                  }}
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setCreating(false); setPreview(false) }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createExercise.mutate()}
                disabled={!form.name.trim() || createExercise.isPending}
                className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {createExercise.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
