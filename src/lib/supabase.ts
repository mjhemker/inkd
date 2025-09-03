import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🔧 Supabase Config:', { 
  url: supabaseUrl ? '✅ Set' : '❌ Missing', 
  key: supabaseAnonKey ? '✅ Set' : '❌ Missing',
  urlStart: supabaseUrl?.substring(0, 20) + '...',
  keyStart: supabaseAnonKey?.substring(0, 20) + '...'
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
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
        Insert: {
          id: string
          email: string
          name?: string | null
          handle?: string | null
          profile_img?: string | null
          styles?: string[] | null
          locations?: string[] | null
          bio?: string | null
          links?: any | null
          lat?: number | null
          lng?: number | null
          is_artist?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          handle?: string | null
          profile_img?: string | null
          styles?: string[] | null
          locations?: string[] | null
          bio?: string | null
          links?: any | null
          lat?: number | null
          lng?: number | null
          is_artist?: boolean
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          image_url: string
          description: string | null
          location: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          description?: string | null
          location?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string
          description?: string | null
          location?: string | null
          tags?: string[] | null
          created_at?: string
        }
      }
      portfolio: {
        Row: {
          id: string
          user_id: string
          image_url: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string
          category?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          message: string
          timestamp: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          message: string
          timestamp?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          message?: string
          timestamp?: string
        }
      }
      appointments: {
        Row: {
          id: string
          artist_id: string
          user_id: string
          date_time: string
          status: string
        }
        Insert: {
          id?: string
          artist_id: string
          user_id: string
          date_time: string
          status: string
        }
        Update: {
          id?: string
          artist_id?: string
          user_id?: string
          date_time?: string
          status?: string
        }
      }
      daily_highlights: {
        Row: {
          id: string
          date: string
          artwork_post_id: string | null
          artist_user_id: string | null
          suggestions: any | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          date: string
          artwork_post_id?: string | null
          artist_user_id?: string | null
          suggestions?: any | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          date?: string
          artwork_post_id?: string | null
          artist_user_id?: string | null
          suggestions?: any | null
          created_at?: string
          expires_at?: string | null
        }
      }
      assistant_events: {
        Row: {
          id: string
          artist_id: string
          type: string
          payload: any | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          type: string
          payload?: any | null
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          type?: string
          payload?: any | null
          status?: string
          created_at?: string
        }
      }
      assistant_settings: {
        Row: {
          artist_id: string
          enabled: boolean
          preferences: any | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          enabled?: boolean
          preferences?: any | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          enabled?: boolean
          preferences?: any | null
          updated_at?: string
        }
      }
      assistant_reports: {
        Row: {
          id: string
          artist_id: string
          query: string
          region: string | null
          time_start: string | null
          time_end: string | null
          methodology: string | null
          summary: string | null
          sources: any | null
          confidence: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          artist_id: string
          query: string
          region?: string | null
          time_start?: string | null
          time_end?: string | null
          methodology?: string | null
          summary?: string | null
          sources?: any | null
          confidence?: string | null
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          artist_id?: string
          query?: string
          region?: string | null
          time_start?: string | null
          time_end?: string | null
          methodology?: string | null
          summary?: string | null
          sources?: any | null
          confidence?: string | null
          status?: string
          created_at?: string
        }
      }
    }
  }
}