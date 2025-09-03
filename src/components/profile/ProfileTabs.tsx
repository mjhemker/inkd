'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useProfileStore } from '@/store/profileStore'
import { useAuthStore } from '@/store/authStore'
import { 
  CalendarIcon, 
  ChartBarIcon, 
  CurrencyDollarIcon,
  BookmarkIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  BriefcaseIcon,
  ClockIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

interface ProfileTabsProps {
  userId: string
}

type ArtistTab = 'info' | 'posts' | 'portfolio' | 'bookings' | 'analytics' | 'business'
type ClientTab = 'info' | 'posts' | 'saved' | 'messages' | 'favorites'

export default function ProfileTabs({ userId }: ProfileTabsProps) {
  const { user } = useAuthStore()
  const isOwnProfile = user?.id === userId
  
  const [activeTab, setActiveTab] = useState<ArtistTab | ClientTab>('info')
  const {
    profile,
    posts,
    portfolio,
    postsLoading,
    portfolioLoading,
    fetchUserPosts,
    fetchUserPortfolio,
  } = useProfileStore()

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchUserPosts(userId)
    } else if (activeTab === 'portfolio') {
      fetchUserPortfolio(userId)
    }
  }, [activeTab, userId, fetchUserPosts, fetchUserPortfolio])

  const getTabsForUserType = () => {
    if (profile?.is_artist) {
      const artistTabs = [
        { id: 'info', name: 'Info', icon: null },
        { id: 'posts', name: 'Posts', icon: null },
        { id: 'portfolio', name: 'Portfolio', icon: null },
      ]
      
      if (isOwnProfile) {
        artistTabs.push(
          { id: 'bookings', name: 'Bookings', icon: CalendarIcon },
          { id: 'analytics', name: 'Analytics', icon: ChartBarIcon },
          { id: 'business', name: 'Business', icon: BriefcaseIcon }
        )
      }
      
      return artistTabs
    } else {
      const clientTabs = [
        { id: 'info', name: 'Info', icon: null },
        { id: 'posts', name: 'Posts', icon: null },
      ]
      
      if (isOwnProfile) {
        clientTabs.push(
          { id: 'saved', name: 'Saved', icon: BookmarkIcon },
          { id: 'messages', name: 'Messages', icon: ChatBubbleLeftIcon },
          { id: 'favorites', name: 'Favorites', icon: HeartIcon }
        )
      }
      
      return clientTabs
    }
  }

  const tabs = getTabsForUserType()

  const renderArtistBusinessTab = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Business Tools</h3>
          <Link 
            href="/assistant"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            AI Assistant →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <CalendarIcon className="w-6 h-6 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">Schedule</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Invoicing</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ChartBarIcon className="w-6 h-6 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Reports</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <BriefcaseIcon className="w-6 h-6 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Inventory</span>
          </button>
        </div>
      </div>
      
      <div className="text-center py-12">
        <p className="text-gray-500">Set up your business profile to get started with analytics and revenue tracking</p>
      </div>
    </div>
  )

  const renderArtistBookingsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Bookings</h3>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Manage Calendar
        </button>
      </div>
      
      <div className="text-center py-12">
        <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No upcoming bookings</p>
        <p className="text-sm text-gray-400">Clients will be able to book appointments with you here</p>
      </div>
    </div>
  )

  const renderArtistAnalyticsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Profile Views</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500">No data yet</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <HeartIcon className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-600">Total Likes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500">No posts yet</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookmarkIcon className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600">Total Saves</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500">No posts yet</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ChatBubbleLeftIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Inquiries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-500">No messages yet</p>
        </div>
      </div>
      
      <div className="text-center py-12">
        <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">Analytics will appear here</p>
        <p className="text-sm text-gray-400">Start posting and engaging to see your performance metrics</p>
      </div>
    </div>
  )

  const renderClientSavedTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Saved Posts</h3>
      </div>
      
      <div className="text-center py-12">
        <BookmarkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No saved posts yet</p>
        <p className="text-sm text-gray-400">Bookmark posts you love to save them here</p>
      </div>
    </div>
  )

  const renderClientMessagesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Messages</h3>
      </div>
      
      <div className="text-center py-12">
        <ChatBubbleLeftIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No messages yet</p>
        <p className="text-sm text-gray-400">Start conversations with artists you're interested in</p>
      </div>
    </div>
  )

  const renderClientFavoritesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Favorite Artists</h3>
      </div>
      
      <div className="text-center py-12">
        <HeartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No favorite artists yet</p>
        <p className="text-sm text-gray-400">Explore artists and add them to your favorites</p>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="prose max-w-none">
            {profile?.bio ? (
              <p className="text-gray-700">{profile.bio}</p>
            ) : (
              <p className="text-gray-500 italic">No bio available</p>
            )}
            
            {profile?.locations && profile.locations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Locations</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.locations.map((location) => (
                    <span
                      key={location}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile?.styles && profile.styles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.styles.map((style) => (
                    <span
                      key={style}
                      className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'posts':
        return (
          <div>
            {postsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="aspect-square bg-gray-200 rounded-lg overflow-hidden group"
                  >
                    <img
                      src={post.image_url}
                      alt={post.description || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No posts yet</p>
              </div>
            )}
          </div>
        )

      case 'portfolio':
        if (!profile?.is_artist) {
          return (
            <div className="text-center py-12">
              <p className="text-gray-500">Only artists have portfolios</p>
            </div>
          )
        }

        const portfolioByCategory = portfolio.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = []
          }
          acc[item.category].push(item)
          return acc
        }, {} as Record<string, typeof portfolio>)

        const categories = ['tattoo', 'flash', 'design']

        return (
          <div className="space-y-6">
            {isOwnProfile && (
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Portfolio</h3>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  Add Work
                </button>
              </div>
            )}
            
            {portfolioLoading ? (
              <div className="space-y-6">
                {categories.map((category) => (
                  <div key={category}>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">{category}s</h3>
                    <div className="flex space-x-4 overflow-x-auto">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-48 h-48 bg-gray-200 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => {
                  const items = portfolioByCategory[category] || []
                  return (
                    <div key={category}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900 capitalize">
                          {category === 'tattoo' ? 'Tattoos' : category === 'flash' ? 'Flash Designs' : 'Custom Designs'}
                        </h3>
                        {isOwnProfile && (
                          <button className="text-sm text-indigo-600 hover:text-indigo-500">
                            Manage {category}s
                          </button>
                        )}
                      </div>
                      {items.length > 0 ? (
                        <div className="flex space-x-4 overflow-x-auto pb-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex-shrink-0 w-48 h-48 bg-gray-200 rounded-lg overflow-hidden group cursor-pointer"
                            >
                              <img
                                src={item.image_url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ))}
                          {isOwnProfile && (
                            <button className="flex-shrink-0 w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors group">
                              <div className="text-center">
                                <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mx-auto mb-2" />
                                <span className="text-sm text-gray-500 group-hover:text-indigo-600">Add {category}</span>
                              </div>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          {isOwnProfile ? (
                            <div>
                              <p className="text-gray-500 mb-4">No {category}s yet</p>
                              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                Add your first {category}
                              </button>
                            </div>
                          ) : (
                            <p className="text-gray-500">No {category}s yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case 'bookings':
        return renderArtistBookingsTab()

      case 'analytics':
        return renderArtistAnalyticsTab()

      case 'business':
        return renderArtistBusinessTab()

      case 'saved':
        return renderClientSavedTab()

      case 'messages':
        return renderClientMessagesTab()

      case 'favorites':
        return renderClientFavoritesTab()

      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 px-6 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors rounded-t-lg ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  )
}