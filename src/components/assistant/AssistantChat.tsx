'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useAssistantStore } from '@/store/assistantStore'
import { useAuthStore } from '@/store/authStore'

export default function AssistantChat() {
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const { messages, sendMessage, fetchMessages } = useAssistantStore()

  useEffect(() => {
    if (user?.id) {
      fetchMessages(user.id)
    }
  }, [user, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !user?.id || loading) return

    setLoading(true)
    try {
      await sendMessage(inputMessage, user.id)
      setInputMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarketResearchRequest = () => {
    const query = "/trend styles in California last year"
    setInputMessage(query)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm h-96 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="font-medium text-gray-900">AI Assistant</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Get help with bookings, inquiries, and market research
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <SparklesIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="text-gray-500 mt-2">Start a conversation with your AI assistant</p>
            <button
              onClick={handleMarketResearchRequest}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
            >
              Try: "What are trending tattoo styles?"
            </button>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.metadata?.suggested_reply && (
                  <div className="text-xs text-indigo-600 mb-1 flex items-center">
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    AI Suggestion
                  </div>
                )}
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask your assistant anything..."
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}