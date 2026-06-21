import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { Plus, Utensils, Trash2, ChevronRight, RefreshCw } from 'lucide-react'
import type { NutritionPlan } from '../../types'

export default function TrainerNutritionPlans() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', dailyCalorieTarget: '', repeatCycle: true })

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['trainer-nutrition-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'nutritionPlans'), where('createdBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionPlan))
    },
    enabled: !!user,
  })

  const createPlan = useMutation({
    mutationFn: async () => {
      const ref = await addDoc(collection(db, 'nutritionPlans'), {
        name: form.name.trim(),
        description: form.description,
        dailyCalorieTarget: form.dailyCalorieTarget ? +form.dailyCalorieTarget : null,
        repeatCycle: form.repeatCycle,
        createdBy: user!.uid,
        weeks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['trainer-nutrition-plans'] })
      setModal(false)
      setForm({ name: '', description: '', dailyCalorieTarget: '', repeatCycle: true })
      navigate(`/trainer/nutrition-plans/${id}`)
    },
  })

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'nutritionPlans', id))
      const usersSnap = await getDocs(collection(db, 'users'))
      await Promise.all(usersSnap.docs.flatMap((d) => {
        const data = d.data()
        const updates: Record<string, null> = {}
        if (data.assignedNutritionPlanId === id) updates.assignedNutritionPlanId = null
        if (data.activeNutritionPlanId === id) updates.activeNutritionPlanId = null
        return Object.keys(updates).length ? [updateDoc(doc(db, 'users', d.id), updates)] : []
      }))
      const assignSnap = await getDocs(query(collection(db, 'assignments'), where('nutritionPlanId', '==', id)))
      await Promise.all(assignSnap.docs.map((d) => updateDoc(doc(db, 'assignments', d.id), { nutritionPlanId: null })))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainer-nutrition-plans'] }),
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">Nutrition Plans</h1>
          <p className="text-[#6B6560] mt-1">{plans.length} plans created</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <Plus size={16} />
          New Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#9E998F] text-sm">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20">
          <Utensils size={48} className="mx-auto text-[#C9A84C]/30 mb-4" />
          <h3 className="text-lg font-medium text-[#16213E] mb-2">No nutrition plans yet</h3>
          <p className="text-[#9E998F] text-sm mb-6">Create meal plans tailored to your clients' goals</p>
          <Button onClick={() => setModal(true)}>
            <Plus size={16} />
            Create First Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="group cursor-pointer" onClick={() => navigate(`/trainer/nutrition-plans/${plan.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C] flex items-center justify-center flex-shrink-0">
                    <Utensils size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#16213E] truncate">{plan.name}</h3>
                    <p className="text-xs text-[#9E998F]">
                      {plan.weeks?.length || 0} weeks
                      {plan.dailyCalorieTarget ? ` · ${plan.dailyCalorieTarget} kcal/day` : ''}
                      {plan.repeatCycle !== false ? ' · repeating' : ' · one-time'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePlan.mutate(plan.id) }}
                    className="p-1.5 rounded-lg text-[#9E998F] hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-[#9E998F]" />
                </div>
              </div>
              {plan.description && (
                <p className="mt-3 text-sm text-[#6B6560] line-clamp-2">{plan.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Create Nutrition Plan">
        <div className="space-y-4">
          <Input
            label="Plan Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Cutting Phase Nutrition"
          />
          <Input
            label="Daily Calorie Target (optional)"
            type="number"
            value={form.dailyCalorieTarget}
            onChange={(e) => setForm({ ...form, dailyCalorieTarget: e.target.value })}
            placeholder="e.g. 2200"
          />
          <div>
            <label className="text-sm font-medium text-[#16213E] block mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Brief description of the nutrition plan..."
              className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg text-sm bg-white text-[#16213E] placeholder-[#9E998F] outline-none focus:border-[#C9A84C] resize-none"
            />
          </div>
          <label className="flex items-center justify-between p-3 border border-[#E5E0D8] rounded-xl cursor-pointer hover:bg-[#FAF8F5] transition-colors">
            <div className="flex items-center gap-2">
              <RefreshCw size={15} className="text-[#C9A84C]" />
              <div>
                <p className="text-sm font-medium text-[#16213E]">Repeat cycle</p>
                <p className="text-xs text-[#9E998F]">
                  {form.repeatCycle
                    ? 'Weeks repeat in a loop once all are done'
                    : 'Plan ends after the last week is complete'
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, repeatCycle: !form.repeatCycle })}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.repeatCycle ? 'bg-[#C9A84C]' : 'bg-[#D8D3CC]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.repeatCycle ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => createPlan.mutate()}
              loading={createPlan.isPending}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              Create Plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
