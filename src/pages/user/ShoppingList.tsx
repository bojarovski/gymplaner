import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  doc, getDoc, collection, getDocs, query, where, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { ShoppingCart, Check, FolderOpen, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { ShoppingList, ShoppingCategory } from '../../types'

export default function UserShoppingList() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  // ── User doc ─────────────────────────────────────────────────────────────
  const { data: userDoc } = useQuery({
    queryKey: ['user-doc', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid))
      return snap.data() as { activeShoppingListId?: string }
    },
    enabled: !!user,
  })

  // ── Shopping list template ────────────────────────────────────────────────
  const { data: list, isLoading } = useQuery({
    queryKey: ['shopping-list', userDoc?.activeShoppingListId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingLists', userDoc!.activeShoppingListId!))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as ShoppingList) : null
    },
    enabled: !!userDoc?.activeShoppingListId,
  })

  // ── Progress (which items are checked) ───────────────────────────────────
  const progressDocId = user && list ? `${user.uid}_${list.id}` : null

  const { data: checkedIds = [] } = useQuery({
    queryKey: ['shopping-progress', progressDocId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'shoppingProgress', progressDocId!))
      return snap.exists() ? (snap.data().checkedItemIds as string[]) : []
    },
    enabled: !!progressDocId,
  })

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds])

  // ── Toggle item ───────────────────────────────────────────────────────────
  const toggle = useMutation({
    mutationFn: async (itemId: string) => {
      const next = new Set(checkedSet)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      await setDoc(doc(db, 'shoppingProgress', progressDocId!), {
        userId: user!.uid,
        listId: list!.id,
        checkedItemIds: [...next],
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-progress', progressDocId] }),
  })

  // ── Reset all ─────────────────────────────────────────────────────────────
  const reset = useMutation({
    mutationFn: async () => {
      await setDoc(doc(db, 'shoppingProgress', progressDocId!), {
        userId: user!.uid,
        listId: list!.id,
        checkedItemIds: [],
        updatedAt: serverTimestamp(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-progress', progressDocId] }),
  })

  const toggleCat = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId); else next.add(catId)
      return next
    })
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalItems = list?.categories.reduce((s, c) => s + c.items.length, 0) ?? 0
  const checkedCount = checkedIds.length

  if (isLoading) return <div className="p-4 md:p-8 text-slate-400 text-sm">Loading...</div>

  if (!userDoc?.activeShoppingListId || !list) {
    return (
      <div className="p-4 md:p-8 max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Shopping List</h1>
        </div>
        <Card className="text-center py-12">
          <ShoppingCart size={44} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No shopping list assigned</h3>
          <p className="text-sm text-slate-500 mb-6">Ask your coach to assign a shopping list to your account.</p>
          <Button variant="ghost" onClick={() => navigate('/user')}>
            <FolderOpen size={15} />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{list.name}</h1>
            {list.description && <p className="text-sm text-slate-400 mt-0.5">{list.description}</p>}
          </div>
        </div>
        <button
          onClick={() => reset.mutate()}
          disabled={reset.isPending || checkedCount === 0}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 mt-1"
          title="Uncheck all"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">{checkedCount} / {totalItems} items</span>
          <span className="text-xs text-slate-400">{totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%</span>
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
        {list.categories.map((cat: ShoppingCategory) => {
          const catChecked = cat.items.filter((i) => checkedSet.has(i.id)).length
          const allCatDone = catChecked === cat.items.length
          const isCollapsed = collapsedCats.has(cat.id)

          return (
            <div key={cat.id} className={`border rounded-2xl overflow-hidden transition-colors ${allCatDone ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              {/* Category header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors"
                onClick={() => toggleCat(cat.id)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none">{cat.emoji}</span>
                  <span className={`font-semibold text-sm ${allCatDone ? 'text-emerald-700' : 'text-[#16213E]'}`}>{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums ${allCatDone ? 'text-emerald-600' : catChecked > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {catChecked}/{cat.items.length}
                  </span>
                  {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                </div>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="border-t border-slate-100">
                  {cat.items.map((item, idx) => {
                    const checked = checkedSet.has(item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggle.mutate(item.id)}
                        disabled={toggle.isPending}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.02] disabled:cursor-wait ${
                          idx < cat.items.length - 1 ? 'border-b border-slate-50' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                        }`}>
                          {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>

                        {/* Name */}
                        <span className={`flex-1 text-sm transition-colors ${checked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {item.name}
                        </span>

                        {/* Amount */}
                        <span className={`text-xs flex-shrink-0 font-medium ${checked ? 'text-slate-300' : 'text-slate-400'}`}>
                          {item.amount}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
