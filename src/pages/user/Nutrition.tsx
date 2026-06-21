import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useState } from 'react'
import Card from '../../components/ui/Card'
import { Utensils, ChevronDown, ChevronUp, Flame } from 'lucide-react'
import type { NutritionPlan } from '../../types'

export default function UserNutrition() {
  const { user } = useAuthStore()
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const { data: assignment } = useQuery({
    queryKey: ['assignment', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'assignments', user!.uid))
      return snap.exists() ? snap.data() : null
    },
    enabled: !!user,
  })

  const { data: plan, isLoading } = useQuery({
    queryKey: ['user-nutrition-plan', assignment?.nutritionPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', assignment!.nutritionPlanId))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as NutritionPlan) : null
    },
    enabled: !!assignment?.nutritionPlanId,
  })

  if (isLoading) return <div className="p-4 md:p-8 text-[#9E998F] text-sm">Loading...</div>

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#16213E]">My Nutrition Plan</h1>
        {plan ? (
          <p className="text-[#6B6560] mt-1">{plan.name}</p>
        ) : (
          <p className="text-[#9E998F] mt-1">No nutrition plan assigned yet</p>
        )}
      </div>

      {plan?.dailyCalorieTarget && (
        <div className="flex items-center gap-3 p-4 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl mb-6">
          <Flame size={20} className="text-[#C9A84C]" />
          <div>
            <p className="text-sm font-semibold text-[#16213E]">{plan.dailyCalorieTarget} kcal</p>
            <p className="text-xs text-[#6B6560]">Daily calorie target</p>
          </div>
        </div>
      )}

      {!plan ? (
        <div className="text-center py-20">
          <Utensils size={48} className="mx-auto text-[#C9A84C]/30 mb-4" />
          <h3 className="text-lg font-medium text-[#16213E] mb-2">No Nutrition Plan Yet</h3>
          <p className="text-[#9E998F] text-sm">Your trainer will assign a nutrition plan to you soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plan.weeks?.map((week) => (
            <Card key={week.id} className="p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-5 hover:bg-[#FAF8F5] transition-colors"
                onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">W{week.weekNumber}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-[#16213E]">Week {week.weekNumber}</p>
                    <p className="text-xs text-[#9E998F]">{week.days?.length || 0} days</p>
                  </div>
                </div>
                {expandedWeek === week.id ? <ChevronUp size={18} className="text-[#9E998F]" /> : <ChevronDown size={18} className="text-[#9E998F]" />}
              </button>

              {expandedWeek === week.id && (
                <div className="border-t border-[#F0EDE8] divide-y divide-[#F0EDE8]">
                  {week.days?.map((day) => (
                    <div key={day.id}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF8F5] transition-colors"
                        onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Utensils size={16} className="text-[#C9A84C]" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-[#16213E]">{day.name}</p>
                            <p className="text-xs text-[#9E998F]">{day.meals?.length || 0} meals</p>
                          </div>
                        </div>
                        {expandedDay === day.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {expandedDay === day.id && (
                        <div className="px-5 pb-4 space-y-3">
                          {day.meals?.map((meal) => (
                            <div key={meal.id} className="p-4 bg-[#FAF8F5] rounded-xl">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-[#16213E] text-sm">{meal.name}</p>
                                  {meal.time && <p className="text-xs text-[#9E998F]">{meal.time}</p>}
                                </div>
                                {meal.calories && (
                                  <div className="flex items-center gap-1 text-[#C9A84C]">
                                    <Flame size={13} />
                                    <span className="text-xs font-semibold">{meal.calories} kcal</span>
                                  </div>
                                )}
                              </div>
                              {(meal.protein || meal.carbs || meal.fat) && (
                                <div className="flex gap-4 mt-2 pt-2 border-t border-[#E5E0D8]">
                                  {meal.protein && (
                                    <div className="text-center">
                                      <p className="text-xs font-semibold text-[#16213E]">{meal.protein}g</p>
                                      <p className="text-xs text-[#9E998F]">Protein</p>
                                    </div>
                                  )}
                                  {meal.carbs && (
                                    <div className="text-center">
                                      <p className="text-xs font-semibold text-[#16213E]">{meal.carbs}g</p>
                                      <p className="text-xs text-[#9E998F]">Carbs</p>
                                    </div>
                                  )}
                                  {meal.fat && (
                                    <div className="text-center">
                                      <p className="text-xs font-semibold text-[#16213E]">{meal.fat}g</p>
                                      <p className="text-xs text-[#9E998F]">Fat</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {day.meals?.length === 0 && (
                            <p className="text-sm text-[#9E998F] text-center py-3">No meals added yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
