import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  needsVerification: boolean
  verificationEmail: string | null
  pendingUserData: any | null
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signUp: (email: string, password: string, userData?: any) => Promise<{ needsVerification: boolean }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  clearVerification: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      needsVerification: false,
      verificationEmail: null,
      pendingUserData: null,

      signIn: async (email: string, password: string, rememberMe: boolean = false) => {
        console.log('🔄 Starting sign in for:', email)
        set({ loading: true })
        
        // Clear any existing auth state first
        await supabase.auth.signOut()
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          
          console.log('📋 Sign in response:', { 
            user: data.user?.email || 'none',
            session: data.session ? 'exists' : 'none',
            error: error?.message || 'none' 
          })
          
          if (error) {
            console.error('🚨 Supabase sign in error:', error)
            throw error
          }
          
          if (!data.user || !data.session) {
            throw new Error('Sign in failed - invalid response from server')
          }
          
          console.log('✅ Sign in successful, user:', data.user.email)
          
          // Store remember me preference
          if (rememberMe) {
            localStorage.setItem('inkd-remember-me', 'true')
            localStorage.setItem('inkd-user-email', email)
          } else {
            localStorage.removeItem('inkd-remember-me')
            localStorage.removeItem('inkd-user-email')
          }
          
          // Manually set the user state
          set({ 
            user: data.user, 
            loading: false, 
            needsVerification: false,
            verificationEmail: null,
            pendingUserData: null
          })
          
          console.log('🎯 Auth state updated with user:', data.user.email)
        } catch (error: any) {
          console.error('❌ Sign in error:', error)
          set({ loading: false })
          throw new Error(error.message || 'Sign in failed')
        }
      },

      signUp: async (email: string, password: string, userData?: any) => {
        console.log('📝 Starting signup for:', email, 'with userData:', userData)
        set({ loading: true })
        
        // Clear any existing auth state first
        await supabase.auth.signOut()
        
        try {
          // First, test if we can reach Supabase
          console.log('🔍 Testing Supabase connection...')
          const testResponse = await supabase.auth.getSession()
          console.log('📡 Connection test result:', testResponse.error?.message || 'OK')
          
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: userData ? {
                name: userData.name,
                handle: userData.handle,
                is_artist: userData.is_artist
              } : {}
            }
          })
          
          console.log('📋 Signup response:', { 
            user: data.user?.email || 'none',
            session: data.session ? 'exists' : 'none',
            error: error?.message || 'none' 
          })
          
          if (error) {
            console.error('🚨 Supabase signup error:', error)
            throw error
          }
          
          if (!data.user) {
            throw new Error('Signup failed - no user returned from server')
          }
          
          console.log('✅ Signup API call successful')
          
          // Create user profile if we have userData (optional - don't fail signup if this fails)
          if (userData && data.user) {
            console.log('👤 Attempting to create user profile...')
            try {
              const { error: profileError } = await supabase
                .from('users')
                .insert([
                  {
                    id: data.user.id,
                    email: data.user.email!,
                    ...userData,
                  }
                ])
              
              if (profileError) {
                console.error('📝 Profile creation failed:', profileError.message)
                if (profileError.message.includes('relation') && profileError.message.includes('does not exist')) {
                  console.warn('⚠️ Users table does not exist - signup will proceed without profile')
                } else {
                  console.warn('⚠️ Profile creation failed but signup succeeded:', profileError.message)
                }
              } else {
                console.log('✅ Profile created successfully')
              }
            } catch (profileErr) {
              console.error('❌ Profile creation exception:', profileErr)
              console.warn('⚠️ Profile creation failed but signup will continue')
            }
          }
          
          // Set user state regardless of profile creation success
          console.log('✅ Setting user state after signup')
          set({ 
            user: data.user, 
            loading: false, 
            needsVerification: false,
            verificationEmail: null,
            pendingUserData: null
          })
          
          return { needsVerification: false }
        } catch (error: any) {
          console.error('❌ Signup error:', error)
          set({ loading: false })
          throw new Error(error.message || 'Signup failed')
        }
      },

      signOut: async () => {
        set({ loading: true })
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
          set({ user: null, loading: false })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      initialize: async () => {
        console.log('🚀 Initializing auth store')
        set({ loading: true })
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          console.log('📋 Initial session:', { session: session?.user?.email || 'none', error })
          
          set({ user: session?.user || null, loading: false })

          supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state change:', event, session?.user?.email || 'no user')
            
            if (event === 'SIGNED_IN') {
              console.log('✅ User signed in, updating state')
              set({ 
                user: session?.user || null, 
                loading: false, 
                needsVerification: false,
                pendingUserData: null 
              })
            } else if (event === 'SIGNED_OUT') {
              console.log('👋 User signed out')
              set({ 
                user: null, 
                loading: false, 
                needsVerification: false,
                pendingUserData: null 
              })
            } else if (event === 'TOKEN_REFRESHED') {
              console.log('🔄 Token refreshed')
              set({ user: session?.user || null, loading: false })
            }
          })
        } catch (error) {
          console.error('❌ Auth initialization error:', error)
          set({ loading: false, user: null })
        }
      },

      clearVerification: () => {
        set({ needsVerification: false, verificationEmail: null, pendingUserData: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        needsVerification: state.needsVerification,
        verificationEmail: state.verificationEmail,
        pendingUserData: state.pendingUserData
      }),
    }
  )
)