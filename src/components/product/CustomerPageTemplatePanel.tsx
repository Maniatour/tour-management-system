'use client'

import { useCallback, useMemo, useState } from 'react'
import { Check, Layers, Loader2, Save, X } from 'lucide-react'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import {
  CUSTOMER_PAGE_TEMPLATES,
  getCustomerPageTemplateById,
  getTemplatePreviewTheme,
  type CustomerPageTemplateDefinition,
} from '@/lib/customerPageTemplate'
import { getStructureSummary } from '@/lib/customerPageHomeStructure'
import {
  loadCustomerPageTemplateId,
  persistCustomerPageTemplate,
} from '@/lib/customerPageTemplatePersistence'
import CustomerPageTemplatePreview from '@/components/product/CustomerPageTemplatePreview'

type CustomerPageTemplatePanelProps = {
  onClose: () => void
  onSaved: () => void
  variant?: 'sidebar' | 'modal'
}

function TemplatePreviewCard({
  template,
  selected,
  onSelect,
}: {
  template: CustomerPageTemplateDefinition
  selected: boolean
  onSelect: () => void
}) {
  const theme = getTemplatePreviewTheme(template)
  const visibleSections = template.homeLayout.sections.filter((section) => section.visible)
  const structureLabels = getStructureSummary(template.structure).slice(0, 3)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col rounded-2xl border-2 overflow-hidden text-left transition-all hover:shadow-lg ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-200 shadow-md'
          : 'border-slate-200 hover:border-violet-300'
      }`}
    >
      <CustomerPageTemplatePreview template={template} compact className="rounded-none border-0" />
      {selected && (
        <span className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow z-10">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="p-3 bg-white space-y-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{template.label}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{template.description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          테마: {theme.label} · 섹션 {visibleSections.length}개 · {structureLabels.join(' · ')}
        </p>
      </div>
    </button>
  )
}

export default function CustomerPageTemplatePanel({
  onClose,
  onSaved,
  variant = 'modal',
}: CustomerPageTemplatePanelProps) {
  const savedTemplateId = loadCustomerPageTemplateId() ?? CUSTOMER_PAGE_TEMPLATES[0].id
  const [draftTemplateId, setDraftTemplateId] = useState(savedTemplateId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = draftTemplateId !== savedTemplateId
  const draftTemplate = useMemo(
    () => getCustomerPageTemplateById(draftTemplateId),
    [draftTemplateId]
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await persistCustomerPageTemplate(draftTemplateId)
      emitCustomerPageBindingsUpdate()
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save customer page template:', err)
      setError('템플릿 적용에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [draftTemplateId, onClose, onSaved])

  const shellClass =
    variant === 'modal'
      ? 'flex flex-col h-full min-h-0 bg-white'
      : 'flex flex-col h-full min-h-0 border-l border-gray-200 bg-white'

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-600" />
            페이지 템플릿
          </h3>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            색상·섹션 순서·레이아웃 구조를 한 번에 적용합니다. 카드는 섹션 목록에서 데이터 연결을
            조정할 수 있습니다.
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

      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0 space-y-3">
        <p className="text-xs text-slate-600">
          선택 중: <strong className="text-slate-900">{draftTemplate.label}</strong>
        </p>
        <CustomerPageTemplatePreview template={draftTemplate} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CUSTOMER_PAGE_TEMPLATES.map((template) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              selected={draftTemplateId === template.id}
              onSelect={() => setDraftTemplateId(template.id)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pb-2 text-[11px] text-amber-800 bg-amber-50/80 border-t border-amber-100 shrink-0 pt-2">
        템플릿 적용 시 전체 테마·홈 섹션 순서·영역별 레이아웃·UI 설정이 갱신됩니다.
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
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          템플릿 적용
        </button>
      </div>
    </div>
  )
}
