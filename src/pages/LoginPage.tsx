import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { useAuthStore } from '../store/authStore'
import { Zap, Activity, Target, TrendingUp } from 'lucide-react'

const features = [
  { icon: Zap, label: 'Custom Workout Plans', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { icon: Activity, label: 'Nutrition Tracking', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { icon: Target, label: 'Goal Setting', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { icon: TrendingUp, label: 'Progress Analytics', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
]

export default function LoginPage() {
  const { user, loading } = useAuthStore()
  const navigate = useNavigate()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) {
      if (user.status === 'inactive') navigate('/waiting')
      else if (user.role === 'admin') navigate('/admin')
      else if (user.role === 'trainer') navigate('/trainer')
      else navigate('/user')
    }
  }, [user, loading, navigate])

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setError('Sign in failed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 gradient-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <span className="text-white font-bold text-xl">Findzzer</span>
            <span className="text-blue-400 font-bold text-xl ml-1">Fit</span>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Train smarter.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Reach further.
            </span>
          </h1>
          <p className="text-white/50 text-lg mb-10">
            Premium fitness coaching platform connecting trainers with their clients.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, color, bg }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={color} />
                </div>
                <span className="text-white/70 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-sm">© 2026 Findzzer Fit. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-slate-100 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src="/logo.png" alt="" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <span className="text-slate-900 font-bold text-lg">Findzzer</span>
              <span className="text-blue-600 font-bold text-lg ml-1">Fit</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

            {error && (
              <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 disabled:opacity-50"
            >
              {signingIn ? (
                <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {signingIn ? 'Signing in...' : 'Continue with Google'}
            </button>

            <p className="mt-6 text-center text-xs text-slate-400">
              By signing in you agree to our Terms &amp; Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
