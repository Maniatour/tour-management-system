'use client'

import React from 'react'
import { Megaphone, Calendar, ExternalLink, ImageIcon, Users, Phone, Copy, Share2, ChevronDown, ChevronUp, Bell, BellOff, X } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import type { SupportedLanguage } from '@/lib/translation'
import type { ChatRoom } from '@/types/chat'

interface ChatHeaderProps {
  room: ChatRoom
  isPublicView: boolean
  isMobileMenuOpen: boolean
  selectedLanguage: SupportedLanguage
  callStatus: string
  availableCallUsersCount: number
  onlineParticipantsCount: number
  isPushSupported: boolean
  isPushSubscribed: boolean
  isPushLoading: boolean
  togglingActive: boolean
  onToggleRoomActive: () => void
  onToggleMobileMenu: () => void
  onShowAnnouncements: () => void
  onShowPickupSchedule: () => void
  onShowPhotoGallery: () => void
  onShowTeamInfo: () => void
  onGoToTourDetail: () => void
  onStartCall: () => void
  onCopyLink: () => void
  onShare: () => void
  onTogglePush: () => void
  onLanguageToggle: () => void
  onShowParticipants: () => void
  getLanguageFlag: () => string
}

export default function ChatHeader({
  room,
  isPublicView,
  isMobileMenuOpen,
  selectedLanguage,
  callStatus,
  availableCallUsersCount,
  onlineParticipantsCount,
  isPushSupported,
  isPushSubscribed,
  isPushLoading,
  togglingActive,
  onToggleRoomActive,
  onToggleMobileMenu,
  onShowAnnouncements,
  onShowPickupSchedule,
  onShowPhotoGallery,
  onShowTeamInfo,
  onGoToTourDetail,
  onStartCall,
  onCopyLink,
  onShare,
  onTogglePush,
  onLanguageToggle,
  onShowParticipants,
  getLanguageFlag
}: ChatHeaderProps) {
  return (
    <div className="flex-shrink-0 px-2 lg:px-3 py-2 border-b bg-white bg-opacity-90 backdrop-blur-sm shadow-sm relative">
      {!isPublicView && (
        <div className="mb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 lg:space-x-3 flex-1 min-w-0">
            </div>
          </div>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className={`mt-1 flex items-center gap-1 lg:gap-2 ${isMobileMenuOpen ? 'justify-between' : 'justify-center'} lg:justify-between`}>
        {/* 모바일: 접었을 때 아이콘만 표시 */}
        <div className={`lg:hidden flex items-center gap-2 flex-wrap justify-center flex-1 ${isMobileMenuOpen ? 'hidden' : ''}`}>
          {isPublicView && (
            <>
              <button
                onClick={onShowAnnouncements}
                className="p-2 bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200"
                title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
              >
                <Megaphone size={18} />
              </button>
              <button
                onClick={onShowPickupSchedule}
                className="p-2 bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200"
                title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
              >
                <Calendar size={18} />
              </button>
              <button
                onClick={onShowPhotoGallery}
                className="p-2 bg-violet-100 text-violet-800 rounded border border-violet-200 hover:bg-violet-200"
                title={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={onShowTeamInfo}
                className="p-2 bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200"
                title={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
              >
                <Users size={18} />
              </button>
              <button
                onClick={onStartCall}
                disabled={!room || callStatus !== 'idle' || availableCallUsersCount === 0}
                className={`p-2 rounded border ${
                  callStatus === 'connected'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : callStatus !== 'idle'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : availableCallUsersCount === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                }`}
                title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
              >
                <Phone size={18} />
              </button>
            </>
          )}
          {!isPublicView && (
            <>
              <button
                onClick={onShowAnnouncements}
                className="p-2 bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200"
                title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
              >
                <Megaphone size={18} />
              </button>
              <button
                onClick={onShowPickupSchedule}
                className="p-2 bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200"
                title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
              >
                <Calendar size={18} />
              </button>
              <button
                onClick={onGoToTourDetail}
                className="p-2 bg-purple-100 text-purple-800 rounded border border-purple-200 hover:bg-purple-200"
                title={selectedLanguage === 'ko' ? '투어 상세 페이지' : 'Tour Details'}
              >
                <ExternalLink size={18} />
              </button>
              <button
                onClick={onStartCall}
                disabled={!room || callStatus !== 'idle' || availableCallUsersCount === 0}
                className={`p-2 rounded border ${
                  callStatus === 'connected'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : callStatus !== 'idle'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : availableCallUsersCount === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                }`}
                title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
              >
                <Phone size={18} />
              </button>
            </>
          )}
          <button
            onClick={onCopyLink}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
          >
            <Copy size={18} />
          </button>
          <button
            onClick={onShare}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title={selectedLanguage === 'ko' ? '공유' : 'Share'}
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={onToggleMobileMenu}
            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
            title={selectedLanguage === 'ko' ? '펼치기' : 'Expand'}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* 데스크톱: 왼쪽 버튼 그룹 */}
        <div className="hidden lg:flex items-center gap-1 lg:gap-2 flex-wrap">
          {!isPublicView && (
            <button
              onClick={onToggleRoomActive}
              disabled={togglingActive}
              className="flex items-center focus:outline-none"
              title={room.is_active ? '비활성화' : '활성화'}
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${room.is_active ? 'bg-green-500' : 'bg-gray-300'} ${togglingActive ? 'opacity-60' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.is_active ? 'translate-x-4' : 'translate-x-1'}`}
                />
              </span>
            </button>
          )}
          <button
            onClick={onShowAnnouncements}
            className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-amber-100 text-amber-800 rounded border border-amber-200 hover:bg-amber-200 flex items-center justify-center"
            title={selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}
          >
            <Megaphone size={12} className="lg:w-3.5 lg:h-3.5" />
          </button>
          <button
            onClick={onShowPickupSchedule}
            className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200 flex items-center justify-center"
            title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
          >
            <Calendar size={12} className="lg:w-3.5 lg:h-3.5" />
          </button>
          {!isPublicView && (
            <button
              onClick={onGoToTourDetail}
              className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-purple-100 text-purple-800 rounded border border-purple-200 hover:bg-purple-200 flex items-center justify-center"
              title={selectedLanguage === 'ko' ? '투어 상세 페이지' : 'Tour Details'}
            >
              <ExternalLink size={12} className="lg:w-3.5 lg:h-3.5" />
            </button>
          )}
          {isPublicView && (
            <>
              <button
                onClick={onShowPhotoGallery}
                className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-violet-100 text-violet-800 rounded border border-violet-200 hover:bg-violet-200 flex items-center justify-center"
                title={selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}
              >
                <ImageIcon size={12} className="lg:w-3.5 lg:h-3.5" />
              </button>
              <button
                onClick={onShowTeamInfo}
                className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-indigo-100 text-indigo-800 rounded border border-indigo-200 hover:bg-indigo-200 flex items-center justify-center"
                title={selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}
              >
                <Users size={12} className="lg:w-3.5 lg:h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onStartCall}
            disabled={!room || callStatus !== 'idle' || availableCallUsersCount === 0}
            className={`px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs rounded border flex items-center justify-center ${
              callStatus === 'connected'
                ? 'bg-green-100 text-green-800 border-green-200'
                : callStatus !== 'idle'
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : availableCallUsersCount === 0
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
            }`}
            title={selectedLanguage === 'ko' ? '음성 통화' : 'Voice Call'}
          >
            <Phone size={12} className="lg:w-3.5 lg:h-3.5" />
          </button>
          {!isPublicView && (
            <button
              onClick={onShowParticipants}
              className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs rounded border bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200 flex items-center justify-center relative"
              title={selectedLanguage === 'ko' ? '참여자 목록' : 'Participants'}
            >
              <Users size={12} className="lg:w-3.5 lg:h-3.5" />
              {onlineParticipantsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                  {onlineParticipantsCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* 모바일: 접었다 폈다 할 수 있는 메뉴 */}
        <div className={`lg:hidden relative p-3 space-y-2 ${isMobileMenuOpen ? '' : 'hidden'}`}>
          {isMobileMenuOpen && (
            <>
              {!isPublicView && (
                <div>
                  <button
                    onClick={onToggleRoomActive}
                    disabled={togglingActive}
                    className="flex items-center gap-2 px-3 py-2 focus:outline-none w-full"
                  >
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${room.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${room.is_active ? 'translate-x-4' : 'translate-x-1'}`}
                      />
                    </span>
                    <span className="text-[10px] text-gray-600">{selectedLanguage === 'ko' ? '활성화' : 'Active'}</span>
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onShowAnnouncements}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg border border-amber-200 hover:bg-amber-200 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <Megaphone size={20} />
                  </div>
                  <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '공지사항' : 'Announcements'}</span>
                </button>
                <button
                  onClick={onShowPickupSchedule}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <Calendar size={20} />
                  </div>
                  <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}</span>
                </button>
              </div>
              {isPublicView && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={onShowPhotoGallery}
                    className="flex items-center gap-2 px-3 py-2 bg-violet-100 text-violet-800 rounded-lg border border-violet-200 hover:bg-violet-200 transition-colors"
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <ImageIcon size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '투어 사진' : 'Tour Photos'}</span>
                  </button>
                  <button
                    onClick={onShowTeamInfo}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors"
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Users size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '가이드 정보' : 'Guide Info'}</span>
                  </button>
                  <button
                    onClick={onStartCall}
                    disabled={!room || callStatus !== 'idle' || availableCallUsersCount === 0}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      callStatus === 'connected'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : callStatus !== 'idle'
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : availableCallUsersCount === 0
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    }`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Phone size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '통화' : 'Call'}</span>
                  </button>
                </div>
              )}
              {!isPublicView && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onStartCall}
                    disabled={!room || callStatus !== 'idle' || availableCallUsersCount === 0}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      callStatus === 'connected'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : callStatus !== 'idle'
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : availableCallUsersCount === 0
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    }`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Phone size={20} />
                    </div>
                    <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '통화' : 'Call'}</span>
                  </button>
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onCopyLink}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <Copy size={20} />
              </div>
              <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '복사' : 'Copy'}</span>
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <Share2 size={20} />
              </div>
              <span className="text-[10px] font-medium">{selectedLanguage === 'ko' ? '공유' : 'Share'}</span>
            </button>
            <button
              onClick={onToggleMobileMenu}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                {isMobileMenuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
              <span className="text-[10px] font-medium">{isMobileMenuOpen ? (selectedLanguage === 'ko' ? '접기' : 'Collapse') : (selectedLanguage === 'ko' ? '펼치기' : 'Expand')}</span>
            </button>
          </div>
        </div>

        {/* 데스크톱: 오른쪽 버튼 그룹 */}
        <div className="hidden lg:flex items-center space-x-1 lg:space-x-2">
          <button
            onClick={onCopyLink}
            className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title={selectedLanguage === 'ko' ? '링크 복사' : 'Copy Link'}
          >
            <Copy size={14} className="lg:w-4 lg:h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title={selectedLanguage === 'ko' ? '공유' : 'Share'}
          >
            <Share2 size={14} className="lg:w-4 lg:h-4" />
          </button>
          {isPublicView && isPushSupported && (
            <button
              onClick={onTogglePush}
              disabled={isPushLoading}
              className={`p-1.5 lg:p-2 rounded transition-colors ${
                isPushSubscribed
                  ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={selectedLanguage === 'ko' 
                ? (isPushSubscribed ? '푸시 알림 비활성화' : '푸시 알림 활성화')
                : (isPushSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications')}
            >
              {isPushSubscribed ? (
                <Bell size={14} className="lg:w-4 lg:h-4" />
              ) : (
                <BellOff size={14} className="lg:w-4 lg:h-4" />
              )}
            </button>
          )}
          <button
            onClick={onLanguageToggle}
            className="p-1.5 lg:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
            title={selectedLanguage === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            {(() => {
              try {
                const flagCountry = getLanguageFlag()
                if (flagCountry) {
                  return (
                    <ReactCountryFlag
                      countryCode={flagCountry}
                      svg
                      style={{
                        width: '16px',
                        height: '12px',
                        borderRadius: '2px'
                      }}
                    />
                  )
                }
                return null
              } catch (error) {
                console.error('Country flag rendering error:', error)
                return null
              }
            })()}
          </button>
        </div>
      </div>
    </div>
  )
}

