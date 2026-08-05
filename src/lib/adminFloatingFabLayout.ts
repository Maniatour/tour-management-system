import { getLayoutTopInset } from '@/lib/resizableRect'

export const FAB_SIZE = 56
/** lg 미만(모바일 푸터 표시 구간) FAB 지름 */
export const FAB_SIZE_MOBILE = 44
export const FAB_RIGHT_PX = 16
export const FAB_GAP_PX = 12
export const FAB_GAP_MOBILE_PX = 8
/** FAB `bottom` = footer + safe-area + 4.5rem */
export const FAB_BASE_BOTTOM_EXTRA_PX = 72
export const PANEL_GAP_ABOVE_FAB_PX = 12
export const VIEWPORT_MARGIN_PX = 12
/** 패널 최대 높이 = 뷰포트 대비 비율 (2K·고해상도에서 더 많은 세로 공간 사용) */
export const FLOATING_PANEL_MAX_HEIGHT_RATIO = 0.92
/** AdminSidebarAndHeader 고정 헤더(z-[9999]) 위에 표시 */
export const ADMIN_FLOATING_PANEL_Z_CLASS = 'z-[10010]'
export const ADMIN_FLOATING_FAB_Z_CLASS = 'z-[10005]'
/** 플로팅 업무 패널 위에 뜨는 드롭다운·메뉴 포털 (패널 z-index보다 높아야 함) */
export const ADMIN_FLOATING_PORTAL_Z_INDEX = 10020
/** 업무 Todo 오른쪽 고정 시 메인 콘텐츠 padding-right에 사용 */
export const ADMIN_TODO_DOCK_WIDTH_CSS_VAR = '--admin-todo-dock-width'
export const ADMIN_TODO_DOCKED_HTML_CLASS = 'admin-todo-docked'
export const ADMIN_TODO_DOCK_MAX_WIDTH_RATIO = 0.5

/** 현재 뷰포트 기준 FAB 지름 (모바일 축소) */
export function getFabSize(): number {
  return isAdminMobileViewport() ? FAB_SIZE_MOBILE : FAB_SIZE
}

export function getFabGapPx(): number {
  return isAdminMobileViewport() ? FAB_GAP_MOBILE_PX : FAB_GAP_PX
}

export function fabBottomExtraPx(stackIndex: number): number {
  return FAB_BASE_BOTTOM_EXTRA_PX + stackIndex * (getFabSize() + getFabGapPx())
}

export function readViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  return window.visualViewport?.height ?? window.innerHeight
}

export function readViewportWidth(): number {
  if (typeof window === 'undefined') return 0
  return window.visualViewport?.width ?? window.innerWidth
}

/** lg 미만에서만 MobileFooter가 표시됨 */
export function isMobileFooterVisible(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 1023px)').matches
}

/** lg 미만 — 플로팅 패널을 전체 화면 모달로 표시 */
export function isAdminMobileViewport(): boolean {
  return isMobileFooterVisible()
}

/** 고정 헤더 아래 최소 top (패널이 헤더에 가려지지 않도록) */
export function getFloatingPanelTopMarginPx(): number {
  return getLayoutTopInset() + VIEWPORT_MARGIN_PX
}

export function readFooterOffsetPx(): number {
  if (typeof window === 'undefined') return 0
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--footer-height').trim()
  const n = parseInt(raw.replace('px', ''), 10)
  return Number.isFinite(n) ? n : 0
}

/** 데스크톱(lg+)에서는 숨겨진 모바일 푸터 높이를 빼지 않음 */
export function readEffectiveFooterOffsetPx(): number {
  if (!isMobileFooterVisible()) return 0
  return readFooterOffsetPx()
}

export function readSafeAreaBottomPx(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(probe)
  const pb = parseInt(getComputedStyle(probe).paddingBottom, 10)
  document.body.removeChild(probe)
  return Number.isFinite(pb) ? pb : 0
}

/** FAB 버튼 `bottom` CSS 값 */
export function fabBottomCss(stackIndex = 0): string {
  const footer = readEffectiveFooterOffsetPx()
  const bottomExtra = fabBottomExtraPx(stackIndex)
  return `calc(${footer}px + env(safe-area-inset-bottom, 0px) + ${bottomExtra}px)`
}

/** 패널 하단이 차지하면 안 되는 영역 (FAB 스택 + 여백 + 푸터) */
export function getFloatingPanelBottomReservePx(stackIndex = 0): number {
  const footer = readEffectiveFooterOffsetPx()
  const safeBottom = readSafeAreaBottomPx()
  return footer + safeBottom + fabBottomExtraPx(stackIndex) + getFabSize() + PANEL_GAP_ABOVE_FAB_PX
}

export function fabTopPx(stackIndex = 0): number {
  if (typeof window === 'undefined') return 0
  const vh = readViewportHeight()
  const reserve = getFloatingPanelBottomReservePx(stackIndex)
  return vh - reserve + PANEL_GAP_ABOVE_FAB_PX
}

export type FloatingPanelSize = { width: number; height: number }

export function getFloatingPanelMaxHeight(
  stackIndex = 0,
  topMargin = getFloatingPanelTopMarginPx()
): number {
  const vh = readViewportHeight()
  const reserve = getFloatingPanelBottomReservePx(stackIndex)
  return Math.max(0, vh - topMargin - reserve - VIEWPORT_MARGIN_PX)
}

export function clampFloatingPanelSize(
  width: number,
  height: number,
  min: FloatingPanelSize,
  maxHeightRatio = FLOATING_PANEL_MAX_HEIGHT_RATIO,
  stackIndex = 0
): FloatingPanelSize {
  if (typeof window === 'undefined') {
    return {
      width: Math.max(min.width, width),
      height: Math.max(min.height, height),
    }
  }
  const vw = readViewportWidth()
  const vh = readViewportHeight()
  const maxByRatio = vh * maxHeightRatio
  const maxByFab = getFloatingPanelMaxHeight(stackIndex)
  const maxHeight = Math.min(maxByRatio, maxByFab)

  return {
    width: Math.min(Math.max(min.width, width), vw * 0.92),
    height: Math.min(Math.max(min.height, height), maxHeight),
  }
}

/** 현재 뷰포트에서 권장 패널 크기 (열 때·리사이즈 시 활용) */
export function suggestFloatingPanelSize(
  min: FloatingPanelSize,
  preferred: FloatingPanelSize,
  stackIndex = 0
): FloatingPanelSize {
  const maxH = getFloatingPanelMaxHeight(stackIndex)
  const targetH = Math.min(maxH, Math.max(preferred.height, Math.round(maxH * 0.72)))
  return clampFloatingPanelSize(preferred.width, targetH, min, FLOATING_PANEL_MAX_HEIGHT_RATIO, stackIndex)
}

export function clampFloatingPanelPosition(
  x: number,
  y: number,
  size: FloatingPanelSize,
  options: { minimized?: boolean; headerHeight?: number; stackIndex?: number } = {}
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const { minimized = false, headerHeight = 50, stackIndex = 0 } = options
  const panelW = size.width
  const panelH = minimized ? headerHeight : size.height
  const vh = readViewportHeight()
  const vw = readViewportWidth()
  const reserve = getFloatingPanelBottomReservePx(stackIndex)
  const maxY = vh - panelH - reserve - VIEWPORT_MARGIN_PX
  const minY = getFloatingPanelTopMarginPx()
  const minX = VIEWPORT_MARGIN_PX
  const maxX = vw - panelW - VIEWPORT_MARGIN_PX

  return {
    x: Math.min(Math.max(minX, x), Math.max(minX, maxX)),
    y: Math.min(Math.max(minY, y), Math.max(minY, maxY)),
  }
}

export function defaultFloatingPanelPosition(
  size: FloatingPanelSize,
  options: { minimized?: boolean; headerHeight?: number; stackIndex?: number } = {}
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  const { minimized = false, headerHeight = 50, stackIndex = 0 } = options
  const panelH = minimized ? headerHeight : size.height
  const x = readViewportWidth() - size.width - FAB_RIGHT_PX
  const y = fabTopPx(stackIndex) - PANEL_GAP_ABOVE_FAB_PX - panelH
  return clampFloatingPanelPosition(x, y, size, { minimized, headerHeight, stackIndex })
}

export function clampDockedFloatingPanelWidth(
  width: number,
  minWidth: number,
  maxWidthRatio = ADMIN_TODO_DOCK_MAX_WIDTH_RATIO
): number {
  if (typeof window === 'undefined') {
    return Math.max(minWidth, width)
  }
  const vw = readViewportWidth()
  return Math.min(Math.max(minWidth, width), vw * maxWidthRatio)
}

export function setAdminTodoDockLayoutActive(active: boolean, width?: number): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (active && Number.isFinite(width) && (width as number) > 0) {
    root.classList.add(ADMIN_TODO_DOCKED_HTML_CLASS)
    root.style.setProperty(ADMIN_TODO_DOCK_WIDTH_CSS_VAR, `${width}px`)
    return
  }
  root.classList.remove(ADMIN_TODO_DOCKED_HTML_CLASS)
  root.style.removeProperty(ADMIN_TODO_DOCK_WIDTH_CSS_VAR)
}
