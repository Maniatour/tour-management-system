'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, Loader2, Palette, Save, X } from 'lucide-react'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import {
  CUSTOMER_PAGE_GLOBAL_THEMES,
  getGlobalThemeById,
  type CustomerPageGlobalThemeDefinition,
} from '@/lib/customerPageGlobalTheme'
import { persistCustomerPageGlobalTheme, loadCustomerPageGlobalThemeId } from '@/lib/customerPageGlobalThemePersistence'

type CustomerPageGlobalThemePanelProps = {
  onClose: () => void
  onSaved: () => void
  variant?: 'sidebar' | 'modal'
}

function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: CustomerPageGlobalThemeDefinition
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col rounded-2xl border-2 overflow-hidden text-left transition-all hover:shadow-lg ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md'
          : 'border-slate-200 hover:border-indigo-300'
      }`}
    >
      <div
        className="h-24 w-full relative"
        style={{
          background: `linear-gradient(135deg, ${theme.previewFrom}, ${theme.previewTo})`,
        }}
      >
        <div className="absolute inset-0 flex items-end p-3 gap-2">
          <span
            className="inline-block h-6 flex-1 max-w-[4.5rem] rounded-md shadow-sm"
            style={{ backgroundColor: theme.accentColor }}
          />
          <span className="inline-block h-3 flex-1 rounded-full bg-white/30" />
        </div>
        {selected && (
          <span className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="p-3 bg-white">
        <p className="text-sm font-semibold text-gray-900">{theme.label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{theme.description}</p>
      </div>
    </button>
  )
}

export default function CustomerPageGlobalThemePanel({
  onClose,
  onSaved,
  variant = 'modal',
}: CustomerPageGlobalThemePanelProps) {
  const savedThemeId = loadCustomerPageGlobalThemeId()
  const [draftThemeId, setDraftThemeId] = useState(savedThemeId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = draftThemeId !== savedThemeId
  const draftTheme = useMemo(() => getGlobalThemeById(draftThemeId), [draftThemeId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await persistCustomerPageGlobalTheme(draftThemeId)
      emitCustomerPageBindingsUpdate()
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save global theme:', err)
      setError('테마 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [draftThemeId, onClose, onSaved])

  const shellClass =
    variant === 'modal'
      ? 'flex flex-col h-full min-h-0 bg-white'
      : 'flex flex-col h-full min-h-0 border-l border-gray-200 bg-white'

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-sky-50 to-indigo-50 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-600" />
            전체 테마
          </h3>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            홈·목록·상세 등 모든 고객 페이지에 색상·분위기가 함께 적용됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/80 hover:text-gray-600 shrink-0"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
        <p className="text-xs text-slate-600">
          선택 중: <strong className="text-slate-900">{draftTheme.label}</strong>
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CUSTOMER_PAGE_GLOBAL_THEMES.map((theme) => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              selected={draftThemeId === theme.id}
              onSelect={() => setDraftThemeId(theme.id)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pb-2 text-[11px] text-amber-800 bg-amber-50/80 border-t border-amber-100 shrink-0 pt-2">
        테마를 바꾸면 영역별로 따로 저장한 UI 설정은 초기화되고, 새 테마가 전체에 적용됩니다.
        이후 각 영역 「수정 → UI」에서 세부 조정할 수 있습니다.
      </div>

      {error && <div className="px-4 pb-2 text-xs text-red-600 shrink-0">{error}</div>}

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-3 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          테마 적용
        </button>
      </div>
    </div>
  )
}
