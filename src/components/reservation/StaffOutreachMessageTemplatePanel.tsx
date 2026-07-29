'use client'

import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LazyResidentInquiryEmailBodyRichEditor from '@/components/reservation/LazyResidentInquiryEmailBodyRichEditor'
import {
  STAFF_OUTREACH_BUILTIN_TEMPLATE_ID,
  defaultStaffOutreachTemplateName,
  type StaffOutreachMessageChannel,
} from '@/lib/staffOutreachMessageTemplates'
import type { useStaffOutreachMessageTemplates } from '@/hooks/useStaffOutreachMessageTemplates'

type TemplateManager = ReturnType<typeof useStaffOutreachMessageTemplates>

export type StaffOutreachMessageTemplatePanelProps = {
  channel: StaffOutreachMessageChannel
  uiLocale: string
  editMode: boolean
  showSubject: boolean
  placeholderHint: string
  shellNote?: string | undefined
  accentClass?: string
  templateManager: TemplateManager
}

export default function StaffOutreachMessageTemplatePanel({
  channel,
  uiLocale,
  editMode,
  showSubject,
  placeholderHint,
  shellNote,
  accentClass = 'violet',
  templateManager,
}: StaffOutreachMessageTemplatePanelProps) {
  const t = useTranslations('reservations.card')
  const {
    templates,
    selectedId,
    selectTemplate,
    templateName,
    setTemplateName,
    subjectTpl,
    setSubjectTpl,
    bodyTpl,
    setBodyTpl,
    templateEditorNonce,
    loading,
    saving,
    deleting,
    adding,
    notice,
    isBuiltinSelected,
    saveCurrentTemplate,
    addNewTemplate,
    deleteCurrentTemplate,
  } = templateManager

  const ringClass = accentClass === 'teal' ? 'focus:ring-teal-500' : 'focus:ring-violet-500'
  const spinClass = accentClass === 'teal' ? 'text-teal-600' : 'text-violet-600'

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t('staffOutreachTemplateSelect')}
          </label>
          <select
            value={selectedId}
            onChange={(e) => selectTemplate(e.target.value)}
            disabled={loading}
            className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 ${ringClass}`}
          >
            <option value={STAFF_OUTREACH_BUILTIN_TEMPLATE_ID}>
              {t('staffOutreachBuiltinOption', {
                name: defaultStaffOutreachTemplateName(uiLocale === 'en' ? 'en' : 'ko'),
              })}
            </option>
            {templates.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void addNewTemplate()}
          disabled={adding || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t('staffOutreachTemplateAdd')}
        </button>
        <button
          type="button"
          onClick={() => void deleteCurrentTemplate()}
          disabled={deleting || loading || isBuiltinSelected}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {t('staffOutreachTemplateDelete')}
        </button>
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {notice}
        </div>
      )}

      {editMode && (
        <div className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-600">{placeholderHint}</p>
          {shellNote ? <p className="text-xs text-gray-500">{shellNote}</p> : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {t('staffOutreachTemplateNameField')}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={loading || isBuiltinSelected}
              placeholder={t('staffOutreachTemplateNamePlaceholder')}
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 ${ringClass}`}
            />
          </div>
          {showSubject && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {t('cancelFollowUpTemplateSubjectField')}
              </label>
              <input
                type="text"
                value={subjectTpl}
                onChange={(e) => setSubjectTpl(e.target.value)}
                disabled={loading}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 ${ringClass}`}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {channel === 'email'
                ? t('cancelFollowUpTemplateBodyField')
                : t('cancelFollowUpTemplateSmsField')}
            </label>
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center rounded border border-gray-200 bg-white">
                <Loader2 className={`h-8 w-8 animate-spin ${spinClass}`} />
              </div>
            ) : channel === 'email' ? (
              <LazyResidentInquiryEmailBodyRichEditor
                key={templateEditorNonce}
                value={bodyTpl}
                onChange={setBodyTpl}
                disabled={loading}
                uiLocale={uiLocale}
              />
            ) : (
              <textarea
                key={templateEditorNonce}
                value={bodyTpl}
                onChange={(e) => setBodyTpl(e.target.value)}
                rows={6}
                disabled={loading}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 ${ringClass}`}
              />
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveCurrentTemplate()}
              disabled={saving || loading || !bodyTpl.trim()}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                accentClass === 'teal'
                  ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                  : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
              }`}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? t('cancelFollowUpTemplateSaving') : t('cancelFollowUpSaveTemplate')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
