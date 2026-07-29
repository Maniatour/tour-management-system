import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { OpTodoActionConfig, OpTodoActionType } from '@/lib/opTodoAction'
import { tourDateFromOffset } from '@/lib/opTodoAction'

const NAVIGATION_ACTIONS = new Set<OpTodoActionType>([
  'tours_page',
  'reservations_page',
  'team_board',
  'custom_url',
])

export function isOpTodoNavigationAction(actionType: OpTodoActionType): boolean {
  return NAVIGATION_ACTIONS.has(actionType)
}

export function runOpTodoNavigationAction(
  actionType: OpTodoActionType,
  config: OpTodoActionConfig,
  opts: { locale: string; router: AppRouterInstance; surface: 'admin' | 'guide' }
): boolean {
  const { locale, router, surface } = opts

  if (actionType === 'tours_page') {
    const date = tourDateFromOffset(config.tourDateOffsetDays)
    const qs = new URLSearchParams()
    if (date) qs.set('date', date)
    if (config.productId) qs.set('productId', config.productId)
    router.push(`/${locale}/admin/tours${qs.toString() ? `?${qs}` : ''}`)
    return true
  }

  if (actionType === 'reservations_page') {
    const path = config.path || `/${locale}/admin/reservations`
    router.push(path)
    return true
  }

  if (actionType === 'team_board') {
    router.push(surface === 'guide' ? `/${locale}/guide/team-board` : `/${locale}/admin/team-board`)
    return true
  }

  if (actionType === 'custom_url' && config.url) {
    if (config.url.startsWith('http')) {
      window.open(config.url, '_blank', 'noopener,noreferrer')
    } else {
      router.push(config.url)
    }
    return true
  }

  return false
}

/** 가이드 화면에서 모달형 액션은 관리자 페이지를 새 탭으로 연다 */
export function openOpTodoAdminFallback(
  actionType: OpTodoActionType,
  config: OpTodoActionConfig,
  locale: string
): void {
  let path = `/${locale}/admin/reservations`

  if (actionType === 'tours_page' || actionType === 'tour_detail') {
    const date = tourDateFromOffset(config.tourDateOffsetDays)
    const qs = new URLSearchParams()
    if (date) qs.set('date', date)
    if (config.productId) qs.set('productId', config.productId)
    path = `/${locale}/admin/tours${qs.toString() ? `?${qs}` : ''}`
  }

  window.open(path, '_blank', 'noopener,noreferrer')
}
