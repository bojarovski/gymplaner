import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Utensils, TrendingUp, ChevronRight, UserCheck, X, CalendarCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import type { Invite } from '../../types'

export default function UserDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: assignment } = useQuery({
    queryKey: ['assignment', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'assignments', user!.uid))
      return snap.exists() ? snap.data() : null
    },
    enabled: !!user,
  })

  const { data: workoutPlan } = useQuery({
    queryKey: ['user-workout-plan', assignment?.workoutPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'workoutPlans', assignment!.workoutPlanId))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    },
    enabled: !!assignment?.workoutPlanId,
  })

  const { data: nutritionPlan } = useQuery({
    queryKey: ['user-nutrition-plan', assignment?.nutritionPlanId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'nutritionPlans', assignment!.nutritionPlanId))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    },
    enabled: !!assignment?.nutritionPlanId,
  })

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['user-invites', user?.email],
    queryFn: async () => {
      const q = query(
        collection(db, 'invites'),
        where('userEmail', '==', user!.email.toLowerCase()),
        where('status', '==', 'pending')
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Invite))
    },
    enabled: !!user?.email,
  })

  const respondInvite = useMutation({
    mutationFn: async ({ inviteId, trainerId, accept }: { inviteId: string; trainerId: string; accept: boolean }) => {
      await updateDoc(doc(db, 'invites', inviteId), { status: accept ? 'accepted' : 'declined' })
      if (accept) {
        await updateDoc(doc(db, 'users', user!.uid), { trainerId })
        const q = query(collection(db, 'assignments'), where('userId', '==', user!.uid))
        const snap = await getDocs(q)
        if (snap.empty) {
          await addDoc(collection(db, 'assignments'), { userId: user!.uid, trainerId })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-invites'] })
      qc.invalidateQueries({ queryKey: ['assignment'] })
    },
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const firstName = user?.displayName?.split(' ')[0] ?? 'there'
  const kcal = (nutritionPlan as any)?.dailyCalorieTarget

  return (
    <div className="p-4 md:p-8 space-y-3 max-w-lg md:max-w-none">

      {/* Greeting */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs text-[#9E998F] font-medium">{today}</p>
          <h1 className="text-2xl font-bold text-[#16213E] mt-0.5">{greeting()}, {firstName}</h1>
        </div>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-[#E5E0D8] flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#E5E0D8] flex items-center justify-center flex-shrink-0">
            <span className="text-[#6B6560] font-bold text-sm">{firstName[0].toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.map((invite) => (
        <div key={invite.id} className="flex items-center gap-3 p-4 bg-[#16213E] rounded-2xl">
          {invite.trainerPhoto ? (
            <img src={invite.trainerPhoto} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#C9A84C] font-bold text-sm">{invite.trainerName[0].toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">{invite.trainerName} invited you</p>
            <p className="text-white/40 text-xs">Accept to get access to your plans</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => respondInvite.mutate({ inviteId: invite.id, trainerId: invite.trainerId, accept: false })}
              className="p-2 rounded-xl text-white/30 hover:bg-white/10 hover:text-white/60 transition-colors"
            >
              <X size={15} />
            </button>
            <Button size="sm" onClick={() => respondInvite.mutate({ inviteId: invite.id, trainerId: invite.trainerId, accept: true })} loading={respondInvite.isPending}>
              <UserCheck size={13} />Accept
            </Button>
          </div>
        </div>
      ))}

      {/* Today — featured CTA */}
      <button
        onClick={() => navigate('/user/today')}
        className="w-full flex items-center gap-4 bg-[#16213E] rounded-2xl p-4 group hover:bg-[#1e2d4a] transition-colors"
      >
        <div className="w-11 h-11 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
          <CalendarCheck size={20} className="text-[#C9A84C]" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-white font-semibold text-sm">Today's Plan</p>
          <p className="text-white/40 text-xs mt-0.5">Workout &amp; meals for today</p>
        </div>
        <ChevronRight size={16} className="text-white/25 group-hover:text-white/50 transition-colors flex-shrink-0" />
      </button>

      {/* Section label */}
      <p className="text-[11px] font-bold text-[#9E998F] uppercase tracking-widest pt-1">Your Plans</p>

      {/* Workout */}
      <button
        onClick={() => navigate('/user/workout')}
        className="w-full flex items-center gap-3 bg-white border border-[#E5E0D8] rounded-2xl px-4 py-3 group hover:border-[#C9C4BC] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={17} className="text-orange-400" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-[#16213E] text-sm">Workout Plan</p>
          <p className="text-xs text-[#9E998F] mt-0.5 truncate">
            {workoutPlan ? (workoutPlan as any).name : 'Not assigned yet'}
          </p>
        </div>
        <ChevronRight size={15} className="text-[#C9C4BC] group-hover:text-[#9E998F] transition-colors flex-shrink-0" />
      </button>

      {/* Nutrition */}
      <button
        onClick={() => navigate('/user/nutrition')}
        className="w-full flex items-center gap-3 bg-white border border-[#E5E0D8] rounded-2xl px-4 py-3 group hover:border-[#C9C4BC] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Utensils size={17} className="text-amber-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-[#16213E] text-sm">Nutrition</p>
          <p className="text-xs text-[#9E998F] mt-0.5 truncate">
            {kcal ? `${kcal} kcal daily` : nutritionPlan ? 'View plan' : 'Not assigned yet'}
          </p>
        </div>
        <ChevronRight size={15} className="text-[#C9C4BC] group-hover:text-[#9E998F] transition-colors flex-shrink-0" />
      </button>

      {/* Progress */}
      <button
        onClick={() => navigate('/user/progress')}
        className="w-full flex items-center gap-3 bg-white border border-[#E5E0D8] rounded-2xl px-4 py-3 group hover:border-[#C9C4BC] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={17} className="text-emerald-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-[#16213E] text-sm">Progress</p>
          <p className="text-xs text-[#9E998F] mt-0.5">Log measurements &amp; photos</p>
        </div>
        <ChevronRight size={15} className="text-[#C9C4BC] group-hover:text-[#9E998F] transition-colors flex-shrink-0" />
      </button>

      {/* No trainer state */}
      {!user?.trainerId && pendingInvites.length === 0 && (
        <div className="text-center py-8 border border-dashed border-[#E5E0D8] rounded-2xl mt-2">
          <div className="w-11 h-11 rounded-xl bg-[#F0EDE8] flex items-center justify-center mx-auto mb-3">
            <UserCheck size={20} className="text-[#9E998F]" />
          </div>
          <p className="font-semibold text-[#16213E] text-sm mb-1">Waiting for your trainer</p>
          <p className="text-xs text-[#9E998F] max-w-xs mx-auto">
            Your trainer will send you an invite. Once accepted, your plans appear here.
          </p>
        </div>
      )}
    </div>
  )
}
