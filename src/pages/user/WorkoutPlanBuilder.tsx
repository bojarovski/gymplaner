import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Card from '../../components/ui/Card'
import ExercisePicker from '../../components/ExercisePicker'
import {
  ArrowLeft, Plus, ChevronDown, ChevronUp, Dumbbell, Trash2, Moon,
  ArrowUp, ArrowDown, Pencil, Check, RefreshCw,
} from 'lucide-react'
import type { WorkoutPlan, WorkoutWeek, WorkoutDay, WorkoutExercise, Exercise } from '../../types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function UserWorkoutPlanBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [addWeekModal, setAddWeekModal] = useState(false)
  const [addExerciseModal, setAddExerciseModal] = useState<{ weekId: string; dayId: string } | null>(null)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [sets, setSets] = useState([{ reps: 10, weight: 0 }])
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDayName, setEditingDayName] = useState('')

  const { data: plan, isLoading } = useQuery({
    queryKey: ['workout-plan', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', id!))
      return { id: snap.id, ...snap.data() } as WorkoutPlan
    },
    enabled: !!id,
  })

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'exercises'))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Exercise))
    },
  })

  const updatePlan = useMutation({
    mutationFn: async (weeks: WorkoutWeek[]) => {
      await updateDoc(doc(db, 'workoutPlans', id!), { weeks })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-plan', id] }),
  })

  const toggleRepeat = useMutation({
    mutationFn: async (repeatCycle: boolean) => {
      await updateDoc(doc(db, 'workoutPlans', id!), { repeatCycle })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-plan', id] }),
  })

  const addWeek = () => {
    if (!plan) return
    const newWeek: WorkoutWeek = {
      id: crypto.randomUUID(),
      weekNumber: (plan.weeks?.length || 0) + 1,
      days: DAY_NAMES.map((name, i): WorkoutDay => ({
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
          if (next) setExpandedDay((prev) => prev === d.id ? null : prev)
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
    if (!plan || !addExerciseModal || !selectedExercise) return
    const exercise = exercises.find((e) => e.id === selectedExercise)
    if (!exercise) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== addExerciseModal.weekId) return w
      return {
        ...w,
        days: w.days.map((d) => {
          if (d.id !== addExerciseModal.dayId) return d
          const newEx: WorkoutExercise = {
            id: crypto.randomUUID(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            order: (d.exercises ?? []).length + 1,
            sets: sets.map((s) => ({ reps: s.reps, weight: s.weight })),
          }
          return { ...d, exercises: [...d.exercises, newEx] }
        }),
      }
    })
    updatePlan.mutate(weeks)
    setAddExerciseModal(null)
    setSelectedExercise('')
    setSets([{ reps: 10, weight: 0 }])
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

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/user/plans')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1>
          {plan.description && <p className="text-slate-500 text-sm mt-0.5">{plan.description}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400">{plan.weeks?.length || 0} weeks</p>
          <button
            onClick={() => toggleRepeat.mutate(!(plan.repeatCycle !== false))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${plan.repeatCycle !== false ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            <RefreshCw size={11} className={plan.repeatCycle !== false ? 'text-blue-500' : 'text-slate-400'} />
            {plan.repeatCycle !== false ? 'Repeating' : 'One-time'}
          </button>
        </div>
        <Button size="sm" onClick={() => setAddWeekModal(true)}>
          <Plus size={15} />
          Add Week
        </Button>
      </div>

      <div className="space-y-4">
        {(plan.weeks || []).map((week) => {
          const sorted = [...week.days].sort((a, b) => a.order - b.order)
          const workoutDays = sorted.filter((d) => !d.isRestDay).length
          return (
            <Card key={week.id} className="p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">W{week.weekNumber}</span>
                  </div>
                  <span className="font-semibold text-slate-900">Week {week.weekNumber}</span>
                  <span className="text-xs text-slate-400">{workoutDays} training · {7 - workoutDays} rest</span>
                </div>
                {expandedWeek === week.id
                  ? <ChevronUp size={16} className="text-slate-400" />
                  : <ChevronDown size={16} className="text-slate-400" />
                }
              </button>

              {expandedWeek === week.id && (
                <div className="border-t border-slate-100 p-4 space-y-2">
                  {sorted.map((day, idx) => (
                    <div key={day.id} className={`border rounded-xl overflow-hidden transition-colors ${day.isRestDay ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                      {/* Day header row */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Weekday label */}
                        <span className={`text-xs font-bold w-8 flex-shrink-0 ${day.isRestDay ? 'text-slate-300' : 'text-orange-500'}`}>
                          {DAY_LABELS[day.order - 1]}
                        </span>

                        {/* Editable name */}
                        {editingDayId === day.id ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editingDayName}
                              onChange={(e) => setEditingDayName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveDayName(week.id, day.id)
                                if (e.key === 'Escape') setEditingDayId(null)
                              }}
                              onBlur={() => saveDayName(week.id, day.id)}
                              className="flex-1 px-2 py-1 border border-blue-400 rounded-lg text-sm text-slate-900 outline-none bg-white"
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); saveDayName(week.id, day.id) }}
                              className="p-1 rounded-lg bg-blue-500 text-white"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className={`flex-1 text-left text-sm font-medium group flex items-center gap-1.5 ${day.isRestDay ? 'text-slate-400' : 'text-slate-900'}`}
                            onClick={() => { setEditingDayId(day.id); setEditingDayName(day.name) }}
                          >
                            <span>{day.name}</span>
                            <Pencil size={11} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}

                        {/* Stats */}
                        {!day.isRestDay && editingDayId !== day.id && (
                          <span className="text-xs text-slate-400 flex-shrink-0">{(day.exercises ?? []).length} ex</span>
                        )}

                        {/* Rest toggle */}
                        <button
                          onClick={() => toggleRestDay(week.id, day.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                            day.isRestDay
                              ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                          }`}
                        >
                          {day.isRestDay ? <Moon size={12} /> : <Dumbbell size={12} />}
                          {day.isRestDay ? 'Rest' : 'Train'}
                        </button>

                        {/* Reorder */}
                        <div className="flex flex-col flex-shrink-0">
                          <button
                            onClick={() => moveDay(week.id, day.id, 'up')}
                            disabled={idx === 0 || updatePlan.isPending}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveDay(week.id, day.id, 'down')}
                            disabled={idx === sorted.length - 1 || updatePlan.isPending}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        {/* Expand (only for training days) */}
                        {!day.isRestDay && (
                          <button
                            onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                          >
                            {expandedDay === day.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>

                      {/* Exercise list */}
                      {!day.isRestDay && expandedDay === day.id && (
                        <div className="border-t border-slate-100 p-3 space-y-2">
                          {(day.exercises ?? []).map((ex) => (
                            <div key={ex.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{ex.exerciseName}</p>
                                <p className="text-xs text-slate-400">
                                  {ex.sets.length} sets · {ex.sets[0]?.reps} reps · {ex.sets[0]?.weight}kg
                                </p>
                              </div>
                              <button
                                onClick={() => removeExercise(week.id, day.id, ex.id)}
                                className="p-1 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setAddExerciseModal({ weekId: week.id, dayId: day.id })}
                            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-orange-300 rounded-lg text-xs font-medium text-orange-500 hover:bg-orange-50 transition-colors"
                          >
                            <Plus size={13} />
                            Add Exercise
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}

        {(!plan.weeks || plan.weeks.length === 0) && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <Dumbbell size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm mb-4">No weeks added yet. Each week includes all 7 days.</p>
            <Button size="sm" onClick={() => setAddWeekModal(true)}>
              <Plus size={15} />
              Add First Week
            </Button>
          </div>
        )}
      </div>

      <Modal open={addWeekModal} onClose={() => setAddWeekModal(false)} title="Add Week">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            This will add Week {(plan.weeks?.length || 0) + 1} with all 7 days. Days start as rest days — toggle each one to training to add exercises.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAddWeekModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={addWeek} loading={updatePlan.isPending} className="flex-1">Add Week</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!addExerciseModal} onClose={() => { setAddExerciseModal(null); setSelectedExercise(''); setSets([{ reps: 10, weight: 0 }]) }} title="Add Exercise" width="max-w-xl">
        <div className="space-y-4">
          <ExercisePicker
            value={selectedExercise}
            onChange={setSelectedExercise}
            exercises={exercises}
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Sets</label>
              <button onClick={() => setSets([...sets, { reps: 10, weight: 0 }])} className="text-xs text-blue-500 font-medium hover:underline">
                + Add Set
              </button>
            </div>
            <div className="space-y-2">
              {sets.map((set, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-12">Set {i + 1}</span>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => setSets(sets.map((s, j) => j === i ? { ...s, reps: +e.target.value } : s))}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    placeholder="Reps"
                  />
                  <input
                    type="number"
                    value={set.weight}
                    onChange={(e) => setSets(sets.map((s, j) => j === i ? { ...s, weight: +e.target.value } : s))}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    placeholder="kg"
                  />
                  {sets.length > 1 && (
                    <button onClick={() => setSets(sets.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddExerciseModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={addExercise} disabled={!selectedExercise} loading={updatePlan.isPending} className="flex-1">
              Add Exercise
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
