'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Smartphone, X } from 'lucide-react'
import {
  type AdminSmsCategoryId,
  getAdminSmsCategory,
} from '@/lib/adminSmsTemplateCatalog'
import {
  resolveAdminSmsCategoryIconKey,
  resolveAdminSmsCategoryLabel,
  sortedAdminSmsCategories,
} from '@/lib/adminSmsCategorySettings'
import { resolveAdminSmsCategoryIcon } from '@/lib/adminSmsCategoryIcons'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import AdminSmsLocaleTemplateEditor from '@/components/admin/sms/AdminSmsLocaleTemplateEditor'
import AdminSmsMessengerContactsSection from '@/components/admin/sms/AdminSmsMessengerContactsSection'
import AdminSmsStaffOutreachSection from '@/components/admin/sms/AdminSmsStaffOutreachSection'
import AdminSmsCategorySettingsPanel from '@/components/admin/sms/AdminSmsCategorySettingsPanel'
import { useAdminSmsCategorySettings, prefetchAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import { prefetchAdminSmsLocaleTemplate } from '@/lib/adminSmsLocaleTemplateClientCache'
import { prefetchMessengerContactSettings } from '@/lib/messengerContactSettingsClientCache'

const LOCALE_LABELS: Record<string, { ko: string; en: string }> = {
  ko: { ko: '한국어', en: 'Korean' },
  en: { ko: '영어', en: 'English' },
}

type Props = {
  open: boolean
  onClose: () => void
  locale?: string
}

export function AdminSmsManagementModal({ open, onClose, locale = 'ko' }: Props) {
  const isKo = locale.startsWith('ko')
  const { settings, reload } = useAdminSmsCategorySettings({ enabled: open })
  const [categoryId, setCategoryId] = useState<AdminSmsCategoryId>('pre_tour_contact')
  const [messageLocale, setMessageLocale] = useState<string>('ko')
  const [staffLocale, setStaffLocale] = useState<'ko' | 'en'>('ko')

  const categories = useMemo(() => sortedAdminSmsCategories(settings), [settings])
  const category = useMemo(() => getAdminSmsCategory(categoryId), [categoryId])
  const categoryRow = settings[categoryId]

  const handleSettingsSaved = useCallback(() => {
    void reload()
  }, [reload])

  const availableLocales = useMemo(() => {
    if (category.kind === 'staff_outreach') return ['ko', 'en'] as const
    if (category.kind === 'messenger_contacts') return [] as const
    return category.locales ?? ['ko', 'en']
  }, [category])

  const activeLocale =
    category.kind === 'staff_outreach'
      ? staffLocale
      : category.kind === 'locale_template'
        ? messageLocale
        : 'ko'

  useEffect(() => {
    if (!open) return
    prefetchAdminSmsCategorySettings()
    prefetchMessengerContactSettings()
  }, [open])

  useEffect(() => {
    if (!open || category.kind !== 'locale_template') return
    for (const loc of availableLocales) {
      prefetchAdminSmsLocaleTemplate(categoryId, loc)
    }
  }, [open, categoryId, category.kind, availableLocales])

  if (!open) return null

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: DIALOG_Z_INDEX.elevated }}
      onClick={onClose}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isKo ? 'SMS 관리' : 'SMS management'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isKo
                  ? '문자 템플릿·표시 이름·아이콘을 관리합니다.'
                  : 'Manage SMS templates, display names, and icons.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-gray-100 bg-slate-50 md:w-56 md:border-b-0 md:border-r">
            <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible">
              {categories.map((item) => {
                const active = item.id === categoryId
                const iconKey = resolveAdminSmsCategoryIconKey(item.id, settings)
                const Icon = resolveAdminSmsCategoryIcon(iconKey)
                const label = resolveAdminSmsCategoryLabel(item.id, settings, locale, item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(item.id)
                      if (item.kind === 'locale_template' && item.locales?.length) {
                        setMessageLocale(item.locales[0])
                      }
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors md:w-full ${
                      active
                        ? 'bg-violet-600 text-white'
                        : 'text-gray-700 hover:bg-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <AdminSmsCategorySettingsPanel
              categoryId={categoryId}
              row={categoryRow}
              uiLocale={locale}
              onSaved={handleSettingsSaved}
            />

            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                {resolveAdminSmsCategoryLabel(categoryId, settings, locale, category)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isKo ? category.descriptionKo : category.descriptionEn}
              </p>
            </div>

            {category.kind === 'locale_template' && (
              <div className="mb-4 flex flex-wrap gap-2">
                {availableLocales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setMessageLocale(loc)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      messageLocale === loc
                        ? 'bg-violet-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {LOCALE_LABELS[loc]?.[isKo ? 'ko' : 'en'] ?? loc}
                  </button>
                ))}
              </div>
            )}

            {category.kind === 'staff_outreach' && (
              <div className="mb-4 flex flex-wrap gap-2">
                {(['ko', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setStaffLocale(loc)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      staffLocale === loc
                        ? 'bg-violet-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {LOCALE_LABELS[loc][isKo ? 'ko' : 'en']}
                  </button>
                ))}
              </div>
            )}

            {category.kind === 'locale_template' && (
              <AdminSmsLocaleTemplateEditor
                categoryId={categoryId}
                locale={activeLocale}
                uiLocale={locale}
                placeholderHint={category.placeholderHint}
                isActive={open}
              />
            )}

            {category.kind === 'staff_outreach' && (
              <AdminSmsStaffOutreachSection
                category={category}
                uiLocale={locale}
                messageLocale={staffLocale}
                isActive={open}
              />
            )}

            {category.kind === 'messenger_contacts' && (
              <AdminSmsMessengerContactsSection uiLocale={locale} isActive={open} />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
