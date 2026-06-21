import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { LayoutDashboard, Users, Dumbbell, Utensils } from 'lucide-react'

const navItems = [
  { to: '/trainer', icon: LayoutDashboard, label: 'Dashboard', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { to: '/trainer/clients', icon: Users, label: 'My Clients', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { to: '/trainer/workout-plans', icon: Dumbbell, label: 'Workout Plans', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { to: '/trainer/nutrition-plans', icon: Utensils, label: 'Nutrition Plans', color: 'text-purple-400', bg: 'bg-purple-500/20' },
]

export default function TrainerLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar items={navItems} title="Trainer" accentColor="#34D399" />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
