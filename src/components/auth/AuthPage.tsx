'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
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
  
  const { signIn, signUp, needsVerification, verificationEmail, clearVerification } = useAuthStore()

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (authStep === 'signup') {
        const result = await signUp(email, password, {
          name,
          handle,
          is_artist: accountType === 'artist',
        })
        // If verification is needed, the AuthPage will show verification message
        // No need to do anything else here
      } else {
        await signIn(email, password, rememberMe)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDevSkip = () => {
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
      useAuthStore.setState({ user: mockUser as any, loading: false })
    }
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
          <div className="text-center mt-8">
            <button
              onClick={handleDevSkip}
              className="px-6 py-2 border border-white/30 rounded-lg text-sm font-medium text-indigo-200 bg-white/10 hover:bg-white/20 transition-colors"
            >
              Skip Login - Dev
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
              <div className="p-3 text-sm text-red-200 bg-red-500/20 rounded-lg border border-red-400/30">
                {error}
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

  // Show verification screen if needed
  if (needsVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Check Your Email</h1>
            <p className="text-indigo-200 mb-6">
              We've sent a verification link to <br />
              <span className="font-medium text-white">{verificationEmail}</span>
            </p>
            <p className="text-sm text-indigo-300 mb-8">
              Click the link in your email to verify your account and start using INKD.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  clearVerification()
                  setAuthStep('choice')
                  setAccountType(null)
                  setEmail('')
                  setPassword('')
                  setName('')
                  setHandle('')
                }}
                className="w-full px-4 py-2 border border-white/30 rounded-lg text-sm font-medium text-indigo-200 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Back to Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (authStep === 'choice') {
    return renderChoiceStep()
  }

  return renderFormStep()
}