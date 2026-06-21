import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Utensils, Dumbbell, UserCheck, Search, ChevronRight, ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react'
import type { NutritionPlan, WorkoutPlan, ShoppingList, AppUser } from '../../types'

type Tab = 'nutrition' | 'workout' | 'shopping'

export default function AdminPlans() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('nutrition')
  const [search, setSearch] = useState('')
  const [assignModal, setAssignModal] = useState<{ plan: NutritionPlan | WorkoutPlan | ShoppingList; type: Tab } | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)

  const { data: nutritionPlans = [], isLoading: loadingNutrition } = useQuery({
    queryKey: ['admin-nutrition-plans', currentUser?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'nutritionPlans'), where('createdBy', '==', currentUser!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionPlan))
    },
    enabled: !!currentUser,
  })

  const { data: workoutPlans = [], isLoading: loadingWorkout } = useQuery({
    queryKey: ['admin-workout-plans', currentUser?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'workoutPlans'), where('createdBy', '==', currentUser!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutPlan))
    },
    enabled: !!currentUser,
  })

  const { data: shoppingLists = [], isLoading: loadingShopping } = useQuery({
    queryKey: ['admin-shopping-lists', currentUser?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'shoppingLists'), where('createdBy', '==', currentUser!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingList))
    },
    enabled: !!currentUser,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser))
    },
  })

  const assignPlan = useMutation({
    mutationFn: async ({ userId, planId, type }: { userId: string; planId: string; type: Tab }) => {
      if (type === 'shopping') {
        // Shopping: only record the assignment — user activates manually
        const label = currentUser?.role === 'admin'
          ? 'Findzzer Fit'
          : (currentUser?.email ?? currentUser?.displayName ?? 'Your coach')
        await setDoc(doc(db, 'shoppingAssignments', `${planId}_${userId}`), {
          listId: planId,
          userId,
          assignedBy: currentUser!.uid,
          assignedByLabel: label,
          assignedAt: serverTimestamp(),
        })
      } else {
        // Workout / nutrition: record as assigned but do NOT auto-activate
        // User sees it in My Plans and can Set Active themselves
        const assignedField = type === 'nutrition' ? 'assignedNutritionPlanId' : 'assignedWorkoutPlanId'
        await updateDoc(doc(db, 'users', userId), { [assignedField]: planId })
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setAssignedTo(vars.userId)
    },
  })

  const deletePlan = useMutation({
    mutationFn: async ({ planId, type }: { planId: string; type: Tab }) => {
      if (type === 'workout') {
        await deleteDoc(doc(db, 'workoutPlans', planId))
        const usersSnap = await getDocs(collection(db, 'users'))
        await Promise.all(usersSnap.docs.flatMap((d) => {
          const data = d.data()
          const updates: Record<string, null> = {}
          if (data.assignedWorkoutPlanId === planId) updates.assignedWorkoutPlanId = null
          if (data.activeWorkoutPlanId === planId) updates.activeWorkoutPlanId = null
          return Object.keys(updates).length ? [updateDoc(doc(db, 'users', d.id), updates)] : []
        }))
        const assignSnap = await getDocs(query(collection(db, 'assignments'), where('workoutPlanId', '==', planId)))
        await Promise.all(assignSnap.docs.map((d) => updateDoc(doc(db, 'assignments', d.id), { workoutPlanId: null })))
      } else if (type === 'nutrition') {
        await deleteDoc(doc(db, 'nutritionPlans', planId))
        const usersSnap = await getDocs(collection(db, 'users'))
        await Promise.all(usersSnap.docs.flatMap((d) => {
          const data = d.data()
          const updates: Record<string, null> = {}
          if (data.assignedNutritionPlanId === planId) updates.assignedNutritionPlanId = null
          if (data.activeNutritionPlanId === planId) updates.activeNutritionPlanId = null
          return Object.keys(updates).length ? [updateDoc(doc(db, 'users', d.id), updates)] : []
        }))
        const assignSnap = await getDocs(query(collection(db, 'assignments'), where('nutritionPlanId', '==', planId)))
        await Promise.all(assignSnap.docs.map((d) => updateDoc(doc(db, 'assignments', d.id), { nutritionPlanId: null })))
      } else {
        await deleteDoc(doc(db, 'shoppingLists', planId))
        const assignSnap = await getDocs(query(collection(db, 'shoppingAssignments'), where('listId', '==', planId)))
        await Promise.all(assignSnap.docs.map((d) => deleteDoc(doc(db, 'shoppingAssignments', d.id))))
        const usersSnap = await getDocs(collection(db, 'users'))
        await Promise.all(usersSnap.docs
          .filter((d) => d.data().activeShoppingListId === planId)
          .map((d) => updateDoc(doc(db, 'users', d.id), { activeShoppingListId: null })))
      }
    },
    onSuccess: (_, { type }) => {
      qc.invalidateQueries({ queryKey: type === 'nutrition' ? ['admin-nutrition-plans'] : type === 'workout' ? ['admin-workout-plans'] : ['admin-shopping-lists'] })
    },
  })

  const plans = tab === 'nutrition' ? nutritionPlans : tab === 'workout' ? workoutPlans : shoppingLists
  const loading = tab === 'nutrition' ? loadingNutrition : tab === 'workout' ? loadingWorkout : loadingShopping

  const filteredPlans = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const eligibleUsers = users.filter((u) =>
    u.role === 'user' && u.status === 'active' &&
    (u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()))
  )

  const openAssign = (plan: NutritionPlan | WorkoutPlan | ShoppingList) => {
    setAssignModal({ plan, type: tab })
    setUserSearch('')
    setAssignedTo(null)
  }

  const closeAssign = () => {
    setAssignModal(null)
    setAssignedTo(null)
    setUserSearch('')
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#16213E]">Plan Templates</h1>
        <p className="text-[#6B6560] mt-1">Assign nutrition and workout plans to users</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F0EDE8] rounded-xl w-full md:w-fit mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('nutrition')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'nutrition' ? 'bg-white text-[#16213E] shadow-sm' : 'text-[#6B6560] hover:text-[#16213E]'
          }`}
        >
          <Utensils size={15} />
          Nutrition Plans
          <span className="text-xs bg-[#C9A84C]/20 text-[#C9A84C] px-1.5 py-0.5 rounded-full font-semibold">
            {nutritionPlans.length}
          </span>
        </button>
        <button
          onClick={() => setTab('workout')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'workout' ? 'bg-white text-[#16213E] shadow-sm' : 'text-[#6B6560] hover:text-[#16213E]'
          }`}
        >
          <Dumbbell size={15} />
          Workout Plans
          <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
            {workoutPlans.length}
          </span>
        </button>
        <button
          onClick={() => setTab('shopping')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'shopping' ? 'bg-white text-[#16213E] shadow-sm' : 'text-[#6B6560] hover:text-[#16213E]'
          }`}
        >
          <ShoppingCart size={15} />
          Shopping Lists
          <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">
            {shoppingLists.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E998F]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plans..."
          className="w-full pl-9 pr-4 py-2.5 border border-[#E5E0D8] rounded-xl text-sm bg-white outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20"
        />
      </div>

      {/* Plan list */}
      {loading ? (
        <div className="text-center py-16 text-[#9E998F] text-sm">Loading plans...</div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-16">
          <Dumbbell size={36} className="mx-auto text-[#C9A84C]/30 mb-3" />
          <p className="text-[#9E998F] text-sm">No plans found</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E0D8] rounded-2xl overflow-hidden divide-y divide-[#F0EDE8]">
          {filteredPlans.map((plan) => {
            const isShopping = tab === 'shopping'
            const weekCount = (plan as NutritionPlan).weeks?.length || 0
            const catCount = (plan as ShoppingList).categories?.length || 0
            const assignedUsers = users.filter((u) =>
              tab === 'nutrition' ? u.assignedNutritionPlanId === plan.id
              : tab === 'workout' ? u.assignedWorkoutPlanId === plan.id
              : false
            )
            const detailPath = tab === 'nutrition'
              ? `/admin/plans/nutrition/${plan.id}`
              : tab === 'workout'
              ? `/admin/plans/workout/${plan.id}`
              : `/user/shopping/${plan.id}`

            const iconEl = isShopping
              ? <ShoppingCart size={16} className="text-emerald-600" />
              : tab === 'nutrition' ? <Utensils size={16} className="text-[#C9A84C]" /> : <Dumbbell size={16} className="text-orange-500" />
            const iconBg = isShopping ? 'bg-emerald-50' : tab === 'nutrition' ? 'bg-[#C9A84C]/10' : 'bg-orange-50'

            const meta = isShopping
              ? `${catCount} categories`
              : `${weekCount} week${weekCount !== 1 ? 's' : ''} · ${(plan as NutritionPlan).repeatCycle !== false ? 'repeating' : 'one-time'}`

            return (
              <div key={plan.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF9] transition-colors group">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                  {iconEl}
                </div>

                {/* Info — clickable if detail page exists */}
                <div className="flex-1 min-w-0">
                  {detailPath ? (
                    <button
                      onClick={() => navigate(detailPath, { state: { backTo: '/admin/plans' } })}
                      className="text-left w-full group/link"
                    >
                      <p className="font-semibold text-[#16213E] text-sm truncate group-hover/link:text-[#C9A84C] transition-colors">
                        {plan.name}
                      </p>
                      <p className="text-xs text-[#9E998F] mt-0.5">{meta}</p>
                    </button>
                  ) : (
                    <>
                      <p className="font-semibold text-[#16213E] text-sm truncate">{plan.name}</p>
                      <p className="text-xs text-[#9E998F] mt-0.5">{meta}</p>
                    </>
                  )}
                </div>

                {/* Assigned avatars */}
                {assignedUsers.length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="flex -space-x-1.5">
                      {assignedUsers.slice(0, 4).map((u) => (
                        <div
                          key={u.uid}
                          title={u.displayName || u.email}
                          className="w-6 h-6 rounded-full bg-[#16213E] border-2 border-white flex items-center justify-center"
                        >
                          <span className="text-[9px] font-bold text-[#C9A84C]">
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                    {assignedUsers.length > 4 && (
                      <span className="text-[10px] text-[#9E998F] font-medium">+{assignedUsers.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openAssign(plan)}
                    title="Assign to user"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#16213E] border border-[#E5E0D8] px-2.5 py-1.5 rounded-lg hover:bg-[#F0EDE8] transition-colors"
                  >
                    <UserCheck size={13} />
                    Assign
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${plan.name}"? This cannot be undone.`)) {
                        deletePlan.mutate({ planId: plan.id, type: tab })
                      }
                    }}
                    disabled={deletePlan.isPending}
                    title="Delete plan"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign modal */}
      <Modal
        open={!!assignModal}
        onClose={closeAssign}
        title={`Assign "${assignModal?.plan.name}"`}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E998F]" />
            <input
              autoFocus
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-4 py-2.5 border border-[#E5E0D8] rounded-xl text-sm outline-none focus:border-[#C9A84C]"
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {eligibleUsers.length === 0 && (
              <p className="text-sm text-[#9E998F] text-center py-6">No active users found</p>
            )}
            {eligibleUsers.map((u) => {
              const alreadyHas = assignModal?.type === 'nutrition'
                ? u.assignedNutritionPlanId === assignModal?.plan.id
                : assignModal?.type === 'workout'
                ? u.assignedWorkoutPlanId === assignModal?.plan.id
                : false // shopping: can't easily check without querying assignments per user
              const justAssigned = assignedTo === u.uid

              return (
                <div
                  key={u.uid}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    justAssigned
                      ? 'bg-emerald-50 border-emerald-200'
                      : alreadyHas
                      ? 'bg-[#FAF8F5] border-[#E5E0D8]'
                      : 'bg-white border-[#E5E0D8] hover:border-[#C9A84C]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u.photoURL ? (
                      <img src={u.photoURL} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#16213E] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#C9A84C] text-xs font-bold">
                          {u.displayName?.[0] || u.email?.[0] || '?'}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#16213E] truncate">{u.displayName || u.email}</p>
                      {u.displayName && <p className="text-xs text-[#9E998F] truncate">{u.email}</p>}
                    </div>
                  </div>

                  {justAssigned ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium flex-shrink-0">
                      <CheckCircle2 size={13} />
                      Assigned
                    </span>
                  ) : alreadyHas ? (
                    <span className="text-xs text-[#9E998F] flex-shrink-0">Already has it</span>
                  ) : (
                    <button
                      onClick={() => assignPlan.mutate({ userId: u.uid, planId: assignModal!.plan.id, type: assignModal!.type })}
                      disabled={assignPlan.isPending}
                      className="flex-shrink-0 px-2.5 py-1 bg-[#16213E] hover:bg-[#1e2d4a] text-[#C9A84C] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      Assign
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button onClick={closeAssign} className="w-full py-2 text-sm text-[#6B6560] hover:text-[#16213E] transition-colors">
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
