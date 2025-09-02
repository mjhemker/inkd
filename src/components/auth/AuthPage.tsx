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
  
  const { signIn, signUp } = useAuthStore()

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
        await signUp(email, password, {
          name,
          handle,
          is_artist: accountType === 'artist',
        })
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

  if (authStep === 'choice') {
    return (
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
}