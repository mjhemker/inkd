'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import AuthPage from './AuthPage'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, needsVerification, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Add logging for debugging
  useEffect(() => {
    console.log('🔍 AuthProvider state:', { 
      user: user?.email || 'none', 
      loading, 
      needsVerification 
    })
  }, [user, loading, needsVerification])

  // Show loading state
  if (loading) {
    console.log('⏳ Showing loading state')
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Show auth page if not authenticated or needs verification
  if (!user || needsVerification) {
    console.log('🔐 Showing auth page - user:', user?.email || 'none', 'needsVerification:', needsVerification)
    return <AuthPage />
  }

  // Show main app if authenticated
  console.log('✅ Showing main app for user:', user.email)
  return <>{children}</>
}