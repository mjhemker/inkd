'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  HomeIcon, 
  MapPinIcon, 
  PlusIcon, 
  UserCircleIcon,
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import AuthModal from '@/components/auth/AuthModal'

export default function Header() {
  const pathname = usePathname()
  const { user, signOut } = useAuthStore()
  const { setCreateModalOpen } = useAppStore()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Local', href: '/local', icon: MapPinIcon },
    { name: 'Profile', href: user ? `/profile/${user.id}` : '/profile', icon: UserCircleIcon },
  ]

  const handleCreateClick = () => {
    if (!user) {
      setIsAuthModalOpen(true)
      return
    }
    setCreateModalOpen(true)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setIsProfileMenuOpen(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600">
                INKD
              </Link>
            </div>

            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>

              <button
                onClick={handleCreateClick}
                className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
              </button>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-50"
                  >
                    <img
                      src={user.user_metadata?.profile_img || '/default-avatar.svg'}
                      alt="Profile"
                      className="h-8 w-8 rounded-full bg-gray-200"
                    />
                  </button>

                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                      <Link
                        href={`/profile/${user.id}`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        Your Profile
                      </Link>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="flex justify-around py-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center p-2 text-xs ${
                    isActive ? 'text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="mt-1">{item.name}</span>
                </Link>
              )
            })}
            <button
              onClick={handleCreateClick}
              className="flex flex-col items-center p-2 text-xs text-indigo-600"
            >
              <div className="flex items-center justify-center w-6 h-6 bg-indigo-600 text-white rounded-full">
                <PlusIcon className="h-4 w-4" />
              </div>
              <span className="mt-1">Create</span>
            </button>
          </div>
        </div>
      </header>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  )
}