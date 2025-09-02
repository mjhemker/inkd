import { create } from 'zustand'

interface AppState {
  currentView: 'home' | 'local' | 'profile'
  isCreateModalOpen: boolean
  selectedLocation: { lat: number; lng: number } | null
  searchQuery: string
  styleFilters: string[]
  setCurrentView: (view: 'home' | 'local' | 'profile') => void
  setCreateModalOpen: (open: boolean) => void
  setSelectedLocation: (location: { lat: number; lng: number } | null) => void
  setSearchQuery: (query: string) => void
  setStyleFilters: (filters: string[]) => void
  addStyleFilter: (filter: string) => void
  removeStyleFilter: (filter: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'home',
  isCreateModalOpen: false,
  selectedLocation: null,
  searchQuery: '',
  styleFilters: [],

  setCurrentView: (view) => set({ currentView: view }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStyleFilters: (filters) => set({ styleFilters: filters }),
  
  addStyleFilter: (filter) => {
    const { styleFilters } = get()
    if (!styleFilters.includes(filter)) {
      set({ styleFilters: [...styleFilters, filter] })
    }
  },
  
  removeStyleFilter: (filter) => {
    const { styleFilters } = get()
    set({ styleFilters: styleFilters.filter(f => f !== filter) })
  },
}))