import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import {
  ArrowLeft, ShoppingCart, Check, RotateCcw, ChevronDown, ChevronUp,
  Plus, Trash2, Shield, Pencil, Lock, LockOpen,
} from 'lucide-react'
import type { ShoppingList, ShoppingCategory, ShoppingItem, ShoppingAssignment } from '../../types'

function uid() { return crypto.randomUUID() }

export default function ShoppingListDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [addCatModal, setAddCatModal] = useState(false)
  const [newCatEmoji, setNewCatEmoji] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [addItemCatId, setAddItemCatId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')

  const { data: list, isLoading } = useQuery({
    queryKey: ['shopping-list', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingLists', id!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as ShoppingList) : null
    },
    enabled: !!id,
  })

  const { data: assignment } = useQuery({
    queryKey: ['shopping-assignment', id, user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingAssignments', `${id}_${user!.uid}`))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as ShoppingAssignment) : null
    },
    enabled: !!id && !!user,
  })

  const isOwned = list?.ownedBy === user?.uid
  const progressDocId = user && id ? `${user.uid}_${id}` : null

  const { data: progress } = useQuery({
    queryKey: ['shopping-progress', progressDocId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingProgress', progressDocId!))
      if (!snap.exists()) return { checkedItemIds: [] as string[], lockedItemIds: [] as string[] }
      const d = snap.data()
      return {
        checkedItemIds: (d.checkedItemIds ?? []) as string[],
        lockedItemIds: (d.lockedItemIds ?? []) as string[],
      }
    },
    enabled: !!progressDocId,
  })

  const checkedIds = progress?.checkedItemIds ?? []
  const lockedIds = progress?.lockedItemIds ?? []
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds])
  const lockedSet = useMemo(() => new Set(lockedIds), [lockedIds])

  const saveProgress = async (nextChecked: Set<string>, nextLocked: Set<string>) => {
    await setDoc(doc(db, 'shoppingProgress', progressDocId!), {
      userId: user!.uid, listId: id,
      checkedItemIds: [...nextChecked],
      lockedItemIds: [...nextLocked],
      updatedAt: serverTimestamp(),
    })
  }

  const toggle = useMutation({
    mutationFn: async (itemId: string) => {
      const next = new Set(checkedSet)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      await saveProgress(next, lockedSet)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-progress', progressDocId] }),
  })

  const toggleLock = useMutation({
    mutationFn: async (itemId: string) => {
      const next = new Set(lockedSet)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      await saveProgress(checkedSet, next)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-progress', progressDocId] }),
  })

  const reset = useMutation({
    mutationFn: async () => {
      // Keep checked state only for locked items; uncheck everything else
      const nextChecked = new Set([...checkedIds].filter((id) => lockedSet.has(id)))
      await saveProgress(nextChecked, lockedSet)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-progress', progressDocId] }),
  })

  const addCategory = useMutation({
    mutationFn: async ({ emoji, name }: { emoji: string; name: string }) => {
      const newCat: ShoppingCategory = {
        id: uid(), emoji: emoji.trim() || '📦', name: name.trim(), items: [],
      }
      await updateDoc(doc(db, 'shoppingLists', id!), {
        categories: [...(list?.categories ?? []), newCat],
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list', id] })
      setAddCatModal(false)
      setNewCatEmoji('')
      setNewCatName('')
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (catId: string) => {
      await updateDoc(doc(db, 'shoppingLists', id!), {
        categories: (list?.categories ?? []).filter((c) => c.id !== catId),
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', id] }),
  })

  const addItem = useMutation({
    mutationFn: async ({ catId, name, amount }: { catId: string; name: string; amount: string }) => {
      const newItem: ShoppingItem = { id: uid(), name: name.trim(), amount: amount.trim() }
      await updateDoc(doc(db, 'shoppingLists', id!), {
        categories: (list?.categories ?? []).map((c) =>
          c.id === catId ? { ...c, items: [...c.items, newItem] } : c
        ),
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list', id] })
      setAddItemCatId(null)
      setNewItemName('')
      setNewItemAmount('')
    },
  })

  const deleteItem = useMutation({
    mutationFn: async ({ catId, itemId }: { catId: string; itemId: string }) => {
      await updateDoc(doc(db, 'shoppingLists', id!), {
        categories: (list?.categories ?? []).map((c) =>
          c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
        ),
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', id] }),
  })

  const toggleCat = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId); else next.add(catId)
      return next
    })
  }

  const totalItems = list?.categories?.reduce((s, c) => s + c.items.length, 0) ?? 0
  const nonLockedChecked = checkedIds.filter((id) => !lockedSet.has(id)).length
  const checkedCount = checkedIds.length

  if (isLoading) return <div className="p-4 md:p-8 text-slate-400 text-sm">Loading...</div>
  if (!list) return <div className="p-4 md:p-8 text-slate-400 text-sm">List not found.</div>

  return (
    <div className="p-4 md:p-8 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/user/shopping')}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <ShoppingCart size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{list.name}</h1>
          {list.description && <p className="text-xs text-slate-400">{list.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditMode(!editMode)}
            title={editMode ? 'Done editing' : 'Edit list'}
            className={`p-2 rounded-xl transition-colors ${
              editMode
                ? 'bg-orange-100 text-orange-600'
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending || nonLockedChecked === 0}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
            title={lockedSet.size > 0 ? `Resets ${nonLockedChecked} items — ${lockedSet.size} locked item${lockedSet.size !== 1 ? 's' : ''} kept` : 'Uncheck all'}
          >
            <RotateCcw size={13} />
            Reset
            {lockedSet.size > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full leading-none">
                {lockedSet.size} locked
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Assigned by banner */}
      {assignment && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <Shield size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Assigned by{' '}
            <span className="font-semibold">{assignment.assignedByLabel}</span>
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">
            {checkedCount} / {totalItems} items
          </span>
          <span className="text-xs text-slate-400">
            {totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {(list.categories ?? []).map((cat: ShoppingCategory) => {
          const catChecked = cat.items.filter((i) => checkedSet.has(i.id)).length
          const allCatDone = cat.items.length > 0 && catChecked === cat.items.length
          const isCollapsed = collapsedCats.has(cat.id)

          return (
            <div
              key={cat.id}
              className={`border rounded-2xl overflow-hidden transition-colors ${
                allCatDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center">
                <button
                  className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors text-left"
                  onClick={() => toggleCat(cat.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className={`font-semibold text-sm ${allCatDone ? 'text-emerald-700' : 'text-[#16213E]'}`}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold tabular-nums ${
                      allCatDone ? 'text-emerald-600' : catChecked > 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {catChecked}/{cat.items.length}
                    </span>
                    {isCollapsed
                      ? <ChevronDown size={14} className="text-slate-400" />
                      : <ChevronUp size={14} className="text-slate-400" />
                    }
                  </div>
                </button>
                {editMode && (
                  <button
                    onClick={() => deleteCategory.mutate(cat.id)}
                    disabled={deleteCategory.isPending}
                    className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="border-t border-slate-100">
                  {cat.items.map((item, idx) => {
                    const checked = checkedSet.has(item.id)
                    const locked = lockedSet.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center ${idx < cat.items.length - 1 ? 'border-b border-slate-50' : ''} ${locked ? 'bg-amber-50/60' : ''}`}
                      >
                        <button
                          onClick={() => toggle.mutate(item.id)}
                          disabled={toggle.isPending}
                          className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors disabled:cursor-wait"
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                          }`}>
                            {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`flex-1 text-sm transition-colors ${
                            checked ? 'text-slate-400 line-through' : 'text-slate-800'
                          }`}>
                            {item.name}
                          </span>
                          <span className={`text-xs flex-shrink-0 font-medium ${
                            checked ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            {item.amount}
                          </span>
                        </button>

                        {/* Lock button — always visible */}
                        <button
                          onClick={() => toggleLock.mutate(item.id)}
                          disabled={toggleLock.isPending}
                          title={locked ? 'Unlock (will be reset)' : 'Lock (skip on reset)'}
                          className={`p-2.5 flex-shrink-0 transition-colors disabled:opacity-50 ${
                            locked
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-slate-300 hover:text-slate-400'
                          }`}
                        >
                          {locked ? <Lock size={13} /> : <LockOpen size={13} />}
                        </button>

                        {editMode && (
                          <button
                            onClick={() => deleteItem.mutate({ catId: cat.id, itemId: item.id })}
                            disabled={deleteItem.isPending}
                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )
                  })}

                  {editMode && (
                    addItemCatId === cat.id ? (
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100">
                        <input
                          autoFocus
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newItemName.trim()) {
                              addItem.mutate({ catId: cat.id, name: newItemName, amount: newItemAmount })
                            }
                            if (e.key === 'Escape') {
                              setAddItemCatId(null)
                              setNewItemName('')
                              setNewItemAmount('')
                            }
                          }}
                          placeholder="Item name"
                          className="flex-1 text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-400"
                        />
                        <input
                          value={newItemAmount}
                          onChange={(e) => setNewItemAmount(e.target.value)}
                          placeholder="Amount"
                          className="w-20 text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-400"
                        />
                        <button
                          onClick={() =>
                            newItemName.trim() &&
                            addItem.mutate({ catId: cat.id, name: newItemName, amount: newItemAmount })
                          }
                          disabled={!newItemName.trim() || addItem.isPending}
                          className="text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddItemCatId(null); setNewItemName(''); setNewItemAmount('') }}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddItemCatId(cat.id)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-slate-100"
                      >
                        <Plus size={12} />
                        Add item
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}

        {editMode && (
          <button
            onClick={() => setAddCatModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
          >
            <Plus size={15} />
            Add Category
          </button>
        )}

        {(list.categories ?? []).length === 0 && !editMode && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No items yet. Tap the pencil icon to add categories and items.
          </div>
        )}
      </div>

      {/* Add category modal */}
      {addCatModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setAddCatModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Category</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={newCatEmoji}
                  onChange={(e) => setNewCatEmoji(e.target.value)}
                  placeholder="📦"
                  className="w-14 text-center px-2 py-2.5 border border-slate-200 rounded-xl text-xl outline-none focus:border-emerald-400"
                />
                <input
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    newCatName.trim() &&
                    addCategory.mutate({ emoji: newCatEmoji, name: newCatName })
                  }
                  placeholder="Category name"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAddCatModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addCategory.mutate({ emoji: newCatEmoji, name: newCatName })}
                  disabled={!newCatName.trim() || addCategory.isPending}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
