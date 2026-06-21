import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useState } from 'react'
import Card from '../../components/ui/Card'
import { Dumbbell, ChevronDown, ChevronUp } from 'lucide-react'
import type { WorkoutPlan } from '../../types'

export default function UserWorkout() {
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
    queryKey: ['user-workout-plan', assignment?.workoutPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', assignment!.workoutPlanId))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutPlan) : null
    },
    enabled: !!assignment?.workoutPlanId,
  })

  if (isLoading) return <div className="p-4 md:p-8 text-[#9E998F] text-sm">Loading...</div>

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#16213E]">My Workout Plan</h1>
        {plan ? (
          <p className="text-[#6B6560] mt-1">{plan.name}</p>
        ) : (
          <p className="text-[#9E998F] mt-1">No workout plan assigned yet</p>
        )}
      </div>

      {!plan ? (
        <div className="text-center py-20">
          <Dumbbell size={48} className="mx-auto text-[#C9A84C]/30 mb-4" />
          <h3 className="text-lg font-medium text-[#16213E] mb-2">No Workout Plan Yet</h3>
          <p className="text-[#9E998F] text-sm">Your trainer will assign a workout plan to you soon.</p>
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
                  <div className="w-9 h-9 rounded-xl bg-[#16213E] flex items-center justify-center">
                    <span className="text-[#C9A84C] text-xs font-bold">W{week.weekNumber}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-[#16213E]">Week {week.weekNumber}</p>
                    <p className="text-xs text-[#9E998F]">{week.days?.length || 0} training days</p>
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
                          <Dumbbell size={16} className="text-[#C9A84C]" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-[#16213E]">{day.name}</p>
                            <p className="text-xs text-[#9E998F]">{day.exercises?.length || 0} exercises</p>
                          </div>
                        </div>
                        {expandedDay === day.id ? <ChevronUp size={16} className="text-[#9E998F]" /> : <ChevronDown size={16} className="text-[#9E998F]" />}
                      </button>

                      {expandedDay === day.id && (
                        <div className="px-5 pb-4 space-y-3">
                          {day.exercises?.map((ex, i) => (
                            <div key={ex.id} className="flex items-start gap-4 p-4 bg-[#FAF8F5] rounded-xl">
                              <div className="w-7 h-7 rounded-lg bg-[#16213E] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[#C9A84C] text-xs font-bold">{i + 1}</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-[#16213E] text-sm">{ex.exerciseName}</p>
                                <div className="flex flex-wrap gap-3 mt-2">
                                  {ex.sets?.map((set, si) => (
                                    <div key={si} className="flex items-center gap-1.5 text-xs text-[#6B6560]">
                                      <span className="font-medium text-[#16213E]">Set {si + 1}:</span>
                                      {set.reps && <span>{set.reps} reps</span>}
                                      {set.weight ? <span>@ {set.weight}kg</span> : null}
                                      {set.duration ? <span>{set.duration}s</span> : null}
                                    </div>
                                  ))}
                                </div>
                                {ex.notes && <p className="text-xs text-[#9E998F] mt-1.5 italic">{ex.notes}</p>}
                              </div>
                            </div>
                          ))}
                          {day.exercises?.length === 0 && (
                            <p className="text-sm text-[#9E998F] text-center py-3">No exercises added yet</p>
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
