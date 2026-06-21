import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, CheckCircle2, Star, User2, Shield, ChevronRight } from 'lucide-react'
import type { ShoppingList, ShoppingAssignment } from '../../types'

export default function ShoppingListHome() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: userDoc } = useQuery({
    queryKey: ['user-doc', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid))
      return snap.data() as { activeShoppingListId?: string }
    },
    enabled: !!user,
  })

  const { data: ownLists = [] } = useQuery({
    queryKey: ['own-shopping-lists', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'shoppingLists'), where('ownedBy', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingList))
    },
    enabled: !!user,
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['shopping-assignments', user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'shoppingAssignments'), where('userId', '==', user!.uid))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingAssignment))
    },
    enabled: !!user,
  })

  const { data: assignedLists = [] } = useQuery({
    queryKey: ['assigned-shopping-lists', assignments.map((a) => a.listId).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        assignments.map(async (a) => {
          const snap = await getDoc(doc(db, 'shoppingLists', a.listId))
          if (!snap.exists()) return null
          return { list: { id: snap.id, ...snap.data() } as ShoppingList, assignment: a }
        })
      )
      return results.filter(Boolean) as { list: ShoppingList; assignment: ShoppingAssignment }[]
    },
    enabled: assignments.length > 0,
  })

  // Fallback: if activeShoppingListId is set but not covered by own/assigned lists, load it directly
  const coveredIds = new Set([
    ...ownLists.map((l) => l.id),
    ...assignedLists.map(({ list }) => list.id),
  ])
  const fallbackId =
    userDoc?.activeShoppingListId && !coveredIds.has(userDoc.activeShoppingListId)
      ? userDoc.activeShoppingListId
      : null

  const { data: fallbackList } = useQuery({
    queryKey: ['shopping-list-fallback', fallbackId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingLists', fallbackId!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as ShoppingList) : null
    },
    enabled: !!fallbackId,
  })

  const setActive = useMutation({
    mutationFn: async (listId: string) => {
      await updateDoc(doc(db, 'users', user!.uid), { activeShoppingListId: listId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-doc'] }),
  })

  const createList = useMutation({
    mutationFn: async (name: string) => {
      const ref = await addDoc(collection(db, 'shoppingLists'), {
        name: name.trim(),
        createdBy: user!.uid,
        ownedBy: user!.uid,
        isUserCopy: true,
        categories: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return ref.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['own-shopping-lists'] })
      setCreateModal(false)
      setNewName('')
      navigate(`/user/shopping/${id}`)
    },
  })

  const activeId = userDoc?.activeShoppingListId

  const fallbackEntry =
    fallbackList && !coveredIds.has(fallbackList.id)
      ? { list: fallbackList, assignment: { assignedByLabel: 'Findzzer Fit' } as ShoppingAssignment }
      : null

  const allLists = [
    ...ownLists.map((list) => ({ list, assignment: null as ShoppingAssignment | null })),
    ...assignedLists.filter(({ list }) => !ownLists.some((o) => o.id === list.id)),
    ...(fallbackEntry ? [fallbackEntry] : []),
  ]

  const totalItems = (list: ShoppingList) =>
    list.categories?.reduce((s, c) => s + c.items.length, 0) ?? 0

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#16213E]">Shopping</h1>
          <p className="text-sm text-[#9E998F] mt-0.5">
            {allLists.length} list{allLists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#16213E] hover:bg-[#1e2d4a] px-3.5 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} />
          New
        </button>
      </div>

      {allLists.length === 0 ? (
        <div className="border border-dashed border-[#E5E0D8] rounded-3xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} className="text-emerald-400" />
          </div>
          <h3 className="font-semibold text-[#16213E] mb-1">No shopping lists yet</h3>
          <p className="text-sm text-[#9E998F] mb-5">Create your own or ask your coach to assign one.</p>
          <button
            onClick={() => setCreateModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={15} />
            Create List
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {allLists.map(({ list, assignment }) => {
            const isActive = activeId === list.id
            const isMine = !assignment
            const total = totalItems(list)
            const cats = list.categories?.length ?? 0

            return (
              <div
                key={list.id}
                onClick={() => navigate(`/user/shopping/${list.id}`)}
                className={`rounded-2xl cursor-pointer transition-all active:scale-[0.99] ${
                  isActive
                    ? 'bg-emerald-500 shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
                    : 'bg-white border border-[#E5E0D8] hover:border-[#C9C4BC] hover:shadow-sm'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-[#16213E]'}`}>
                        {list.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isMine ? (
                          <span className={`flex items-center gap-1 text-xs ${isActive ? 'text-white/60' : 'text-[#9E998F]'}`}>
                            <User2 size={10} />
                            My list
                          </span>
                        ) : (
                          <span className={`flex items-center gap-1 text-xs ${isActive ? 'text-white/60' : 'text-[#9E998F]'}`}>
                            <Shield size={10} className={isActive ? 'text-white/50' : 'text-amber-400'} />
                            {assignment!.assignedByLabel}
                          </span>
                        )}
                        {cats > 0 && (
                          <>
                            <span className={`text-xs ${isActive ? 'text-white/30' : 'text-[#C9C4BC]'}`}>·</span>
                            <span className={`text-xs ${isActive ? 'text-white/60' : 'text-[#9E998F]'}`}>{total} items across {cats} categories</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setActive.mutate(list.id) }}
                          disabled={setActive.isPending}
                          className="text-xs text-emerald-600 font-semibold px-2.5 py-1.5 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        >
                          Set Active
                        </button>
                      )}
                      {isActive
                        ? <CheckCircle2 size={18} className="text-white" />
                        : <ChevronRight size={16} className="text-[#C9C4BC]" />
                      }
                    </div>
                  </div>

                  {/* Category preview pills */}
                  {cats > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(list.categories ?? []).slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            isActive ? 'bg-white/20 text-white/80' : 'bg-[#F0EDE8] text-[#6B6560]'
                          }`}
                        >
                          {c.emoji ? `${c.emoji} ` : ''}{c.name}
                        </span>
                      ))}
                      {cats > 4 && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${isActive ? 'bg-white/10 text-white/50' : 'bg-[#F0EDE8] text-[#9E998F]'}`}>
                          +{cats - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {createModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => { setCreateModal(false); setNewName('') }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-4">New Shopping List</h3>
            <div className="space-y-4">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createList.mutate(newName)}
                placeholder="e.g. Weekly Groceries"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setCreateModal(false); setNewName('') }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => newName.trim() && createList.mutate(newName)}
                  disabled={!newName.trim() || createList.isPending}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {createList.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
