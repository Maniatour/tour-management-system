'use client'

import type { CustomerPreviewTarget } from '@/lib/customerPageZones'

function ZoneBlock({
  active,
  label,
  className = '',
  children,
}: {
  active: boolean
  label?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`relative rounded-md border-2 transition-all ${
        active
          ? 'border-primary bg-primary/5/80 shadow-[0_0_0_4px_rgba(59,130,246,0.25)] z-10'
          : 'border-gray-200 bg-gray-50/80 opacity-70'
      } ${className}`}
    >
      {active && label && (
        <span className="absolute -top-2.5 left-2 z-20 inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

function isActive(target: CustomerPreviewTarget, zone: string) {
  return target.highlightZone === zone
}

function ListingWireframe({ target }: { target: CustomerPreviewTarget }) {
  return (
    <div className="max-w-sm mx-auto space-y-3">
      <p className="text-xs font-medium text-gray-500 text-center">상품 목록 페이지</p>
      <ZoneBlock
        active={isActive(target, 'listing-card')}
        label="상품 카드"
        className="p-3 space-y-2"
      >
        <div className="h-24 rounded bg-gradient-to-br from-slate-200 to-slate-300" />
        <ZoneBlock active={isActive(target, 'listing-card-name')} label="상품명·카테고리" className="h-8 px-2 flex items-center text-xs text-gray-600">
          상품명
        </ZoneBlock>
        <div className="h-6 bg-gray-100 rounded text-[10px] px-2 flex items-center text-gray-400">설명</div>
        <ZoneBlock active={isActive(target, 'listing-card-description')} label="짧은 설명" className="h-6 px-2 flex items-center text-[10px] text-gray-500">
          상품 요약·설명
        </ZoneBlock>
        <ZoneBlock active={isActive(target, 'listing-card-location')} label="출발지" className="h-6 px-2 flex items-center text-[10px] text-gray-500">
          📍 출발 도시
        </ZoneBlock>
        <ZoneBlock active={isActive(target, 'listing-card-tags')} label="태그" className="h-6 px-2 flex items-center text-[10px] text-gray-500">
          #태그
        </ZoneBlock>
        <ZoneBlock active={isActive(target, 'listing-card-price')} label="시작 가격" className="h-8 px-2 flex items-center justify-between text-xs">
          <span className="font-bold text-primary">$000~</span>
          <span className="text-[10px] text-gray-400">예약하기</span>
        </ZoneBlock>
      </ZoneBlock>
    </div>
  )
}

function DetailWireframe({ target }: { target: CustomerPreviewTarget }) {
  const tab = target.tab ?? 'overview'

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      <p className="text-xs font-medium text-gray-500 text-center">상품 상세 페이지</p>
      <ZoneBlock active={isActive(target, 'detail-header')} label="상단 헤더" className="h-14 px-3 flex items-center text-sm font-semibold text-gray-700">
        ← 상품명 · 카테고리 · 태그
      </ZoneBlock>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2 space-y-2">
          <ZoneBlock active={isActive(target, 'detail-gallery')} label="이미지 갤러리" className="h-28 flex items-center justify-center text-xs text-gray-500">
            🖼 갤러리
          </ZoneBlock>
          <div className="flex gap-1 flex-wrap text-[10px]">
            {(
              [
                ['overview', '개요'],
                ['itinerary', '코스'],
                ['tour-schedule', '일정'],
                ['basic', '기본'],
                ['included', '포함'],
                ['logistics', '운영'],
                ['policy', '정책'],
                ['faq', 'FAQ'],
              ] as const
            ).map(([id, label]) => (
              <span
                key={id}
                className={`px-2 py-1 rounded border ${
                  tab === id ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-gray-200 text-gray-400'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <ZoneBlock
            active={
              isActive(target, 'detail-tab-overview') ||
              isActive(target, 'detail-overview-slogan') ||
              isActive(target, 'detail-overview-greeting') ||
              isActive(target, 'detail-overview-description') ||
              isActive(target, 'detail-overview-keyinfo') ||
              isActive(target, 'detail-overview-tags') ||
              isActive(target, 'detail-tab-itinerary') ||
              isActive(target, 'detail-tab-schedule') ||
              isActive(target, 'detail-tab-details') ||
              isActive(target, 'detail-tab-faq') ||
              isActive(target, 'detail-details-body')
            }
            label={target.label}
            className="min-h-[140px] p-3 space-y-2"
          >
            {tab === 'overview' && (
              <>
                <ZoneBlock active={isActive(target, 'detail-overview-slogan')} label="슬로건" className="h-8 text-xs px-2 flex items-center">슬로건</ZoneBlock>
                <ZoneBlock active={isActive(target, 'detail-overview-greeting')} label="인사말" className="h-8 text-xs px-2 flex items-center">인사말</ZoneBlock>
                <ZoneBlock active={isActive(target, 'detail-overview-description')} label="상품 설명" className="h-12 text-xs px-2 flex items-center">상품 설명</ZoneBlock>
                <ZoneBlock active={isActive(target, 'detail-overview-keyinfo')} label="투어 정보" className="h-10 text-xs px-2 flex items-center">소요시간 · 정원</ZoneBlock>
                <ZoneBlock active={isActive(target, 'detail-overview-tags')} label="태그" className="h-8 text-xs px-2 flex items-center">태그</ZoneBlock>
              </>
            )}
            {tab === 'basic' ||
            tab === 'included' ||
            tab === 'logistics' ||
            tab === 'policy' ||
            tab === 'details' ? (
              <ZoneBlock active={isActive(target, 'detail-details-body')} label="상세정보 섹션" className="h-24 text-xs px-2 flex items-center">
                포함·불포함·안내 등
              </ZoneBlock>
            ) : null}
            {tab === 'itinerary' && <div className="text-xs text-gray-500 p-2">투어 코스 · 경유지</div>}
            {tab === 'tour-schedule' && <div className="text-xs text-gray-500 p-2">투어 일정 타임라인</div>}
            {tab === 'faq' && <div className="text-xs text-gray-500 p-2">FAQ 질문·답변</div>}
          </ZoneBlock>
        </div>
        <ZoneBlock active={isActive(target, 'detail-sidebar')} label="예약 패널" className="p-2 space-y-2 min-h-[200px]">
          <ZoneBlock active={isActive(target, 'detail-sidebar-price')} label="가격" className="h-10 text-xs px-2 flex items-center justify-center font-bold text-primary">
            $ 총액
          </ZoneBlock>
          <ZoneBlock active={isActive(target, 'detail-sidebar-options')} label="상품 초이스" className="h-16 text-[10px] px-2 flex items-center text-gray-500">
            초이스 / 옵션
          </ZoneBlock>
          <ZoneBlock active={isActive(target, 'detail-sidebar-included')} label="포함·불포함" className="h-12 text-[10px] px-2 flex items-center text-gray-500">
            포함 · 불포함 요약
          </ZoneBlock>
          <div className="flex h-8 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground">예약하기</div>
        </ZoneBlock>
      </div>
    </div>
  )
}

function BookingWireframe({ target }: { target: CustomerPreviewTarget }) {
  return (
    <div className="max-w-md mx-auto space-y-3">
      <p className="text-xs font-medium text-gray-500 text-center">예약하기 화면</p>
      <ZoneBlock active={isActive(target, 'booking-participants')} label="인원 선택" className="h-24 p-3 text-xs text-gray-600">
        성인 · 아동 · 유아
      </ZoneBlock>
      <ZoneBlock active={isActive(target, 'booking-options')} label="옵션 단계" className="h-32 p-3 text-xs text-gray-600">
        초이스 / 추가 옵션 선택
      </ZoneBlock>
    </div>
  )
}

export default function CustomerPageWireframePreview({ target }: { target: CustomerPreviewTarget }) {
  if (target.page === 'listing') return <ListingWireframe target={target} />
  if (target.page === 'booking') return <BookingWireframe target={target} />
  return <DetailWireframe target={target} />
}
