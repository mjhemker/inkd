'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import AssistantChat from '@/components/assistant/AssistantChat'
import MarketResearch from '@/components/assistant/MarketResearch'

export default function AssistantPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'research'>('chat')
  const { user } = useAuthStore()

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Sign in required</h1>
        <p className="text-gray-600 mt-2">Please sign in to access the AI assistant.</p>
      </div>
    )
  }

  const tabs = [
    { id: 'chat', name: 'Chat' },
    { id: 'research', name: 'Market Research' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'chat' && <AssistantChat />}
          {activeTab === 'research' && <MarketResearch />}
        </div>
      </div>
    </div>
  )
}