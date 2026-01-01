'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/lib/auth'
import { getRoleDisplayName } from '@/lib/roles'
import { User, LogOut, Settings, ChevronDown, Shield, Home, UserCheck, FileText } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface UserProfileProps {
  className?: string
}

export default function UserProfile({ className = '' }: UserProfileProps) {
  const { authUser, userRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('common')

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  const handleMenuClick = () => {
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
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {authUser.name || '사용자'}
                </p>
                <p className="text-xs text-gray-500">{authUser.email}</p>
                {userRole && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    {getRoleDisplayName(userRole)}
                  </p>
                )}
              </div>
              
              {/* 직원인 경우 관리자 페이지와 고객 페이지 메뉴 표시 */}
              {userRole && userRole !== 'customer' && (
                <>
                  <Link
                    href={`/${locale}/admin`}
                    onClick={handleMenuClick}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {t('adminPage')}
                  </Link>
                  
                  <Link
                    href={`/${locale}/dashboard`}
                    onClick={handleMenuClick}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    {t('customerPage')}
                  </Link>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                </>
              )}
              
              {/* 고객인 경우 My Info 섹션 */}
              {userRole === 'customer' && (
                <>
                  <div className="border-t border-gray-100 my-1"></div>
                  <div className="px-4 py-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {t('myInfo')}
                    </p>
                    <Link
                      href={`/${locale}/dashboard/profile`}
                      onClick={handleMenuClick}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <User className="w-4 h-4 mr-2" />
                      {t('myInfo')}
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/pass-upload`}
                      onClick={handleMenuClick}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {t('passUpload')}
                    </Link>
                  </div>
                </>
              )}
              
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
