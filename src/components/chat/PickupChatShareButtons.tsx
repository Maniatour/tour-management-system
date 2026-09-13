'use client'

import { Copy, ImageIcon, MapPin, Building2, Footprints } from 'lucide-react'
import {
  pickupChatShareAvailability,
  type PickupChatShareHotel,
  type PickupChatShareKind,
} from '@/lib/pickupChatShare'

export default function PickupChatShareButtons({
  hotel,
  locale,
  disabled,
  onShare,
}: {
  hotel: PickupChatShareHotel
  locale: 'ko' | 'en'
  disabled: boolean
  onShare: (kind: PickupChatShareKind) => void
}) {
  const isKo = locale === 'ko'
  const available = pickupChatShareAvailability(hotel)

  const hasAny = Object.values(available).some(Boolean)
  if (!hasAny) return null

  const btnClass =
    'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {available.maps && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onShare('maps')}
          className={btnClass}
          title={isKo ? '구글 맵 안내를 미리보고 채팅으로 보내기' : 'Preview Google Maps info, then send to chat'}
        >
          <Copy size={12} />
          {isKo ? '맵 안내' : 'Map'}
        </button>
      )}
      {available.images && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onShare('images')}
          className={btnClass}
          title={isKo ? '픽업 장소 사진을 미리보고 채팅으로 보내기' : 'Preview pickup photos, then send to chat'}
        >
          <ImageIcon size={12} />
          {isKo ? '장소 사진' : 'Photos'}
        </button>
      )}
      {available.description && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onShare('description')}
          className={btnClass}
          title={isKo ? '위치 설명을 미리보고 채팅으로 보내기' : 'Preview location description, then send to chat'}
        >
          <MapPin size={12} />
          {isKo ? '위치 설명' : 'Description'}
        </button>
      )}
      {available.inside && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onShare('inside')}
          className={btnClass}
          title={isKo ? '호텔 내부 안내를 미리보고 채팅으로 보내기' : 'Preview From Inside Hotel, then send to chat'}
        >
          <Building2 size={12} />
          {isKo ? '호텔 안' : 'Inside'}
        </button>
      )}
      {available.outside && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onShare('outside')}
          className={btnClass}
          title={isKo ? '호텔 외부 안내를 미리보고 채팅으로 보내기' : 'Preview From Outside Hotel, then send to chat'}
        >
          <Footprints size={12} />
          {isKo ? '호텔 밖' : 'Outside'}
        </button>
      )}
    </div>
  )
}
