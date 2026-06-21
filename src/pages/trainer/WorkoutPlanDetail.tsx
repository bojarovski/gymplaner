import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Card from '../../components/ui/Card'
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, Dumbbell, Trash2, Moon,
  ArrowUp, ArrowDown, Pencil, Check, ExternalLink,
} from 'lucide-react'
import type { WorkoutPlan, WorkoutWeek, WorkoutDay, WorkoutExercise } from '../../types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type EditSet = { reps: string; weight: string; duration: string }

export default function TrainerWorkoutPlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/trainer/workout-plans'
  const qc = useQueryClient()

  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [addWeekModal, setAddWeekModal] = useState(false)
  const [addExerciseModal, setAddExerciseModal] = useState<{ weekId: string; dayId: string } | null>(null)
  const [newExName, setNewExName] = useState('')
  const [exType, setExType] = useState<'strength' | 'cardio'>('strength')
  const [sets, setSets] = useState([{ reps: 10, weight: 0 }])
  const [cardioSets, setCardioSets] = useState([{ duration: 20 }])
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDayName, setEditingDayName] = useState('')

  // ── Edit exercise modal ─────────────────────────────────────────────────
  const [editExModal, setEditExModal] = useState<{ weekId: string; dayId: string; ex: WorkoutExercise } | null>(null)
  const [editExName, setEditExName] = useState('')
  const [editExType, setEditExType] = useState<'strength' | 'cardio'>('strength')
  const [editExSets, setEditExSets] = useState<EditSet[]>([])
  const [editExVideoUrl, setEditExVideoUrl] = useState('')
  const [editExImageUrl, setEditExImageUrl] = useState('')

  // Add exercise URL overrides (pre-filled from library, editable)
  const [addExVideoUrl, setAddExVideoUrl] = useState('')
  const [addExImageUrl, setAddExImageUrl] = useState('')

  const openEditEx = (weekId: string, dayId: string, ex: WorkoutExercise) => {
    setEditExModal({ weekId, dayId, ex })
    setEditExName(ex.exerciseName)
    setEditExVideoUrl(ex.videoUrl ?? '')
    setEditExImageUrl(ex.imageUrl ?? '')
    const isCardio = ex.sets.length > 0 && ex.sets[0].duration != null
    setEditExType(isCardio ? 'cardio' : 'strength')
    setEditExSets(
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            reps: s.reps != null ? String(s.reps) : '',
            weight: String(s.weight ?? 0),
            duration: s.duration != null ? String(s.duration) : '',
          }))
        : [{ reps: '', weight: '0', duration: '' }]
    )
  }

  const closeEditEx = () => setEditExModal(null)

  const saveEditEx = () => {
    if (!plan || !editExModal) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== editExModal.weekId) return w
      return {
        ...w,
        days: w.days.map((d) => {
          if (d.id !== editExModal.dayId) return d
          return {
            ...d,
            exercises: (d.exercises ?? []).map((e) =>
              e.id !== editExModal.ex.id ? e : {
                ...e,
                exerciseName: editExName.trim() || e.exerciseName,
                videoUrl: editExVideoUrl.trim() || undefined,
                imageUrl: editExImageUrl.trim() || undefined,
                sets: editExType === 'cardio'
                  ? editExSets.map((s) => ({ duration: s.duration !== '' ? Number(s.duration) : undefined }))
                  : editExSets.map((s) => ({
                      reps: s.reps !== '' ? Number(s.reps) : undefined,
                      weight: s.weight !== '' ? Number(s.weight) : undefined,
                    })),
              }
            ),
          }
        }),
      }
    })
    updatePlan.mutate(weeks)
    closeEditEx()
  }

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: plan, isLoading } = useQuery({
    queryKey: ['workout-plan', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', id!))
      return { id: snap.id, ...snap.data() } as WorkoutPlan
    },
    enabled: !!id,
  })


  const updatePlan = useMutation({
    mutationFn: async (weeks: WorkoutWeek[]) => {
      await updateDoc(doc(db, 'workoutPlans', id!), { weeks })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-plan', id] }),
  })

  // ── Mutations ───────────────────────────────────────────────────────────
  const addWeek = () => {
    if (!plan) return
    const newWeek: WorkoutWeek = {
      id: crypto.randomUUID(),
      weekNumber: (plan.weeks?.length || 0) + 1,
      days: DAY_NAMES.map((name, i) => ({
        id: crypto.randomUUID(),
        name,
        order: i + 1,
        exercises: [],
        isRestDay: true,
      })),
    }
    updatePlan.mutate([...(plan.weeks || []), newWeek])
    setAddWeekModal(false)
  }

  const toggleRestDay = (weekId: string, dayId: string) => {
    if (!plan) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== weekId) return w
      return {
        ...w,
        days: w.days.map((d) => {
          if (d.id !== dayId) return d
          const next = !d.isRestDay
          if (next) setExpandedDay(null)
          return { ...d, isRestDay: next }
        }),
      }
    })
    updatePlan.mutate(weeks)
  }

  const moveDay = (weekId: string, dayId: string, dir: 'up' | 'down') => {
    if (!plan) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== weekId) return w
      const sorted = [...w.days].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((d) => d.id === dayId)
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= sorted.length) return w
      const newDays = sorted.map((d, i) => {
        if (i === idx) return { ...d, order: sorted[target].order }
        if (i === target) return { ...d, order: sorted[idx].order }
        return d
      })
      return { ...w, days: newDays }
    })
    updatePlan.mutate(weeks)
  }

  const saveDayName = (weekId: string, dayId: string) => {
    if (!plan || !editingDayName.trim()) { setEditingDayId(null); return }
    const weeks = plan.weeks.map((w) => {
      if (w.id !== weekId) return w
      return { ...w, days: w.days.map((d) => d.id === dayId ? { ...d, name: editingDayName.trim() } : d) }
    })
    updatePlan.mutate(weeks)
    setEditingDayId(null)
  }

  const addExercise = () => {
    if (!plan || !addExerciseModal || !newExName.trim()) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== addExerciseModal.weekId) return w
      return {
        ...w,
        days: w.days.map((d) => {
          if (d.id !== addExerciseModal.dayId) return d
          const exId = crypto.randomUUID()
          const newEx: WorkoutExercise = {
            id: exId,
            exerciseId: exId,
            exerciseName: newExName.trim(),
            order: (d.exercises ?? []).length + 1,
            sets: exType === 'cardio'
              ? cardioSets.map((s) => ({ duration: s.duration }))
              : sets.map((s) => ({ reps: s.reps, weight: s.weight })),
            ...(addExVideoUrl.trim() ? { videoUrl: addExVideoUrl.trim() } : {}),
            ...(addExImageUrl.trim() ? { imageUrl: addExImageUrl.trim() } : {}),
          }
          return { ...d, exercises: [...d.exercises, newEx] }
        }),
      }
    })
    updatePlan.mutate(weeks)
    setAddExerciseModal(null)
    setNewExName('')
    setExType('strength')
    setSets([{ reps: 10, weight: 0 }])
    setCardioSets([{ duration: 20 }])
    setAddExVideoUrl('')
    setAddExImageUrl('')
  }

  const removeExercise = (weekId: string, dayId: string, exId: string) => {
    if (!plan) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== weekId) return w
      return {
        ...w,
        days: w.days.map((d) =>
          d.id !== dayId ? d : { ...d, exercises: (d.exercises ?? []).filter((e) => e.id !== exId) }
        ),
      }
    })
    updatePlan.mutate(weeks)
  }

  if (isLoading) return <div className="p-4 md:p-8 text-slate-400 text-sm">Loading...</div>
  if (!plan) return null

  const weeks = plan.weeks ?? []
  const multiWeek = weeks.length > 1
  const activeWeek = multiWeek
    ? (weeks.find((w) => w.id === selectedWeekId) ?? weeks[0])
    : weeks[0]

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate(backTo)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mt-0.5 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#16213E]">{plan.name}</h1>
          {plan.description && <p className="text-[#6B6560] text-sm mt-0.5">{plan.description}</p>}
          <p className="text-xs text-[#9E998F] mt-1">
            {weeks.length} week{weeks.length !== 1 ? 's' : ''} ·{' '}
            {plan.repeatCycle !== false ? 'Repeating cycle' : 'One-time plan'}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddWeekModal(true)} className="flex-shrink-0">
          <Plus size={15} />
          Add Week
        </Button>
      </div>

      {weeks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#E5E0D8] rounded-2xl">
          <Dumbbell size={40} className="mx-auto text-[#C9A84C]/30 mb-3" />
          <p className="text-[#9E998F] text-sm mb-4">No weeks yet. Add a week to get started.</p>
          <Button size="sm" onClick={() => setAddWeekModal(true)}>
            <Plus size={15} />Add First Week
          </Button>
        </div>
      ) : (
        <>
          {/* Week tabs — only when >1 week */}
          {multiWeek && (
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {weeks.map((w) => {
                const isActive = w.id === (activeWeek?.id ?? weeks[0].id)
                const trainingDays = (w.days ?? []).filter((d) => !d.isRestDay).length
                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeekId(w.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#16213E] text-[#C9A84C]'
                        : 'bg-[#F0EDE8] text-[#6B6560] hover:bg-[#E5E0D8]'
                    }`}
                  >
                    Week {w.weekNumber}
                    <span className={`ml-1.5 text-[10px] font-normal ${isActive ? 'text-[#C9A84C]/70' : 'text-[#9E998F]'}`}>
                      {trainingDays}d
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Days — always visible, no accordion */}
          {activeWeek && (
            <div className="space-y-2">
              {[...(activeWeek.days ?? [])].sort((a, b) => a.order - b.order).map((day, idx, arr) => (
                <DayRow
                  key={day.id}
                  day={day}
                  idx={idx}
                  totalDays={arr.length}
                  weekId={activeWeek.id}
                  expandedDay={expandedDay}
                  editingDayId={editingDayId}
                  editingDayName={editingDayName}
                  isPending={updatePlan.isPending}
                  onToggleExpand={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
                  onToggleRest={() => toggleRestDay(activeWeek.id, day.id)}
                  onMoveUp={() => moveDay(activeWeek.id, day.id, 'up')}
                  onMoveDown={() => moveDay(activeWeek.id, day.id, 'down')}
                  onStartEditName={() => { setEditingDayId(day.id); setEditingDayName(day.name) }}
                  onEditNameChange={setEditingDayName}
                  onSaveName={() => saveDayName(activeWeek.id, day.id)}
                  onCancelName={() => setEditingDayId(null)}
                  onAddExercise={() => setAddExerciseModal({ weekId: activeWeek.id, dayId: day.id })}
                  onEditExercise={(ex) => openEditEx(activeWeek.id, day.id, ex)}
                  onRemoveExercise={(exId) => removeExercise(activeWeek.id, day.id, exId)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add week modal */}
      <Modal open={addWeekModal} onClose={() => setAddWeekModal(false)} title="Add Week">
        <div className="space-y-4">
          <p className="text-sm text-[#6B6560]">
            This will add Week {(plan.weeks?.length || 0) + 1} with all 7 days. Days start as rest days — toggle each one to training to add exercises.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAddWeekModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={addWeek} loading={updatePlan.isPending} className="flex-1">Add Week</Button>
          </div>
        </div>
      </Modal>

      {/* Add exercise modal */}
      <Modal
        open={!!addExerciseModal}
        onClose={() => { setAddExerciseModal(null); setNewExName(''); setExType('strength'); setSets([{ reps: 10, weight: 0 }]); setCardioSets([{ duration: 20 }]); setAddExVideoUrl(''); setAddExImageUrl('') }}
        title="Add Exercise"
        width="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#16213E] block mb-1.5">Exercise Name</label>
            <input
              autoFocus
              value={newExName}
              onChange={(e) => setNewExName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExercise()}
              placeholder="e.g. Barbell Squat"
              className="w-full px-3 py-2.5 border border-[#E5E0D8] rounded-xl text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
            />
          </div>
          {/* Type toggle */}
          <div className="flex gap-1 p-1 bg-[#F0EDE8] rounded-xl border border-[#E5E0D8]">
            {(['strength', 'cardio'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setExType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  exType === t ? 'bg-white text-[#16213E] shadow-sm border border-[#E5E0D8]' : 'text-[#9E998F] hover:text-[#6B6560]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {exType === 'strength' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#16213E]">Sets</label>
                <button onClick={() => setSets([...sets, { reps: 10, weight: 0 }])} className="text-xs text-[#C9A84C] font-medium hover:underline">+ Add Set</button>
              </div>
              <div className="grid grid-cols-[2.5rem_1fr_1fr_1.5rem] gap-2 text-xs font-semibold text-[#9E998F] px-1 pb-1">
                <span>#</span><span>Reps</span><span>Weight (kg)</span><span />
              </div>
              <div className="space-y-2">
                {sets.map((set, i) => (
                  <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr_1.5rem] gap-2 items-center">
                    <span className="text-xs text-[#9E998F] font-medium">{i + 1}</span>
                    <input type="number" value={set.reps} onChange={(e) => setSets(sets.map((s, j) => j === i ? { ...s, reps: +e.target.value } : s))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="Reps" />
                    <input type="number" value={set.weight} onChange={(e) => setSets(sets.map((s, j) => j === i ? { ...s, weight: +e.target.value } : s))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="0" />
                    {sets.length > 1 && <button onClick={() => setSets(sets.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#16213E]">Intervals</label>
                <button onClick={() => setCardioSets([...cardioSets, { duration: 20 }])} className="text-xs text-[#C9A84C] font-medium hover:underline">+ Add Interval</button>
              </div>
              <div className="grid grid-cols-[2.5rem_1fr_1.5rem] gap-2 text-xs font-semibold text-[#9E998F] px-1 pb-1">
                <span>#</span><span>Duration (min)</span><span />
              </div>
              <div className="space-y-2">
                {cardioSets.map((set, i) => (
                  <div key={i} className="grid grid-cols-[2.5rem_1fr_1.5rem] gap-2 items-center">
                    <span className="text-xs text-[#9E998F] font-medium">{i + 1}</span>
                    <input type="number" value={set.duration} onChange={(e) => setCardioSets(cardioSets.map((s, j) => j === i ? { duration: +e.target.value } : s))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="20" />
                    {cardioSets.length > 1 && <button onClick={() => setCardioSets(cardioSets.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide mb-1.5 block">Image URL (optional)</label>
              <input
                value={addExImageUrl}
                onChange={(e) => setAddExImageUrl(e.target.value)}
                placeholder="https://example.com/exercise.jpg"
                className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide mb-1.5 block">Video / Tutorial URL (optional)</label>
              <input
                value={addExVideoUrl}
                onChange={(e) => setAddExVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddExerciseModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={addExercise} disabled={!newExName.trim()} loading={updatePlan.isPending} className="flex-1">
              Add Exercise
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit exercise modal */}
      <Modal open={!!editExModal} onClose={closeEditEx} title="Edit Exercise" width="max-w-lg">
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide mb-1.5 block">Exercise Name</label>
            <input
              autoFocus
              value={editExName}
              onChange={(e) => setEditExName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveEditEx()}
              className="w-full px-3 py-2.5 border border-[#E5E0D8] rounded-xl text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
              placeholder="Exercise name"
            />
          </div>

          {/* Type toggle */}
          <div className="flex gap-1 p-1 bg-[#F0EDE8] rounded-xl border border-[#E5E0D8]">
            {(['strength', 'cardio'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEditExType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  editExType === t ? 'bg-white text-[#16213E] shadow-sm border border-[#E5E0D8]' : 'text-[#9E998F] hover:text-[#6B6560]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            {editExType === 'strength' ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">Sets</label>
                  <button onClick={() => setEditExSets([...editExSets, { reps: '', weight: '0', duration: '' }])} className="text-xs text-[#C9A84C] font-semibold hover:underline">+ Add Set</button>
                </div>
                <div className="grid grid-cols-[2rem_1fr_1fr_1.5rem] gap-2 text-xs font-semibold text-[#9E998F] px-1 pb-1.5">
                  <span>#</span><span>Reps</span><span>Weight (kg)</span><span />
                </div>
                <div className="space-y-2">
                  {editExSets.map((s, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1.5rem] gap-2 items-center">
                      <span className="text-xs text-[#9E998F] font-bold">{i + 1}</span>
                      <input type="number" value={s.reps} onChange={(e) => setEditExSets(editExSets.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="—" />
                      <input type="number" value={s.weight} onChange={(e) => setEditExSets(editExSets.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="0" />
                      {editExSets.length > 1 ? (
                        <button onClick={() => setEditExSets(editExSets.filter((_, j) => j !== i))} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      ) : <span />}
                </div>
              ))}
            </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide">Intervals</label>
                  <button onClick={() => setEditExSets([...editExSets, { reps: '', weight: '0', duration: '' }])} className="text-xs text-[#C9A84C] font-semibold hover:underline">+ Add Interval</button>
                </div>
                <div className="grid grid-cols-[2rem_1fr_1.5rem] gap-2 text-xs font-semibold text-[#9E998F] px-1 pb-1.5">
                  <span>#</span><span>Duration (min)</span><span />
                </div>
                <div className="space-y-2">
                  {editExSets.map((s, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_1.5rem] gap-2 items-center">
                      <span className="text-xs text-[#9E998F] font-bold">{i + 1}</span>
                      <input type="number" value={s.duration} onChange={(e) => setEditExSets(editExSets.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} className="px-2 py-1.5 border border-[#E5E0D8] rounded-lg text-sm text-center outline-none focus:border-[#C9A84C]" placeholder="20" />
                      {editExSets.length > 1 ? (
                        <button onClick={() => setEditExSets(editExSets.filter((_, j) => j !== i))} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide mb-1.5 block">Image URL (optional)</label>
              <input
                value={editExImageUrl}
                onChange={(e) => setEditExImageUrl(e.target.value)}
                placeholder="https://example.com/exercise.jpg"
                className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B6560] uppercase tracking-wide mb-1.5 block">Video / Tutorial URL (optional)</label>
              <input
                value={editExVideoUrl}
                onChange={(e) => setEditExVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={closeEditEx} className="flex-1">Cancel</Button>
            <Button onClick={saveEditEx} loading={updatePlan.isPending} className="flex-1">Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Day row sub-component ──────────────────────────────────────────────────
function DayRow({
  day, idx, totalDays, weekId,
  expandedDay, editingDayId, editingDayName, isPending,
  onToggleExpand, onToggleRest, onMoveUp, onMoveDown,
  onStartEditName, onEditNameChange, onSaveName, onCancelName,
  onAddExercise, onEditExercise, onRemoveExercise,
}: {
  day: WorkoutDay
  idx: number
  totalDays: number
  weekId: string
  expandedDay: string | null
  editingDayId: string | null
  editingDayName: string
  isPending: boolean
  onToggleExpand: () => void
  onToggleRest: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onStartEditName: () => void
  onEditNameChange: (v: string) => void
  onSaveName: () => void
  onCancelName: () => void
  onAddExercise: () => void
  onEditExercise: (ex: WorkoutExercise) => void
  onRemoveExercise: (exId: string) => void
}) {
  const isEditing = editingDayId === day.id
  const exCount = (day.exercises ?? []).length

  return (
    <div className={`rounded-2xl border overflow-hidden ${day.isRestDay ? 'border-slate-100 bg-slate-50/40' : 'border-[#E5E0D8] bg-white'}`}>
      {/* Day header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Day label */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          day.isRestDay ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 text-orange-500'
        }`}>
          {DAY_LABELS[day.order - 1]}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={editingDayName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); if (e.key === 'Escape') onCancelName() }}
                onBlur={onSaveName}
                className="flex-1 px-2 py-1 border border-[#C9A84C] rounded-lg text-sm text-[#16213E] outline-none bg-white"
              />
              <button onMouseDown={(e) => { e.preventDefault(); onSaveName() }} className="p-1 rounded-lg bg-[#C9A84C] text-white">
                <Check size={12} />
              </button>
            </div>
          ) : (
            <button
              className={`text-left text-sm font-semibold group flex items-center gap-1 ${day.isRestDay ? 'text-slate-400' : 'text-[#16213E]'}`}
              onClick={onStartEditName}
            >
              {day.name}
              <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          {!day.isRestDay && (
            <p className="text-xs text-[#9E998F] mt-0.5">{exCount} exercise{exCount !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Rest/Train toggle */}
        <button
          onClick={onToggleRest}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            day.isRestDay ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
          }`}
        >
          {day.isRestDay ? <Moon size={11} /> : <Dumbbell size={11} />}
          {day.isRestDay ? 'Rest' : 'Train'}
        </button>

        {/* Reorder */}
        <div className="flex flex-col flex-shrink-0">
          <button onClick={onMoveUp} disabled={idx === 0 || isPending} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ArrowUp size={11} /></button>
          <button onClick={onMoveDown} disabled={idx === totalDays - 1 || isPending} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ArrowDown size={11} /></button>
        </div>
      </div>

      {/* Exercise list — always visible for training days */}
      {!day.isRestDay && (
        <div className="border-t border-[#F0EDE8] divide-y divide-[#F8F6F3]">
          {(day.exercises ?? []).map((ex) => (
            <div
              key={ex.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAF9] transition-colors group cursor-pointer"
              onClick={() => onEditExercise(ex)}
            >
              {ex.imageUrl ? (
                <img src={ex.imageUrl} alt={ex.exerciseName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-[#E5E0D8]" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-[#F0EDE8] flex items-center justify-center flex-shrink-0">
                  <Dumbbell size={14} className="text-[#9E998F]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-[#16213E]">{ex.exerciseName}</p>
                  {ex.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                      title="Watch tutorial"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[#9E998F] mt-0.5">
                  {ex.sets.length} sets ·{' '}
                  {ex.sets.map((s) => s.reps != null ? `${s.reps}` : s.duration != null ? `${s.duration}min` : '—').join(' / ')} reps
                  {ex.notes && <span className="italic text-[#C9C4BC]"> · {ex.notes}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="p-1.5 rounded-lg text-[#9E998F] hover:text-blue-500 hover:bg-blue-50 transition-colors">
                  <Pencil size={13} />
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveExercise(ex.id) }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={onAddExercise}
            className="flex items-center gap-1.5 mx-4 my-2.5 text-xs font-semibold text-[#C9A84C] hover:text-[#b8922f] transition-colors"
          >
            <Plus size={13} />
            Add exercise
          </button>
        </div>
      )}
    </div>
  )
}
