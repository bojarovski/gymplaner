import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, query, where, addDoc, doc, updateDoc, serverTimestamp,
  getDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { Dumbbell, Utensils, Plus, ChevronRight, Trash2, Star, RefreshCw } from 'lucide-react'
import type { WorkoutPlan, NutritionPlan } from '../../types'

export default function UserPlans() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'workout' | 'nutrition'>('workout')
  const [createWorkoutModal, setCreateWorkoutModal] = useState(false)
  const [createNutritionModal, setCreateNutritionModal] = useState(false)
  const [workoutForm, setWorkoutForm] = useState({ name: '', description: '', repeatCycle: true })
  const [nutritionForm, setNutritionForm] = useState({ name: '', description: '', calories: '', repeatCycle: true })

  const { data: userDoc } = useQuery({
    queryKey: ['user-doc', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid))
      return snap.data() as {
        activeWorkoutPlanId?: string
        activeNutritionPlanId?: string
        assignedWorkoutPlanId?: string
        assignedNutritionPlanId?: string
        workoutPlanStartDate?: any
      }
    },
    enabled: !!user,
  })

  const { data: assignment } = useQuery({
    queryKey: ['assignment', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'assignments'), where('userId', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.empty ? null : snap.docs[0].data()
    },
    enabled: !!user,
  })

  const { data: trainerWorkoutPlan } = useQuery({
    queryKey: ['trainer-workout-plan', assignment?.workoutPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', assignment!.workoutPlanId))
      return snap.exists() ? ({ id: snap.id, ...snap.data(), source: 'trainer' } as WorkoutPlan & { source: string }) : null
    },
    enabled: !!assignment?.workoutPlanId,
  })

  const { data: trainerNutritionPlan } = useQuery({
    queryKey: ['trainer-nutrition-plan', assignment?.nutritionPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', assignment!.nutritionPlanId))
      return snap.exists() ? ({ id: snap.id, ...snap.data(), source: 'trainer' } as NutritionPlan & { source: string }) : null
    },
    enabled: !!assignment?.nutritionPlanId,
  })

  // Fetch whatever plan the admin/coach set as active — regardless of ownership
  // We decide at render time whether to show it as 'coach' or skip (already in myPlans)
  const activeWorkoutId2 = userDoc?.assignedWorkoutPlanId ?? userDoc?.activeWorkoutPlanId
  const activeNutritionId2 = userDoc?.assignedNutritionPlanId ?? userDoc?.activeNutritionPlanId

  const { data: fetchedWorkoutPlan } = useQuery({
    queryKey: ['fetched-workout-plan', activeWorkoutId2],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', activeWorkoutId2!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutPlan) : null
    },
    enabled: !!activeWorkoutId2,
  })

  const { data: fetchedNutritionPlan } = useQuery({
    queryKey: ['fetched-nutrition-plan', activeNutritionId2],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', activeNutritionId2!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as NutritionPlan) : null
    },
    enabled: !!activeNutritionId2,
  })

  const { data: myWorkoutPlans = [] } = useQuery({
    queryKey: ['my-workout-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'workoutPlans'), where('ownedBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), source: 'self' } as WorkoutPlan & { source: string }))
    },
    enabled: !!user,
  })

  const { data: myNutritionPlans = [] } = useQuery({
    queryKey: ['my-nutrition-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'nutritionPlans'), where('ownedBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), source: 'self' } as NutritionPlan & { source: string }))
    },
    enabled: !!user,
  })

  const createWorkoutPlan = useMutation({
    mutationFn: async () => {
      const ref = await addDoc(collection(db, 'workoutPlans'), {
        name: workoutForm.name,
        description: workoutForm.description || null,
        repeatCycle: workoutForm.repeatCycle,
        createdBy: user!.uid,
        ownedBy: user!.uid,
        weeks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['my-workout-plans'] })
      setCreateWorkoutModal(false)
      setWorkoutForm({ name: '', description: '', repeatCycle: true })
      navigate(`/user/plans/workout/${id}`)
    },
  })

  const createNutritionPlan = useMutation({
    mutationFn: async () => {
      const ref = await addDoc(collection(db, 'nutritionPlans'), {
        name: nutritionForm.name,
        description: nutritionForm.description || null,
        dailyCalorieTarget: nutritionForm.calories ? +nutritionForm.calories : null,
        repeatCycle: nutritionForm.repeatCycle,
        createdBy: user!.uid,
        ownedBy: user!.uid,
        weeks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['my-nutrition-plans'] })
      setCreateNutritionModal(false)
      setNutritionForm({ name: '', description: '', calories: '', repeatCycle: true })
      navigate(`/user/plans/nutrition/${id}`)
    },
  })

  const setActiveWorkout = useMutation({
    mutationFn: async (planId: string) => {
      await updateDoc(doc(db, 'users', user!.uid), {
        activeWorkoutPlanId: planId,
        workoutPlanStartDate: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-doc'] }),
  })

  const setActiveNutrition = useMutation({
    mutationFn: async (planId: string) => {
      await updateDoc(doc(db, 'users', user!.uid), { activeNutritionPlanId: planId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-doc'] }),
  })

  const deleteMyWorkoutPlan = useMutation({
    mutationFn: async (planId: string) => {
      await deleteDoc(doc(db, 'workoutPlans', planId))
      if (userDoc?.activeWorkoutPlanId === planId) {
        await updateDoc(doc(db, 'users', user!.uid), { activeWorkoutPlanId: null })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-workout-plans'] })
      qc.invalidateQueries({ queryKey: ['user-doc'] })
    },
  })

  const deleteMyNutritionPlan = useMutation({
    mutationFn: async (planId: string) => {
      await deleteDoc(doc(db, 'nutritionPlans', planId))
      if (userDoc?.activeNutritionPlanId === planId) {
        await updateDoc(doc(db, 'users', user!.uid), { activeNutritionPlanId: null })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-nutrition-plans'] })
      qc.invalidateQueries({ queryKey: ['user-doc'] })
    },
  })

  const myWorkoutIds = new Set(myWorkoutPlans.map((p) => p.id))
  const myNutritionIds = new Set(myNutritionPlans.map((p) => p.id))

  // Tag fetched plan as 'coach' only if the user doesn't own it
  const coachWorkoutPlan =
    fetchedWorkoutPlan && !myWorkoutIds.has(fetchedWorkoutPlan.id)
      ? { ...fetchedWorkoutPlan, source: 'coach' as const }
      : null
  const coachNutritionPlan =
    fetchedNutritionPlan && !myNutritionIds.has(fetchedNutritionPlan.id)
      ? { ...fetchedNutritionPlan, source: 'coach' as const }
      : null

  // Trainer plan (from assignments collection) — skip if already covered by coach or own
  const coachAndMyWorkoutIds = new Set([...myWorkoutIds, ...(coachWorkoutPlan ? [coachWorkoutPlan.id] : [])])
  const coachAndMyNutritionIds = new Set([...myNutritionIds, ...(coachNutritionPlan ? [coachNutritionPlan.id] : [])])

  const allWorkoutPlans = [
    ...(coachWorkoutPlan ? [coachWorkoutPlan] : []),
    ...(trainerWorkoutPlan && !coachAndMyWorkoutIds.has(trainerWorkoutPlan.id)
      ? [{ ...trainerWorkoutPlan, source: 'trainer' as const }] : []),
    ...myWorkoutPlans.map((p) => ({ ...p, source: 'self' as const })),
  ]

  const allNutritionPlans = [
    ...(coachNutritionPlan ? [coachNutritionPlan] : []),
    ...(trainerNutritionPlan && !coachAndMyNutritionIds.has(trainerNutritionPlan.id)
      ? [{ ...trainerNutritionPlan, source: 'trainer' as const }] : []),
    ...myNutritionPlans.map((p) => ({ ...p, source: 'self' as const })),
  ]

  const activeWorkoutId = userDoc?.activeWorkoutPlanId
  const activeNutritionId = userDoc?.activeNutritionPlanId


  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">My Plans</h1>
          <p className="text-[#9E998F] mt-0.5 text-sm hidden sm:block">Create your own plans or use the ones your trainer assigned</p>
        </div>
        <button
          onClick={() => tab === 'workout' ? setCreateWorkoutModal(true) : setCreateNutritionModal(true)}
          className="flex items-center gap-1.5 bg-[#16213E] hover:bg-[#1e2d4a] text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New {tab === 'workout' ? 'Workout' : 'Nutrition'} Plan</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F0EDE8] rounded-xl mb-5 w-full">
        <button
          onClick={() => setTab('workout')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'workout' ? 'bg-white text-[#16213E] shadow-sm' : 'text-[#9E998F] hover:text-[#6B6560]'}`}
        >
          <Dumbbell size={14} />
          <span>Workout</span>
        </button>
        <button
          onClick={() => setTab('nutrition')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'nutrition' ? 'bg-white text-[#16213E] shadow-sm' : 'text-[#9E998F] hover:text-[#6B6560]'}`}
        >
          <Utensils size={14} />
          <span>Nutrition</span>
        </button>
      </div>

      {tab === 'workout' && (() => {
        const assigned = allWorkoutPlans.filter((p) => p.source !== 'self')
        const mine = allWorkoutPlans.filter((p) => p.source === 'self')
        const renderCard = (plan: typeof allWorkoutPlans[0]) => {
          const isActive = plan.id === activeWorkoutId
          return (
            <div
              key={plan.id}
              className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border transition-all ${
                isActive ? 'border-blue-400 ring-1 ring-blue-400' : 'border-[#E5E0D8]'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-500' : 'bg-[#F0EDE8]'}`}>
                <Dumbbell size={16} className={isActive ? 'text-white' : 'text-[#9E998F]'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#16213E] text-sm truncate">{plan.name}</p>
                <p className="text-xs text-[#9E998F] mt-0.5 truncate">
                  {plan.weeks?.length || 0}w
                  {plan.repeatCycle !== false ? ' · repeating' : ' · one-time'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isActive && (
                  <button
                    onClick={() => setActiveWorkout.mutate(plan.id)}
                    title="Set Active"
                    className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Star size={15} />
                  </button>
                )}
                {plan.source === 'self' && (
                  <button
                    onClick={() => navigate(`/user/plans/workout/${plan.id}`)}
                    className="p-1.5 rounded-lg text-[#C9C4BC] hover:text-[#6B6560] hover:bg-[#F0EDE8] transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                )}
                {plan.source === 'self' && (
                  <button
                    onClick={() => deleteMyWorkoutPlan.mutate(plan.id)}
                    className="p-1.5 rounded-lg text-[#C9C4BC] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        }
        return (
          <div className="space-y-5">
            {assigned.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest mb-2.5">Assigned to me</p>
                <div className="space-y-2">{assigned.map(renderCard)}</div>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest mb-2.5">My Plans</p>
              {mine.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-[#E5E0D8] rounded-2xl">
                  <Dumbbell size={28} className="mx-auto text-[#C9C4BC] mb-2" />
                  <p className="text-[#9E998F] text-sm mb-3">No workout plans yet.</p>
                  <button
                    onClick={() => setCreateWorkoutModal(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16213E] bg-[#F0EDE8] hover:bg-[#E5E0D8] px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus size={14} />Create Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">{mine.map(renderCard)}</div>
              )}
            </div>
          </div>
        )
      })()}

      {tab === 'nutrition' && (() => {
        const assigned = allNutritionPlans.filter((p) => p.source !== 'self')
        const mine = allNutritionPlans.filter((p) => p.source === 'self')
        const renderCard = (plan: typeof allNutritionPlans[0]) => {
          const isActive = plan.id === activeNutritionId
          return (
            <div
              key={plan.id}
              className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border transition-all ${
                isActive ? 'border-purple-400 ring-1 ring-purple-400' : 'border-[#E5E0D8]'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-purple-500' : 'bg-[#F0EDE8]'}`}>
                <Utensils size={16} className={isActive ? 'text-white' : 'text-[#9E998F]'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#16213E] text-sm truncate">{plan.name}</p>
                <p className="text-xs text-[#9E998F] mt-0.5 truncate">
                  {plan.weeks?.length || 0}w
                  {(plan as NutritionPlan).dailyCalorieTarget ? ` · ${(plan as NutritionPlan).dailyCalorieTarget} kcal` : ''}
                  {plan.repeatCycle !== false ? ' · repeating' : ' · one-time'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isActive && (
                  <button
                    onClick={() => setActiveNutrition.mutate(plan.id)}
                    title="Set Active"
                    className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                  >
                    <Star size={15} />
                  </button>
                )}
                {plan.source === 'self' && (
                  <button
                    onClick={() => navigate(`/user/plans/nutrition/${plan.id}`)}
                    className="p-1.5 rounded-lg text-[#C9C4BC] hover:text-[#6B6560] hover:bg-[#F0EDE8] transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                )}
                {plan.source === 'self' && (
                  <button
                    onClick={() => deleteMyNutritionPlan.mutate(plan.id)}
                    className="p-1.5 rounded-lg text-[#C9C4BC] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        }
        return (
          <div className="space-y-5">
            {assigned.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest mb-2.5">Assigned to me</p>
                <div className="space-y-2">{assigned.map(renderCard)}</div>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest mb-2.5">My Plans</p>
              {mine.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-[#E5E0D8] rounded-2xl">
                  <Utensils size={28} className="mx-auto text-[#C9C4BC] mb-2" />
                  <p className="text-[#9E998F] text-sm mb-3">No nutrition plans yet.</p>
                  <button
                    onClick={() => setCreateNutritionModal(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16213E] bg-[#F0EDE8] hover:bg-[#E5E0D8] px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus size={14} />Create Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-2">{mine.map(renderCard)}</div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Create Workout Plan Modal */}
      <Modal open={createWorkoutModal} onClose={() => setCreateWorkoutModal(false)} title="Create Workout Plan">
        <div className="space-y-4">
          <Input
            label="Plan Name"
            value={workoutForm.name}
            onChange={(e) => setWorkoutForm({ ...workoutForm, name: e.target.value })}
            placeholder="e.g. My 4-Week Strength Plan"
          />
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Description (optional)</label>
            <textarea
              value={workoutForm.description}
              onChange={(e) => setWorkoutForm({ ...workoutForm, description: e.target.value })}
              rows={2}
              placeholder="What's this plan for?"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 resize-none"
            />
          </div>
          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <RefreshCw size={15} className="text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Repeat cycle</p>
                <p className="text-xs text-slate-400">
                  {workoutForm.repeatCycle
                    ? 'Weeks repeat in a loop once all are done'
                    : 'Plan ends after the last week is complete'
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWorkoutForm({ ...workoutForm, repeatCycle: !workoutForm.repeatCycle })}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${workoutForm.repeatCycle ? 'bg-blue-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${workoutForm.repeatCycle ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateWorkoutModal(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => createWorkoutPlan.mutate()}
              disabled={!workoutForm.name.trim()}
              loading={createWorkoutPlan.isPending}
              className="flex-1"
            >
              Create & Build
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Nutrition Plan Modal */}
      <Modal open={createNutritionModal} onClose={() => setCreateNutritionModal(false)} title="Create Nutrition Plan">
        <div className="space-y-4">
          <Input
            label="Plan Name"
            value={nutritionForm.name}
            onChange={(e) => setNutritionForm({ ...nutritionForm, name: e.target.value })}
            placeholder="e.g. My Cutting Meal Plan"
          />
          <Input
            label="Daily Calorie Target (optional)"
            type="number"
            value={nutritionForm.calories}
            onChange={(e) => setNutritionForm({ ...nutritionForm, calories: e.target.value })}
            placeholder="e.g. 2200"
          />
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Description (optional)</label>
            <textarea
              value={nutritionForm.description}
              onChange={(e) => setNutritionForm({ ...nutritionForm, description: e.target.value })}
              rows={2}
              placeholder="Goal of this plan..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 resize-none"
            />
          </div>
          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <RefreshCw size={15} className="text-purple-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Repeat cycle</p>
                <p className="text-xs text-slate-400">
                  {nutritionForm.repeatCycle
                    ? 'Weeks repeat in a loop once all are done'
                    : 'Plan ends after the last week is complete'
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNutritionForm({ ...nutritionForm, repeatCycle: !nutritionForm.repeatCycle })}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${nutritionForm.repeatCycle ? 'bg-purple-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${nutritionForm.repeatCycle ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateNutritionModal(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => createNutritionPlan.mutate()}
              disabled={!nutritionForm.name.trim()}
              loading={createNutritionPlan.isPending}
              className="flex-1"
            >
              Create & Build
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
