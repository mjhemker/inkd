import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AssistantMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  metadata?: {
    suggested_reply?: boolean
    appointment_request?: boolean
    market_research?: boolean
  }
}

interface AssistantReport {
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

interface AssistantState {
  messages: AssistantMessage[]
  reports: AssistantReport[]
  loading: boolean
  settings: {
    enabled: boolean
    preferences: any
  }
  fetchMessages: (artistId: string) => Promise<void>
  fetchReports: (artistId: string) => Promise<void>
  fetchSettings: (artistId: string) => Promise<void>
  sendMessage: (content: string, artistId: string) => Promise<void>
  requestMarketResearch: (query: string, artistId: string, region?: string, timeStart?: string, timeEnd?: string) => Promise<void>
  updateSettings: (artistId: string, settings: { enabled: boolean; preferences?: any }) => Promise<void>
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  messages: [],
  reports: [],
  loading: false,
  settings: {
    enabled: true,
    preferences: {},
  },

  fetchMessages: async (artistId: string) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${artistId},receiver_id.eq.${artistId}`)
        .order('timestamp', { ascending: true })

      if (error) throw error
      
      const formattedMessages: AssistantMessage[] = (data || []).map(msg => ({
        id: msg.id,
        content: msg.message,
        role: msg.sender_id === artistId ? 'user' : 'assistant',
        timestamp: msg.timestamp,
      }))

      set({ messages: formattedMessages, loading: false })
    } catch (error) {
      console.error('Error fetching messages:', error)
      set({ loading: false })
    }
  },

  fetchReports: async (artistId: string) => {
    try {
      const { data, error } = await supabase
        .from('assistant_reports')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ reports: data || [] })
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
  },

  fetchSettings: async (artistId: string) => {
    try {
      const { data, error } = await supabase
        .from('assistant_settings')
        .select('*')
        .eq('artist_id', artistId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        set({
          settings: {
            enabled: data.enabled,
            preferences: data.preferences || {},
          }
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  },

  sendMessage: async (content: string, artistId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            receiver_id: 'assistant',
            message: content,
          }
        ])
        .select()
        .single()

      if (error) throw error

      const { messages } = get()
      const newMessage: AssistantMessage = {
        id: data.id,
        content,
        role: 'user',
        timestamp: data.timestamp,
      }

      set({ messages: [...messages, newMessage] })

      setTimeout(() => {
        const assistantReply: AssistantMessage = {
          id: `assistant-${Date.now()}`,
          content: "Thanks for your message! I'm here to help with bookings and inquiries. This is a demo response.",
          role: 'assistant',
          timestamp: new Date().toISOString(),
          metadata: { suggested_reply: true }
        }
        const { messages: currentMessages } = get()
        set({ messages: [...currentMessages, assistantReply] })
      }, 1000)

    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  },

  requestMarketResearch: async (query: string, artistId: string, region?: string, timeStart?: string, timeEnd?: string) => {
    try {
      const { data, error } = await supabase
        .from('assistant_reports')
        .insert([
          {
            artist_id: artistId,
            query,
            region: region || null,
            time_start: timeStart || null,
            time_end: timeEnd || null,
            status: 'pending',
          }
        ])
        .select()
        .single()

      if (error) throw error

      const { reports } = get()
      set({ reports: [data, ...reports] })

      setTimeout(async () => {
        const { error: updateError } = await supabase
          .from('assistant_reports')
          .update({
            status: 'completed',
            summary: 'Based on analysis of public data, traditional and geometric styles are trending in this region.',
            methodology: 'Data aggregated from public social media posts, artist portfolios, and tattoo convention data.',
            sources: [
              { title: 'Instagram Tattoo Hashtag Analysis', url: 'https://example.com' },
              { title: 'Artist Portfolio Trends', url: 'https://example.com' },
              { title: 'Convention Style Reports', url: 'https://example.com' }
            ],
            confidence: 'medium'
          })
          .eq('id', data.id)

        if (!updateError) {
          get().fetchReports(artistId)
        }
      }, 3000)

    } catch (error) {
      console.error('Error requesting market research:', error)
      throw error
    }
  },

  updateSettings: async (artistId: string, settings: { enabled: boolean; preferences?: any }) => {
    try {
      const { error } = await supabase
        .from('assistant_settings')
        .upsert({
          artist_id: artistId,
          enabled: settings.enabled,
          preferences: settings.preferences || {},
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      set({ settings })
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  },
}))