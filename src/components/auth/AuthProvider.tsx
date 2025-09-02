'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import AuthPage from './AuthPage'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, needsVerification, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Show auth page if not authenticated or needs verification
  if (!user || needsVerification) {
    return <AuthPage />
  }

  // Show main app if authenticated
  return <>{children}</>
}