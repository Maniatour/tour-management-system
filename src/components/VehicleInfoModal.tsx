'use client'

import { X, Car, Camera } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    photoHint: '사진을 누르면 크게 볼 수 있습니다',
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
    photoHint: 'Tap an image to view full size',
    empty: 'No vehicle is assigned for this tour yet.',
    close: 'Close',
    color: 'Color',
    loading: 'Loading…',
  },
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-foreground leading-snug">{value}</dd>
    </div>
  )
}

export default function VehicleInfoModal({
  isOpen,
  onClose,
  loading,
  vehicle,
  language,
}: VehicleInfoModalProps) {
  const t = copy[language === 'ko' ? 'ko' : 'en']

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="max-w-lg gap-0 overflow-hidden rounded-2xl border border-border/60 p-0 shadow-xl sm:max-w-lg"
      >
        <DialogHeader className="space-y-0 border-b border-border/60 px-5 py-4 text-left sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Car className="h-5 w-5" aria-hidden />
              </span>
              {t.title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.loading}</p>
          ) : !vehicle ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              {t.empty}
            </div>
          ) : (
            <div className="space-y-5">
              <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SpecItem label={t.type} value={vehicle.vehicleType} />
                <SpecItem label={t.model} value={vehicle.model} />
                <SpecItem
                  label={t.capacity}
                  value={
                    vehicle.capacity != null
                      ? `${vehicle.capacity}${t.peopleSuffix}`
                      : '—'
                  }
                />
                {vehicle.color ? (
                  <SpecItem label={t.color} value={vehicle.color} />
                ) : null}
              </dl>

              {vehicle.photos.length > 0 ? (
                <div className="border-t border-border/60 pt-5">
                  <div className="mb-3 flex items-start gap-2">
                    <Camera className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{t.photos}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.photoHint}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {vehicle.photos.map((p, i) => (
                      <a
                        key={`${p.url}-${i}`}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block overflow-hidden rounded-xl border border-border/60 bg-muted/20 shadow-sm transition duration-200 hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.alt || `${t.photos} ${i + 1}`}
                          className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
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

        <DialogFooter className="border-t border-border/60 px-5 py-4 sm:px-6">
          <Button type="button" onClick={onClose} className="h-11 rounded-xl px-6">
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
