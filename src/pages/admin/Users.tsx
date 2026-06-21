import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Search, UserCheck, UserX, Users, RefreshCw } from 'lucide-react'
import type { AppUser, UserRole, UserStatus } from '../../types'
import Select from '../../components/ui/Select'

export default function AdminUsers() {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users'))
      return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser))
    },
  })

  const updateUser = useMutation({
    mutationFn: async ({ uid, data }: { uid: string; data: Partial<AppUser> }) => {
      await updateDoc(doc(db, 'users', uid), data as Record<string, unknown>)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  // If the admin's own document is missing, create it
  const fixMyAccount = useMutation({
    mutationFn: async () => {
      if (!me) return
      await setDoc(doc(db, 'users', me.uid), {
        uid: me.uid,
        email: me.email,
        displayName: me.displayName,
        photoURL: me.photoURL || null,
        role: 'admin',
        status: 'active',
        createdAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const filtered = users
    .filter((u) => {
      if (filter === 'active') return u.status === 'active'
      if (filter === 'inactive') return u.status === 'inactive'
      return true
    })
    .filter((u) => {
      const q = search.toLowerCase()
      return (
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
    })

  const roleBadge = (role: UserRole) => {
    const map: Record<UserRole, { label: string; color: 'gold' | 'navy' | 'gray' }> = {
      admin: { label: 'Admin', color: 'navy' },
      trainer: { label: 'Trainer', color: 'gold' },
      user: { label: 'User', color: 'gray' },
    }
    return <Badge label={map[role].label} color={map[role].color} />
  }

  const statusBadge = (status: UserStatus) =>
    status === 'active' ? (
      <Badge label="Active" color="green" />
    ) : (
      <Badge label="Pending" color="red" />
    )

  const isMe = (uid: string) => uid === me?.uid

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">User Management</h1>
          <p className="text-[#6B6560] mt-1">{users.length} total accounts</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Firestore error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-600 mb-1">Firestore permission error</p>
          <p className="text-xs text-red-500 mb-3">
            Go to Firebase Console → Firestore → Rules and set <code>allow read, write: if true;</code> then publish.
          </p>
          <Button size="sm" variant="danger" onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {/* Missing own document warning */}
      {!isLoading && !error && !users.find((u) => u.uid === me?.uid) && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-700">Your account is missing from the database</p>
            <p className="text-xs text-amber-600 mt-0.5">Click to create your admin record in Firestore.</p>
          </div>
          <Button size="sm" onClick={() => fixMyAccount.mutate()} loading={fixMyAccount.isPending}>
            Fix My Account
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E998F]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#E5E0D8] rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-[#16213E] text-white'
                  : 'bg-white border border-[#E5E0D8] text-[#6B6560] hover:border-[#C9A84C]/40'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#9E998F]">Loading users...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={36} className="mx-auto text-[#C9A84C]/30 mb-3" />
            <p className="text-sm font-medium text-[#16213E] mb-1">No users found</p>
            <p className="text-xs text-[#9E998F]">
              {users.length === 0
                ? 'No accounts in the database yet. Make sure Firestore rules allow reads.'
                : 'Try a different search or filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EDE8] bg-[#FAF8F5]">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#9E998F] uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#9E998F] uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#9E998F] uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-[#9E998F] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE8]">
              {filtered.map((u) => (
                <tr key={u.uid} className={`transition-colors ${isMe(u.uid) ? 'bg-[#C9A84C]/5' : 'hover:bg-[#FAF8F5]'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#C9A84C] text-sm font-semibold">
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#16213E]">{u.displayName}</p>
                          {isMe(u.uid) && (
                            <span className="text-xs bg-[#C9A84C]/15 text-[#A8872E] px-1.5 py-0.5 rounded font-medium">You</span>
                          )}
                        </div>
                        <p className="text-xs text-[#9E998F]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{roleBadge(u.role)}</td>
                  <td className="px-6 py-4">{statusBadge(u.status)}</td>
                  <td className="px-6 py-4">
                    {isMe(u.uid) ? (
                      <p className="text-xs text-[#9E998F] text-right">Current account</p>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {u.status === 'inactive' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => updateUser.mutate({ uid: u.uid, data: { status: 'active' } })}
                            loading={updateUser.isPending}
                          >
                            <UserCheck size={14} />
                            Activate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateUser.mutate({ uid: u.uid, data: { status: 'inactive' } })}
                            loading={updateUser.isPending}
                          >
                            <UserX size={14} />
                            Deactivate
                          </Button>
                        )}
                        <Select
                          compact
                          value={u.role}
                          onChange={(v) => updateUser.mutate({ uid: u.uid, data: { role: v as UserRole } })}
                          options={[
                            { value: 'user', label: 'User' },
                            { value: 'trainer', label: 'Trainer' },
                            { value: 'admin', label: 'Admin' },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
