import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { Users, UserCheck, Clock, Dumbbell, ShieldCheck, Activity } from 'lucide-react'

export default function AdminDashboard() {
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
  })

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises-count'],
    queryFn: async () => (await getDocs(collection(db, 'exercises'))).docs,
  })

  const active = (users as any[]).filter((u) => u.status === 'active').length
  const inactive = (users as any[]).filter((u) => u.status === 'inactive').length
  const trainers = (users as any[]).filter((u) => u.role === 'trainer').length
  const pendingUsers = (users as any[]).filter((u) => u.status === 'inactive')

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, gradient: 'from-blue-500 to-blue-600', glow: 'card-glow-blue' },
    { label: 'Active Members', value: active, icon: UserCheck, gradient: 'from-emerald-500 to-emerald-600', glow: 'card-glow-emerald' },
    { label: 'Pending Approval', value: inactive, icon: Clock, gradient: 'from-orange-500 to-orange-600', glow: 'card-glow-orange' },
    { label: 'Trainers', value: trainers, icon: ShieldCheck, gradient: 'from-violet-500 to-purple-600', glow: 'card-glow-purple' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">Platform overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, gradient, glow }) => (
          <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white ${glow} shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon size={20} className="text-white" />
              </div>
              <Activity size={16} className="text-white/40" />
            </div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-white/70 text-sm font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending approvals */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-orange-600" />
            </div>
            <h2 className="font-bold text-slate-900">Pending Approvals</h2>
            {inactive > 0 && (
              <span className="ml-auto bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">{inactive}</span>
            )}
          </div>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8">
              <UserCheck size={32} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-slate-400 text-sm">All accounts approved</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(pendingUsers as any[]).slice(0, 6).map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 text-xs font-bold">
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{u.displayName || 'Unknown'}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exercise library */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Dumbbell size={16} className="text-blue-600" />
            </div>
            <h2 className="font-bold text-slate-900">Exercise Library</h2>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Dumbbell size={26} className="text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{exercises.length}</p>
              <p className="text-slate-400 text-sm">exercises in library</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
