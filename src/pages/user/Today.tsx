import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  doc, getDoc, collection, getDocs, addDoc, deleteDoc, query, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import {
  Moon, Dumbbell, Utensils, CheckCircle2, Circle, CalendarCheck,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderOpen, Flame, Zap, Trophy, Check, RefreshCw, ExternalLink,
} from 'lucide-react'
import type { WorkoutPlan, NutritionPlan, WorkoutDay, NutritionDay } from '../../types'

const TODAY_ORDER = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d })()
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type SetRow = { reps: string; weight: string; completed: boolean }
type ExTracking = { [exId: string]: SetRow[] }

function resolveWeek(plan: WorkoutPlan | NutritionPlan, startDate?: Date, weekOffset = 0) {
  const weeks = plan.weeks
  if (!weeks?.length) return { week: null, weekIndex: 0, isComplete: false }
  let raw = weekOffset
  if (startDate) {
    const adjustedNow = Date.now() + weekOffset * 7 * 86400000
    const daysSince = Math.floor((adjustedNow - startDate.getTime()) / 86400000)
    raw = Math.floor(daysSince / 7)
  }
  const repeats = plan.repeatCycle !== false
  if (!repeats && raw >= weeks.length) return { week: null, weekIndex: raw, isComplete: true }
  const idx = repeats ? ((raw % weeks.length) + weeks.length) % weeks.length : Math.min(Math.max(raw, 0), weeks.length - 1)
  return { week: weeks[idx], weekIndex: idx, isComplete: !repeats && raw >= weeks.length }
}

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const daysToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMon + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const todayDateStr = new Date().toISOString().split('T')[0]

function getDayByOrder(week: WorkoutPlan['weeks'][0] | NutritionPlan['weeks'][0] | null, order: number) {
  if (!week?.days?.length) return null
  return week.days.find((d) => d.order === order) ?? null
}

export default function UserToday() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [selectedOrder, setSelectedOrder] = useState(TODAY_ORDER)
  const [weekOffset, setWeekOffset] = useState(0)
  const [workoutExpanded, setWorkoutExpanded] = useState(true)
  const [mealsExpanded, setMealsExpanded] = useState(true)
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [exTracking, setExTracking] = useState<ExTracking>({})
  const [showDayPicker, setShowDayPicker] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const selectedDate = weekDates[selectedOrder - 1]
  const selectedDateStr = selectedDate.toISOString().split('T')[0]
  const isViewingToday = selectedDateStr === todayDateStr

  const todayDate = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const weekLabel = (() => {
    const start = weekDates[0]
    const end = weekDates[6]
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}`
  })()

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: userDoc } = useQuery({
    queryKey: ['user-doc', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid))
      return snap.data() as {
        activeWorkoutPlanId?: string
        activeNutritionPlanId?: string
        workoutPlanStartDate?: { toDate: () => Date }
      }
    },
    enabled: !!user,
  })

  const { data: workoutPlan } = useQuery({
    queryKey: ['workout-plan', userDoc?.activeWorkoutPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', userDoc!.activeWorkoutPlanId!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutPlan) : null
    },
    enabled: !!userDoc?.activeWorkoutPlanId,
  })

  const { data: nutritionPlan } = useQuery({
    queryKey: ['nutrition-plan', userDoc?.activeNutritionPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', userDoc!.activeNutritionPlanId!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as NutritionPlan) : null
    },
    enabled: !!userDoc?.activeNutritionPlanId,
  })

  const { data: completedMeals = [] } = useQuery({
    queryKey: ['meal-tracking', user?.uid, selectedDateStr],
    queryFn: async () => {
      const q = query(
        collection(db, 'mealTracking'),
        where('userId', '==', user!.uid),
        where('date', '==', selectedDateStr),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => d.data().mealId as string)
    },
    enabled: !!user,
  })

  const { data: workoutLogged } = useQuery({
    queryKey: ['workout-log-today', user?.uid, selectedDateStr],
    queryFn: async () => {
      const q = query(
        collection(db, 'workoutLogs'),
        where('userId', '==', user!.uid),
        where('date', '==', selectedDateStr),
      )
      const snap = await getDocs(q)
      return !snap.empty
    },
    enabled: !!user,
  })

  // ── Day override query ───────────────────────────────────────────────────
  const { data: dayOverride } = useQuery({
    queryKey: ['day-override', user?.uid, selectedDateStr],
    queryFn: async () => {
      const q = query(
        collection(db, 'workoutDayOverrides'),
        where('userId', '==', user!.uid),
        where('date', '==', selectedDateStr),
      )
      const snap = await getDocs(q)
      if (snap.empty) return null
      return { docId: snap.docs[0].id, ...snap.docs[0].data() } as { docId: string; dayId: string }
    },
    enabled: !!user,
  })

  // ── Plan resolution ──────────────────────────────────────────────────────
  const startDate = userDoc?.workoutPlanStartDate?.toDate()
  const { week: workoutWeek, weekIndex: workoutWeekIndex, isComplete: workoutDone } = useMemo(
    () => workoutPlan ? resolveWeek(workoutPlan, startDate, weekOffset) : { week: null, weekIndex: 0, isComplete: false },
    [workoutPlan, startDate, weekOffset],
  )
  const { week: nutritionWeek, isComplete: nutritionDone } = useMemo(
    () => nutritionPlan ? resolveWeek(nutritionPlan, undefined, weekOffset) : { week: null, weekIndex: 0, isComplete: false },
    [nutritionPlan, weekOffset],
  )

  const selectedWorkoutDay = getDayByOrder(workoutWeek, selectedOrder) as WorkoutDay | null
  const selectedNutritionDay = getDayByOrder(nutritionWeek, selectedOrder) as NutritionDay | null

  // Override: find the overridden day anywhere in the plan's weeks
  const effectiveWorkoutDay = useMemo<WorkoutDay | null>(() => {
    if (!dayOverride) return selectedWorkoutDay
    const found = workoutPlan?.weeks.flatMap((w) => w.days).find((d) => d.id === dayOverride.dayId)
    return (found as WorkoutDay) ?? selectedWorkoutDay
  }, [dayOverride, selectedWorkoutDay, workoutPlan])

  const isOverridden = !!(dayOverride && effectiveWorkoutDay?.id !== selectedWorkoutDay?.id)

  // ── Init set tracking when effective day changes ─────────────────────────
  useEffect(() => {
    if (!effectiveWorkoutDay) return
    const init: ExTracking = {}
    ;(effectiveWorkoutDay.exercises ?? []).forEach((ex) => {
      init[ex.id] = ex.sets.map((s) => ({
        reps: s.reps != null ? String(s.reps) : s.duration != null ? String(s.duration) : '',
        weight: String(s.weight ?? 0),
        completed: false,
      }))
    })
    setExTracking(init)
  }, [effectiveWorkoutDay?.id])

  // ── Day meta ─────────────────────────────────────────────────────────────
  const dayMeta = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const order = i + 1
    const wd = getDayByOrder(workoutWeek, order) as WorkoutDay | null
    const nd = getDayByOrder(nutritionWeek, order) as NutritionDay | null
    const date = weekDates[i]
    const dateStr = date.toISOString().split('T')[0]
    return { order, label: DAY_LABELS[i], date, dateStr, wd, nd, isRestDay: wd?.isRestDay ?? false, hasWorkout: !!wd && !wd.isRestDay, hasMeals: !!nd && nd.meals.length > 0, inPlan: !!wd || !!nd }
  }), [workoutWeek, nutritionWeek, weekDates])

  const totalCalories = selectedNutritionDay?.meals.reduce((s, m) => s + (m.calories || 0), 0) ?? 0
  const completedCalories = selectedNutritionDay?.meals.filter((m) => completedMeals.includes(m.id)).reduce((s, m) => s + (m.calories || 0), 0) ?? 0

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
  const hasAnyPlan = userDoc?.activeWorkoutPlanId || userDoc?.activeNutritionPlanId

  // ── Mutations ────────────────────────────────────────────────────────────
  const toggleMeal = useMutation({
    mutationFn: async ({ mealId, planId, completed }: { mealId: string; planId: string; completed: boolean }) => {
      if (completed) {
        const q = query(collection(db, 'mealTracking'), where('userId', '==', user!.uid), where('date', '==', selectedDateStr), where('mealId', '==', mealId))
        const snap = await getDocs(q)
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
      } else {
        await addDoc(collection(db, 'mealTracking'), { userId: user!.uid, planId, date: selectedDateStr, mealId, completed: true, createdAt: serverTimestamp() })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-tracking'] }),
  })

  const setDayOverrideMut = useMutation({
    mutationFn: async (dayId: string) => {
      // Clear existing override for this date first
      const q = query(collection(db, 'workoutDayOverrides'), where('userId', '==', user!.uid), where('date', '==', selectedDateStr))
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
      await addDoc(collection(db, 'workoutDayOverrides'), { userId: user!.uid, date: selectedDateStr, planId: workoutPlan!.id, dayId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-override'] })
      setShowDayPicker(false)
    },
  })

  const clearDayOverrideMut = useMutation({
    mutationFn: async () => {
      const q = query(collection(db, 'workoutDayOverrides'), where('userId', '==', user!.uid), where('date', '==', selectedDateStr))
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-override'] })
      setShowDayPicker(false)
    },
  })

  const logWorkout = useMutation({
    mutationFn: async ({ planId, weekId, dayId }: { planId: string; weekId: string; dayId: string }) => {
      const loggedExercises = (effectiveWorkoutDay?.exercises ?? []).map((ex) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: (exTracking[ex.id] ?? []).map((r) => ({
          reps: r.reps !== '' ? Number(r.reps) : undefined,
          weight: r.weight !== '' ? Number(r.weight) : undefined,
          completed: r.completed,
        })),
      }))
      await addDoc(collection(db, 'workoutLogs'), {
        userId: user!.uid, planId, weekId, dayId, date: selectedDateStr,
        exercises: loggedExercises, createdAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-log-today'] }),
  })

  const updateSet = (exId: string, si: number, patch: Partial<SetRow>) => {
    setExTracking((prev) => {
      const rows = [...(prev[exId] ?? [])]
      rows[si] = { ...rows[si], ...patch }
      return { ...prev, [exId]: rows }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
          <CalendarCheck size={15} />
          <span>{todayDate}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isViewingToday ? `${greeting()}, ${user?.displayName?.split(' ')[0]}` : DAY_LABELS[selectedOrder - 1]}
        </h1>
      </div>

      {!hasAnyPlan && (
        <Card className="text-center py-12">
          <CalendarCheck size={44} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No active plans selected</h3>
          <p className="text-sm text-slate-500 mb-6">Go to My Plans and set an active plan to see your schedule here.</p>
          <Button onClick={() => navigate('/user/plans')}><FolderOpen size={16} />Go to My Plans</Button>
        </Card>
      )}

      {/* Week nav + day selector */}
      {hasAnyPlan && (
        <div className="mb-6">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              onClick={() => { setWeekOffset(0); setSelectedOrder(TODAY_ORDER) }}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                weekOffset === 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {weekOffset === 0 ? 'This week' : weekLabel}
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day pills */}
          <div className="flex gap-1 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar">
            {dayMeta.map(({ order, label, date, dateStr, isRestDay, hasWorkout, hasMeals, inPlan }) => {
              const isSelected = order === selectedOrder
              const isActualToday = dateStr === todayDateStr
              return (
                <button
                  key={order}
                  onClick={() => setSelectedOrder(order)}
                  className={`flex-1 min-w-[2.8rem] flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all text-xs font-medium ${
                    isSelected ? 'bg-white shadow-sm text-slate-900' : inPlan ? 'text-slate-500 hover:bg-white/60 hover:text-slate-700' : 'text-slate-300 hover:bg-white/40'
                  }`}
                >
                  <span className="font-semibold text-[11px]">{label}</span>
                  <span className={`text-[11px] font-normal ${isActualToday ? (isSelected ? 'text-blue-500' : 'text-blue-400') : isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                  <div className="flex items-center h-2.5">
                    {isActualToday && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-blue-400'}`} />}
                    {!isActualToday && isRestDay && <Moon size={9} className="text-slate-300" />}
                    {!isActualToday && !isRestDay && hasWorkout && <Dumbbell size={8} className={isSelected ? 'text-orange-500' : 'text-slate-300'} />}
                    {!isActualToday && !hasWorkout && !isRestDay && hasMeals && <Utensils size={8} className={isSelected ? 'text-purple-500' : 'text-slate-300'} />}
                  </div>
                </button>
              )
            })}
          </div>

          {weekOffset !== 0 && (
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-slate-400">{weekLabel}</p>
              <button
                onClick={() => { setWeekOffset(0); setSelectedOrder(TODAY_ORDER) }}
                className="text-xs text-blue-500 font-medium hover:underline"
              >
                Back to today
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Workout section ──────────────────────────────────────────────── */}
      {workoutPlan && (
        <div className="mb-6">
          <button className="w-full flex items-center justify-between mb-3" onClick={() => setWorkoutExpanded(!workoutExpanded)}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
                <Dumbbell size={14} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {isViewingToday ? "Today's Workout" : `${DAY_LABELS[selectedOrder - 1]}'s Workout`}
              </h2>
              {effectiveWorkoutDay?.isRestDay && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Moon size={10} />Rest
                </span>
              )}
              {isOverridden && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RefreshCw size={10} />Changed
                </span>
              )}
              {isViewingToday && workoutLogged && !effectiveWorkoutDay?.isRestDay && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={11} />Logged
                </span>
              )}
            </div>
            {workoutExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {workoutExpanded && (
            <div>
              {workoutDone ? (
                <Card className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <Trophy size={26} className="text-emerald-500" />
                  </div>
                  <p className="font-semibold text-slate-900 mb-1">Plan Complete!</p>
                  <p className="text-sm text-slate-400 mb-4">You finished all {workoutPlan.weeks.length} week{workoutPlan.weeks.length !== 1 ? 's' : ''} of <span className="font-medium">{workoutPlan.name}</span>.</p>
                  <button onClick={() => navigate('/user/plans')} className="text-sm text-blue-500 font-medium hover:underline">Choose a new plan →</button>
                </Card>
              ) : !effectiveWorkoutDay ? (
                <div className="text-center py-8 border-2 border-dashed border-[#E5E0D8] rounded-2xl">
                  <Moon size={28} className="mx-auto text-[#C9C4BC] mb-2" />
                  <p className="text-sm text-[#9E998F] mb-3">No workout scheduled for {DAY_LABELS[selectedOrder - 1]}</p>
                  <button
                    onClick={() => setShowDayPicker(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Dumbbell size={13} />Pick a workout to do
                  </button>
                </div>
              ) : effectiveWorkoutDay.isRestDay ? (
                <div className="text-center py-8 border border-[#E5E0D8] rounded-2xl bg-white">
                  <Moon size={32} className="mx-auto text-[#C9C4BC] mb-2" />
                  <p className="font-semibold text-[#16213E] mb-1">{effectiveWorkoutDay.name}</p>
                  <p className="text-sm text-[#9E998F] mb-4">Rest day — no training {isViewingToday ? 'today' : `on ${DAY_LABELS[selectedOrder - 1]}`}.</p>
                  <button
                    onClick={() => setShowDayPicker(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Dumbbell size={13} />Train anyway
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header bar */}
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <p className="font-semibold text-slate-900">{effectiveWorkoutDay.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(effectiveWorkoutDay.exercises ?? []).length} exercises · Week {workoutWeekIndex + 1} of {workoutPlan.weeks.length}
                        {workoutPlan.repeatCycle !== false ? ' (repeating)' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDayPicker(true)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                          isOverridden
                            ? 'text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100'
                            : 'text-slate-500 border-slate-200 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-200'
                        }`}
                      >
                        <RefreshCw size={12} />
                        {isOverridden ? 'Changed' : 'Change'}
                      </button>
                      {isViewingToday && !workoutLogged && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const weekWithDay = workoutPlan.weeks.find((w) => w.days.some((d) => d.id === effectiveWorkoutDay.id))
                            if (weekWithDay) logWorkout.mutate({ planId: workoutPlan.id, weekId: weekWithDay.id, dayId: effectiveWorkoutDay.id })
                          }}
                          loading={logWorkout.isPending}
                        >
                          <CheckCircle2 size={14} />
                          Save Workout
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Exercise cards */}
                  {(effectiveWorkoutDay.exercises ?? []).length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                      <Dumbbell size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">No exercises in this day yet.</p>
                    </div>
                  )}
                  {(effectiveWorkoutDay.exercises ?? []).map((ex) => {
                    const rows = exTracking[ex.id] ?? []
                    const doneCount = rows.filter((r) => r.completed).length
                    const repsSummary = ex.sets.map((s) => s.reps ?? s.duration ?? '—').join('-')
                    const allDone = rows.length > 0 && doneCount === rows.length

                    return (
                      <div key={ex.id} className={`border rounded-2xl overflow-hidden transition-colors ${allDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                        {/* Exercise header */}
                        <div className="flex items-start justify-between px-4 pt-3.5 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className={`font-semibold text-sm ${allDone ? 'text-emerald-800' : 'text-[#16213E]'}`}>{ex.exerciseName}</p>
                              {ex.videoUrl && (
                                <a
                                  href={ex.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                                  title="Watch tutorial"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-orange-500 mt-0.5">
                              {rows.length} set{rows.length !== 1 ? 's' : ''} · {repsSummary} reps
                            </p>
                          </div>
                          <span className={`text-xs font-semibold mt-0.5 flex-shrink-0 ${allDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {doneCount}/{rows.length}
                          </span>
                        </div>

                        {/* Sets table */}
                        <div className="px-4 pb-3.5">
                          {/* Column headers */}
                          <div className="grid grid-cols-[1.5rem_2.5rem_1.75rem_1fr_1fr] gap-2 px-0.5 pb-2 border-b border-slate-100 mb-2.5">
                            <span className="text-[11px] text-slate-400 font-semibold">#</span>
                            <span className="text-[11px] text-slate-400 font-semibold">Target</span>
                            <span className="text-[11px] text-slate-400 font-semibold text-center">✓</span>
                            <span className="text-[11px] text-slate-400 font-semibold text-center">Reps</span>
                            <span className="text-[11px] text-slate-400 font-semibold text-center">kg</span>
                          </div>

                          <div className="space-y-2">
                            {rows.map((row, si) => {
                              const targetVal = ex.sets[si]?.reps ?? ex.sets[si]?.duration ?? '—'
                              return (
                                <div key={si} className="grid grid-cols-[1.5rem_2.5rem_1.75rem_1fr_1fr] gap-2 items-center">
                                  <span className="text-xs text-slate-400 font-medium">{si + 1}</span>
                                  <span className="text-xs text-slate-500 font-medium">{targetVal}</span>
                                  <button
                                    onClick={() => updateSet(ex.id, si, { completed: !row.completed })}
                                    className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                      row.completed
                                        ? 'bg-orange-500 border-orange-500'
                                        : 'border-slate-300 bg-white hover:border-orange-400'
                                    }`}
                                  >
                                    {row.completed && <Check size={11} className="text-white" strokeWidth={3} />}
                                  </button>
                                  <input
                                    type="number"
                                    value={row.reps}
                                    onChange={(e) => updateSet(ex.id, si, { reps: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-white border border-orange-200 rounded-lg text-orange-600 text-sm text-center outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 font-semibold transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="—"
                                  />
                                  <input
                                    type="number"
                                    value={row.weight}
                                    onChange={(e) => updateSet(ex.id, si, { weight: e.target.value })}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm text-center outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Nutrition section ─────────────────────────────────────────────── */}
      {nutritionPlan && (
        <div>
          <button className="w-full flex items-center justify-between mb-3" onClick={() => setMealsExpanded(!mealsExpanded)}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center">
                <Utensils size={14} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {isViewingToday ? "Today's Meals" : `${DAY_LABELS[selectedOrder - 1]}'s Meals`}
              </h2>
              {isViewingToday && totalCalories > 0 && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flame size={10} />{completedCalories}/{totalCalories} kcal
                </span>
              )}
            </div>
            {mealsExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {mealsExpanded && (
            <Card>
              {nutritionDone ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <Trophy size={26} className="text-emerald-500" />
                  </div>
                  <p className="font-semibold text-slate-900 mb-1">Nutrition Plan Complete!</p>
                  <p className="text-sm text-slate-400 mb-4">You finished all {nutritionPlan.weeks.length} week{nutritionPlan.weeks.length !== 1 ? 's' : ''} of <span className="font-medium">{nutritionPlan.name}</span>.</p>
                  <button onClick={() => navigate('/user/plans')} className="text-sm text-purple-500 font-medium hover:underline">Choose a new plan →</button>
                </div>
              ) : !selectedNutritionDay || selectedNutritionDay.meals.length === 0 ? (
                <div className="text-center py-6">
                  <Utensils size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No meals scheduled for {DAY_LABELS[selectedOrder - 1]} in this plan</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedNutritionDay.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedNutritionDay.meals.length} meals · from {nutritionPlan.name}</p>
                    </div>
                    {isViewingToday && totalCalories > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-bold text-purple-600">{completedCalories} kcal</p>
                        <p className="text-xs text-slate-400">of {totalCalories}</p>
                      </div>
                    )}
                  </div>

                  {isViewingToday && totalCalories > 0 && (
                    <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (completedCalories / totalCalories) * 100)}%` }} />
                    </div>
                  )}

                  <div className="space-y-2">
                    {selectedNutritionDay.meals.map((meal) => {
                      const done = isViewingToday && completedMeals.includes(meal.id)
                      const hasDetails = !!(meal.ingredients || meal.instructions)
                      const isOpen = expandedMeal === meal.id
                      return (
                        <div key={meal.id} className={`rounded-xl border transition-all ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-3 p-3">
                            <button
                              onClick={() => isViewingToday && toggleMeal.mutate({ mealId: meal.id, planId: nutritionPlan.id, completed: done })}
                              disabled={!isViewingToday}
                              className="flex-shrink-0 disabled:cursor-default"
                            >
                              {isViewingToday ? done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-slate-300" /> : <Circle size={18} className="text-slate-200" />}
                            </button>
                            <button
                              className={`flex-1 text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                              onClick={() => hasDetails && setExpandedMeal(isOpen ? null : meal.id)}
                              disabled={!hasDetails}
                            >
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium ${done ? 'text-emerald-700 line-through' : 'text-slate-900'}`}>{meal.name}</p>
                                {meal.time && <span className="text-xs text-slate-400">{meal.time}</span>}
                              </div>
                              {(meal.protein || meal.carbs || meal.fat) && (
                                <div className="flex gap-3 mt-0.5">
                                  {meal.protein && <span className="text-xs text-slate-500">P: {meal.protein}g</span>}
                                  {meal.carbs && <span className="text-xs text-slate-500">C: {meal.carbs}g</span>}
                                  {meal.fat && <span className="text-xs text-slate-500">F: {meal.fat}g</span>}
                                </div>
                              )}
                            </button>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {meal.calories && (
                                <div className="flex items-center gap-0.5 text-xs font-semibold text-slate-500">
                                  <Zap size={11} />{meal.calories}
                                </div>
                              )}
                              {hasDetails && (
                                <button onClick={() => setExpandedMeal(isOpen ? null : meal.id)} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors">
                                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </div>
                          </div>
                          {isOpen && hasDetails && (
                            <div className="border-t border-slate-200 px-4 pb-3 pt-2.5 space-y-3">
                              {meal.ingredients && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ingredients</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{meal.ingredients}</p>
                                </div>
                              )}
                              {meal.instructions && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preparation</p>
                                  <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{meal.instructions}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!isViewingToday && <p className="text-xs text-slate-400 text-center mt-3">Switch to today to track meals</p>}
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {hasAnyPlan && !(userDoc?.activeWorkoutPlanId && userDoc?.activeNutritionPlanId) && (
        <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <FolderOpen size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            You only have one active plan.{' '}
            <button onClick={() => navigate('/user/plans')} className="font-semibold underline">Set both a workout and nutrition plan</button>{' '}
            for the full schedule.
          </p>
        </div>
      )}

      {/* ── Day picker modal ─────────────────────────────────────────────── */}
      <Modal
        open={showDayPicker}
        onClose={() => setShowDayPicker(false)}
        title="Choose a workout day"
      >
        <div className="space-y-4">
          {dayOverride && (
            <button
              onClick={() => clearDayOverrideMut.mutate()}
              disabled={clearDayOverrideMut.isPending}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl py-2 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={11} />
              Reset to plan default ({selectedWorkoutDay?.name ?? 'auto'})
            </button>
          )}

          {(workoutPlan?.weeks ?? []).map((week) => (
            <div key={week.id}>
              {(workoutPlan?.weeks.length ?? 0) > 1 && (
                <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest mb-2">Week {week.weekNumber}</p>
              )}
              <div className="space-y-1.5">
                {[...(week.days as WorkoutDay[])].sort((a, b) => a.order - b.order).map((day) => {
                  const isActive = effectiveWorkoutDay?.id === day.id
                  const isDefault = selectedWorkoutDay?.id === day.id && !dayOverride
                  return (
                    <button
                      key={day.id}
                      onClick={() => {
                        if (isDefault) { setShowDayPicker(false); return }
                        setDayOverrideMut.mutate(day.id)
                      }}
                      disabled={setDayOverrideMut.isPending || clearDayOverrideMut.isPending}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        isActive
                          ? 'border-orange-400 bg-orange-50'
                          : day.isRestDay
                          ? 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200'
                          : 'border-[#E5E0D8] bg-white hover:border-orange-300 hover:bg-orange-50/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                        isActive ? 'bg-orange-500 text-white' : day.isRestDay ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 text-orange-500'
                      }`}>
                        {DAY_LABELS[day.order - 1]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isActive ? 'text-orange-700' : day.isRestDay ? 'text-slate-400' : 'text-[#16213E]'}`}>
                          {day.name}
                        </p>
                        <p className="text-xs text-[#9E998F] mt-0.5">
                          {day.isRestDay ? 'Rest day' : `${(day.exercises ?? []).length} exercises`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isDefault && <span className="text-[10px] text-[#9E998F] bg-[#F0EDE8] px-1.5 py-0.5 rounded-full">default</span>}
                        {isActive && !isDefault && <Check size={15} className="text-orange-500" strokeWidth={2.5} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
