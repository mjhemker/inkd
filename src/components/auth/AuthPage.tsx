'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [isArtist, setIsArtist] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn, signUp } = useAuthStore()

  // Pre-populate email if "Remember Me" was used
  useEffect(() => {
    if (!isSignUp) {
      const rememberedEmail = localStorage.getItem('inkd-user-email')
      const rememberMeEnabled = localStorage.getItem('inkd-remember-me') === 'true'
      if (rememberedEmail && rememberMeEnabled) {
        setEmail(rememberedEmail)
        setRememberMe(true)
      }
    }
  }, [isSignUp])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password, {
          name,
          handle,
          is_artist: isArtist,
        })
      } else {
        await signIn(email, password, rememberMe)
      }
      resetForm()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDevSkip = () => {
    // For development: skip authentication by setting a mock user
    if (process.env.NODE_ENV === 'development') {
      const mockUser = {
        id: 'dev-user-id',
        email: 'dev@inkd.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        identities: [],
        factors: []
      }
      // Manually set the user in the auth store
      useAuthStore.setState({ user: mockUser as any, loading: false })
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setName('')
    setHandle('')
    setIsArtist(false)
    setRememberMe(false)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full flex flex-col lg:flex-row items-center gap-12">
        {/* Left side - Branding/Hero */}
        <div className="flex-1 text-center lg:text-left">
          <div className="mb-8">
            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-4">
              INKD
            </h1>
            <p className="text-xl lg:text-2xl text-indigo-200 mb-6">
              Connect with tattoo artists and enthusiasts worldwide
            </p>
            <div className="space-y-4 text-indigo-100">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                <span>Discover local artists</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Share your tattoo journey</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                <span>Get AI-powered assistance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="flex-1 max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                {isSignUp ? 'Join INKD' : 'Welcome Back'}
              </h2>
              <p className="text-indigo-200">
                {isSignUp ? 'Create your account to get started' : 'Sign in to your account'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-200 bg-red-500/20 rounded-lg border border-red-400/30">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-indigo-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-indigo-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>

              {isSignUp && (
                <>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-indigo-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="handle" className="block text-sm font-medium text-white mb-2">
                      Handle
                    </label>
                    <input
                      type="text"
                      id="handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@username"
                      className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-indigo-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isArtist"
                      checked={isArtist}
                      onChange={(e) => setIsArtist(e.target.checked)}
                      className="h-4 w-4 text-indigo-400 focus:ring-indigo-400 bg-white/10 border-white/20 rounded"
                    />
                    <label htmlFor="isArtist" className="ml-3 block text-sm text-white">
                      I am a tattoo artist
                    </label>
                  </div>
                </>
              )}

              {!isSignUp && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-400 focus:ring-indigo-400 bg-white/10 border-white/20 rounded"
                  />
                  <label htmlFor="rememberMe" className="ml-3 block text-sm text-white">
                    Remember me
                  </label>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>
                
                {process.env.NODE_ENV === 'development' && (
                  <button
                    type="button"
                    onClick={handleDevSkip}
                    className="w-full flex justify-center py-3 px-4 border border-white/30 rounded-lg shadow-sm text-sm font-medium text-indigo-200 bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 transition-colors"
                  >
                    Skip Login - Dev
                  </button>
                )}
              </div>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  resetForm()
                }}
                className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}