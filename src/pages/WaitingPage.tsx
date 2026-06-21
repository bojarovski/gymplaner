import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useAuthStore } from '../store/authStore'
import { Clock, LogOut, CheckCircle2 } from 'lucide-react'

export default function WaitingPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Findzzer Fit" className="w-14 h-14 rounded-xl object-cover mb-6" />

          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mb-5">
            <Clock size={26} className="text-orange-500" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Account Pending</h1>
          <p className="text-sm text-slate-500 mb-6">
            Hi <span className="font-semibold text-slate-900">{user?.displayName}</span>, your account is under review. An administrator will activate it shortly.
          </p>

          <div className="w-full space-y-2 mb-6">
            {[
              { label: 'Account created', done: true },
              { label: 'Awaiting admin approval', done: false },
              { label: 'Get access to plans', done: false },
            ].map(({ label, done }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
                <CheckCircle2 size={18} className={done ? 'text-emerald-500' : 'text-slate-300'} />
                <span className={`text-sm font-medium ${done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
              </div>
            ))}
          </div>

          <div className="w-full bg-slate-50 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs text-slate-400 mb-0.5">Signed in as</p>
            <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
