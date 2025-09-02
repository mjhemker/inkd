import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface Artist {
  id: string
  name: string | null
  handle: string | null
  profile_img: string | null
  styles: string[] | null
  locations: string[] | null
  bio: string | null
  lat: number | null
  lng: number | null
}

interface LocalState {
  artists: Artist[]
  loading: boolean
  selectedArtistIndex: number
  searchQuery: string
  styleFilters: string[]
  isFullscreenMap: boolean
  userLocation: { lat: number; lng: number } | null
  mapViewport: {
    latitude: number
    longitude: number
    zoom: number
  }
  fetchArtists: () => Promise<void>
  setSelectedArtistIndex: (index: number) => void
  setSearchQuery: (query: string) => void
  setStyleFilters: (filters: string[]) => void
  addStyleFilter: (filter: string) => void
  removeStyleFilter: (filter: string) => void
  setFullscreenMap: (fullscreen: boolean) => void
  setUserLocation: (location: { lat: number; lng: number }) => void
  setMapViewport: (viewport: { latitude: number; longitude: number; zoom: number }) => void
  requestLocation: () => Promise<void>
}

export const useLocalStore = create<LocalState>((set, get) => ({
  artists: [],
  loading: false,
  selectedArtistIndex: 0,
  searchQuery: '',
  styleFilters: [],
  isFullscreenMap: false,
  userLocation: null,
  mapViewport: {
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 12,
  },

  fetchArtists: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_artist', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const { searchQuery, styleFilters } = get()
      let filteredArtists = data || []

      if (searchQuery) {
        filteredArtists = filteredArtists.filter(artist =>
          artist.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          artist.handle?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }

      if (styleFilters.length > 0) {
        filteredArtists = filteredArtists.filter(artist =>
          artist.styles?.some((style: string) => styleFilters.includes(style))
        )
      }

      set({ artists: filteredArtists, loading: false })
    } catch (error) {
      console.error('Error fetching artists:', error)
      set({ loading: false })
    }
  },

  setSelectedArtistIndex: (index) => {
    set({ selectedArtistIndex: index })
    const { artists } = get()
    const artist = artists[index]
    if (artist && artist.lat && artist.lng) {
      set({
        mapViewport: {
          latitude: artist.lat,
          longitude: artist.lng,
          zoom: 14,
        }
      })
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
    get().fetchArtists()
  },

  setStyleFilters: (filters) => {
    set({ styleFilters: filters })
    get().fetchArtists()
  },

  addStyleFilter: (filter) => {
    const { styleFilters } = get()
    if (!styleFilters.includes(filter)) {
      const newFilters = [...styleFilters, filter]
      set({ styleFilters: newFilters })
      get().fetchArtists()
    }
  },

  removeStyleFilter: (filter) => {
    const { styleFilters } = get()
    const newFilters = styleFilters.filter(f => f !== filter)
    set({ styleFilters: newFilters })
    get().fetchArtists()
  },

  setFullscreenMap: (fullscreen) => set({ isFullscreenMap: fullscreen }),

  setUserLocation: (location) => {
    set({ 
      userLocation: location,
      mapViewport: {
        latitude: location.lat,
        longitude: location.lng,
        zoom: 12,
      }
    })
  },

  setMapViewport: (viewport) => set({ mapViewport: viewport }),

  requestLocation: async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          get().setUserLocation(location)
          resolve()
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 600000,
        }
      )
    })
  },
}))