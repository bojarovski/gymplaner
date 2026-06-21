import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Utensils, Trash2, ArrowUp, ArrowDown, Pencil, Check, Info } from 'lucide-react'
import type { NutritionPlan, NutritionWeek, NutritionDay, Meal } from '../../types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DEFAULT_MEALS = [
  { name: 'Breakfast', time: '07:00 - 09:00' },
  { name: 'Lunch', time: '12:00 - 14:00' },
  { name: 'Snack', time: '16:00 - 17:00' },
  { name: 'Dinner', time: '19:00 - 21:00' },
]

const EMPTY_FORM = { name: '', time: '', calories: '', protein: '', carbs: '', fat: '', ingredients: '', instructions: '' }

type MealModal = { weekId: string; dayId: string; meal?: Meal } | null

export default function UserNutritionPlanBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [addWeekModal, setAddWeekModal] = useState(false)
  const [mealModal, setMealModal] = useState<MealModal>(null)
  const [mealForm, setMealForm] = useState(EMPTY_FORM)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDayName, setEditingDayName] = useState('')

  const { data: plan, isLoading } = useQuery({
    queryKey: ['nutrition-plan', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', id!))
      return { id: snap.id, ...snap.data() } as NutritionPlan
    },
    enabled: !!id,
  })

  const updatePlan = useMutation({
    mutationFn: async (weeks: NutritionWeek[]) => {
      await updateDoc(doc(db, 'nutritionPlans', id!), { weeks })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition-plan', id] }),
  })

  const addWeek = () => {
    if (!plan) return
    const newWeek: NutritionWeek = {
      id: crypto.randomUUID(),
      weekNumber: (plan.weeks?.length || 0) + 1,
      days: DAY_NAMES.map((name, i): NutritionDay => ({
        id: crypto.randomUUID(),
        name,
        order: i + 1,
        meals: DEFAULT_MEALS.map((m) => ({ id: crypto.randomUUID(), name: m.name, time: m.time, foods: [] })),
      })),
    }
    updatePlan.mutate([...(plan.weeks || []), newWeek])
    setAddWeekModal(false)
  }

  const moveDay = (weekId: string, dayId: string, dir: 'up' | 'down') => {
    if (!plan) return
    const weeks = plan.weeks.map((w) => {
      if (w.id !== weekId) return w
      const sorted = [...w.days].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((d) => d.id === dayId)
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= sorted.length) return w
      return {
        ...w, days: sorted.map((d, i) => {
          if (i === idx) return { ...d, order: sorted[target].order }
          if (i === target) return { ...d, order: sorted[idx].order }
          return d
        }),
      }
    })
    updatePlan.mutate(weeks)
  }

  const saveDayName = (weekId: string, dayId: string) => {
    if (!plan || !editingDayName.trim()) { setEditingDayId(null); return }
    const weeks = plan.weeks.map((w) =>
      w.id !== weekId ? w : { ...w, days: w.days.map((d) => d.id === dayId ? { ...d, name: editingDayName.trim() } : d) }
    )
    updatePlan.mutate(weeks)
    setEditingDayId(null)
  }

  const openMealModal = (weekId: string, dayId: string, meal?: Meal) => {
    setMealModal({ weekId, dayId, meal })
    if (meal) {
      setMealForm({
        name: meal.name,
        time: meal.time || '',
        calories: meal.calories?.toString() || '',
        protein: meal.protein?.toString() || '',
        carbs: meal.carbs?.toString() || '',
        fat: meal.fat?.toString() || '',
        ingredients: meal.ingredients || '',
        instructions: meal.instructions || '',
      })
    } else {
      setMealForm(EMPTY_FORM)
    }
  }

  const saveMeal = () => {
    if (!plan || !mealModal) return
    const saved: Meal = {
      id: mealModal.meal?.id ?? crypto.randomUUID(),
      name: mealForm.name.trim() || 'Meal',
      time: mealForm.time.trim() || undefined,
      calories: mealForm.calories ? +mealForm.calories : undefined,
      protein: mealForm.protein ? +mealForm.protein : undefined,
      carbs: mealForm.carbs ? +mealForm.carbs : undefined,
      fat: mealForm.fat ? +mealForm.fat : undefined,
      ingredients: mealForm.ingredients.trim() || undefined,
      instructions: mealForm.instructions.trim() || undefined,
      foods: mealModal.meal?.foods ?? [],
    }
    const weeks = plan.weeks.map((w) => {
      if (w.id !== mealModal.weekId) return w
      return {
        ...w, days: w.days.map((d) => {
          if (d.id !== mealModal.dayId) return d
          return {
            ...d,
            meals: mealModal.meal
              ? d.meals.map((m) => m.id === saved.id ? saved : m)
              : [...d.meals, saved],
          }
        }),
      }
    })
    updatePlan.mutate(weeks)
    setMealModal(null)
    setMealForm(EMPTY_FORM)
  }

  const removeMeal = (weekId: string, dayId: string, mealId: string) => {
    if (!plan) return
    const weeks = plan.weeks.map((w) =>
      w.id !== weekId ? w : {
        ...w, days: w.days.map((d) =>
          d.id !== dayId ? d : { ...d, meals: d.meals.filter((m) => m.id !== mealId) }
        ),
      }
    )
    updatePlan.mutate(weeks)
  }

  if (isLoading) return <div className="p-4 md:p-8 text-slate-400 text-sm">Loading...</div>
  if (!plan) return null

  const isEditMode = !!mealModal?.meal

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/user/plans')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{plan.name}</h1>
          {plan.dailyCalorieTarget && (
            <p className="text-purple-500 text-sm font-medium mt-0.5">{plan.dailyCalorieTarget} kcal/day target</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-400">{plan.weeks?.length || 0} weeks</p>
        <Button size="sm" onClick={() => setAddWeekModal(true)}>
          <Plus size={15} />
          Add Week
        </Button>
      </div>

      <div className="space-y-4">
        {(plan.weeks || []).map((week) => {
          const sorted = [...week.days].sort((a, b) => a.order - b.order)
          const totalMeals = sorted.reduce((acc, d) => acc + (d.meals?.length || 0), 0)
          return (
            <Card key={week.id} className="p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">W{week.weekNumber}</span>
                  </div>
                  <span className="font-semibold text-slate-900">Week {week.weekNumber}</span>
                  <span className="text-xs text-slate-400">7 days · {totalMeals} meals</span>
                </div>
                {expandedWeek === week.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {expandedWeek === week.id && (
                <div className="border-t border-slate-100 p-4 space-y-2">
                  {sorted.map((day, idx) => (
                    <div key={day.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {/* Day row */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="text-xs font-bold text-purple-500 w-8 flex-shrink-0">
                          {DAY_LABELS[day.order - 1]}
                        </span>

                        {editingDayId === day.id ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editingDayName}
                              onChange={(e) => setEditingDayName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveDayName(week.id, day.id); if (e.key === 'Escape') setEditingDayId(null) }}
                              onBlur={() => saveDayName(week.id, day.id)}
                              className="flex-1 px-2 py-1 border border-purple-400 rounded-lg text-sm text-slate-900 outline-none bg-white"
                            />
                            <button onMouseDown={(e) => { e.preventDefault(); saveDayName(week.id, day.id) }} className="p-1 rounded-lg bg-purple-500 text-white">
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="flex-1 text-left text-sm font-medium group flex items-center gap-1.5 text-slate-900"
                            onClick={() => { setEditingDayId(day.id); setEditingDayName(day.name) }}
                          >
                            <span>{day.name}</span>
                            <Pencil size={11} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}

                        {editingDayId !== day.id && (
                          <span className="text-xs text-slate-400 flex-shrink-0">{day.meals.length} meals</span>
                        )}

                        <div className="flex flex-col flex-shrink-0">
                          <button onClick={() => moveDay(week.id, day.id, 'up')} disabled={idx === 0 || updatePlan.isPending} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ArrowUp size={12} />
                          </button>
                          <button onClick={() => moveDay(week.id, day.id, 'down')} disabled={idx === sorted.length - 1 || updatePlan.isPending} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        <button onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
                          {expandedDay === day.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>

                      {/* Meal list */}
                      {expandedDay === day.id && (
                        <div className="border-t border-slate-100 p-3 space-y-2">
                          {day.meals.map((meal) => (
                            <div key={meal.id} className="p-3 bg-slate-50 rounded-lg group">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-slate-900">{meal.name}</p>
                                    {meal.time && <span className="text-xs text-slate-400">{meal.time}</span>}
                                    {meal.calories && <span className="text-xs font-medium text-purple-500">{meal.calories} kcal</span>}
                                  </div>
                                  {(meal.protein || meal.carbs || meal.fat) && (
                                    <div className="flex gap-3 mt-1">
                                      {meal.protein && <span className="text-xs text-slate-400">P: {meal.protein}g</span>}
                                      {meal.carbs && <span className="text-xs text-slate-400">C: {meal.carbs}g</span>}
                                      {meal.fat && <span className="text-xs text-slate-400">F: {meal.fat}g</span>}
                                    </div>
                                  )}
                                  {meal.ingredients && (
                                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 flex items-start gap-1">
                                      <Info size={11} className="flex-shrink-0 mt-0.5 text-purple-400" />
                                      {meal.ingredients}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button onClick={() => openMealModal(week.id, day.id, meal)} className="p-1 rounded text-slate-300 hover:text-purple-500 transition-colors">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => removeMeal(week.id, day.id, meal.id)} className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => openMealModal(week.id, day.id)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-purple-300 rounded-lg text-xs font-medium text-purple-500 hover:bg-purple-50 transition-colors"
                          >
                            <Plus size={13} />
                            Add Meal
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
            <Utensils size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-400 text-sm mb-1">No weeks added yet.</p>
            <p className="text-slate-300 text-xs mb-4">Each week auto-creates 7 days with Breakfast, Lunch, Snack & Dinner.</p>
            <Button size="sm" onClick={() => setAddWeekModal(true)}>
              <Plus size={15} />
              Add First Week
            </Button>
          </div>
        )}
      </div>

      {/* Add Week modal */}
      <Modal open={addWeekModal} onClose={() => setAddWeekModal(false)} title="Add Week">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Week {(plan.weeks?.length || 0) + 1} will be created with all 7 days. Each day starts with Breakfast, Lunch, Snack and Dinner — fill in ingredients and instructions for each.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAddWeekModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={addWeek} loading={updatePlan.isPending} className="flex-1">Add Week</Button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Meal modal */}
      <Modal
        open={!!mealModal}
        onClose={() => { setMealModal(null); setMealForm(EMPTY_FORM) }}
        title={isEditMode ? `Edit ${mealModal?.meal?.name ?? 'Meal'}` : 'Add Meal'}
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Meal Name" value={mealForm.name} onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })} placeholder="e.g. Breakfast, Pre-workout..." />
            </div>
            <div className="col-span-2">
              <Input label="Time (optional)" value={mealForm.time} onChange={(e) => setMealForm({ ...mealForm, time: e.target.value })} placeholder="e.g. 07:00 - 09:00" />
            </div>
            <Input label="Calories" type="number" value={mealForm.calories} onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value })} placeholder="kcal" />
            <Input label="Protein (g)" type="number" value={mealForm.protein} onChange={(e) => setMealForm({ ...mealForm, protein: e.target.value })} placeholder="g" />
            <Input label="Carbs (g)" type="number" value={mealForm.carbs} onChange={(e) => setMealForm({ ...mealForm, carbs: e.target.value })} placeholder="g" />
            <Input label="Fat (g)" type="number" value={mealForm.fat} onChange={(e) => setMealForm({ ...mealForm, fat: e.target.value })} placeholder="g" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Ingredients</label>
            <textarea
              value={mealForm.ingredients}
              onChange={(e) => setMealForm({ ...mealForm, ingredients: e.target.value })}
              rows={3}
              placeholder={"Chicken 300g\nRice 80g\nBroccoli 150g"}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-300 outline-none focus:border-purple-400 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">How to prepare (optional)</label>
            <textarea
              value={mealForm.instructions}
              onChange={(e) => setMealForm({ ...mealForm, instructions: e.target.value })}
              rows={3}
              placeholder="Grill the chicken, cook rice, steam broccoli. Season to taste..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-300 outline-none focus:border-purple-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={() => { setMealModal(null); setMealForm(EMPTY_FORM) }} className="flex-1">Cancel</Button>
            <Button onClick={saveMeal} loading={updatePlan.isPending} className="flex-1">
              {isEditMode ? 'Save Changes' : 'Add Meal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
