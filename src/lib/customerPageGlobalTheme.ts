export const DEFAULT_GLOBAL_THEME_ID = 'kovegas-classic'

export type CustomerPageGlobalThemeDefinition = {
  id: string
  label: string
  description: string
  presetId: string
  /** 페이지 바깥 배경 (main 주변) */
  pageBackground: string
  accentColor: string
  previewFrom: string
  previewTo: string
  isDark: boolean
}

export const CUSTOMER_PAGE_GLOBAL_THEMES: CustomerPageGlobalThemeDefinition[] = [
  {
    id: 'kovegas-classic',
    label: '코베가스 클래식',
    description: '신뢰감 있는 브랜드 블루 · 여행 사이트 기본',
    presetId: 'default',
    pageBackground: '#f8fafc',
    accentColor: '#0B5FFF',
    previewFrom: '#2563eb',
    previewTo: '#1e40af',
    isDark: false,
  },
  {
    id: 'light-minimal',
    label: '라이트 미니멀',
    description: '깔끔한 흰·회색 톤 · 콘텐츠 중심',
    presetId: 'light-minimal',
    pageBackground: '#f1f5f9',
    accentColor: '#0f172a',
    previewFrom: '#f8fafc',
    previewTo: '#e2e8f0',
    isDark: false,
  },
  {
    id: 'gold-accent',
    label: '프리미엄 골드',
    description: '네이비 + 골드 · 고급 투어 브랜드',
    presetId: 'gold-accent',
    pageBackground: '#0f172a',
    accentColor: '#FFB800',
    previewFrom: '#1e3a5f',
    previewTo: '#0f172a',
    isDark: true,
  },
  {
    id: 'ocean-breeze',
    label: '오션 브리즈',
    description: '청록·바다색 · 상쾌한 리조트 무드',
    presetId: 'ocean-breeze',
    pageBackground: '#ecfeff',
    accentColor: '#14b8a6',
    previewFrom: '#0e7490',
    previewTo: '#0369a1',
    isDark: false,
  },
  {
    id: 'desert-sunset',
    label: '데저트 선셋',
    description: '따뜻한 오렌지·레드 · 사막 투어',
    presetId: 'desert-sunset',
    pageBackground: '#fff7ed',
    accentColor: '#fb923c',
    previewFrom: '#c2410c',
    previewTo: '#9a3412',
    isDark: false,
  },
  {
    id: 'forest-retreat',
    label: '포레스트',
    description: '깊은 그린 · 자연·트레킹',
    presetId: 'forest-retreat',
    pageBackground: '#f0fdf4',
    accentColor: '#22c55e',
    previewFrom: '#14532d',
    previewTo: '#166534',
    isDark: false,
  },
  {
    id: 'rose-blush',
    label: '로즈 블러시',
    description: '부드러운 핑크 · 로맨틱·힐링',
    presetId: 'rose-blush',
    pageBackground: '#fff1f2',
    accentColor: '#e11d48',
    previewFrom: '#fff1f2',
    previewTo: '#fecdd3',
    isDark: false,
  },
  {
    id: 'premium-dark',
    label: '프리미엄 다크',
    description: '다크 모드 · 세련된 나이트 투어',
    presetId: 'premium-dark',
    pageBackground: '#020617',
    accentColor: '#0B5FFF',
    previewFrom: '#0f172a',
    previewTo: '#1e293b',
    isDark: true,
  },
]

let activeGlobalThemeId: string = DEFAULT_GLOBAL_THEME_ID

export function setActiveGlobalThemeId(themeId: string): void {
  activeGlobalThemeId = normalizeGlobalThemeId(themeId)
}

export function getActiveGlobalThemeId(): string {
  return activeGlobalThemeId
}

export function normalizeGlobalThemeId(themeId: unknown): string {
  if (typeof themeId !== 'string' || !themeId.trim()) return DEFAULT_GLOBAL_THEME_ID
  const trimmed = themeId.trim()
  return CUSTOMER_PAGE_GLOBAL_THEMES.some((theme) => theme.id === trimmed)
    ? trimmed
    : DEFAULT_GLOBAL_THEME_ID
}

export function getGlobalThemeById(themeId?: string): CustomerPageGlobalThemeDefinition {
  const id = normalizeGlobalThemeId(themeId ?? activeGlobalThemeId)
  return (
    CUSTOMER_PAGE_GLOBAL_THEMES.find((theme) => theme.id === id) ??
    CUSTOMER_PAGE_GLOBAL_THEMES[0]
  )
}
