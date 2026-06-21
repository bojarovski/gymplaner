import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { useAuthStore } from '../store/authStore'

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
    <div className="min-h-screen bg-[#F7F5F1] flex flex-col">
      {/* Banner */}
      <div className="w-full gradient-sidebar px-6 py-4 flex items-center gap-3">
        <img src="/logo.png" alt="Findzzer" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/20 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-white font-bold text-lg leading-none">Findzzer</span>
            <span className="text-[#C9A84C] font-bold text-lg leading-none">Fit</span>
          </div>
          <p className="text-white/40 text-xs mt-0.5 truncate">Premium fitness coaching platform</p>
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center">
          {/* Logo mark */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg ring-4 ring-white">
              <img src="/logo.png" alt="Findzzer" className="w-full h-full object-cover" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#16213E] mb-2">Welcome to Findzzer Fit</h1>
          <p className="text-[#9E998F] text-sm mb-8 leading-relaxed">
            Your personal coaching platform.<br />Sign in to access your plans and workouts.
          </p>

          {error && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-[#E5E0D8] rounded-2xl text-[#16213E] text-sm font-semibold hover:bg-[#F7F5F1] hover:border-[#C9A84C] hover:shadow-sm transition-all duration-200 disabled:opacity-50 shadow-sm"
          >
            {signingIn ? (
              <span className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {signingIn ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="mt-5 text-xs text-[#C9C4BC]">
            By signing in you agree to our Terms &amp; Privacy Policy
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-[#C9C4BC] pb-6">© 2026 Findzzer Fit. All rights reserved.</p>
    </div>
  )
}
