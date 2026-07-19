'use client'

import LightRichEditor from '@/components/LightRichEditor'
import type { DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import {
  detailBindingLabel,
  isDetailTableBinding,
  type DetailBindingKey,
  type DetailFieldSlotDef,
  type DetailSlotValues,
} from '@/lib/customerPageFieldBindings'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'

type DetailFieldSlotsFormProps = {
  slots: DetailFieldSlotDef[]
  bindings: Record<string, DetailBindingKey>
  values: DetailSlotValues
  visibility: Partial<Record<DetailFieldKey, boolean>>
  onBindingChange: (slotId: DetailFieldKey, binding: DetailBindingKey) => void
  onValueChange: (slotId: DetailFieldKey, value: string) => void
  onVisibilityChange: (next: Partial<Record<DetailFieldKey, boolean>>) => void
}

export default function CustomerPageDetailFieldSlotsForm({
  slots,
  bindings,
  values,
  visibility,
  onBindingChange,
  onValueChange,
  onVisibilityChange,
}: DetailFieldSlotsFormProps) {
  const {
    t,
    detailFieldLabel,
    showOnCustomerPage,
    contentPlaceholder,
    editorUiLocale,
  } = useCustomerPageEditLabels()
  const editorHeight = useModalEditorHeight(slots.length > 1 ? 360 : 260)

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        {t.rich('bindingHint', {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      {slots.map((slot) => {
        const bound = bindings[slot.slotId] ?? slot.defaultOption
        const hasAlternatives = slot.options.length > 0
        const showVisibility = slot.supportsVisibility && isDetailTableBinding(bound)
        const label = detailFieldLabel(slot.slotId)

        return (
          <div key={slot.slotId} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="text-xs font-medium text-gray-800">{label}</label>
              <div className="flex flex-wrap items-center gap-2">
                {hasAlternatives ? (
                  <select
                    value={bound}
                    onChange={(e) =>
                      onBindingChange(slot.slotId, e.target.value as DetailBindingKey)
                    }
                    className="text-[11px] border border-border rounded-md px-2 py-1 bg-primary/5 text-foreground max-w-full min-w-[14rem]"
                    aria-label={t('bindingColumnAria', { label })}
                  >
                    {slot.options.map((option) => (
                      <option key={option} value={option}>
                        {detailBindingLabel(option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-gray-500">{detailBindingLabel(bound)}</span>
                )}
                {showVisibility && (
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibility[slot.slotId] !== false}
                      onChange={(e) =>
                        onVisibilityChange({ ...visibility, [slot.slotId]: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                    />
                    {showOnCustomerPage}
                  </label>
                )}
              </div>
            </div>
            <LightRichEditor
              value={values[slot.slotId] ?? ''}
              onChange={(v) => onValueChange(slot.slotId, v ?? '')}
              height={slot.slotId.startsWith('slogan') ? 80 : editorHeight}
              placeholder={contentPlaceholder(label)}
              enableResize
              uiLocale={editorUiLocale}
              maxHeight={1200}
            />
          </div>
        )
      })}
    </div>
  )
}
