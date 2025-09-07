'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/lib/auth'
import { getRoleDisplayName } from '@/lib/roles'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'

interface UserProfileProps {
  className?: string
}

export default function UserProfile({ className = '' }: UserProfileProps) {
  const { authUser, userRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  if (!authUser) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          {authUser.avatar_url ? (
            <img
              src={authUser.avatar_url}
              alt={authUser.name || 'User'}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">
            {authUser.name || '사용자'}
          </p>
          <p className="text-xs text-gray-500">{authUser.email}</p>
          {userRole && (
            <p className="text-xs text-blue-600 font-medium">
              {getRoleDisplayName(userRole)}
            </p>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {authUser.name || '사용자'}
                </p>
                <p className="text-xs text-gray-500">{authUser.email}</p>
              </div>
              
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
