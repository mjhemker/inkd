'use client'

import Link from 'next/link'
import { MapPinIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

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

interface ArtistCardProps {
  artist: Artist
  userLocation?: { lat: number; lng: number } | null
}

export default function ArtistCard({ artist, userLocation }: ArtistCardProps) {
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 3959
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const distance = userLocation && artist.lat && artist.lng
    ? calculateDistance(userLocation.lat, userLocation.lng, artist.lat, artist.lng)
    : null

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start space-x-4">
        <img
          src={artist.profile_img || '/default-avatar.svg'}
          alt=""
          className="w-16 h-16 rounded-full bg-gray-200 object-cover"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {artist.name || artist.handle}
            </h3>
            {distance && (
              <div className="flex items-center text-sm text-gray-500">
                <MapPinIcon className="h-4 w-4 mr-1" />
                <span>{distance.toFixed(1)} mi</span>
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600">@{artist.handle}</p>
          
          {artist.styles && artist.styles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {artist.styles.slice(0, 3).map((style) => (
                <span
                  key={style}
                  className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-full"
                >
                  {style}
                </span>
              ))}
              {artist.styles.length > 3 && (
                <span className="text-xs text-gray-500">+{artist.styles.length - 3}</span>
              )}
            </div>
          )}
          
          {artist.bio && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {artist.bio}
            </p>
          )}
          
          <div className="flex space-x-2 mt-4">
            <Link
              href={`/profile/${artist.id}`}
              className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 text-center"
            >
              View Profile
            </Link>
            <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center">
              <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
              Message
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}