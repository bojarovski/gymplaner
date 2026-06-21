import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { LayoutDashboard, Users, Utensils, BookOpen } from 'lucide-react'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', color: 'text-violet-400', bg: 'bg-violet-500/20' },
  { to: '/admin/users', icon: Users, label: 'Users', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { to: '/admin/plans', icon: BookOpen, label: 'Plan Templates', color: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/20' },
  { to: '/admin/seed', icon: Utensils, label: 'Seed Plan', color: 'text-purple-400', bg: 'bg-purple-500/20' },
]

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar items={navItems} title="Admin" accentColor="#A78BFA" />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
