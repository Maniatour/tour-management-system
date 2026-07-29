'use client'

import type { OpTodoActionConfig, OpTodoActionType } from '@/lib/opTodoAction'
import {
  FOLLOW_UP_TABS,
  OP_TODO_ACTION_TYPES,
  RESERVATION_ACTION_TABS,
} from '@/lib/opTodoAction'
import { OpTodoProductSelect } from '@/components/admin/todo/OpTodoProductSelect'
import { OpTodoTourSelect } from '@/components/admin/todo/OpTodoTourSelect'

export type OpTodoActionFormState = {
  action_type: OpTodoActionType
  action_config: OpTodoActionConfig
}

export const EMPTY_OP_TODO_ACTION_FORM: OpTodoActionFormState = {
  action_type: 'none',
  action_config: {},
}

type OpTodoActionConfigFieldsProps = {
  locale: string
  value: OpTodoActionFormState
  onChange: (next: OpTodoActionFormState) => void
  compact?: boolean
}

export function OpTodoActionConfigFields({
  locale,
  value,
  onChange,
  compact = false,
}: OpTodoActionConfigFieldsProps) {
  const isKo = locale === 'ko'
  const { action_type, action_config } = value

  const setType = (action_type: OpTodoActionType) => {
    onChange({ action_type, action_config: action_type === 'none' ? {} : action_config })
  }

  const patchConfig = (patch: Record<string, string | number | undefined>) => {
    const next: OpTodoActionConfig = { ...action_config }
    for (const [key, value] of Object.entries(patch)) {
      const k = key as keyof OpTodoActionConfig
      if (value === undefined || value === '') delete next[k]
      else next[k] = value as never
    }
    onChange({ action_type, action_config: next })
  }

  const labelClass = compact ? 'text-xs font-medium text-gray-700' : 'text-sm font-medium text-gray-800'
  const inputClass = compact
    ? 'w-full rounded border border-gray-300 px-2 py-1.5 text-xs'
    : 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm'

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3'}>
      {!compact && (
        <p className="text-sm font-semibold text-gray-900">
          {isKo ? '클릭 시 연결' : 'Click action'}
        </p>
      )}
      <div>
        <label className={labelClass}>{isKo ? '연결 유형' : 'Action type'}</label>
        <select
          value={action_type}
          onChange={(e) => setType(e.target.value as OpTodoActionType)}
          className={`${inputClass} mt-1`}
        >
          {OP_TODO_ACTION_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {isKo ? opt.labelKo : opt.labelEn}
            </option>
          ))}
        </select>
      </div>

      {action_type === 'tour_detail' && (
        <>
          <div>
            <label className={labelClass}>{isKo ? '상품 (선택)' : 'Product (optional)'}</label>
            <OpTodoProductSelect
              locale={locale}
              value={action_config.productId}
              onChange={(productId) => patchConfig({ productId })}
              inputClass={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {isKo ? '투어일 오프셋 (일)' : 'Tour date offset (days)'}
            </label>
            <input
              type="number"
              value={action_config.tourDateOffsetDays ?? ''}
              onChange={(e) => {
                const n = e.target.value === '' ? undefined : Number(e.target.value)
                patchConfig({ tourDateOffsetDays: Number.isFinite(n) ? n : undefined })
              }}
              placeholder={isKo ? '0 = 오늘' : '0 = today'}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>{isKo ? '투어 선택' : 'Select tour'}</label>
            <OpTodoTourSelect
              locale={locale}
              value={action_config.tourId}
              {...(action_config.productId ? { productId: action_config.productId } : {})}
              {...(action_config.tourDateOffsetDays !== undefined
                ? { tourDateOffsetDays: action_config.tourDateOffsetDays }
                : {})}
              onChange={(tourId) => patchConfig({ tourId })}
              inputClass={inputClass}
            />
          </div>
        </>
      )}

      {action_type === 'tours_page' && (
        <>
          <div>
            <label className={labelClass}>
              {isKo ? '투어일 오프셋 (일)' : 'Tour date offset (days)'}
            </label>
            <input
              type="number"
              value={action_config.tourDateOffsetDays ?? ''}
              onChange={(e) => {
                const n = e.target.value === '' ? undefined : Number(e.target.value)
                patchConfig({ tourDateOffsetDays: Number.isFinite(n) ? n : undefined })
              }}
              placeholder={isKo ? '예: 2 = 이틀 후' : 'e.g. 2 = two days later'}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>{isKo ? '상품 (선택)' : 'Product (optional)'}</label>
            <OpTodoProductSelect
              locale={locale}
              value={action_config.productId}
              onChange={(productId) => patchConfig({ productId })}
              inputClass={inputClass}
            />
          </div>
        </>
      )}

      {(action_type === 'reservation_action' || action_type === 'reservation_follow_up') && (
        <div>
          <label className={labelClass}>
            {isKo ? '투어일 오프셋 (일)' : 'Tour date offset (days)'}
          </label>
          <input
            type="number"
            value={action_config.tourDateOffsetDays ?? ''}
            onChange={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value)
              patchConfig({ tourDateOffsetDays: Number.isFinite(n) ? n : undefined })
            }}
            placeholder={isKo ? '예: 2 = 이틀 후' : 'e.g. 2 = two days later'}
            className={`${inputClass} mt-1`}
          />
        </div>
      )}

      {(action_type === 'reservation_action' || action_type === 'reservation_follow_up') && (
        <>
          <div>
            <label className={labelClass}>{isKo ? '모달 탭' : 'Modal tab'}</label>
            <select
              value={String(action_config.tab || '')}
              onChange={(e) => patchConfig({ tab: e.target.value || undefined })}
              className={`${inputClass} mt-1`}
            >
              <option value="">{isKo ? '기본 탭' : 'Default tab'}</option>
              {(action_type === 'reservation_action' ? RESERVATION_ACTION_TABS : FOLLOW_UP_TABS).map(
                (tab) => (
                  <option key={tab.value} value={tab.value}>
                    {tab.labelKo}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              {isKo ? '상품명 포함 필터' : 'Product name contains'}
            </label>
            <input
              value={action_config.productNameContains || ''}
              onChange={(e) => patchConfig({ productNameContains: e.target.value.trim() || undefined })}
              placeholder={isKo ? '예: 앤텔롭, Antelope' : 'e.g. Antelope'}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>{isKo ? '상품' : 'Product'}</label>
            <OpTodoProductSelect
              locale={locale}
              value={action_config.productId}
              onChange={(productId) => patchConfig({ productId })}
              inputClass={inputClass}
            />
          </div>
        </>
      )}

      {action_type === 'custom_url' && (
        <div>
          <label className={labelClass}>URL</label>
          <input
            value={action_config.url || ''}
            onChange={(e) => patchConfig({ url: e.target.value.trim() || undefined })}
            placeholder="/admin/reservations"
            className={`${inputClass} mt-1`}
          />
        </div>
      )}

      {action_type === 'reservations_page' && (
        <div>
          <label className={labelClass}>{isKo ? '경로 (선택)' : 'Path (optional)'}</label>
          <input
            value={action_config.path || ''}
            onChange={(e) => patchConfig({ path: e.target.value.trim() || undefined })}
            placeholder="/admin/reservations"
            className={`${inputClass} mt-1`}
          />
        </div>
      )}
    </div>
  )
}
