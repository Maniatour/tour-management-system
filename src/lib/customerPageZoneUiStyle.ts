import type { CSSProperties } from 'react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import { getActiveGlobalThemeId, getGlobalThemeById } from '@/lib/customerPageGlobalTheme'
import {
  type ZoneUiAdvancedPatch,
  type ZoneUiAdvancedStyle,
  buildAdvancedCssVars,
  resolveAdvancedStyle,
  ADVANCED_UI_DEFAULTS,
  BORDER_RADIUS_CSS,
  GRADIENT_DIRECTION_CSS,
} from '@/lib/customerPageZoneUiStyleTokens'

export type {
  ZoneUiFontWeight,
  ZoneUiHeadingFontWeight,
  ZoneUiLineHeight,
  ZoneUiLetterSpacing,
  ZoneUiBorderRadius,
  ZoneUiBorderWidth,
  ZoneUiShadow,
  ZoneUiTextAlign,
  ZoneUiContentWidth,
  ZoneUiButtonStyle,
  ZoneUiButtonSize,
  ZoneUiGradientDirection,
  ZoneUiLinkStyle,
} from '@/lib/customerPageZoneUiStyleTokens'

export type ZoneUiPadding = 'none' | 'compact' | 'default' | 'spacious'

export type ZoneUiFontFamily =
  | 'inherit'
  | 'inter'
  | 'geist'
  | 'system'
  | 'playfair'
  | 'dm-sans'
  | 'poppins'
  | 'plus-jakarta'
  | 'merriweather'
  | 'lora'
  | 'serif'
  | 'mono'

export type ZoneUiFontSize = 'compact' | 'default' | 'comfortable' | 'large' | 'xlarge'

export type ZoneUiStylePatch = {
  presetId?: string
  useGradient?: boolean
  backgroundColor?: string
  gradientFrom?: string
  gradientTo?: string
  textColor?: string
  mutedTextColor?: string
  accentColor?: string
  accentHoverColor?: string
  accentTextColor?: string
  surfaceColor?: string
  borderColor?: string
  iconColor?: string
  overlayOpacity?: number
  paddingY?: ZoneUiPadding
  fontFamily?: ZoneUiFontFamily
  fontSize?: ZoneUiFontSize
} & ZoneUiAdvancedPatch

type ResolvedCoreUiStyle = Required<
  Pick<
    ZoneUiStylePatch,
    | 'useGradient'
    | 'backgroundColor'
    | 'gradientFrom'
    | 'gradientTo'
    | 'textColor'
    | 'mutedTextColor'
    | 'accentColor'
    | 'accentHoverColor'
    | 'accentTextColor'
    | 'surfaceColor'
    | 'borderColor'
    | 'iconColor'
    | 'overlayOpacity'
    | 'paddingY'
    | 'fontFamily'
    | 'fontSize'
  >
>

export type ResolvedZoneUiStyle = ResolvedCoreUiStyle & ZoneUiAdvancedStyle & { presetId: string }

export type ZoneUiPreset = {
  id: string
  label: string
  patch: ZoneUiStylePatch
}

export type ZoneUiFontFamilyOption = {
  id: ZoneUiFontFamily
  label: string
  stack: string
}

export type ZoneUiFontSizeOption = {
  id: ZoneUiFontSize
  label: string
  description: string
}

export const ZONE_UI_FONT_FAMILIES: ZoneUiFontFamilyOption[] = [
  { id: 'inherit', label: '사이트 기본', stack: 'inherit' },
  {
    id: 'inter',
    label: 'Inter — 깔끔한 산세리프',
    stack: 'var(--font-inter), Inter, system-ui, sans-serif',
  },
  {
    id: 'geist',
    label: 'Geist — 모던 산세리프',
    stack: 'var(--font-sans), system-ui, sans-serif',
  },
  {
    id: 'system',
    label: '시스템 기본',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans — 프리미엄 UI',
    stack: 'var(--font-dm-sans), "DM Sans", system-ui, sans-serif',
  },
  {
    id: 'poppins',
    label: 'Poppins — 친근한 산세리프',
    stack: 'var(--font-poppins), Poppins, system-ui, sans-serif',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans — 트렌디',
    stack: 'var(--font-plus-jakarta), "Plus Jakarta Sans", system-ui, sans-serif',
  },
  {
    id: 'playfair',
    label: 'Playfair Display — 우아한 세리프',
    stack: 'var(--font-playfair), "Playfair Display", Georgia, serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather — 가독성 세리프',
    stack: 'var(--font-merriweather), Merriweather, Georgia, serif',
  },
  {
    id: 'lora',
    label: 'Lora — 클래식 세리프',
    stack: 'var(--font-lora), Lora, Georgia, serif',
  },
  {
    id: 'serif',
    label: 'Georgia — 클래식',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'mono',
    label: '모노스페이스',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
]

export const ZONE_UI_FONT_SIZES: ZoneUiFontSizeOption[] = [
  { id: 'compact', label: '작게', description: '본문 14px · 제목 축소' },
  { id: 'default', label: '보통', description: '본문 16px · 기본' },
  { id: 'comfortable', label: '편안하게', description: '본문 17px' },
  { id: 'large', label: '크게', description: '본문 18px' },
  { id: 'xlarge', label: '아주 크게', description: '본문 20px' },
]

const FONT_SIZE_TOKENS: Record<
  ZoneUiFontSize,
  { body: string; h1: string; h2: string; h3: string }
> = {
  compact: { body: '0.875rem', h1: '2rem', h2: '1.625rem', h3: '1.375rem' },
  default: { body: '1rem', h1: '2.25rem', h2: '1.875rem', h3: '1.5rem' },
  comfortable: { body: '1.0625rem', h1: '2.375rem', h2: '2rem', h3: '1.625rem' },
  large: { body: '1.125rem', h1: '2.5rem', h2: '2.125rem', h3: '1.75rem' },
  xlarge: { body: '1.25rem', h1: '2.75rem', h2: '2.375rem', h3: '1.875rem' },
}

export function getFontFamilyStack(id: ZoneUiFontFamily): string {
  return ZONE_UI_FONT_FAMILIES.find((f) => f.id === id)?.stack ?? 'inherit'
}

export function getFontSizeTokens(id: ZoneUiFontSize) {
  return FONT_SIZE_TOKENS[id] ?? FONT_SIZE_TOKENS.default
}

const PADDING_Y_CSS: Record<ZoneUiPadding, { paddingTop: string; paddingBottom: string }> = {
  none: { paddingTop: '0', paddingBottom: '0' },
  compact: { paddingTop: '2rem', paddingBottom: '2rem' },
  default: { paddingTop: '3rem', paddingBottom: '3rem' },
  spacious: { paddingTop: '4.5rem', paddingBottom: '4.5rem' },
}

const DETAIL_ACCENT = '#0B5FFF'
const DETAIL_ACCENT_HOVER = '#0952e0'

export const ZONE_UI_PRESETS: ZoneUiPreset[] = [
  { id: 'default', label: '기본 (브랜드 블루)', patch: { fontFamily: 'inter', fontSize: 'default' } },
  {
    id: 'premium-dark',
    label: '프리미엄 다크',
    patch: {
      useGradient: true,
      gradientFrom: '#0f172a',
      gradientTo: '#1e293b',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      mutedTextColor: '#94a3b8',
      accentColor: '#0B5FFF',
      accentHoverColor: '#0952e0',
      accentTextColor: '#ffffff',
      surfaceColor: 'rgba(255,255,255,0.08)',
      iconColor: '#FFB800',
      overlayOpacity: 0.35,
      fontFamily: 'geist',
      fontSize: 'default',
    },
  },
  {
    id: 'light-minimal',
    label: '라이트 미니멀',
    patch: {
      useGradient: false,
      backgroundColor: '#f8fafc',
      textColor: '#0f172a',
      mutedTextColor: '#64748b',
      accentColor: '#0f172a',
      accentHoverColor: '#334155',
      accentTextColor: '#ffffff',
      surfaceColor: '#ffffff',
      borderColor: '#e2e8f0',
      iconColor: '#0B5FFF',
      overlayOpacity: 0,
      fontFamily: 'inter',
      fontSize: 'default',
    },
  },
  {
    id: 'gold-accent',
    label: '골드 액센트',
    patch: {
      useGradient: true,
      gradientFrom: '#1e3a5f',
      gradientTo: '#0f172a',
      backgroundColor: '#1e3a5f',
      textColor: '#ffffff',
      mutedTextColor: '#fde68a',
      accentColor: '#FFB800',
      accentHoverColor: '#e5a600',
      accentTextColor: '#1e293b',
      surfaceColor: 'rgba(255,184,0,0.15)',
      iconColor: '#FFB800',
      overlayOpacity: 0.25,
      fontFamily: 'plus-jakarta',
      fontSize: 'default',
    },
  },
  {
    id: 'ocean-breeze',
    label: '오션 브리즈',
    patch: {
      useGradient: true,
      gradientFrom: '#0e7490',
      gradientTo: '#0369a1',
      backgroundColor: '#0e7490',
      textColor: '#f0fdfa',
      mutedTextColor: '#99f6e4',
      accentColor: '#14b8a6',
      accentHoverColor: '#0d9488',
      accentTextColor: '#042f2e',
      surfaceColor: 'rgba(255,255,255,0.12)',
      borderColor: '#5eead4',
      iconColor: '#2dd4bf',
      fontFamily: 'dm-sans',
      fontSize: 'comfortable',
    },
  },
  {
    id: 'desert-sunset',
    label: '데저트 선셋',
    patch: {
      useGradient: true,
      gradientFrom: '#c2410c',
      gradientTo: '#9a3412',
      backgroundColor: '#c2410c',
      textColor: '#fff7ed',
      mutedTextColor: '#fed7aa',
      accentColor: '#fb923c',
      accentHoverColor: '#f97316',
      accentTextColor: '#431407',
      surfaceColor: 'rgba(255,255,255,0.15)',
      borderColor: '#fdba74',
      iconColor: '#fbbf24',
      fontFamily: 'poppins',
      fontSize: 'default',
    },
  },
  {
    id: 'forest-retreat',
    label: '포레스트 리트릿',
    patch: {
      useGradient: true,
      gradientFrom: '#14532d',
      gradientTo: '#166534',
      backgroundColor: '#14532d',
      textColor: '#f0fdf4',
      mutedTextColor: '#bbf7d0',
      accentColor: '#22c55e',
      accentHoverColor: '#16a34a',
      accentTextColor: '#052e16',
      surfaceColor: 'rgba(255,255,255,0.1)',
      borderColor: '#86efac',
      iconColor: '#4ade80',
      fontFamily: 'lora',
      fontSize: 'default',
    },
  },
  {
    id: 'rose-blush',
    label: '로즈 블러시',
    patch: {
      useGradient: false,
      backgroundColor: '#fff1f2',
      textColor: '#881337',
      mutedTextColor: '#be123c',
      accentColor: '#e11d48',
      accentHoverColor: '#be123c',
      accentTextColor: '#ffffff',
      surfaceColor: '#ffffff',
      borderColor: '#fda4af',
      iconColor: '#f43f5e',
      fontFamily: 'playfair',
      fontSize: 'comfortable',
    },
  },
  {
    id: 'midnight-neon',
    label: '미드나잇 네온',
    patch: {
      useGradient: true,
      gradientFrom: '#09090b',
      gradientTo: '#18181b',
      backgroundColor: '#09090b',
      textColor: '#fafafa',
      mutedTextColor: '#a1a1aa',
      accentColor: '#22d3ee',
      accentHoverColor: '#06b6d4',
      accentTextColor: '#083344',
      surfaceColor: 'rgba(34,211,238,0.08)',
      borderColor: '#22d3ee',
      iconColor: '#67e8f9',
      fontFamily: 'geist',
      fontSize: 'default',
    },
  },
  {
    id: 'classic-navy',
    label: '클래식 네이비',
    patch: {
      useGradient: false,
      backgroundColor: '#1e3a8a',
      textColor: '#ffffff',
      mutedTextColor: '#bfdbfe',
      accentColor: '#ffffff',
      accentHoverColor: '#e2e8f0',
      accentTextColor: '#1e3a8a',
      surfaceColor: 'rgba(255,255,255,0.1)',
      borderColor: '#93c5fd',
      iconColor: '#ffffff',
      fontFamily: 'merriweather',
      fontSize: 'default',
    },
  },
  {
    id: 'warm-cream',
    label: '웜 크림',
    patch: {
      useGradient: false,
      backgroundColor: '#fef3c7',
      textColor: '#78350f',
      mutedTextColor: '#92400e',
      accentColor: '#d97706',
      accentHoverColor: '#b45309',
      accentTextColor: '#ffffff',
      surfaceColor: '#fffbeb',
      borderColor: '#fcd34d',
      iconColor: '#f59e0b',
      fontFamily: 'lora',
      fontSize: 'comfortable',
    },
  },
  {
    id: 'high-contrast',
    label: '하이 콘트라스트',
    patch: {
      useGradient: false,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      mutedTextColor: '#404040',
      accentColor: '#0B5FFF',
      accentHoverColor: '#0952e0',
      accentTextColor: '#ffffff',
      surfaceColor: '#ffffff',
      borderColor: '#000000',
      iconColor: '#0B5FFF',
      fontFamily: 'system',
      fontSize: 'large',
    },
  },
  {
    id: 'lavender-dream',
    label: '라벤더 드림',
    patch: {
      useGradient: true,
      gradientFrom: '#6b21a8',
      gradientTo: '#581c87',
      backgroundColor: '#6b21a8',
      textColor: '#faf5ff',
      mutedTextColor: '#e9d5ff',
      accentColor: '#c084fc',
      accentHoverColor: '#a855f7',
      accentTextColor: '#3b0764',
      surfaceColor: 'rgba(255,255,255,0.1)',
      borderColor: '#d8b4fe',
      iconColor: '#e879f9',
      fontFamily: 'playfair',
      fontSize: 'default',
    },
  },
  {
    id: 'slate-professional',
    label: '슬레이트 프로페셔널',
    patch: {
      useGradient: false,
      backgroundColor: '#f1f5f9',
      textColor: '#0f172a',
      mutedTextColor: '#475569',
      accentColor: '#334155',
      accentHoverColor: '#1e293b',
      accentTextColor: '#ffffff',
      surfaceColor: '#ffffff',
      borderColor: '#cbd5e1',
      iconColor: '#64748b',
      fontFamily: 'dm-sans',
      fontSize: 'default',
    },
  },
  {
    id: 'editorial-serif',
    label: '에디토리얼 세리프',
    patch: {
      useGradient: false,
      backgroundColor: '#fafaf9',
      textColor: '#1c1917',
      mutedTextColor: '#57534e',
      accentColor: '#1c1917',
      accentHoverColor: '#44403c',
      accentTextColor: '#ffffff',
      surfaceColor: '#ffffff',
      borderColor: '#d6d3d1',
      iconColor: '#78716c',
      fontFamily: 'playfair',
      fontSize: 'large',
    },
  },
  {
    id: 'travel-pop',
    label: '트래블 팝',
    patch: {
      useGradient: true,
      gradientFrom: '#2563eb',
      gradientTo: '#7c3aed',
      backgroundColor: '#2563eb',
      textColor: '#ffffff',
      mutedTextColor: '#dbeafe',
      accentColor: '#FFB800',
      accentHoverColor: '#e5a600',
      accentTextColor: '#1e293b',
      surfaceColor: 'rgba(255,255,255,0.15)',
      borderColor: '#ffffff',
      iconColor: '#FFB800',
      fontFamily: 'poppins',
      fontSize: 'large',
    },
  },
]

export const ZONE_UI_DEFAULTS: Partial<Record<CustomerPageZone, ZoneUiStylePatch>> = {
  'home-hero': {
    presetId: 'default',
    useGradient: true,
    gradientFrom: '#1e3a8a',
    gradientTo: '#581c87',
    backgroundColor: '#1e3a8a',
    textColor: '#ffffff',
    mutedTextColor: '#bfdbfe',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: 'rgba(255,255,255,0.2)',
    overlayOpacity: 0.3,
    paddingY: 'spacious',
  },
  'home-categories': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#2563eb',
    paddingY: 'default',
  },
  'home-stats': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    paddingY: 'default',
  },
  'home-popular': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#f9fafb',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#2563eb',
    paddingY: 'default',
  },
  'home-features': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#22c55e',
    accentHoverColor: '#16a34a',
    accentTextColor: '#ffffff',
    iconColor: '#22c55e',
    paddingY: 'default',
  },
  'home-cta': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#1e3a8a',
    textColor: '#ffffff',
    mutedTextColor: '#bfdbfe',
    accentColor: '#ffffff',
    accentHoverColor: '#f3f4f6',
    accentTextColor: '#1e3a8a',
    surfaceColor: 'transparent',
    borderColor: '#ffffff',
    paddingY: 'default',
  },
  'home-reviews': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#fffbeb',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#f59e0b',
    accentHoverColor: '#d97706',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#fcd34d',
    paddingY: 'default',
  },
  'home-faq': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#f9fafb',
    borderColor: '#e5e7eb',
    paddingY: 'default',
  },
  'home-gallery': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#f8fafc',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#0284c7',
    accentHoverColor: '#0369a1',
    accentTextColor: '#ffffff',
    paddingY: 'default',
  },
  'home-logos': {
    presetId: 'light-minimal',
    useGradient: false,
    backgroundColor: '#f9fafb',
    textColor: '#374151',
    mutedTextColor: '#6b7280',
    accentColor: '#2563eb',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    paddingY: 'compact',
  },
  'home-video': {
    presetId: 'premium-dark',
    useGradient: false,
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
    mutedTextColor: '#94a3b8',
    accentColor: '#ffffff',
    accentHoverColor: '#e2e8f0',
    accentTextColor: '#0f172a',
    paddingY: 'default',
  },
  'home-newsletter': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#eff6ff',
    textColor: '#1e3a8a',
    mutedTextColor: '#3b82f6',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#bfdbfe',
    paddingY: 'default',
  },
  'home-promo': {
    presetId: 'default',
    useGradient: true,
    gradientFrom: '#dc2626',
    gradientTo: '#b91c1c',
    backgroundColor: '#dc2626',
    textColor: '#ffffff',
    mutedTextColor: '#fecaca',
    accentColor: '#ffffff',
    accentHoverColor: '#fef2f2',
    accentTextColor: '#b91c1c',
    paddingY: 'default',
  },
  'home-rich-text': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    surfaceColor: '#f9fafb',
    borderColor: '#e5e7eb',
    paddingY: 'default',
  },
  'listing-page-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'listing-page-filters': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'listing-page-results': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'listing-card': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'listing-card-cta': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'booking-overlay-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'booking-overlay-stepper': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#6b7280',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'booking-overlay-content': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'booking-overlay-footer': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'detail-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#f8fafc',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'none',
  },
  'detail-gallery': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'none',
  },
  'detail-highlights': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'default',
  },
  'detail-tabs': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#f8fafc',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'none',
  },
  'detail-sidebar': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'none',
  },
  'detail-faq-section': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: '#FFB800',
    accentHoverColor: '#e5a600',
    accentTextColor: '#1e293b',
    surfaceColor: '#ffffff',
    borderColor: '#e2e8f0',
    iconColor: '#FFB800',
    paddingY: 'default',
  },
  'detail-mobile-booking': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    accentColor: DETAIL_ACCENT,
    accentHoverColor: DETAIL_ACCENT_HOVER,
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e2e8f0',
    iconColor: DETAIL_ACCENT,
    paddingY: 'none',
  },
  'tags-page-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'default',
  },
  'tags-page-categories': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'custom-tour-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#0B5FFF',
    accentHoverColor: '#0952e0',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#0B5FFF',
    paddingY: 'none',
  },
  'custom-tour-builder': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: 'transparent',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#0B5FFF',
    accentHoverColor: '#0952e0',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#0B5FFF',
    paddingY: 'default',
  },
  'reservation-check-header': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
  'reservation-check-form': {
    presetId: 'default',
    useGradient: false,
    backgroundColor: '#ffffff',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#e5e7eb',
    iconColor: '#2563eb',
    paddingY: 'none',
  },
}

/** @deprecated ZONE_UI_DEFAULTS 사용 */
export const HOME_ZONE_UI_DEFAULTS = ZONE_UI_DEFAULTS

export const HOME_UI_ZONES: CustomerPageZone[] = [
  'home-hero',
  'home-categories',
  'home-stats',
  'home-popular',
  'home-features',
  'home-cta',
  'home-reviews',
  'home-faq',
  'home-gallery',
  'home-logos',
  'home-video',
  'home-newsletter',
  'home-promo',
  'home-rich-text',
]

export const LISTING_UI_ZONES: CustomerPageZone[] = [
  'listing-page-header',
  'listing-page-filters',
  'listing-page-results',
  'listing-card',
  'listing-card-cta',
]

export const BOOKING_UI_ZONES: CustomerPageZone[] = [
  'booking-overlay-header',
  'booking-overlay-stepper',
  'booking-overlay-content',
  'booking-overlay-footer',
  'booking-participants',
  'booking-options',
]

export const DETAIL_UI_ZONES: CustomerPageZone[] = [
  'detail-header',
  'detail-gallery',
  'detail-highlights',
  'detail-tabs',
  'detail-sidebar',
  'detail-faq-section',
  'detail-mobile-booking',
]

export const TAGS_UI_ZONES: CustomerPageZone[] = ['tags-page-header', 'tags-page-categories']

export const CUSTOM_TOUR_UI_ZONES: CustomerPageZone[] = ['custom-tour-header', 'custom-tour-builder']

export const RESERVATION_CHECK_UI_ZONES: CustomerPageZone[] = [
  'reservation-check-header',
  'reservation-check-form',
]

export const UI_STYLE_ZONES: CustomerPageZone[] = [
  ...HOME_UI_ZONES,
  ...LISTING_UI_ZONES,
  ...BOOKING_UI_ZONES,
  ...DETAIL_UI_ZONES,
  ...TAGS_UI_ZONES,
  ...CUSTOM_TOUR_UI_ZONES,
  ...RESERVATION_CHECK_UI_ZONES,
]

/** 카드·패널형 zone — 세로 여백 슬라이더 숨김 */
export const CARD_UI_ZONES: CustomerPageZone[] = [
  'listing-card',
  'detail-header',
  'detail-gallery',
  'detail-tabs',
  'detail-sidebar',
  'detail-mobile-booking',
  'tags-page-header',
  'tags-page-categories',
  'listing-page-header',
  'listing-page-filters',
  'listing-page-results',
  'custom-tour-header',
  'reservation-check-header',
  'reservation-check-form',
]

export function zoneSupportsUiStyle(zone: CustomerPageZone): boolean {
  return UI_STYLE_ZONES.includes(zone)
}

function baseDefaults(): Omit<ResolvedZoneUiStyle, 'presetId'> {
  return {
    useGradient: false,
    backgroundColor: '#ffffff',
    gradientFrom: '#1e3a8a',
    gradientTo: '#581c87',
    textColor: '#111827',
    mutedTextColor: '#4b5563',
    accentColor: '#2563eb',
    accentHoverColor: '#1d4ed8',
    accentTextColor: '#ffffff',
    surfaceColor: '#ffffff',
    borderColor: '#2563eb',
    iconColor: '#2563eb',
    overlayOpacity: 0,
    paddingY: 'default',
    fontFamily: 'inherit',
    fontSize: 'default',
    ...ADVANCED_UI_DEFAULTS,
  }
}

function getActiveGlobalThemePresetPatch(): ZoneUiStylePatch & { presetId: string } {
  const theme = getGlobalThemeById(getActiveGlobalThemeId())
  const preset = ZONE_UI_PRESETS.find((item) => item.id === theme.presetId) ?? ZONE_UI_PRESETS[0]
  return {
    presetId: theme.presetId,
    ...(preset.patch ?? {}),
  }
}

function resolveCoreFields(
  zone: CustomerPageZone,
  patch?: ZoneUiStylePatch | null
): ResolvedCoreUiStyle & { presetId: string } {
  const globalThemePatch = getActiveGlobalThemePresetPatch()
  const zoneDefaults = ZONE_UI_DEFAULTS[zone] ?? {}
  const zonePatch = patch ?? {}
  const hasZoneCustomization = Object.keys(zonePatch).length > 0

  const effectivePresetId =
    zonePatch.presetId ??
    (hasZoneCustomization ? zoneDefaults.presetId : globalThemePatch.presetId) ??
    zoneDefaults.presetId ??
    'default'

  const preset =
    ZONE_UI_PRESETS.find((p) => p.id === effectivePresetId) ?? ZONE_UI_PRESETS[0]

  const merged: ZoneUiStylePatch = {
    ...baseDefaults(),
    ...globalThemePatch,
    ...zoneDefaults,
    ...preset.patch,
    ...zonePatch,
  }
  const base = baseDefaults()
  return {
    presetId: zonePatch.presetId ?? globalThemePatch.presetId ?? zoneDefaults.presetId ?? preset.id,
    useGradient: merged.useGradient ?? base.useGradient,
    backgroundColor: merged.backgroundColor ?? base.backgroundColor,
    gradientFrom: merged.gradientFrom ?? base.gradientFrom,
    gradientTo: merged.gradientTo ?? base.gradientTo,
    textColor: merged.textColor ?? base.textColor,
    mutedTextColor: merged.mutedTextColor ?? base.mutedTextColor,
    accentColor: merged.accentColor ?? base.accentColor,
    accentHoverColor: merged.accentHoverColor ?? base.accentHoverColor,
    accentTextColor: merged.accentTextColor ?? base.accentTextColor,
    surfaceColor: merged.surfaceColor ?? base.surfaceColor,
    borderColor: merged.borderColor ?? base.borderColor,
    iconColor: merged.iconColor ?? base.iconColor,
    overlayOpacity: merged.overlayOpacity ?? base.overlayOpacity,
    paddingY: merged.paddingY ?? base.paddingY,
    fontFamily: merged.fontFamily ?? base.fontFamily,
    fontSize: merged.fontSize ?? base.fontSize,
  }
}

export function resolveZoneUiStyle(
  zone: CustomerPageZone,
  patch?: ZoneUiStylePatch | null
): ResolvedZoneUiStyle {
  const core = resolveCoreFields(zone, patch)
  const advanced = resolveAdvancedStyle(patch)
  return { ...core, ...advanced }
}

export function zoneUiStyleToCssProperties(style: ResolvedZoneUiStyle): CSSProperties {
  const padding = PADDING_Y_CSS[style.paddingY]
  const bodyFontSize = style.fontSize
  const headingSizeKey =
    style.headingFontSize === 'default' ? bodyFontSize : style.headingFontSize
  const fontTokens = getFontSizeTokens(bodyFontSize)
  const headingTokens = getFontSizeTokens(headingSizeKey)
  const bodyFontStack = getFontFamilyStack(style.fontFamily)
  const headingFontId =
    style.headingFontFamily === 'inherit' ? style.fontFamily : style.headingFontFamily
  const headingFontStack = getFontFamilyStack(headingFontId)
  const advancedVars = buildAdvancedCssVars(style, {
    accentColor: style.accentColor,
    accentHoverColor: style.accentHoverColor,
    accentTextColor: style.accentTextColor,
    borderColor: style.borderColor,
  })

  const gradientDir = GRADIENT_DIRECTION_CSS[style.gradientDirection]

  return {
    ...padding,
    paddingLeft: advancedVars['--cp-ui-padding-x'],
    paddingRight: advancedVars['--cp-ui-padding-x'],
    color: style.textColor,
    fontFamily: bodyFontStack === 'inherit' ? undefined : bodyFontStack,
    fontSize: fontTokens.body,
    fontWeight: advancedVars['--cp-ui-font-weight'],
    lineHeight: advancedVars['--cp-ui-line-height'],
    letterSpacing: advancedVars['--cp-ui-letter-spacing'],
    textAlign:
      style.textAlign === 'inherit' ? undefined : (style.textAlign as CSSProperties['textAlign']),
    maxWidth: style.contentMaxWidth === 'full' ? undefined : advancedVars['--cp-ui-max-width'],
    marginLeft: style.contentMaxWidth === 'full' ? undefined : 'auto',
    marginRight: style.contentMaxWidth === 'full' ? undefined : 'auto',
    borderRadius: BORDER_RADIUS_CSS[style.borderRadius],
    borderWidth: advancedVars['--cp-ui-border-width'],
    borderStyle: style.borderWidth === 'none' ? undefined : 'solid',
    borderColor: style.borderColor,
    boxShadow: advancedVars['--cp-ui-shadow'],
    backdropFilter: style.backdropBlur ? `blur(${advancedVars['--cp-ui-backdrop-blur']})` : undefined,
    ...(style.useGradient
      ? {
          background: `linear-gradient(${gradientDir}, ${style.gradientFrom}, ${style.gradientTo})`,
        }
      : { backgroundColor: style.backgroundColor }),
    ['--cp-ui-text' as string]: style.textColor,
    ['--cp-ui-muted' as string]: style.mutedTextColor,
    ['--cp-ui-accent' as string]: style.accentColor,
    ['--cp-ui-accent-hover' as string]: style.accentHoverColor,
    ['--cp-ui-accent-text' as string]: style.accentTextColor,
    ['--cp-ui-surface' as string]: style.surfaceColor,
    ['--cp-ui-border' as string]: style.borderColor,
    ['--cp-ui-icon' as string]: style.iconColor,
    ['--cp-ui-overlay' as string]: String(style.overlayOpacity),
    ['--cp-ui-font-family' as string]: bodyFontStack,
    ['--cp-ui-heading-font-family' as string]: headingFontStack,
    ['--cp-ui-font-size' as string]: fontTokens.body,
    ['--cp-ui-h1-size' as string]: headingTokens.h1,
    ['--cp-ui-h2-size' as string]: headingTokens.h2,
    ['--cp-ui-h3-size' as string]: headingTokens.h3,
    ['--cp-ui-surface-opacity' as string]: String(style.surfaceOpacity),
    ...(advancedVars as Record<string, string>),
  }
}

export function serializeZoneUiStylePatch(patch: ZoneUiStylePatch): string {
  return JSON.stringify(patch)
}

export function applyUiPreset(presetId: string, zone: CustomerPageZone): ZoneUiStylePatch {
  const preset = ZONE_UI_PRESETS.find((p) => p.id === presetId)
  const zoneDefault = ZONE_UI_DEFAULTS[zone] ?? {}
  return {
    ...zoneDefault,
    ...(preset?.patch ?? {}),
    presetId,
  }
}

/** 편집 폼에 표시할 전체 패치 — 저장값이 없어도 zone 기본·프리셋이 반영됨 */
export function toEditableZoneUiStylePatch(
  zone: CustomerPageZone,
  stored?: ZoneUiStylePatch | null
): ZoneUiStylePatch {
  const resolved = resolveZoneUiStyle(zone, stored)
  return {
    presetId: resolved.presetId,
    useGradient: resolved.useGradient,
    backgroundColor: resolved.backgroundColor,
    gradientFrom: resolved.gradientFrom,
    gradientTo: resolved.gradientTo,
    textColor: resolved.textColor,
    mutedTextColor: resolved.mutedTextColor,
    accentColor: resolved.accentColor,
    accentHoverColor: resolved.accentHoverColor,
    accentTextColor: resolved.accentTextColor,
    surfaceColor: resolved.surfaceColor,
    borderColor: resolved.borderColor,
    iconColor: resolved.iconColor,
    overlayOpacity: resolved.overlayOpacity,
    paddingY: resolved.paddingY,
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    headingFontFamily: resolved.headingFontFamily,
    headingFontSize: resolved.headingFontSize,
    fontWeight: resolved.fontWeight,
    headingFontWeight: resolved.headingFontWeight,
    lineHeight: resolved.lineHeight,
    letterSpacing: resolved.letterSpacing,
    paddingX: resolved.paddingX,
    textAlign: resolved.textAlign,
    contentMaxWidth: resolved.contentMaxWidth,
    borderRadius: resolved.borderRadius,
    borderWidth: resolved.borderWidth,
    shadow: resolved.shadow,
    surfaceOpacity: resolved.surfaceOpacity,
    backdropBlur: resolved.backdropBlur,
    gradientDirection: resolved.gradientDirection,
    buttonStyle: resolved.buttonStyle,
    buttonSize: resolved.buttonSize,
    buttonRadius: resolved.buttonRadius,
    linkStyle: resolved.linkStyle,
    linkColor: resolved.linkColor,
  }
}
