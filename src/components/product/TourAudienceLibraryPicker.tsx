'use client'

import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import type { AdminEditLocale } from '@/lib/adminEditLocales'
import {
  TOUR_AUDIENCE_KIND_LABELS,
  getTourAudienceFilledLocales,
  getTourAudienceLocalizedText,
  type TourAudienceKind,
  type TourAudienceLibraryItem,
} from '@/lib/tourAudienceLibrary'

type TourAudienceLibraryPickerProps = {
  editLocale: AdminEditLocale
  libraryItems: TourAudienceLibraryItem[]
  libraryLoading: boolean
  librarySearch: string
  selectedLibraryIds: Set<string>
  saving: boolean
  onSearchChange: (value: string) => void
  onSearch: () => void
  onClose: () => void
  onAttach: () => void
  onToggleAll: () => void
  onToggleItem: (id: string) => void
}

function kindLabel(kind: TourAudienceKind, locale: AdminEditLocale) {
  return TOUR_AUDIENCE_KIND_LABELS[kind][locale === 'en' ? 'en' : 'ko']
}

export default function TourAudienceLibraryPicker({
  editLocale,
  libraryItems,
  libraryLoading,
  librarySearch,
  selectedLibraryIds,
  saving,
  onSearchChange,
  onSearch,
  onClose,
  onAttach,
  onToggleAll,
  onToggleItem,
}: TourAudienceLibraryPickerProps) {
  const t = useTranslations('products.customerPageEdit.tourAudienceEmbed')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t('libraryPickerTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('libraryClose')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 border-b border-border px-4 py-3">
          <input
            value={librarySearch}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch()
            }}
            placeholder={t('librarySearchPlaceholder')}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onSearch}
            className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
          >
            {t('librarySearch')}
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {libraryLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('libraryLoading')}
            </div>
          ) : libraryItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('libraryEmpty')}</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={
                    libraryItems.length > 0 && selectedLibraryIds.size === libraryItems.length
                  }
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                />
                {selectedLibraryIds.size === libraryItems.length
                  ? t('libraryDeselectAll')
                  : t('librarySelectAll')}
              </label>
              {libraryItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex w-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selectedLibraryIds.has(item.id)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLibraryIds.has(item.id)}
                    onChange={() => onToggleItem(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">
                        {item.name ||
                          getTourAudienceLocalizedText(item, editLocale) ||
                          t('libraryUnnamed')}
                      </div>
                      <ContentLibraryLocaleBadges locales={getTourAudienceFilledLocales(item)} />
                    </div>
                    <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {kindLabel(item.audience_kind, editLocale)}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {getTourAudienceLocalizedText(item, editLocale) || item.title}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {t('librarySelectedCount', { count: String(selectedLibraryIds.size) })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {t('libraryClose')}
            </button>
            <button
              type="button"
              onClick={onAttach}
              disabled={saving || selectedLibraryIds.size === 0}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t('libraryAddSelected', { count: String(selectedLibraryIds.size) })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
