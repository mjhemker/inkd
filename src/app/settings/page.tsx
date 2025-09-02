'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useAssistantStore } from '@/store/assistantStore'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { settings, fetchSettings, updateSettings } = useAssistantStore()
  const [assistantEnabled, setAssistantEnabled] = useState(settings.enabled)

  useEffect(() => {
    if (user?.id) {
      fetchSettings(user.id)
    }
  }, [user, fetchSettings])

  useEffect(() => {
    setAssistantEnabled(settings.enabled)
  }, [settings.enabled])

  const handleSaveSettings = async () => {
    if (!user?.id) return

    try {
      await updateSettings(user.id, {
        enabled: assistantEnabled,
        preferences: settings.preferences,
      })
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Sign in required</h1>
        <p className="text-gray-600 mt-2">Please sign in to access settings.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* AI Assistant Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">AI Assistant</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable AI Assistant</h3>
              <p className="text-sm text-gray-600">
                Get help with booking requests, customer inquiries, and market research
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={assistantEnabled}
                onChange={(e) => setAssistantEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="text-sm text-gray-900 mt-1">{user.email}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">User ID</label>
            <p className="text-sm text-gray-500 mt-1 font-mono">{user.id}</p>
          </div>
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Notifications</h2>
        <p className="text-gray-500">Notification settings coming soon...</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Privacy</h2>
        <p className="text-gray-500">Privacy settings coming soon...</p>
      </div>
    </div>
  )
}