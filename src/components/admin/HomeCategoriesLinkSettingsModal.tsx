'use client'

import { useState } from 'react'
import { MapPin, Compass, X } from 'lucide-react'
import CustomerPageHomeSettingsPanel, {
  type HomeSettingsKind,
} from '@/components/product/CustomerPageHomeSettingsPanel'

type TabKind = Extract<HomeSettingsKind, 'destinations' | 'adventure'>

type Props = {
  isOpen: boolean
  onClose: () => void
  locale: string
}

const TABS: Array<{ id: TabKind; labelKo: string; labelEn: string; icon: typeof MapPin }> = [
  { id: 'destinations', labelKo: '인기 목적지', labelEn: 'Popular destinations', icon: MapPin },
  { id: 'adventure', labelKo: '여행 스타일', labelEn: 'Travel styles', icon: Compass },
]

export default function HomeCategoriesLinkSettingsModal({ isOpen, onClose, locale }: Props) {
  const isEn = locale === 'en'
  const [activeTab, setActiveTab] = useState<TabKind>('destinations')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
              {isEn ? 'Home category links' : '홈 카테고리 연결 설정'}
            </h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {isEn
                ? 'Link products to each Popular Destinations / Travel Style card. Saving adds the card’s tag to those products automatically.'
                : '인기 목적지·여행 스타일 카드에 상품을 연결하세요. 저장하면 해당 연결 태그가 상품에 자동으로 추가됩니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-gray-200 px-5 pt-3 sm:px-6">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={16} />
                  {isEn ? tab.labelEn : tab.labelKo}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <CustomerPageHomeSettingsPanel
            key={isOpen ? 'open' : 'closed'}
            kind={activeTab}
            locale={locale}
            onSaved={() => {
              /* keep modal open so user can switch tabs and continue editing */
            }}
          />
        </div>

        <div className="flex items-center justify-end border-t border-gray-200 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            {isEn ? 'Close' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
