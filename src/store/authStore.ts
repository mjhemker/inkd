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
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          
          console.log('📋 Sign in response:', { data, error })
          
          if (error) throw error
          
          // Check if user exists and is confirmed
          if (!data.user) {
            throw new Error('Sign in failed - no user returned')
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
          
          set({ 
            user: data.user, 
            loading: false, 
            needsVerification: false,
            verificationEmail: null 
          })
          
          console.log('🎯 Auth state updated with user')
        } catch (error) {
          console.error('❌ Sign in error:', error)
          set({ loading: false })
          throw error
        }
      },

      signUp: async (email: string, password: string, userData?: any) => {
        console.log('📝 Starting signup for:', email)
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          })
          
          console.log('📋 Signup response:', { data, error })
          
          if (error) throw error
          
          // Since email confirmation is disabled, user should be immediately signed in
          if (!data.user) {
            throw new Error('Signup failed - no user returned')
          }
          
          console.log('👤 Creating user profile')
          
          // Create user profile immediately
          if (userData) {
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
              console.error('Profile creation error:', profileError)
              throw new Error('Failed to create user profile')
            }
          }
          
          console.log('✅ Signup completed, setting user state')
          set({ 
            user: data.user, 
            loading: false, 
            needsVerification: false,
            verificationEmail: null,
            pendingUserData: null
          })
          
          return { needsVerification: false }
        } catch (error) {
          console.error('❌ Signup error:', error)
          set({ loading: false })
          throw error
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
        set({ loading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          set({ user: session?.user || null, loading: false })

          supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state change:', event, session?.user?.email || 'no user')
            
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const { pendingUserData } = get()
              
              // If user just verified email and we have pending data, create their profile
              if (session?.user && pendingUserData && event === 'SIGNED_IN') {
                console.log('👤 Creating profile for verified user')
                try {
                  const { error: profileError } = await supabase
                    .from('users')
                    .insert([
                      {
                        id: session.user.id,
                        email: session.user.email!,
                        ...pendingUserData,
                      }
                    ])
                  if (profileError) {
                    console.error('Error creating profile after verification:', profileError)
                  }
                } catch (error) {
                  console.error('Error creating profile:', error)
                }
              }
              
              console.log('✅ Setting user in state:', session?.user?.email)
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
            }
          })
        } catch (error) {
          set({ loading: false })
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