'use client'

import {
  OpTodoActionConfigFields,
  EMPTY_OP_TODO_ACTION_FORM,
  type OpTodoActionFormState,
} from '@/components/admin/todo/OpTodoActionConfigFields'
import { HubArticleManualLinkField } from '@/components/team-board/HubArticleManualLinkField'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'

export type OpTodoFormValues = {
  title: string
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
  department: 'office' | 'guide' | 'common'
  notify_enabled: boolean
  notify_time: string
  notify_weekday: number
  notify_day_of_month: number
  notify_month: number
  action_type: OpTodoActionFormState['action_type']
  action_config: OpTodoActionFormState['action_config']
  linked_hub_article_id: string | null
}

export const EMPTY_OP_TODO_FORM: OpTodoFormValues = {
  title: '',
  category: 'daily',
  department: 'common',
  notify_enabled: false,
  notify_time: '09:00',
  notify_weekday: 1,
  notify_day_of_month: 1,
  notify_month: 1,
  linked_hub_article_id: null,
  ...EMPTY_OP_TODO_ACTION_FORM,
}

type OpTodoFormFieldsProps = {
  locale: string
  value: OpTodoFormValues
  onChange: (next: OpTodoFormValues) => void
  hubArticles?: HubArticleLinkOption[]
  hubArticlesLoading?: boolean
  hubArticlesLoadFailed?: boolean
  onRetryHubArticles?: () => void
}

export function OpTodoFormFields({
  locale,
  value,
  onChange,
  hubArticles = [],
  hubArticlesLoading = false,
  hubArticlesLoadFailed = false,
  onRetryHubArticles,
}: OpTodoFormFieldsProps) {
  const patch = (partial: Partial<OpTodoFormValues>) => onChange({ ...value, ...partial })

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Todo 제목</label>
        <input
          value={value.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="체크리스트 항목을 입력하세요"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-800">부서</label>
        <div className="flex flex-wrap gap-2">
          {(['office', 'guide', 'common'] as const).map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => patch({ department: dept })}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                value.department === dept
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {dept === 'office' ? 'Office' : dept === 'guide' ? 'Guide' : '공통'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-800">반복 주기</label>
        <div className="flex flex-wrap gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => patch({ category: period })}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                value.category === period
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period === 'daily'
                ? '일일'
                : period === 'weekly'
                  ? '주간'
                  : period === 'monthly'
                    ? '월간'
                    : '연간'}
            </button>
          ))}
        </div>
      </div>

      <OpTodoActionConfigFields
        locale={locale}
        value={{ action_type: value.action_type, action_config: value.action_config }}
        onChange={(next) =>
          patch({ action_type: next.action_type, action_config: next.action_config })
        }
      />

      <HubArticleManualLinkField
        locale={locale}
        value={value.linked_hub_article_id}
        onChange={(linked_hub_article_id) => patch({ linked_hub_article_id })}
        hubArticles={hubArticles}
        loading={hubArticlesLoading}
        loadFailed={hubArticlesLoadFailed}
        {...(onRetryHubArticles ? { onRetry: onRetryHubArticles } : {})}
      />

      <div className="space-y-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={value.notify_enabled}
            onChange={(e) => patch({ notify_enabled: e.target.checked })}
          />
          알림 보내기
        </label>
        <p className="text-xs leading-relaxed text-gray-600">
          켜면 설정한 시각(한국 기준)에 해당 부서에 맞는 팀원 화면에 알림 모달이 뜹니다.
        </p>
        {value.notify_enabled ? (
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-medium text-gray-700">알림 시각</label>
              <input
                type="time"
                value={value.notify_time}
                onChange={(e) => patch({ notify_time: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
              />
            </div>
            {value.category === 'weekly' ? (
              <div>
                <label className="text-xs font-medium text-gray-700">요일</label>
                <select
                  value={value.notify_weekday}
                  onChange={(e) => patch({ notify_weekday: parseInt(e.target.value, 10) })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
                    <option key={label} value={i}>
                      {label}요일
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {value.category === 'monthly' || value.category === 'yearly' ? (
              <div>
                <label className="text-xs font-medium text-gray-700">매월 몇 일</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={value.notify_day_of_month}
                  onChange={(e) =>
                    patch({
                      notify_day_of_month: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)),
                    })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                />
              </div>
            ) : null}
            {value.category === 'yearly' ? (
              <div>
                <label className="text-xs font-medium text-gray-700">월</label>
                <select
                  value={value.notify_month}
                  onChange={(e) => patch({ notify_month: parseInt(e.target.value, 10) })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
