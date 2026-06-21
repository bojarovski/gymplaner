import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuthStore } from '../store/authStore'
import type { AppUser } from '../types'

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)

        if (snap.exists()) {
          const data = snap.data()
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || data.displayName || 'User',
            photoURL: firebaseUser.photoURL || undefined,
            role: data.role || 'user',
            status: data.status || 'inactive',
            createdAt: data.createdAt?.toDate() || new Date(),
            trainerId: data.trainerId,
          } as AppUser)
        } else {
          // New user — create their document
          const newDoc = {
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || null,
            role: 'user' as const,
            status: 'inactive' as const,
            createdAt: serverTimestamp(),
          }
          await setDoc(ref, newDoc)
          setUser({ ...newDoc, createdAt: new Date() } as AppUser)
        }
      } catch (err: any) {
        console.error('Firestore error:', err?.code, err?.message)
        // Firestore rules are blocking — set a minimal user so app doesn't hang
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL || undefined,
          role: 'user',
          status: 'inactive',
          createdAt: new Date(),
        } as AppUser)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [setUser, setLoading])
}
