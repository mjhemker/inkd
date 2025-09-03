'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { UserIcon, PaintBrushIcon } from '@heroicons/react/24/outline'

type AuthStep = 'choice' | 'signin' | 'signup'

export default function AuthPage() {
  const [authStep, setAuthStep] = useState<AuthStep>('choice')
  const [accountType, setAccountType] = useState<'artist' | 'client' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signIn, signUp } = useAuthStore()

  // Debug the current state
  useEffect(() => {
    console.log('🔍 AuthPage state:', { authStep, email, error, loading })
  }, [authStep, email, error, loading])

  useEffect(() => {
    if (authStep === 'signin') {
      const rememberedEmail = localStorage.getItem('inkd-user-email')
      const rememberMeEnabled = localStorage.getItem('inkd-remember-me') === 'true'
      if (rememberedEmail && rememberMeEnabled) {
        setEmail(rememberedEmail)
        setRememberMe(true)
      }
    }
  }, [authStep])

  // Test Supabase connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      console.log('🔧 Environment check:', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'
      })
      
      try {
        // Test basic Supabase connection
        const { data, error } = await supabase.from('users').select('count').limit(1).maybeSingle()
        console.log('🔗 Supabase connection test:', { error: error?.message || 'none', success: !error })
        
        if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
          setError('Authentication service connection failed. Please try again.')
        }
      } catch (error) {
        console.error('❌ Supabase connection failed:', error)
        setError('Unable to connect to authentication service.')
      }
    }
    testConnection()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    console.log('🚀 Form submitted for:', authStep, email)

    try {
      if (authStep === 'signup') {
        console.log('📝 Attempting signup')
        const result = await signUp(email, password, {
          name,
          handle,
          is_artist: accountType === 'artist',
        })
        console.log('✅ Signup result:', result)
      } else {
        console.log('🔑 Attempting sign in')
        await signIn(email, password, rememberMe)
        console.log('✅ Sign in completed')
      }
    } catch (err: any) {
      console.error('❌ Auth error:', err)
      let errorMessage = 'An error occurred'
      
      // Handle specific error cases
      if (err.message.includes('Invalid login credentials')) {
        errorMessage = 'Incorrect email or password'
      } else if (err.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists'
      } else if (err.message.includes('Password should be at least')) {
        errorMessage = 'Password must be at least 6 characters long'
      } else if (err.message.includes('Unable to validate email address')) {
        errorMessage = 'Please enter a valid email address'
      } else if (err.message.includes('Failed to load resource')) {
        errorMessage = 'Connection error. Please check your internet and try again.'
      } else if (err.message.includes('fetch')) {
        errorMessage = 'Network error. Please try again.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      console.log('🚨 Setting error message:', errorMessage)
      setError(errorMessage)
    } finally {
      console.log('🏁 Auth request finished, setting loading to false')
      setLoading(false)
    }
  }

  const handleDevSkip = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Dev skip activated')
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
      useAuthStore.setState({ 
        user: mockUser as any, 
        loading: false,
        needsVerification: false,
        verificationEmail: null,
        pendingUserData: null
      })
      console.log('✅ Dev user set, should navigate to app')
    }
  }

  // Add a test button for debugging auth issues
  const handleTestAuth = async () => {
    console.log('🧪 Testing auth with test credentials')
    setError('')
    setLoading(true)
    
    try {
      // Test with a simple email/password
      await signUp('test@test.com', 'testpass123', {
        name: 'Test User',
        handle: 'testuser',
        is_artist: false,
      })
    } catch (err: any) {
      console.error('❌ Test auth failed:', err)
      setError('Test auth failed: ' + (err.message || 'Unknown error'))
    }
    setLoading(false)
  }

  const renderChoiceStep = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-16">
          <h1 className="text-6xl lg:text-8xl font-bold text-white mb-6">INKD</h1>
          <p className="text-2xl lg:text-3xl text-indigo-200 mb-4">Where Ink Meets Inspiration</p>
          <p className="text-lg text-indigo-300 max-w-2xl mx-auto">
            Join the community that connects tattoo artists with enthusiasts worldwide
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <button
            onClick={() => {
              setAccountType('artist')
              setAuthStep('signup')
            }}
            className="group relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <PaintBrushIcon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">I'm an Artist</h3>
              <p className="text-indigo-200 mb-6 leading-relaxed">
                Showcase your portfolio, connect with clients, get AI-powered market insights, and grow your tattoo business.
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-3 text-purple-200">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-sm">Portfolio management</span>
                </div>
                <div className="flex items-center gap-3 text-purple-200">
                  <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                  <span className="text-sm">Client booking system</span>
                </div>
                <div className="flex items-center gap-3 text-purple-200">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span className="text-sm">AI market research</span>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>

          <button
            onClick={() => {
              setAccountType('client')
              setAuthStep('signup')
            }}
            className="group relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-400 to-blue-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <UserIcon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">I'm a Client</h3>
              <p className="text-indigo-200 mb-6 leading-relaxed">
                Discover amazing artists, browse portfolios, book appointments, and share your tattoo journey with the community.
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-3 text-blue-200">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-sm">Find local artists</span>
                </div>
                <div className="flex items-center gap-3 text-blue-200">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span className="text-sm">Browse portfolios</span>
                </div>
                <div className="flex items-center gap-3 text-blue-200">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <span className="text-sm">Share your ink story</span>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-indigo-300 mb-4">Already have an account?</p>
          <button
            onClick={() => setAuthStep('signin')}
            className="text-lg font-medium text-white hover:text-indigo-200 transition-colors underline decoration-2 underline-offset-4"
          >
            Sign In
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="text-center mt-8 space-y-3">
            <button
              onClick={handleDevSkip}
              className="block mx-auto px-6 py-2 border border-white/30 rounded-lg text-sm font-medium text-indigo-200 bg-white/10 hover:bg-white/20 transition-colors"
            >
              Skip Login - Dev
            </button>
            <button
              onClick={handleTestAuth}
              className="block mx-auto px-6 py-2 border border-green-300/30 rounded-lg text-sm font-medium text-green-200 bg-green-500/10 hover:bg-green-500/20 transition-colors"
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Auth - Dev'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderFormStep = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">INKD</h1>
            {authStep === 'signin' ? (
              <>
                <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
                <p className="text-indigo-200">Sign in to your account</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Join as {accountType === 'artist' ? 'an Artist' : 'a Client'}
                </h2>
                <p className="text-indigo-200">Create your account to get started</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
                <div className="p-4 text-sm font-medium text-red-100 bg-red-600/90 backdrop-blur-sm rounded-lg border-2 border-red-400 shadow-2xl animate-pulse">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-red-200 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="font-bold text-red-100">Authentication Error</div>
                      <div className="text-red-200">{error}</div>
                    </div>
                    <button
                      onClick={() => setError('')}
                      className="ml-auto flex-shrink-0 text-red-200 hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">Email</label>
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
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">Password</label>
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

            {authStep === 'signup' && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-2">Full Name</label>
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
                  <label htmlFor="handle" className="block text-sm font-medium text-white mb-2">Username</label>
                  <input
                    type="text"
                    id="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full rounded-lg border border-white/20 bg-white/10 text-white placeholder-indigo-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    {accountType === 'artist' ? (
                      <PaintBrushIcon className="w-6 h-6 text-purple-400" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-blue-400" />
                    )}
                    <span className="text-white font-medium">
                      Creating {accountType === 'artist' ? 'Artist' : 'Client'} account
                    </span>
                  </div>
                </div>
              </>
            )}

            {authStep === 'signin' && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-indigo-400 focus:ring-indigo-400 bg-white/10 border-white/20 rounded"
                />
                <label htmlFor="rememberMe" className="ml-3 block text-sm text-white">Remember me</label>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : (authStep === 'signup' ? 'Create Account' : 'Sign In')}
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <button
                  type="button"
                  onClick={handleDevSkip}
                  className="w-full flex justify-center py-2 px-4 border border-white/30 rounded-lg text-sm font-medium text-indigo-200 bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 transition-colors"
                >
                  Skip Login - Dev
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center space-y-3">
            {authStep === 'signin' ? (
              <button
                onClick={() => setAuthStep('choice')}
                className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                Need an account? Sign up
              </button>
            ) : authStep === 'signup' ? (
              <>
                <button
                  onClick={() => setAuthStep('signin')}
                  className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
                >
                  Already have an account? Sign in
                </button>
                <div>
                  <button
                    onClick={() => setAuthStep('choice')}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ← Back to account type selection
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  if (authStep === 'choice') {
    return renderChoiceStep()
  }

  return renderFormStep()
}