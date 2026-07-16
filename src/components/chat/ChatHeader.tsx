'use client'

import { useMemo } from 'react'
import { Megaphone, Calendar, ExternalLink, ImageIcon, Users, Phone, Copy, Share2, ChevronDown, ChevronUp, Bell, BellOff, Car, Power } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import type { SupportedLanguage } from '@/lib/translation'
import type { ChatRoom } from '@/types/chat'
import AttendanceMobileDashboard, {
  type AttendanceDashboardAction,
} from '@/components/attendance/AttendanceMobileDashboard'

interface ChatHeaderProps {
  room: ChatRoom
  /** 고객 공개 화면 등에서 DB room_name 대신 표시할 제목 */
  displayRoomName?: string
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
  /** 차량 정보 모달 (투어 채팅) */
  onShowVehicleInfo?: () => void
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
  /** 채팅방 전체 메시지 수 (DB 기준) */
  totalMessageCount?: number
}

export default function ChatHeader({
  room,
  displayRoomName,
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
  onShowVehicleInfo,
  onShowPhotoGallery,
  onShowTeamInfo,
  onGoToTourDetail,
  onStartCall,
  onCopyLink,
  onShare,
  onTogglePush,
  onLanguageToggle,
  onShowParticipants,
  getLanguageFlag,
  totalMessageCount = 0
}: ChatHeaderProps) {
  const headingText =
    displayRoomName?.trim() ||
    room.room_name ||
    (selectedLanguage === 'ko' ? '채팅방' : 'Chat room')

  const countLabel =
    selectedLanguage === 'ko'
      ? `총 ${totalMessageCount}개 메시지`
      : `${totalMessageCount} messages total`

  const callDisabled = !room || callStatus !== 'idle' || availableCallUsersCount === 0

  const mobileCoreActions = useMemo((): AttendanceDashboardAction[] => {
    const ko = selectedLanguage === 'ko'
    const actions: AttendanceDashboardAction[] = []

    if (!isPublicView) {
      actions.push({
        id: 'toggle-active',
        label: ko ? (room.is_active ? '활성' : '비활성') : (room.is_active ? 'Active' : 'Off'),
        icon: Power,
        onClick: () => {
          if (!togglingActive) onToggleRoomActive()
        },
        tileClass: room.is_active
          ? 'bg-gradient-to-br from-emerald-500 to-green-700'
          : 'bg-gradient-to-br from-slate-400 to-slate-600',
      })
    }

    actions.push(
      {
        id: 'announcements',
        label: ko ? '공지' : 'Info',
        icon: Megaphone,
        onClick: onShowAnnouncements,
        tileClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
      },
      {
        id: 'pickup',
        label: ko ? '픽업' : 'Pickup',
        icon: Calendar,
        onClick: onShowPickupSchedule,
        tileClass: 'bg-gradient-to-br from-blue-500 to-blue-700',
      }
    )

    if (onShowVehicleInfo) {
      actions.push({
        id: 'vehicle',
        label: ko ? '차량' : 'Vehicle',
        icon: Car,
        onClick: onShowVehicleInfo,
        tileClass: 'bg-gradient-to-br from-orange-500 to-orange-700',
      })
    }

    if (isPublicView) {
      actions.push(
        {
          id: 'photos',
          label: ko ? '사진' : 'Photos',
          icon: ImageIcon,
          onClick: onShowPhotoGallery,
          tileClass: 'bg-gradient-to-br from-violet-500 to-purple-700',
        },
        {
          id: 'guide',
          label: ko ? '가이드' : 'Guide',
          icon: Users,
          onClick: onShowTeamInfo,
          tileClass: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
        }
      )
    } else {
      actions.push({
        id: 'tour-detail',
        label: ko ? '투어' : 'Tour',
        icon: ExternalLink,
        onClick: onGoToTourDetail,
        tileClass: 'bg-gradient-to-br from-purple-500 to-fuchsia-700',
      })
    }

    actions.push(
      {
        id: 'call',
        label: ko ? '통화' : 'Call',
        icon: Phone,
        onClick: () => {
          if (!callDisabled) onStartCall()
        },
        tileClass:
          callStatus === 'connected'
            ? 'bg-gradient-to-br from-emerald-500 to-green-700'
            : callDisabled
              ? 'bg-gradient-to-br from-slate-300 to-slate-500 opacity-70'
              : 'bg-gradient-to-br from-green-500 to-emerald-700',
      },
      {
        id: 'copy',
        label: ko ? '복사' : 'Copy',
        icon: Copy,
        onClick: onCopyLink,
        tileClass: 'bg-gradient-to-br from-sky-500 to-blue-700',
      },
      {
        id: 'share',
        label: ko ? '공유' : 'Share',
        icon: Share2,
        onClick: onShare,
        tileClass: 'bg-gradient-to-br from-teal-500 to-teal-700',
      }
    )

    return actions
  }, [
    selectedLanguage,
    isPublicView,
    room.is_active,
    togglingActive,
    onToggleRoomActive,
    onShowAnnouncements,
    onShowPickupSchedule,
    onShowVehicleInfo,
    onShowPhotoGallery,
    onShowTeamInfo,
    onGoToTourDetail,
    callDisabled,
    callStatus,
    onStartCall,
    onCopyLink,
    onShare,
  ])

  const mobileCollapsedActions = useMemo((): AttendanceDashboardAction[] => {
    const ko = selectedLanguage === 'ko'
    return [
      ...mobileCoreActions,
      {
        id: 'expand',
        label: ko ? '더보기' : 'More',
        icon: ChevronDown,
        onClick: onToggleMobileMenu,
        tileClass: 'bg-gradient-to-br from-slate-400 to-slate-600',
      },
    ]
  }, [mobileCoreActions, selectedLanguage, onToggleMobileMenu])

  const mobileExpandedActions = useMemo((): AttendanceDashboardAction[] => {
    const ko = selectedLanguage === 'ko'
    return [
      ...mobileCoreActions.map((action) =>
        action.id === 'announcements'
          ? { ...action, label: ko ? '공지사항' : 'Announcements' }
          : action.id === 'pickup'
            ? { ...action, label: ko ? '픽업 스케줄' : 'Pickup Schedule' }
            : action.id === 'photos'
              ? { ...action, label: ko ? '투어 사진' : 'Tour Photos' }
              : action.id === 'guide'
                ? { ...action, label: ko ? '가이드 정보' : 'Guide Info' }
                : action.id === 'tour-detail'
                  ? { ...action, label: ko ? '투어 상세' : 'Tour Details' }
                  : action
      ),
      {
        id: 'collapse',
        label: ko ? '접기' : 'Collapse',
        icon: ChevronUp,
        onClick: onToggleMobileMenu,
        tileClass: 'bg-gradient-to-br from-slate-400 to-slate-600',
      },
    ]
  }, [mobileCoreActions, selectedLanguage, onToggleMobileMenu])

  return (
    <div className="flex-shrink-0 px-2 lg:px-3 py-2 border-b bg-white bg-opacity-90 backdrop-blur-sm shadow-sm relative">
      {!isPublicView && (
        <div className="mb-1.5 flex items-center gap-2 min-w-0 pr-1">
          <div
            className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0 leading-tight"
            title={headingText}
            role="heading"
            aria-level={2}
          >
            {headingText}
          </div>
          <span
            className="flex-shrink-0 tabular-nums rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[11px] font-semibold shadow-sm"
            title={countLabel}
            aria-label={countLabel}
          >
            {totalMessageCount > 9999 ? '9999+' : totalMessageCount}
          </span>
        </div>
      )}

      {/* 버튼 영역 */}
      <div
        className={`${
          isMobileMenuOpen ? 'flex flex-col w-full' : 'flex items-center gap-1 lg:gap-2'
        } ${isPublicView ? '' : 'mt-1'} ${
          isMobileMenuOpen ? '' : 'justify-center'
        } lg:mt-1 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-2`}
      >
        {/* 모바일: 접었을 때 — 출석 관리와 동일한 앱 아이콘 한 줄 */}
        <div className={`lg:hidden w-full flex-1 min-w-0 ${isMobileMenuOpen ? 'hidden' : ''}`}>
          <AttendanceMobileDashboard actions={mobileCollapsedActions} layout="strip" />
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
            className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-primary/10 text-primary rounded border border-border hover:bg-blue-200 flex items-center justify-center"
            title={selectedLanguage === 'ko' ? '픽업 스케줄' : 'Pickup Schedule'}
          >
            <Calendar size={12} className="lg:w-3.5 lg:h-3.5" />
          </button>
          {onShowVehicleInfo ? (
            <button
              type="button"
              onClick={onShowVehicleInfo}
              className="px-2 lg:px-2.5 py-1 lg:py-1.5 text-xs bg-orange-100 text-orange-900 rounded border border-orange-200 hover:bg-orange-200 flex items-center justify-center"
              title={selectedLanguage === 'ko' ? '차량 정보' : 'Vehicle info'}
            >
              <Car size={12} className="lg:w-3.5 lg:h-3.5" />
            </button>
          ) : null}
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

        {/* 모바일: 출석 관리와 동일한 앱 아이콘 대시보드 */}
        <div className={`lg:hidden relative w-full ${isMobileMenuOpen ? '' : 'hidden'}`}>
          {isMobileMenuOpen && (
            <AttendanceMobileDashboard actions={mobileExpandedActions} />
          )}
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
                  ? 'text-primary hover:text-primary/80 hover:bg-muted/50'
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

