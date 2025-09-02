'use client'

import { CalendarIcon, ChatBubbleLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'

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

interface ProfileHeaderProps {
  profile: User
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { user } = useAuthStore()
  const isOwnProfile = user?.id === profile.id

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
        {/* Profile image */}
        <div className="flex-shrink-0 mx-auto md:mx-0">
          <img
            src={profile.profile_img || '/default-avatar.svg'}
            alt=""
            className="w-32 h-32 rounded-full bg-gray-200 object-cover"
          />
        </div>

        {/* Profile info */}
        <div className="flex-1 text-center md:text-left mt-4 md:mt-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.name || profile.handle}
          </h1>
          {profile.handle && (
            <p className="text-lg text-gray-600">@{profile.handle}</p>
          )}
          
          {profile.bio && (
            <p className="text-gray-700 mt-2 max-w-2xl">{profile.bio}</p>
          )}

          {/* Styles */}
          {profile.styles && profile.styles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {profile.styles.map((style) => (
                <span
                  key={style}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-full"
                >
                  {style}
                </span>
              ))}
            </div>
          )}

          {/* Locations */}
          {profile.locations && profile.locations.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                📍 {profile.locations.join(', ')}
              </p>
            </div>
          )}

          {/* External links */}
          {profile.links && (
            <div className="flex flex-wrap gap-3 mt-3 justify-center md:justify-start">
              {Object.entries(profile.links).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  {platform}
                </a>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6 justify-center md:justify-start">
            {!isOwnProfile && (
              <>
                {profile.is_artist && (
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">
                    Book
                  </button>
                )}
                <button className="flex items-center space-x-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Calendar</span>
                </button>
                <button className="flex items-center space-x-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                  <span>Message</span>
                </button>
              </>
            )}
            
            {isOwnProfile && (
              <button className="flex items-center space-x-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                <Cog6ToothIcon className="h-4 w-4" />
                <span>Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}