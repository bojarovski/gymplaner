import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../store/authStore'
import Select from './ui/Select'
import Input from './ui/Input'
import { Plus, ChevronDown, ChevronUp, ImageIcon, X } from 'lucide-react'
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
  const [form, setForm] = useState({
    name: '',
    category: 'Strength',
    muscleGroups: [] as string[],
    description: '',
    imageUrl: '',
  })
  const [preview, setPreview] = useState(false)

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

  return (
    <div className="space-y-3">
      {!creating ? (
        <>
          <Select
            label="Exercise"
            value={value}
            onChange={onChange}
            placeholder="Select exercise..."
            options={exercises.map((e) => ({ value: e.id, label: `${e.name} — ${e.category}` }))}
          />
          {/* Show selected exercise photo if it has one */}
          {value && (() => {
            const ex = exercises.find((e) => e.id === value)
            return ex?.imageUrl ? (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={ex.imageUrl}
                  alt={ex.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{ex.name}</p>
                  <p className="text-xs text-slate-400">{ex.category} · {ex.muscleGroups?.join(', ')}</p>
                </div>
              </div>
            ) : null
          })()}
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
