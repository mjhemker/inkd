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
  ClockIcon
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollarIcon className="w-8 h-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Revenue</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">$12,450</p>
          <p className="text-sm text-gray-600">This month</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <CalendarIcon className="w-8 h-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Bookings</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">23</p>
          <p className="text-sm text-gray-600">Next 30 days</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <ChartBarIcon className="w-8 h-8 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Growth</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">+18%</p>
          <p className="text-sm text-gray-600">Profile views</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Services</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Small Tattoo (&lt; 3 inches)</span>
              <span className="font-medium">$150 - $300</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-700">Medium Tattoo (3-6 inches)</span>
              <span className="font-medium">$300 - $600</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Large Tattoo (6+ inches)</span>
              <span className="font-medium">$600+</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Monday - Friday</span>
              <span className="text-gray-600">10:00 AM - 7:00 PM</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Saturday</span>
              <span className="text-gray-600">9:00 AM - 5:00 PM</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Sunday</span>
              <span className="text-gray-600">Closed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderArtistBookingsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Bookings</h3>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Block Time
        </button>
      </div>
      
      <div className="space-y-4">
        {[
          { client: 'Sarah Johnson', date: 'Dec 15, 2024', time: '2:00 PM', service: 'Small Floral Design', status: 'confirmed' },
          { client: 'Mike Chen', date: 'Dec 18, 2024', time: '11:00 AM', service: 'Touch-up Session', status: 'pending' },
          { client: 'Emma Davis', date: 'Dec 22, 2024', time: '1:00 PM', service: 'Large Back Piece - Session 2', status: 'confirmed' },
        ].map((booking, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-900">{booking.client}</h4>
                <p className="text-sm text-gray-600">{booking.service}</p>
                <p className="text-sm text-gray-500">{booking.date} at {booking.time}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                booking.status === 'confirmed' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {booking.status}
              </span>
            </div>
          </div>
        ))}
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
          <p className="text-2xl font-bold text-gray-900">1,247</p>
          <p className="text-xs text-green-600">+23% this week</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <HeartIcon className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-600">Likes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">856</p>
          <p className="text-xs text-green-600">+15% this week</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookmarkIcon className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600">Saves</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">342</p>
          <p className="text-xs text-green-600">+8% this week</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ChatBubbleLeftIcon className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Inquiries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">28</p>
          <p className="text-xs text-green-600">+12% this week</p>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Content</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {posts.slice(0, 4).map((post) => (
            <div key={post.id} className="space-y-2">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={post.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs text-gray-600">
                <p>156 likes • 23 saves</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderClientSavedTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Saved Posts</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer">
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <BookmarkIcon className="w-8 h-8 text-white opacity-60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderClientMessagesTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Messages</h3>
      <div className="space-y-3">
        {[
          { artist: 'Alex Rivera', preview: 'Thanks for your interest! I have availability next week...', time: '2 hours ago', unread: true },
          { artist: 'Maya Chen', preview: 'Here are some design options for your sleeve...', time: '1 day ago', unread: false },
          { artist: 'Jordan Smith', preview: 'Your appointment is confirmed for Friday at 3 PM', time: '3 days ago', unread: false },
        ].map((message, index) => (
          <div key={index} className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer ${message.unread ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className={`font-medium ${message.unread ? 'text-blue-900' : 'text-gray-900'}`}>
                  {message.artist}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{message.preview}</p>
              </div>
              <span className="text-xs text-gray-500">{message.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderClientFavoritesTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Favorite Artists</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Alex Rivera', handle: '@alexink', location: 'Los Angeles, CA', style: 'Neo-Traditional' },
          { name: 'Maya Chen', handle: '@mayatattoos', location: 'San Francisco, CA', style: 'Minimalist' },
          { name: 'Jordan Smith', handle: '@jordanartistry', location: 'Portland, OR', style: 'Blackwork' },
        ].map((artist, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{artist.name}</h4>
                <p className="text-sm text-gray-600">{artist.handle}</p>
                <p className="text-xs text-gray-500">{artist.location} • {artist.style}</p>
              </div>
              <button className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                View
              </button>
            </div>
          </div>
        ))}
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

        return (
          <div className="space-y-8">
            {portfolioLoading ? (
              <div className="space-y-6">
                {['Tattoos', 'Flashes', 'Designs'].map((category) => (
                  <div key={category}>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{category}</h3>
                    <div className="flex space-x-4 overflow-x-auto">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-48 h-48 bg-gray-200 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(portfolioByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">
                    {category}s
                  </h3>
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
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No {category}s yet</p>
                  )}
                </div>
              ))
            )}
            
            {!portfolioLoading && Object.keys(portfolioByCategory).length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No portfolio items yet</p>
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