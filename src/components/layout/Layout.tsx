'use client'

import Header from './Header'
import CreateModal from '@/components/create/CreateModal'
import { useAppStore } from '@/store/appStore'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isCreateModalOpen, setCreateModalOpen } = useAppStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      
      <CreateModal 
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  )
}