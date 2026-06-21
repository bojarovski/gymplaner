import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import {
  TrendingUp, Plus, Scale, Dumbbell, Utensils, Activity,
  Flame, Trophy, Target, BarChart2,
} from 'lucide-react'
import Select from '../../components/ui/Select'
import type { BodyMeasurement } from '../../types'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

type Tab = 'overview' | 'gym' | 'nutrition' | 'body'

// ── helpers ───────────────────────────────────────────────────────────────────

function mondayOf(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortWeek(mondayStr: string) {
  return new Date(mondayStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calcStreak(dates: string[]): number {
  const s = new Set(dates)
  let streak = 0
  const d = new Date()
  while (true) {
    const key = d.toISOString().split('T')[0]
    if (!s.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }
const GRID_STROKE = '#f1f5f9'

// ── component ─────────────────────────────────────────────────────────────────

export default function UserProgress() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [modal, setModal] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [form, setForm] = useState({
    weight: '', bodyFat: '', chest: '', waist: '', hips: '', arms: '', thighs: '', notes: '',
  })

  // ── Firestore queries ───────────────────────────────────────────────────────

  const { data: measurements = [], isLoading: measLoading } = useQuery({
    queryKey: ['measurements', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'bodyMeasurements'), where('userId', '==', user!.uid), orderBy('date', 'asc'))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() } as BodyMeasurement))
    },
    enabled: !!user,
  })

  const { data: workoutLogs = [] } = useQuery({
    queryKey: ['workout-logs', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'workoutLogs'), where('userId', '==', user!.uid), orderBy('date', 'asc'))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
        id: string; date: string; exercises: Array<{ exerciseName: string; sets: Array<{ reps?: number; weight?: number; completed?: boolean }> }>
      }>
    },
    enabled: !!user,
  })

  const { data: mealTracking = [] } = useQuery({
    queryKey: ['meal-tracking-all', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'mealTracking'), where('userId', '==', user!.uid), orderBy('date', 'asc'))
      const snap = await getDocs(q)
      return snap.docs.map((d) => d.data() as { date: string; mealId: string })
    },
    enabled: !!user,
  })

  const addMeasurement = useMutation({
    mutationFn: async () => {
      await addDoc(collection(db, 'bodyMeasurements'), {
        userId: user!.uid, date: serverTimestamp(),
        weight: form.weight ? +form.weight : null, bodyFat: form.bodyFat ? +form.bodyFat : null,
        chest: form.chest ? +form.chest : null, waist: form.waist ? +form.waist : null,
        hips: form.hips ? +form.hips : null, arms: form.arms ? +form.arms : null,
        thighs: form.thighs ? +form.thighs : null, notes: form.notes || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements'] })
      setModal(false)
      setForm({ weight: '', bodyFat: '', chest: '', waist: '', hips: '', arms: '', thighs: '', notes: '' })
    },
  })

  // ── Derived gym data ────────────────────────────────────────────────────────

  const gymStats = useMemo(() => {
    const sessions = workoutLogs.length
    let totalSets = 0, totalReps = 0, totalVolume = 0

    for (const log of workoutLogs) {
      for (const ex of log.exercises ?? []) {
        for (const s of ex.sets ?? []) {
          if (s.completed) {
            totalSets++
            totalReps += s.reps ?? 0
            totalVolume += (s.weight ?? 0) * (s.reps ?? 0)
          }
        }
      }
    }

    const streak = calcStreak(workoutLogs.map((l) => l.date))
    return { sessions, totalSets, totalReps, totalVolume: Math.round(totalVolume), streak }
  }, [workoutLogs])

  // Sessions per week (last 10 weeks)
  const sessionsByWeek = useMemo(() => {
    const map: Record<string, number> = {}
    for (const log of workoutLogs) {
      const w = mondayOf(log.date)
      map[w] = (map[w] || 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([monday, count]) => ({ week: shortWeek(monday), sessions: count }))
  }, [workoutLogs])

  // Volume per session (last 20 sessions)
  const volumePerSession = useMemo(() =>
    workoutLogs.slice(-20).map((log) => {
      let vol = 0, reps = 0
      for (const ex of log.exercises ?? [])
        for (const s of ex.sets ?? [])
          if (s.completed) { vol += (s.weight ?? 0) * (s.reps ?? 0); reps += s.reps ?? 0 }
      return { date: shortDate(log.date), volume: Math.round(vol), reps }
    }), [workoutLogs])

  // Exercise frequency (top 8)
  const exerciseFrequency = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const log of workoutLogs)
      for (const ex of log.exercises ?? [])
        freq[ex.exerciseName] = (freq[ex.exerciseName] || 0) + 1
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 16) + '…' : name, count }))
  }, [workoutLogs])

  const exerciseNames = useMemo(() =>
    [...new Set(workoutLogs.flatMap((l) => (l.exercises ?? []).map((e) => e.exerciseName)))],
    [workoutLogs])

  // Per-exercise progress
  const exerciseData = useMemo(() => {
    if (!selectedExercise) return []
    return workoutLogs
      .filter((l) => (l.exercises ?? []).some((e) => e.exerciseName === selectedExercise))
      .map((log) => {
        const ex = (log.exercises ?? []).find((e) => e.exerciseName === selectedExercise)!
        const completed = (ex.sets ?? []).filter((s) => s.completed)
        const maxWeight = Math.max(0, ...completed.map((s) => s.weight ?? 0))
        const totalReps = completed.reduce((s, r) => s + (r.reps ?? 0), 0)
        const volume = completed.reduce((s, r) => s + (r.weight ?? 0) * (r.reps ?? 0), 0)
        return { date: shortDate(log.date), maxWeight, totalReps, volume: Math.round(volume) }
      })
  }, [workoutLogs, selectedExercise])

  // ── Derived nutrition data ──────────────────────────────────────────────────

  const nutritionStats = useMemo(() => {
    const total = mealTracking.length
    const days = new Set(mealTracking.map((m) => m.date)).size
    const avg = days > 0 ? +(total / days).toFixed(1) : 0
    const streak = calcStreak(mealTracking.map((m) => m.date))
    return { total, days, avg, streak }
  }, [mealTracking])

  // Meals per day (last 21 days)
  const mealsPerDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of mealTracking) map[m.date] = (map[m.date] || 0) + 1
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-21)
      .map(([date, meals]) => ({ date: shortDate(date), meals }))
  }, [mealTracking])

  // Weekly meal consistency (last 10 weeks)
  const mealsByWeek = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of mealTracking) {
      const w = mondayOf(m.date)
      map[w] = (map[w] || 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([monday, meals]) => ({ week: shortWeek(monday), meals }))
  }, [mealTracking])

  // Monthly meal consistency (last 12 months)
  const mealsByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of mealTracking) {
      const month = m.date.slice(0, 7) // "YYYY-MM"
      map[month] = (map[month] || 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, meals]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        meals,
      }))
  }, [mealTracking])

  // ── Body data ───────────────────────────────────────────────────────────────

  const weightData = measurements.filter((m) => m.weight).map((m) => ({
    date: m.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: m.weight,
  }))

  const latest = [...measurements].reverse()[0]
  const previous = [...measurements].reverse()[1]
  const diff = (curr?: number | null, prev?: number | null) => {
    if (!curr || !prev) return null
    const d = curr - prev
    return { value: Math.abs(d).toFixed(1), positive: d > 0 }
  }

  const bodyRadarData = latest ? [
    { metric: 'Weight', value: latest.weight ?? 0 },
    { metric: 'Chest', value: latest.chest ?? 0 },
    { metric: 'Waist', value: latest.waist ?? 0 },
    { metric: 'Hips', value: latest.hips ?? 0 },
    { metric: 'Arms', value: latest.arms ?? 0 },
    { metric: 'Thighs', value: latest.thighs ?? 0 },
  ].filter((d) => d.value > 0) : []

  // ── Tab config ──────────────────────────────────────────────────────────────

  const tabs: { id: Tab; icon: typeof TrendingUp; label: string }[] = [
    { id: 'overview', icon: BarChart2, label: 'Overview' },
    { id: 'gym', icon: Dumbbell, label: 'Gym' },
    { id: 'nutrition', icon: Utensils, label: 'Nutrition' },
    { id: 'body', icon: Scale, label: 'Body' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
          <p className="text-slate-500 mt-1 text-sm">Charts and statistics from your training</p>
        </div>
        {tab === 'body' && (
          <Button onClick={() => setModal(true)}>
            <Plus size={16} />
            Log Measurement
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-fit mb-6 overflow-x-auto no-scrollbar">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Key stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Workout Sessions', value: gymStats.sessions, icon: Dumbbell, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
              { label: 'Workout Streak', value: `${gymStats.streak}d`, icon: Flame, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
              { label: 'Meals Logged', value: nutritionStats.total, icon: Utensils, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
              { label: 'Meal Streak', value: `${nutritionStats.streak}d`, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className={`border ${border} ${bg} rounded-2xl p-4`}>
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={16} className={color} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Sessions + meals per week side by side */}
          {(sessionsByWeek.length > 0 || mealsByWeek.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              {sessionsByWeek.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Dumbbell size={15} className="text-orange-500" />
                    <h3 className="font-semibold text-slate-900 text-sm">Workouts per Week</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={sessionsByWeek} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} width={20} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="sessions" fill="#f97316" radius={[4, 4, 0, 0]} name="Sessions" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
              {mealsByWeek.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Utensils size={15} className="text-purple-500" />
                    <h3 className="font-semibold text-slate-900 text-sm">Meals per Week</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={mealsByWeek} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} width={20} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="meals" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Meals" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}

          {/* More gym stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sets', value: gymStats.totalSets.toLocaleString(), color: 'text-blue-600' },
              { label: 'Total Reps', value: gymStats.totalReps.toLocaleString(), color: 'text-emerald-600' },
              { label: 'Total Volume', value: gymStats.totalVolume > 0 ? `${(gymStats.totalVolume / 1000).toFixed(1)}t` : '—', color: 'text-orange-600' },
              { label: 'Unique Exercises', value: exerciseNames.length, color: 'text-slate-900' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="text-center py-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </Card>
            ))}
          </div>

          {workoutLogs.length === 0 && mealTracking.length === 0 && measurements.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <TrendingUp size={44} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No data yet</h3>
              <p className="text-slate-400 text-sm">Complete workouts and log meals in the Today screen to see your progress here.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Gym Tab ──────────────────────────────────────────────────────────── */}
      {tab === 'gym' && (
        <div className="space-y-6">
          {workoutLogs.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <Dumbbell size={44} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No workout logs yet</h3>
              <p className="text-slate-400 text-sm">Complete workouts in the Today screen to see your gym progress here.</p>
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Sessions', value: gymStats.sessions, color: 'text-orange-500' },
                  { label: 'Workout Streak', value: `${gymStats.streak}d`, color: 'text-red-500' },
                  { label: 'Total Sets', value: gymStats.totalSets.toLocaleString(), color: 'text-blue-600' },
                  { label: 'Total Volume', value: gymStats.totalVolume > 0 ? `${(gymStats.totalVolume / 1000).toFixed(1)}t` : `${gymStats.totalReps} reps`, color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="text-center py-4">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-1">{label}</p>
                  </Card>
                ))}
              </div>

              {/* Sessions per week */}
              {sessionsByWeek.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={15} className="text-orange-500" />
                    <h3 className="font-semibold text-slate-900">Sessions per Week</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sessionsByWeek} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={24} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="sessions" fill="#f97316" radius={[5, 5, 0, 0]} name="Sessions" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Volume over time */}
              {volumePerSession.length > 1 && volumePerSession.some((v) => v.volume > 0) && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={15} className="text-emerald-500" />
                    <h3 className="font-semibold text-slate-900">Volume per Session (kg)</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={volumePerSession}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} fill="url(#volGrad)" dot={{ fill: '#10b981', r: 3 }} name="Volume (kg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Total reps per session (when no weight data) */}
              {volumePerSession.length > 1 && !volumePerSession.some((v) => v.volume > 0) && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={15} className="text-blue-500" />
                    <h3 className="font-semibold text-slate-900">Reps per Session</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={volumePerSession}>
                      <defs>
                        <linearGradient id="repsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={32} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="reps" stroke="#3b82f6" strokeWidth={2} fill="url(#repsGrad)" dot={{ fill: '#3b82f6', r: 3 }} name="Total Reps" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Exercise frequency */}
              {exerciseFrequency.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={15} className="text-purple-500" />
                    <h3 className="font-semibold text-slate-900">Most Trained Exercises</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={exerciseFrequency} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Times performed" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Per-exercise drill-down */}
              <Card>
                <Select
                  label="Drill Down: Select Exercise"
                  value={selectedExercise}
                  onChange={setSelectedExercise}
                  placeholder="Choose an exercise..."
                  options={exerciseNames.map((name) => ({ value: name, label: name }))}
                />
              </Card>

              {selectedExercise && exerciseData.length >= 1 && (
                <div className="grid md:grid-cols-2 gap-4">
                  {exerciseData.some((d) => d.maxWeight > 0) && (
                    <Card>
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={15} className="text-orange-500" />
                        <h3 className="font-semibold text-slate-900 text-sm">Max Weight (kg)</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={exerciseData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} width={32} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Line type="monotone" dataKey="maxWeight" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} name="Max Weight (kg)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                  <Card>
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={15} className="text-blue-500" />
                      <h3 className="font-semibold text-slate-900 text-sm">Total Reps</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={exerciseData} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="totalReps" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Reps" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  {exerciseData.some((d) => d.volume > 0) && (
                    <Card className="md:col-span-2">
                      <div className="flex items-center gap-2 mb-4">
                        <Flame size={15} className="text-emerald-500" />
                        <h3 className="font-semibold text-slate-900 text-sm">Session Volume (kg)</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={exerciseData}>
                          <defs>
                            <linearGradient id="exVolGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Area type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} fill="url(#exVolGrad)" dot={{ fill: '#10b981', r: 3 }} name="Volume (kg)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Nutrition Tab ─────────────────────────────────────────────────────── */}
      {tab === 'nutrition' && (
        <div className="space-y-6">
          {mealTracking.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <Utensils size={44} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No meal logs yet</h3>
              <p className="text-slate-400 text-sm">Check off meals in the Today screen to see your nutrition data here.</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Meals', value: nutritionStats.total, color: 'text-purple-600' },
                  { label: 'Days Tracked', value: nutritionStats.days, color: 'text-blue-600' },
                  { label: 'Avg Meals/Day', value: nutritionStats.avg, color: 'text-emerald-600' },
                  { label: 'Current Streak', value: `${nutritionStats.streak}d`, color: 'text-amber-500' },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="text-center py-4">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-1">{label}</p>
                  </Card>
                ))}
              </div>

              {/* Meals per day */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Utensils size={15} className="text-purple-500" />
                  <h3 className="font-semibold text-slate-900">Meals Logged per Day</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mealsPerDay} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={24} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="meals" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Meals" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Weekly meal volume */}
              {mealsByWeek.length > 1 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={15} className="text-emerald-500" />
                    <h3 className="font-semibold text-slate-900">Weekly Meal Tracking</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={mealsByWeek}>
                      <defs>
                        <linearGradient id="mealGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={24} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="meals" stroke="#8b5cf6" strokeWidth={2} fill="url(#mealGrad)" dot={{ fill: '#8b5cf6', r: 3 }} name="Meals" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Monthly meal volume */}
              {mealsByMonth.length > 1 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Flame size={15} className="text-purple-500" />
                    <h3 className="font-semibold text-slate-900">Monthly Meal Tracking</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={mealsByMonth} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={28} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="meals" fill="#a855f7" radius={[5, 5, 0, 0]} name="Meals logged" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Body Tab ─────────────────────────────────────────────────────────── */}
      {tab === 'body' && (
        <div className="space-y-6">
          {measLoading ? (
            <p className="text-center text-slate-400 text-sm py-8">Loading...</p>
          ) : measurements.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <Scale size={44} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No measurements yet</h3>
              <p className="text-slate-400 text-sm mb-5">Start logging to track your body changes over time</p>
              <Button onClick={() => setModal(true)}><Plus size={16} />Log First Measurement</Button>
            </div>
          ) : (
            <>
              {/* Weight chart */}
              {weightData.length >= 2 ? (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={15} className="text-emerald-500" />
                    <h3 className="font-semibold text-slate-900">Body Weight (kg)</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={weightData}>
                      <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={['auto', 'auto']} width={36} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} fill="url(#weightGrad)" dot={{ fill: '#10b981', r: 3 }} name="Weight (kg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              ) : weightData.length === 1 && (
                <Card>
                  <p className="text-sm text-slate-400 text-center py-4">Add at least 2 weight entries to see the trend chart.</p>
                </Card>
              )}

              {/* Body radar */}
              {bodyRadarData.length >= 3 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={15} className="text-blue-500" />
                    <h3 className="font-semibold text-slate-900">Latest Measurements</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={bodyRadarData}>
                      <PolarGrid stroke={GRID_STROKE} />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Radar name="Measurements" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Stat cards */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Latest Stats</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Weight', value: latest?.weight, unit: 'kg', prev: previous?.weight },
                    { label: 'Body Fat', value: latest?.bodyFat, unit: '%', prev: previous?.bodyFat },
                    { label: 'Chest', value: latest?.chest, unit: 'cm', prev: previous?.chest },
                    { label: 'Waist', value: latest?.waist, unit: 'cm', prev: previous?.waist },
                    { label: 'Hips', value: latest?.hips, unit: 'cm', prev: previous?.hips },
                    { label: 'Arms', value: latest?.arms, unit: 'cm', prev: previous?.arms },
                    { label: 'Thighs', value: latest?.thighs, unit: 'cm', prev: previous?.thighs },
                  ].filter((m) => m.value).map(({ label, value, unit, prev }) => {
                    const d = diff(value, prev)
                    const isDownGood = label === 'Weight' || label === 'Body Fat' || label === 'Waist'
                    return (
                      <Card key={label} className="py-4">
                        <p className="text-xs text-slate-400 mb-1">{label}</p>
                        <p className="text-xl font-bold text-slate-900">
                          {value}<span className="text-sm font-normal text-slate-400 ml-0.5">{unit}</span>
                        </p>
                        {d && (
                          <p className={`text-xs mt-1 font-medium ${
                            isDownGood
                              ? (d.positive ? 'text-red-500' : 'text-emerald-500')
                              : (d.positive ? 'text-blue-500' : 'text-slate-400')
                          }`}>
                            {d.positive ? '+' : '−'}{d.value}{unit}
                          </p>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Log Measurement Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Log Measurement" width="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="70.5" />
            <Input label="Body Fat (%)" type="number" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} placeholder="15.0" />
            <Input label="Chest (cm)" type="number" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} placeholder="95" />
            <Input label="Waist (cm)" type="number" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} placeholder="80" />
            <Input label="Hips (cm)" type="number" value={form.hips} onChange={(e) => setForm({ ...form, hips: e.target.value })} placeholder="95" />
            <Input label="Arms (cm)" type="number" value={form.arms} onChange={(e) => setForm({ ...form, arms: e.target.value })} placeholder="35" />
            <Input label="Thighs (cm)" type="number" value={form.thighs} onChange={(e) => setForm({ ...form, thighs: e.target.value })} placeholder="55" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="How are you feeling?"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={() => addMeasurement.mutate()} loading={addMeasurement.isPending} className="flex-1">
              Save Measurement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
