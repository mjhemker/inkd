import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  name: string | null
  handle: string | null
  profile_img: string | null
  styles: string[] | null
  locations: string[] | null
  bio: string | null
  links: any | null
  lat: number | null
  lng: number | null
  is_artist: boolean
  created_at: string
}

interface Post {
  id: string
  user_id: string
  image_url: string
  description: string | null
  location: string | null
  tags: string[] | null
  created_at: string
}

interface PortfolioItem {
  id: string
  user_id: string
  image_url: string
  category: string
  created_at: string
}

interface ProfileState {
  profile: User | null
  posts: Post[]
  portfolio: PortfolioItem[]
  loading: boolean
  postsLoading: boolean
  portfolioLoading: boolean
  fetchProfile: (userId: string) => Promise<void>
  fetchUserPosts: (userId: string) => Promise<void>
  fetchUserPortfolio: (userId: string) => Promise<void>
  addPortfolioItem: (item: Omit<PortfolioItem, 'id' | 'created_at'>) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  posts: [],
  portfolio: [],
  loading: false,
  postsLoading: false,
  portfolioLoading: false,

  fetchProfile: async (userId: string) => {
    console.log('🔍 Fetching profile for user:', userId)
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Profile fetch error:', error)
        
        // If user doesn't exist in database, try to create from auth user
        if (error.code === 'PGRST116' || error.message.includes('No rows')) {
          console.log('👤 User not found in database, checking if this is current auth user')
          
          // Get current auth user
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser && authUser.id === userId) {
            console.log('✅ This is the current auth user, creating profile')
            // Create user profile from auth data
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert([{
                id: authUser.id,
                email: authUser.email!,
                name: authUser.user_metadata?.name || null,
                handle: authUser.user_metadata?.handle || null,
                is_artist: authUser.user_metadata?.is_artist || false,
              }])
              .select()
              .single()
            
            if (createError) {
              console.error('❌ Failed to create user profile:', createError)
              throw createError
            }
            
            console.log('✅ Created user profile:', newUser)
            set({ profile: newUser, loading: false })
            return
          }
        }
        
        throw error
      }
      
      console.log('✅ Profile fetched successfully:', data)
      set({ profile: data, loading: false })
    } catch (error) {
      console.error('❌ Error fetching profile:', error)
      set({ profile: null, loading: false })
    }
  },

  fetchUserPosts: async (userId: string) => {
    set({ postsLoading: true })
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ posts: data || [], postsLoading: false })
    } catch (error) {
      console.error('Error fetching user posts:', error)
      set({ postsLoading: false })
    }
  },

  fetchUserPortfolio: async (userId: string) => {
    set({ portfolioLoading: true })
    try {
      const { data, error } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ portfolio: data || [], portfolioLoading: false })
    } catch (error) {
      console.error('Error fetching user portfolio:', error)
      set({ portfolioLoading: false })
    }
  },

  addPortfolioItem: async (item) => {
    try {
      const { data, error } = await supabase
        .from('portfolio')
        .insert([item])
        .select()
        .single()

      if (error) throw error

      const { portfolio } = get()
      set({ portfolio: [data, ...portfolio] })
    } catch (error) {
      console.error('Error adding portfolio item:', error)
      throw error
    }
  },
}))