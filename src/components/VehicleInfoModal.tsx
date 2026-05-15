'use client'

import React from 'react'
import { X, Car, Camera } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'

export type TourChatVehicleInfo = {
  vehicleType: string
  model: string
  capacity: number | null
  color: string | null
  photos: Array<{ url: string; alt?: string }>
}

interface VehicleInfoModalProps {
  isOpen: boolean
  onClose: () => void
  loading: boolean
  vehicle: TourChatVehicleInfo | null
  language: SupportedLanguage
}

const copy = {
  ko: {
    title: '차량',
    type: '유형',
    model: '모델',
    capacity: '정원',
    peopleSuffix: '명',
    photos: '차량 사진',
    photoHint: '(사진을 누르면 크게 볼 수 있습니다)',
    empty: '등록된 차량 정보가 없습니다.',
    close: '닫기',
    color: '색상',
    loading: '불러오는 중…',
  },
  en: {
    title: 'Vehicle',
    type: 'Type',
    model: 'Model',
    capacity: 'Capacity',
    peopleSuffix: ' people',
    photos: 'Vehicle Photos',
    photoHint: '(Click on images to view in full size)',
    empty: 'No vehicle is assigned for this tour yet.',
    close: 'Close',
    color: 'Color',
    loading: 'Loading…',
  },
}

export default function VehicleInfoModal({
  isOpen,
  onClose,
  loading,
  vehicle,
  language,
}: VehicleInfoModalProps) {
  const t = copy[language === 'ko' ? 'ko' : 'en']

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50/90 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900">
            <Car className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
            {t.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-amber-800 hover:bg-amber-100"
            aria-label={t.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-center text-sm text-amber-900/80">{t.loading}</p>
          ) : !vehicle ? (
            <p className="rounded-lg border border-amber-200 bg-white/80 px-3 py-3 text-sm text-amber-950">{t.empty}</p>
          ) : (
            <div className="space-y-4 border-l-4 border-orange-400 pl-4">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-bold text-gray-900">{t.type}</dt>
                  <dd className="mt-0.5 text-gray-800">{vehicle.vehicleType}</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-900">{t.model}</dt>
                  <dd className="mt-0.5 text-gray-800">{vehicle.model}</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-900">{t.capacity}</dt>
                  <dd className="mt-0.5 text-gray-800">
                    {vehicle.capacity != null ? `${vehicle.capacity}${t.peopleSuffix}` : '—'}
                  </dd>
                </div>
                {vehicle.color ? (
                  <div>
                    <dt className="font-bold text-gray-900">{t.color}</dt>
                    <dd className="mt-0.5 text-gray-800">{vehicle.color}</dd>
                  </div>
                ) : null}
              </dl>

              {vehicle.photos.length > 0 ? (
                <div className="border-t border-amber-200/80 pt-4">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-amber-900">
                    <Camera className="h-4 w-4 text-orange-600" aria-hidden />
                    {t.photos}
                  </h3>
                  <p className="mb-3 text-xs text-gray-600">{t.photoHint}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {vehicle.photos.map((p, i) => (
                      <a
                        key={`${p.url}-${i}`}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm ring-1 ring-amber-100/80 transition hover:opacity-95"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.alt || `${t.photos} ${i + 1}`}
                          className="h-36 w-full object-cover sm:h-40"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-amber-200 bg-amber-50/90 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
