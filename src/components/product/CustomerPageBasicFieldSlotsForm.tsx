'use client'

import type { BasicFieldKey } from '@/lib/customerPageZoneEditMap'
import {
  bindingLabel,
  type BasicFieldSlotDef,
  type BasicSlotValues,
} from '@/lib/customerPageFieldBindings'

type BasicFieldSlotsFormProps = {
  slots: BasicFieldSlotDef[]
  bindings: Record<string, BasicFieldKey>
  values: BasicSlotValues
  onBindingChange: (slotId: string, field: BasicFieldKey) => void
  onValueChange: (slotId: string, value: string | string[]) => void
}

export default function BasicFieldSlotsForm({
  slots,
  bindings,
  values,
  onBindingChange,
  onValueChange,
}: BasicFieldSlotsFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        각 입력칸의 <strong>연결 컬럼</strong>을 바꾸면 편집·표시·저장 대상 DB 필드가 바뀝니다. 설정은
        서버에 저장되어 모든 기기·실제 고객 페이지에 반영됩니다.
      </p>
      {slots.map((slot) => {
        const boundField = bindings[slot.slotId] ?? slot.defaultOption
        const value = values[slot.slotId]
        const hasAlternatives = slot.options.length > 0
        const inputType =
          boundField.includes('Price') ||
          boundField.includes('Age') ||
          boundField === 'maxParticipants' ||
          boundField === 'duration'
            ? 'number'
            : 'text'

        if (boundField === 'languages' || boundField === 'transportationMethods') {
          return (
            <div key={slot.slotId} className="rounded-xl border border-gray-200 p-3 space-y-2">
              <SlotHeader
                slot={slot}
                boundField={boundField}
                hasAlternatives={hasAlternatives}
                onBindingChange={onBindingChange}
              />
              <input
                type="text"
                value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                onChange={(e) =>
                  onValueChange(
                    slot.slotId,
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder={boundField === 'languages' ? '한국어, English' : 'van, bus'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-[11px] text-gray-500">쉼표로 구분</p>
            </div>
          )
        }

        return (
          <div key={slot.slotId} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <SlotHeader
              slot={slot}
              boundField={boundField}
              hasAlternatives={hasAlternatives}
              onBindingChange={onBindingChange}
            />
            <input
              type={inputType}
              value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
              onChange={(e) => onValueChange(slot.slotId, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )
      })}
    </div>
  )
}

function SlotHeader({
  slot,
  boundField,
  hasAlternatives,
  onBindingChange,
}: {
  slot: BasicFieldSlotDef
  boundField: BasicFieldKey
  hasAlternatives: boolean
  onBindingChange: (slotId: string, field: BasicFieldKey) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <label className="text-xs font-medium text-gray-800">{slot.label}</label>
      {hasAlternatives ? (
        <select
          value={boundField}
          onChange={(e) => onBindingChange(slot.slotId, e.target.value as BasicFieldKey)}
          className="text-[11px] border border-border rounded-md px-2 py-1 bg-primary/5 text-foreground max-w-full min-w-[12rem]"
          aria-label={`${slot.label} 연결 컬럼`}
        >
          {slot.options.map((option) => (
            <option key={option} value={option}>
              {bindingLabel(option)}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[11px] text-gray-500">{bindingLabel(boundField)}</span>
      )}
    </div>
  )
}
