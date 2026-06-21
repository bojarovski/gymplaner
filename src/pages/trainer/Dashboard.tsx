import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Users, Dumbbell, Utensils, ChevronRight, Activity, TrendingUp } from 'lucide-react'

export default function TrainerDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data: clients = [] } = useQuery({
    queryKey: ['trainer-clients', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'users'), where('trainerId', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
    },
    enabled: !!user,
  })

  const { data: workoutPlans = [] } = useQuery({
    queryKey: ['trainer-workout-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'workoutPlans'), where('createdBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
    enabled: !!user,
  })

  const { data: nutritionPlans = [] } = useQuery({
    queryKey: ['trainer-nutrition-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'nutritionPlans'), where('createdBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
    enabled: !!user,
  })

  const stats = [
    { label: 'Active Clients', value: clients.length, icon: Users, gradient: 'from-blue-500 to-blue-600', to: '/trainer/clients' },
    { label: 'Workout Plans', value: workoutPlans.length, icon: Dumbbell, gradient: 'from-orange-500 to-orange-600', to: '/trainer/workout-plans' },
    { label: 'Nutrition Plans', value: nutritionPlans.length, icon: Utensils, gradient: 'from-violet-500 to-purple-600', to: '/trainer/nutrition-plans' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Hey, {user?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1">Here's your coaching overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, gradient, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon size={20} className="text-white" />
              </div>
              <ChevronRight size={16} className="text-white/50" />
            </div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-white/70 text-sm font-medium mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Clients */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users size={16} className="text-blue-600" />
              </div>
              <h2 className="font-bold text-slate-900">Recent Clients</h2>
            </div>
            <button onClick={() => navigate('/trainer/clients')} className="text-xs text-blue-600 font-semibold hover:underline">
              View all
            </button>
          </div>
          {clients.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No clients yet — send an invite!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(clients as any[]).slice(0, 5).map((c) => (
                <div key={c.uid} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-xs font-bold">
                      {(c.displayName || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{c.email}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Plans */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Dumbbell size={16} className="text-orange-600" />
              </div>
              <h2 className="font-bold text-slate-900">Workout Plans</h2>
            </div>
            <button onClick={() => navigate('/trainer/workout-plans')} className="text-xs text-blue-600 font-semibold hover:underline">
              View all
            </button>
          </div>
          {workoutPlans.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No plans created yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(workoutPlans as any[]).slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/trainer/workout-plans/${p.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.weeks?.length || 0} weeks</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
