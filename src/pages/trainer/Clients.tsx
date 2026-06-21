import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import { UserPlus, Users, Dumbbell, Utensils, Mail, Clock, X, ChevronDown } from 'lucide-react'
import type { AppUser, WorkoutPlan, NutritionPlan, Invite } from '../../types'

export default function TrainerClients() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [inviteModal, setInviteModal] = useState(false)
  const [assignModal, setAssignModal] = useState<{ client: AppUser; type: 'workout' | 'nutrition' } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['trainer-clients', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'users'), where('trainerId', '==', user!.uid), where('status', '==', 'active'))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser))
    },
    enabled: !!user,
  })

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['trainer-invites', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'invites'), where('trainerId', '==', user!.uid), where('status', '==', 'pending'))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() } as Invite))
    },
    enabled: !!user,
  })

  const { data: workoutPlans = [] } = useQuery({
    queryKey: ['trainer-workout-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'workoutPlans'), where('createdBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutPlan))
    },
    enabled: !!user,
  })

  const { data: nutritionPlans = [] } = useQuery({
    queryKey: ['trainer-nutrition-plans', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'nutritionPlans'), where('createdBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionPlan))
    },
    enabled: !!user,
  })

  const { data: assignments = {} } = useQuery({
    queryKey: ['assignments', clients.map((c) => c.uid)],
    queryFn: async () => {
      const results: Record<string, { workoutPlanId?: string; nutritionPlanId?: string }> = {}
      await Promise.all(
        clients.map(async (c) => {
          const q = query(collection(db, 'assignments'), where('userId', '==', c.uid))
          const snap = await getDocs(q)
          if (!snap.empty) results[c.uid] = snap.docs[0].data() as { workoutPlanId?: string; nutritionPlanId?: string }
        })
      )
      return results
    },
    enabled: clients.length > 0,
  })

  const sendInvite = useMutation({
    mutationFn: async (email: string) => {
      const existing = pendingInvites.find((i) => i.userEmail === email)
      if (existing) throw new Error('An invite has already been sent to this email.')
      const alreadyClient = clients.find((c) => c.email === email)
      if (alreadyClient) throw new Error('This user is already your client.')

      await addDoc(collection(db, 'invites'), {
        trainerId: user!.uid,
        trainerName: user!.displayName,
        trainerPhoto: user!.photoURL || null,
        userEmail: email.toLowerCase().trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainer-invites'] })
      setInviteModal(false)
      setInviteEmail('')
      setInviteError('')
    },
    onError: (err: Error) => setInviteError(err.message),
  })

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => deleteDoc(doc(db, 'invites', inviteId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainer-invites'] }),
  })

  const assignPlan = useMutation({
    mutationFn: async ({ clientId, planId, type }: { clientId: string; planId: string; type: 'workout' | 'nutrition' }) => {
      const field = type === 'workout' ? 'workoutPlanId' : 'nutritionPlanId'
      const q = query(collection(db, 'assignments'), where('userId', '==', clientId))
      const snap = await getDocs(q)
      if (snap.empty) {
        await addDoc(collection(db, 'assignments'), { userId: clientId, trainerId: user!.uid, [field]: planId })
      } else {
        await updateDoc(snap.docs[0].ref, { [field]: planId })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] })
      setAssignModal(null)
    },
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">My Clients</h1>
          <p className="text-[#6B6560] mt-1">{clients.length} active clients</p>
        </div>
        <Button onClick={() => setInviteModal(true)}>
          <UserPlus size={16} />
          Invite Client
        </Button>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9E998F] uppercase tracking-wider mb-3">
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                    <Mail size={14} className="text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#16213E]">{invite.userEmail}</p>
                    <div className="flex items-center gap-1 text-xs text-[#9E998F]">
                      <Clock size={10} />
                      <span>Invite sent · waiting for response</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => cancelInvite.mutate(invite.id)}
                  className="p-1.5 rounded-lg text-[#9E998F] hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Cancel invite"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Clients */}
      {clients.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[#E5E0D8] rounded-2xl">
          <Users size={48} className="mx-auto text-[#C9A84C]/30 mb-4" />
          <h3 className="text-lg font-medium text-[#16213E] mb-2">No clients yet</h3>
          <p className="text-[#9E998F] text-sm mb-6">Invite clients by email — they'll see the invite when they log in</p>
          <Button onClick={() => setInviteModal(true)}>
            <UserPlus size={16} />
            Invite First Client
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => {
            const assignment = (assignments as Record<string, { workoutPlanId?: string; nutritionPlanId?: string }>)[client.uid]
            const workoutPlan = workoutPlans.find((p) => p.id === assignment?.workoutPlanId)
            const nutritionPlan = nutritionPlans.find((p) => p.id === assignment?.nutritionPlanId)

            return (
              <Card key={client.uid}>
                <div className="flex items-center gap-3 mb-4">
                  {client.photoURL ? (
                    <img src={client.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center">
                      <span className="text-[#C9A84C] font-semibold text-sm">
                        {(client.displayName || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#16213E] truncate">{client.displayName}</p>
                    <p className="text-xs text-[#9E998F] truncate">{client.email}</p>
                  </div>
                </div>

                {/* Current plan assignments */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between px-3 py-2 bg-[#FAF8F5] rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Dumbbell size={13} className="text-[#16213E] flex-shrink-0" />
                      <span className="text-xs text-[#6B6560] truncate">
                        {workoutPlan ? workoutPlan.name : <span className="italic text-[#9E998F]">No workout plan</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => setAssignModal({ client, type: 'workout' })}
                      className="text-xs text-[#C9A84C] font-medium hover:underline flex-shrink-0 ml-2"
                    >
                      {workoutPlan ? 'Change' : 'Assign'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-[#FAF8F5] rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Utensils size={13} className="text-[#C9A84C] flex-shrink-0" />
                      <span className="text-xs text-[#6B6560] truncate">
                        {nutritionPlan ? nutritionPlan.name : <span className="italic text-[#9E998F]">No nutrition plan</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => setAssignModal({ client, type: 'nutrition' })}
                      className="text-xs text-[#C9A84C] font-medium hover:underline flex-shrink-0 ml-2"
                    >
                      {nutritionPlan ? 'Change' : 'Assign'}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Invite Modal */}
      <Modal open={inviteModal} onClose={() => { setInviteModal(false); setInviteEmail(''); setInviteError('') }} title="Invite Client">
        <div className="space-y-4">
          <p className="text-sm text-[#6B6560]">
            Enter the client's email address. They'll see your invite the next time they log in.
          </p>
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
            placeholder="client@email.com"
            error={inviteError}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setInviteModal(false); setInviteEmail(''); setInviteError('') }} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => sendInvite.mutate(inviteEmail)}
              loading={sendInvite.isPending}
              disabled={!inviteEmail.trim()}
              className="flex-1"
            >
              <Mail size={15} />
              Send Invite
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Plan Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={`Assign ${assignModal?.type === 'workout' ? 'Workout' : 'Nutrition'} Plan`}
      >
        <p className="text-sm text-[#6B6560] mb-4">
          Assigning to <span className="font-semibold text-[#16213E]">{assignModal?.client.displayName}</span>
        </p>
        <div className="space-y-2">
          {(assignModal?.type === 'workout' ? workoutPlans : nutritionPlans).length === 0 ? (
            <p className="text-[#9E998F] text-sm text-center py-6">
              No {assignModal?.type} plans created yet. Create one first.
            </p>
          ) : (
            (assignModal?.type === 'workout' ? workoutPlans : nutritionPlans).map((p) => {
              const asgn = (assignments as Record<string, { workoutPlanId?: string; nutritionPlanId?: string }>)[assignModal?.client.uid ?? '']
              const isAssigned = assignModal?.type === 'workout'
                ? asgn?.workoutPlanId === p.id
                : asgn?.nutritionPlanId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => assignPlan.mutate({ clientId: assignModal!.client.uid, planId: p.id, type: assignModal!.type })}
                  className={`w-full text-left px-4 py-3 border rounded-xl transition-all flex items-center justify-between ${
                    isAssigned
                      ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                      : 'border-[#E5E0D8] hover:border-[#C9A84C]/50 hover:bg-[#FAF8F5]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#16213E]">{p.name}</p>
                    {p.description && <p className="text-xs text-[#9E998F] mt-0.5 line-clamp-1">{p.description}</p>}
                  </div>
                  {isAssigned && <Badge label="Current" color="gold" />}
                </button>
              )
            })
          )}
        </div>
      </Modal>
    </div>
  )
}
