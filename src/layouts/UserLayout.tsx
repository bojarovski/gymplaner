import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { LayoutDashboard, CalendarCheck, FolderOpen, TrendingUp, ShoppingCart } from 'lucide-react'

const navItems = [
  { to: '/user', icon: LayoutDashboard, label: 'Dashboard', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { to: '/user/today', icon: CalendarCheck, label: 'Today', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { to: '/user/plans', icon: FolderOpen, label: 'My Plans', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { to: '/user/shopping', icon: ShoppingCart, label: 'Shopping', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { to: '/user/progress', icon: TrendingUp, label: 'Progress', color: 'text-teal-400', bg: 'bg-teal-500/20' },
]

export default function UserLayout() {
  return (
    <div className="flex min-h-screen bg-[#F7F5F1]">
      <Sidebar items={navItems} title="Member" accentColor="#60A5FA" />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
