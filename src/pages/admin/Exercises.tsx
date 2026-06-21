import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Trash2, Dumbbell, ImageIcon, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { Exercise } from '../../types'
import Select from '../../components/ui/Select'

const CATEGORIES = ['Strength', 'Cardio', 'Flexibility', 'Balance', 'HIIT', 'Olympic', 'Bodyweight']
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Glutes', 'Full Body']

export default function AdminExercises() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Strength', muscleGroups: [] as string[], description: '', imageUrl: '', videoUrl: '' })
  const [preview, setPreview] = useState(false)

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'exercises'))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Exercise))
    },
  })

  const addExercise = useMutation({
    mutationFn: async (data: Omit<Exercise, 'id'>) => {
      await addDoc(collection(db, 'exercises'), { ...data, createdAt: serverTimestamp() })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] })
      setModalOpen(false)
      setForm({ name: '', category: 'Strength', muscleGroups: [], description: '', imageUrl: '', videoUrl: '' })
      setPreview(false)
    },
  })

  const removeExercise = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'exercises', id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMuscle = (m: string) => {
    setForm((f) => ({
      ...f,
      muscleGroups: f.muscleGroups.includes(m)
        ? f.muscleGroups.filter((g) => g !== m)
        : [...f.muscleGroups, m],
    }))
  }

  const handleSubmit = () => {
    if (!form.name.trim()) return
    addExercise.mutate({
      name: form.name.trim(),
      category: form.category,
      muscleGroups: form.muscleGroups,
      description: form.description,
      imageUrl: form.imageUrl.trim() || undefined,
      videoUrl: form.videoUrl.trim() || undefined,
      createdBy: user!.uid,
    })
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">Exercise Library</h1>
          <p className="text-[#6B6560] mt-1">{exercises.length} exercises available</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Add Exercise
        </Button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E998F]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full pl-9 pr-4 py-2.5 border border-[#E5E0D8] rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#9E998F] text-sm">Loading exercises...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Dumbbell size={40} className="mx-auto text-[#C9A84C]/30 mb-3" />
          <p className="text-[#9E998F]">No exercises found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((exercise) => (
            <Card key={exercise.id} className="group p-0 overflow-hidden">
              {exercise.imageUrl && (
                <div className="relative h-36 bg-slate-100">
                  <img
                    src={exercise.imageUrl}
                    alt={exercise.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                  />
                  <button
                    onClick={() => removeExercise.mutate(exercise.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {!exercise.imageUrl && (
                        <div className="w-8 h-8 rounded-lg bg-[#16213E] flex items-center justify-center flex-shrink-0">
                          <Dumbbell size={14} className="text-[#C9A84C]" />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-[#16213E] truncate">{exercise.name}</h3>
                      {exercise.videoUrl && (
                        <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                          title="Watch tutorial"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge label={exercise.category} color="gold" />
                      {exercise.muscleGroups?.slice(0, 2).map((m) => (
                        <Badge key={m} label={m} color="gray" />
                      ))}
                      {exercise.muscleGroups?.length > 2 && (
                        <Badge label={`+${exercise.muscleGroups.length - 2}`} color="gray" />
                      )}
                    </div>
                    {exercise.description && (
                      <p className="text-xs text-[#9E998F] line-clamp-2">{exercise.description}</p>
                    )}
                  </div>
                  {!exercise.imageUrl && (
                    <button
                      onClick={() => removeExercise.mutate(exercise.id)}
                      className="ml-3 p-1.5 rounded-lg text-[#9E998F] hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Exercise">
        <div className="space-y-4">
          <Input
            label="Exercise Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Barbell Squat"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <div>
            <label className="text-sm font-medium text-[#16213E] block mb-2">Muscle Groups</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMuscle(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    form.muscleGroups.includes(m)
                      ? 'bg-[#C9A84C] text-white'
                      : 'bg-[#F0EDE8] text-[#6B6560] hover:bg-[#E5E0D8]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[#16213E] block mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Brief description..."
              className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm bg-white text-[#16213E] placeholder-[#9E998F] outline-none focus:border-[#C9A84C] resize-none"
            />
          </div>
          <Input
            label="Video / Tutorial Link (optional)"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
          />
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
                className="flex items-center gap-1.5 text-xs text-[#9E998F] hover:text-[#6B6560] transition-colors"
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
                className="w-full max-h-40 object-cover rounded-xl border border-[#E5E0D8]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} loading={addExercise.isPending} className="flex-1">
              Add Exercise
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
