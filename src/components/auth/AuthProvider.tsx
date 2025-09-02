'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import AuthModal from './AuthModal'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, initialize } = useAuthStore()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!loading && !user) {
      setShowAuthModal(true)
    } else {
      setShowAuthModal(false)
    }
  }, [loading, user])

  const handleCloseModal = () => {
    // Only allow closing in development or if user is authenticated
    if (process.env.NODE_ENV === 'development' || user) {
      setShowAuthModal(false)
    }
  }

  return (
    <>
      {children}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={handleCloseModal}
      />
    </>
  )
}