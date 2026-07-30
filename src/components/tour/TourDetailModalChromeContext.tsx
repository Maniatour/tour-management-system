'use client'

import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react'

export type TourDetailSectionChrome = {
  compact: boolean
  shellPadding: string
  headerMargin: string
  sectionTitle: string
  subsectionTitle: string
  iconButton: string
  iconSize: number
  chevronClass: string
  textActionButton: string
  /** 본문 기본 텍스트 */
  bodyText: string
  /** 본문 라벨 (굵게) */
  bodyLabel: string
  /** 본문 보조 라벨 (TourInfo 필드명 등) */
  bodyCaption: string
  /** 힌트·메타 텍스트 */
  bodyMuted: string
  /** input 기본 */
  bodyField: string
  /** select 기본 */
  bodySelect: string
  /** 드롭다운 트리거 버튼 */
  bodyTrigger: string
  /** 본문 세로 간격 */
  bodyStack: string
  /** 본문 행 gap */
  bodyRowGap: string
  /** 헤더 아래 본문 시작 여백 */
  bodyExpandedMargin: string
  /** 세그먼트/칩 버튼 (팀 타입 등) */
  segmentButton: string
  /** 빈 상태 패딩 */
  emptyStatePadding: string
  /** 빈 상태 메인 문구 */
  emptyStateTitle: string
  /** 빈 상태 보조 문구 */
  emptyStateSubtext: string
  /** 빈 상태 아이콘 (lucide className) */
  emptyStateIconClass: string
  /** 빈 상태 lucide size prop */
  emptyStateLucideSize: number
  /** 사진 업로드 드롭존 패딩 */
  uploadZonePadding: string
  /** 사진 업로드 드롭존 안내 문구 */
  uploadZoneText: string
  /** 사진 업로드 드롭존 힌트 */
  uploadZoneHint: string
  /** 사진 업로드 아이콘 버튼 */
  uploadIconButton: string
  /** 사진 업로드 아이콘 버튼 내 lucide size */
  uploadIconSize: number
  /** 사진 업로드 드롭존 중앙 아이콘 size */
  uploadDropIconSize: number
}

export function getTourDetailSectionChrome(compact: boolean): TourDetailSectionChrome {
  if (compact) {
    return {
      compact: true,
      shellPadding: 'p-3',
      headerMargin: 'mb-2',
      sectionTitle: 'text-sm font-semibold text-gray-900',
      subsectionTitle: 'text-xs font-medium text-gray-700 mb-1.5',
      iconButton:
        'inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-colors',
      iconSize: 14,
      chevronClass: 'w-4 h-4',
      textActionButton: 'px-2 py-1 text-xs rounded',
      bodyText: 'text-xs text-gray-900',
      bodyLabel: 'text-xs font-medium text-gray-700',
      bodyCaption: 'text-xs text-gray-600',
      bodyMuted: 'text-[10px] text-gray-500',
      bodyField: 'text-xs border border-gray-300 rounded px-2 py-1',
      bodySelect: 'text-xs border border-gray-300 rounded px-2 py-1.5',
      bodyTrigger:
        'text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-ring focus:border-ring',
      bodyStack: 'space-y-2',
      bodyRowGap: 'gap-2',
      bodyExpandedMargin: 'mt-2',
      segmentButton: 'px-2 py-1 text-xs rounded',
      emptyStatePadding: 'py-4',
      emptyStateTitle: 'text-xs text-gray-500 mb-1',
      emptyStateSubtext: 'text-[10px] text-gray-400',
      emptyStateIconClass: 'w-8 h-8',
      emptyStateLucideSize: 28,
      uploadZonePadding: 'p-3',
      uploadZoneText: 'text-xs text-gray-600 mb-1',
      uploadZoneHint: 'text-[10px] text-gray-500',
      uploadIconButton: 'w-8 h-8',
      uploadIconSize: 16,
      uploadDropIconSize: 24,
    }
  }
  return {
    compact: false,
    shellPadding: 'p-4',
    headerMargin: 'mb-3',
    sectionTitle: 'text-md font-semibold text-gray-900',
    subsectionTitle: 'text-sm font-medium text-gray-700 mb-2',
    iconButton:
      'inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors',
    iconSize: 16,
    chevronClass: 'w-5 h-5',
    textActionButton: 'px-3 py-1 text-sm rounded',
    bodyText: 'text-sm text-gray-900',
    bodyLabel: 'text-sm font-medium text-gray-700',
    bodyCaption: 'text-sm text-gray-600',
    bodyMuted: 'text-xs text-gray-500',
    bodyField: 'text-sm border border-gray-300 rounded px-2 py-1',
    bodySelect: 'text-sm border border-gray-300 rounded px-3 py-2',
    bodyTrigger:
      'text-sm border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-ring focus:border-ring',
    bodyStack: 'space-y-4',
    bodyRowGap: 'gap-4',
    bodyExpandedMargin: 'mt-4',
    segmentButton: 'px-3 py-2 text-sm rounded',
    emptyStatePadding: 'py-8',
    emptyStateTitle: 'text-sm text-gray-500 mb-2',
    emptyStateSubtext: 'text-sm text-gray-400',
    emptyStateIconClass: 'w-12 h-12',
    emptyStateLucideSize: 48,
    uploadZonePadding: 'p-4 sm:p-8',
    uploadZoneText: 'text-sm sm:text-base text-gray-600 mb-1 sm:mb-2',
    uploadZoneHint: 'text-xs sm:text-sm text-gray-500',
    uploadIconButton: 'w-10 h-10',
    uploadIconSize: 20,
    uploadDropIconSize: 32,
  }
}

const defaultSectionChrome = getTourDetailSectionChrome(false)

const TourDetailSectionChromeContext = createContext<TourDetailSectionChrome>(defaultSectionChrome)

export function TourDetailSectionChromeProvider({
  compact,
  children,
}: {
  compact: boolean
  children: React.ReactNode
}) {
  const chrome = useMemo(() => getTourDetailSectionChrome(compact), [compact])
  return (
    <TourDetailSectionChromeContext.Provider value={chrome}>
      {children}
    </TourDetailSectionChromeContext.Provider>
  )
}

export function useTourDetailSectionChrome(): TourDetailSectionChrome {
  return useContext(TourDetailSectionChromeContext)
}

export type TourDetailModalMeta = {
  title: string
  date?: string
  tourId?: string
  statusLabel?: string
}

type TourDetailModalChromeContextValue = {
  scrollRef: RefObject<HTMLDivElement | null>
  setMeta: (meta: TourDetailModalMeta | null) => void
  setToolbarContent: (content: ReactNode | null) => void
  resetScroll: () => void
  onClose: () => void
}

export const TourDetailModalChromeContext =
  createContext<TourDetailModalChromeContextValue | null>(null)

export function useTourDetailModalChrome() {
  return useContext(TourDetailModalChromeContext)
}

export function useTourDetailModalScrollRef() {
  const ctx = useTourDetailModalChrome()
  return ctx?.scrollRef ?? { current: null }
}
