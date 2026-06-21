import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { signInWithPopup } from 'firebase/auth'
import { db, auth, googleProvider } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  const makeAdmin = async () => {
    setStatus('loading')
    try {
      let currentUser = auth.currentUser
      if (!currentUser) {
        const result = await signInWithPopup(auth, googleProvider)
        currentUser = result.user
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || 'Admin',
        photoURL: currentUser.photoURL || null,
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
      })

      setStatus('done')
      setTimeout(() => navigate('/admin'), 1500)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || err?.code || String(err))
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-[#E5E0D8] rounded-2xl shadow-lg p-8 flex flex-col items-center text-center">
        <img src="/logo.png" alt="Findzzer Fit" className="w-16 h-16 rounded-full object-cover mb-5" />

        <h1 className="text-xl font-bold text-[#16213E] mb-1">First-time Setup</h1>
        <p className="text-sm text-[#6B6560] mb-6">
          Click below to grant your Google account full admin access.
        </p>

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left w-full">
            <p className="text-xs font-semibold text-red-600 mb-1">Error:</p>
            <p className="text-xs text-red-500 break-all">{errorMsg}</p>
          </div>
        )}

        {status === 'done' ? (
          <p className="text-sm text-emerald-600 font-medium">✓ Admin access granted! Redirecting...</p>
        ) : (
          <button
            onClick={makeAdmin}
            disabled={status === 'loading'}
            className="w-full py-3 bg-[#16213E] text-white text-sm font-medium rounded-xl hover:bg-[#1E2D50] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Shield size={16} />
            )}
            {status === 'loading' ? 'Setting up...' : 'Make me Admin'}
          </button>
        )}

        <p className="text-xs text-[#9E998F] mt-5">
          Delete this page after setup is complete.
        </p>
      </div>
    </div>
  )
}
