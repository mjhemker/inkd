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
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          
          // Check if user exists and is confirmed
          if (!data.user) {
            throw new Error('Sign in failed - no user returned')
          }
          
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
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      signUp: async (email: string, password: string, userData?: any) => {
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          })
          if (error) throw error
          
          // Check if user needs email verification
          const needsVerification = !data.session && data.user && !data.user.email_confirmed_at
          
          if (needsVerification) {
            set({ 
              loading: false, 
              needsVerification: true, 
              verificationEmail: email,
              pendingUserData: userData,
              user: null 
            })
            return { needsVerification: true }
          }
          
          // If user is confirmed, create profile
          if (data.user && userData) {
            const { error: profileError } = await supabase
              .from('users')
              .insert([
                {
                  id: data.user.id,
                  email: data.user.email!,
                  ...userData,
                }
              ])
            if (profileError) throw profileError
          }
          
          set({ user: data.user, loading: false, needsVerification: false })
          return { needsVerification: false }
        } catch (error) {
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
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const { pendingUserData } = get()
              
              // If user just verified email and we have pending data, create their profile
              if (session?.user && pendingUserData && event === 'SIGNED_IN') {
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
              
              set({ 
                user: session?.user || null, 
                loading: false, 
                needsVerification: false,
                pendingUserData: null 
              })
            } else if (event === 'SIGNED_OUT') {
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
      partialize: (state) => ({ user: state.user }),
    }
  )
)