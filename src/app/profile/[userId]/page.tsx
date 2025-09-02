'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useProfileStore } from '@/store/profileStore'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ProfileTabs from '@/components/profile/ProfileTabs'

export default function ProfilePage() {
  const params = useParams()
  const userId = params.userId as string
  const { profile, loading, fetchProfile } = useProfileStore()

  useEffect(() => {
    if (userId) {
      fetchProfile(userId)
    }
  }, [userId, fetchProfile])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
            <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse mx-auto md:mx-0" />
            <div className="flex-1 space-y-3 mt-4 md:mt-0">
              <div className="h-8 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm h-64 animate-pulse" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Profile not found</h1>
        <p className="text-gray-600 mt-2">This user does not exist or is private.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} />
      <ProfileTabs userId={userId} />
    </div>
  )
}