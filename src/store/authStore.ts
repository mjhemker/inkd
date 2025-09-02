import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signUp: (email: string, password: string, userData?: any) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,

      signIn: async (email: string, password: string, rememberMe: boolean = false) => {
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          
          // Store remember me preference
          if (rememberMe) {
            localStorage.setItem('inkd-remember-me', 'true')
            localStorage.setItem('inkd-user-email', email)
          } else {
            localStorage.removeItem('inkd-remember-me')
            localStorage.removeItem('inkd-user-email')
          }
          
          set({ user: data.user, loading: false })
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
          
          set({ user: data.user, loading: false })
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

          supabase.auth.onAuthStateChange((event, session) => {
            set({ user: session?.user || null, loading: false })
          })
        } catch (error) {
          set({ loading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)