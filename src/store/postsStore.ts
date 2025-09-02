import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface Post {
  id: string
  user_id: string
  image_url: string
  description: string | null
  location: string | null
  tags: string[] | null
  created_at: string
  user?: {
    name: string | null
    handle: string | null
    profile_img: string | null
  }
}

interface PostsState {
  posts: Post[]
  loading: boolean
  dailyHighlights: {
    artworkOfTheDay: Post | null
    artistOfTheDay: any | null
    suggestions: Post[]
  } | null
  fetchPosts: () => Promise<void>
  fetchDailyHighlights: () => Promise<void>
  createPost: (postData: {
    image_url: string
    description?: string
    location?: string
    tags?: string[]
  }) => Promise<void>
  refreshFeed: () => Promise<void>
}

export const usePostsStore = create<PostsState>((set, get) => ({
  posts: [],
  loading: false,
  dailyHighlights: null,

  fetchPosts: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:users(name, handle, profile_img)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      set({ posts: data || [], loading: false })
    } catch (error) {
      console.error('Error fetching posts:', error)
      set({ loading: false })
    }
  },

  fetchDailyHighlights: async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_highlights')
        .select('*')
        .eq('date', today)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        let artworkOfTheDay = null
        let artistOfTheDay = null
        let suggestions = []

        if (data.artwork_post_id) {
          const { data: postData } = await supabase
            .from('posts')
            .select('*, user:users(name, handle, profile_img)')
            .eq('id', data.artwork_post_id)
            .single()
          artworkOfTheDay = postData
        }

        if (data.artist_user_id) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.artist_user_id)
            .single()
          artistOfTheDay = userData
        }

        if (data.suggestions) {
          const suggestionIds = Array.isArray(data.suggestions) ? data.suggestions : []
          if (suggestionIds.length > 0) {
            const { data: suggestionsData } = await supabase
              .from('posts')
              .select('*, user:users(name, handle, profile_img)')
              .in('id', suggestionIds)
            suggestions = suggestionsData || []
          }
        }

        set({
          dailyHighlights: {
            artworkOfTheDay,
            artistOfTheDay,
            suggestions,
          }
        })
      }
    } catch (error) {
      console.error('Error fetching daily highlights:', error)
    }
  },

  createPost: async (postData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            user_id: user.id,
            ...postData,
          }
        ])
        .select('*, user:users(name, handle, profile_img)')
        .single()

      if (error) throw error

      const { posts } = get()
      set({ posts: [data, ...posts] })
    } catch (error) {
      console.error('Error creating post:', error)
      throw error
    }
  },

  refreshFeed: async () => {
    await get().fetchPosts()
    await get().fetchDailyHighlights()
  },
}))