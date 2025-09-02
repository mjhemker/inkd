'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useLocalStore } from '@/store/localStore'
import ArtistCard from './ArtistCard'

export default function ArtistCarousel() {
  const {
    artists,
    selectedArtistIndex,
    userLocation,
    setSelectedArtistIndex,
  } = useLocalStore()
  
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      const cardWidth = 320
      const scrollLeft = selectedArtistIndex * cardWidth
      scrollRef.current.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      })
    }
  }, [selectedArtistIndex])

  const scrollToPrevious = () => {
    const newIndex = Math.max(0, selectedArtistIndex - 1)
    setSelectedArtistIndex(newIndex)
  }

  const scrollToNext = () => {
    const newIndex = Math.min(artists.length - 1, selectedArtistIndex + 1)
    setSelectedArtistIndex(newIndex)
  }

  const handleScroll = () => {
    if (scrollRef.current) {
      const cardWidth = 320
      const scrollLeft = scrollRef.current.scrollLeft
      const newIndex = Math.round(scrollLeft / cardWidth)
      if (newIndex !== selectedArtistIndex) {
        setSelectedArtistIndex(newIndex)
      }
    }
  }

  if (artists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No artists found in this area</p>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Navigation arrows */}
      <button
        onClick={scrollToPrevious}
        disabled={selectedArtistIndex === 0}
        className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
      </button>
      
      <button
        onClick={scrollToNext}
        disabled={selectedArtistIndex === artists.length - 1}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRightIcon className="h-5 w-5 text-gray-600" />
      </button>

      {/* Scrollable artist cards */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide h-full"
        style={{ scrollSnapType: 'x mandatory' }}
        onScroll={handleScroll}
      >
        {artists.map((artist, index) => (
          <div
            key={artist.id}
            className="flex-shrink-0 p-4 h-full flex items-center"
            style={{ scrollSnapAlign: 'start', width: '320px' }}
          >
            <ArtistCard artist={artist} userLocation={userLocation} />
          </div>
        ))}
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1">
        {artists.map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedArtistIndex(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === selectedArtistIndex ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
}