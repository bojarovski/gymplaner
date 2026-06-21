import { NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuthStore } from '../store/authStore'
import type { LucideIcon } from 'lucide-react'
import { LogOut, ChevronRight } from 'lucide-react'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  color: string
  bg: string
}

interface SidebarProps {
  items: NavItem[]
  title: string
  accentColor: string
}

export default function Sidebar({ items, title, accentColor }: SidebarProps) {
  const { user } = useAuthStore()

  const handleSignOut = async () => {
    await signOut(auth)
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 min-h-screen gradient-sidebar flex-col">
        {/* Logo */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <img src="/logo.png" alt="Findzzer Fit" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/20" />
            <div>
              <div className="text-white font-bold text-lg leading-none">Findzzer</div>
              <div className="text-xs font-semibold tracking-widest uppercase mt-0.5" style={{ color: accentColor }}>Fit</div>
            </div>
          </div>
          <div className="mt-4 px-1">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">{title}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {items.map(({ to, icon: Icon, label, color, bg }) => (
            <NavLink
              key={to}
              to={to}
              end={to.split('/').length <= 2}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isActive ? bg : 'bg-white/5 group-hover:bg-white/10'}`}>
                    <Icon size={16} className={isActive ? color : 'text-white/40 group-hover:text-white/60'} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-white/30" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accentColor + '33' }}>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  {(user?.displayName || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.displayName}</p>
              <p className="text-white/40 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-white/5 hover:text-white/70 transition-all duration-150"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2">
        <nav className="bg-[#16213E] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] flex items-center px-2 py-2">
          {items.map(({ to, icon: Icon, label, color, bg }) => (
            <NavLink
              key={to}
              to={to}
              end={to.split('/').length <= 2}
              title={label}
              className="flex-1 flex items-center justify-center py-1"
            >
              {({ isActive }) => (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isActive ? bg + ' shadow-sm' : ''
                }`}>
                  <Icon size={20} className={isActive ? color : 'text-white/35'} />
                </div>
              )}
            </NavLink>
          ))}
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex-1 flex items-center justify-center py-1"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center">
              <LogOut size={20} className="text-white/35" />
            </div>
          </button>
        </nav>
      </div>
    </>
  )
}
