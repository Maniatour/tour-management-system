import type { ZoneUiFontFamily, ZoneUiFontSize, ZoneUiPadding } from '@/lib/customerPageZoneUiStyle'

export type ZoneUiFontWeight = 'normal' | 'medium' | 'semibold' | 'bold'
export type ZoneUiHeadingFontWeight = 'semibold' | 'bold' | 'extrabold'
export type ZoneUiLineHeight = 'tight' | 'normal' | 'relaxed' | 'loose'
export type ZoneUiLetterSpacing = 'tight' | 'normal' | 'wide'
export type ZoneUiBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
export type ZoneUiBorderWidth = 'none' | 'thin' | 'medium' | 'thick'
export type ZoneUiShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl'
export type ZoneUiTextAlign = 'inherit' | 'left' | 'center' | 'right'
export type ZoneUiContentWidth = 'full' | 'wide' | 'default' | 'narrow'
export type ZoneUiButtonStyle = 'solid' | 'outline' | 'soft' | 'ghost'
export type ZoneUiButtonSize = 'sm' | 'md' | 'lg'
export type ZoneUiGradientDirection = 'to-r' | 'to-b' | 'to-br' | 'to-bl'
export type ZoneUiLinkStyle = 'default' | 'underline' | 'bold'

/** ZoneUiStylePatch 확장 필드 */
export type ZoneUiAdvancedPatch = {
  headingFontFamily?: ZoneUiFontFamily
  headingFontSize?: ZoneUiFontSize
  fontWeight?: ZoneUiFontWeight
  headingFontWeight?: ZoneUiHeadingFontWeight
  lineHeight?: ZoneUiLineHeight
  letterSpacing?: ZoneUiLetterSpacing
  paddingX?: ZoneUiPadding
  textAlign?: ZoneUiTextAlign
  contentMaxWidth?: ZoneUiContentWidth
  borderRadius?: ZoneUiBorderRadius
  borderWidth?: ZoneUiBorderWidth
  shadow?: ZoneUiShadow
  surfaceOpacity?: number
  backdropBlur?: boolean
  gradientDirection?: ZoneUiGradientDirection
  buttonStyle?: ZoneUiButtonStyle
  buttonSize?: ZoneUiButtonSize
  buttonRadius?: ZoneUiBorderRadius | 'inherit'
  linkStyle?: ZoneUiLinkStyle
  linkColor?: string
}

export type ZoneUiAdvancedStyle = Required<ZoneUiAdvancedPatch>

export const ADVANCED_UI_DEFAULTS: ZoneUiAdvancedStyle = {
  headingFontFamily: 'inherit',
  headingFontSize: 'default',
  fontWeight: 'normal',
  headingFontWeight: 'bold',
  lineHeight: 'normal',
  letterSpacing: 'normal',
  paddingX: 'default',
  textAlign: 'inherit',
  contentMaxWidth: 'full',
  borderRadius: 'lg',
  borderWidth: 'thin',
  shadow: 'sm',
  surfaceOpacity: 1,
  backdropBlur: false,
  gradientDirection: 'to-r',
  buttonStyle: 'solid',
  buttonSize: 'md',
  buttonRadius: 'inherit',
  linkStyle: 'default',
  linkColor: '',
}

export const FONT_WEIGHT_CSS: Record<ZoneUiFontWeight, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

export const HEADING_FONT_WEIGHT_CSS: Record<ZoneUiHeadingFontWeight, string> = {
  semibold: '600',
  bold: '700',
  extrabold: '800',
}

export const LINE_HEIGHT_CSS: Record<ZoneUiLineHeight, string> = {
  tight: '1.25',
  normal: '1.5',
  relaxed: '1.625',
  loose: '1.75',
}

export const LETTER_SPACING_CSS: Record<ZoneUiLetterSpacing, string> = {
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
}

export const PADDING_X_CSS: Record<ZoneUiPadding, string> = {
  none: '0',
  compact: '1rem',
  default: '1.5rem',
  spacious: '2.5rem',
}

export const BORDER_RADIUS_CSS: Record<ZoneUiBorderRadius, string> = {
  none: '0',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  full: '9999px',
}

export const BORDER_WIDTH_CSS: Record<ZoneUiBorderWidth, string> = {
  none: '0',
  thin: '1px',
  medium: '2px',
  thick: '3px',
}

export const SHADOW_CSS: Record<ZoneUiShadow, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
}

export const CONTENT_WIDTH_CSS: Record<ZoneUiContentWidth, string> = {
  full: '100%',
  wide: '80rem',
  default: '72rem',
  narrow: '48rem',
}

export const GRADIENT_DIRECTION_CSS: Record<ZoneUiGradientDirection, string> = {
  'to-r': 'to right',
  'to-b': 'to bottom',
  'to-br': 'to bottom right',
  'to-bl': 'to bottom left',
}

export const BUTTON_SIZE_CSS: Record<
  ZoneUiButtonSize,
  { paddingY: string; paddingX: string; fontSize: string }
> = {
  sm: { paddingY: '0.5rem', paddingX: '1rem', fontSize: '0.875rem' },
  md: { paddingY: '0.75rem', paddingX: '1.25rem', fontSize: '1rem' },
  lg: { paddingY: '1rem', paddingX: '1.5rem', fontSize: '1.0625rem' },
}

export function resolveAdvancedStyle(patch?: ZoneUiAdvancedPatch | null): ZoneUiAdvancedStyle {
  const base = ADVANCED_UI_DEFAULTS
  return {
    headingFontFamily: patch?.headingFontFamily ?? base.headingFontFamily,
    headingFontSize: patch?.headingFontSize ?? base.headingFontSize,
    fontWeight: patch?.fontWeight ?? base.fontWeight,
    headingFontWeight: patch?.headingFontWeight ?? base.headingFontWeight,
    lineHeight: patch?.lineHeight ?? base.lineHeight,
    letterSpacing: patch?.letterSpacing ?? base.letterSpacing,
    paddingX: patch?.paddingX ?? base.paddingX,
    textAlign: patch?.textAlign ?? base.textAlign,
    contentMaxWidth: patch?.contentMaxWidth ?? base.contentMaxWidth,
    borderRadius: patch?.borderRadius ?? base.borderRadius,
    borderWidth: patch?.borderWidth ?? base.borderWidth,
    shadow: patch?.shadow ?? base.shadow,
    surfaceOpacity: patch?.surfaceOpacity ?? base.surfaceOpacity,
    backdropBlur: patch?.backdropBlur ?? base.backdropBlur,
    gradientDirection: patch?.gradientDirection ?? base.gradientDirection,
    buttonStyle: patch?.buttonStyle ?? base.buttonStyle,
    buttonSize: patch?.buttonSize ?? base.buttonSize,
    buttonRadius: patch?.buttonRadius ?? base.buttonRadius,
    linkStyle: patch?.linkStyle ?? base.linkStyle,
    linkColor: patch?.linkColor ?? base.linkColor,
  }
}

export function buildButtonCssVars(
  style: ZoneUiAdvancedStyle,
  accentColor: string,
  accentHoverColor: string,
  accentTextColor: string,
  borderRadius: string
): Record<string, string> {
  const btnRadius =
    style.buttonRadius === 'inherit' ? borderRadius : BORDER_RADIUS_CSS[style.buttonRadius]
  const size = BUTTON_SIZE_CSS[style.buttonSize]

  const solid = {
    '--cp-ui-btn-bg': accentColor,
    '--cp-ui-btn-bg-hover': accentHoverColor,
    '--cp-ui-btn-color': accentTextColor,
    '--cp-ui-btn-color-hover': accentTextColor,
    '--cp-ui-btn-border': accentColor,
  }
  const outline = {
    '--cp-ui-btn-bg': 'transparent',
    '--cp-ui-btn-bg-hover': accentColor,
    '--cp-ui-btn-color': accentColor,
    '--cp-ui-btn-color-hover': accentTextColor,
    '--cp-ui-btn-border': accentColor,
  }
  const soft = {
    '--cp-ui-btn-bg': `color-mix(in srgb, ${accentColor} 14%, transparent)`,
    '--cp-ui-btn-bg-hover': `color-mix(in srgb, ${accentColor} 22%, transparent)`,
    '--cp-ui-btn-color': accentColor,
    '--cp-ui-btn-color-hover': accentColor,
    '--cp-ui-btn-border': `color-mix(in srgb, ${accentColor} 30%, transparent)`,
  }
  const ghost = {
    '--cp-ui-btn-bg': 'transparent',
    '--cp-ui-btn-bg-hover': `color-mix(in srgb, ${accentColor} 10%, transparent)`,
    '--cp-ui-btn-color': accentColor,
    '--cp-ui-btn-color-hover': accentColor,
    '--cp-ui-btn-border': 'transparent',
  }

  const palette =
    style.buttonStyle === 'outline'
      ? outline
      : style.buttonStyle === 'soft'
        ? soft
        : style.buttonStyle === 'ghost'
          ? ghost
          : solid

  return {
    ...palette,
    '--cp-ui-btn-radius': btnRadius,
    '--cp-ui-btn-padding-y': size.paddingY,
    '--cp-ui-btn-padding-x': size.paddingX,
    '--cp-ui-btn-font-size': size.fontSize,
  }
}

export function buildAdvancedCssVars(
  advanced: ZoneUiAdvancedStyle,
  colors: {
    accentColor: string
    accentHoverColor: string
    accentTextColor: string
    borderColor: string
  }
): Record<string, string> {
  const borderRadius = BORDER_RADIUS_CSS[advanced.borderRadius]
  const linkColor = advanced.linkColor?.trim() || colors.accentColor

  return {
    ...buildButtonCssVars(
      advanced,
      colors.accentColor,
      colors.accentHoverColor,
      colors.accentTextColor,
      borderRadius
    ),
    '--cp-ui-font-weight': FONT_WEIGHT_CSS[advanced.fontWeight],
    '--cp-ui-heading-font-weight': HEADING_FONT_WEIGHT_CSS[advanced.headingFontWeight],
    '--cp-ui-line-height': LINE_HEIGHT_CSS[advanced.lineHeight],
    '--cp-ui-letter-spacing': LETTER_SPACING_CSS[advanced.letterSpacing],
    '--cp-ui-padding-x': PADDING_X_CSS[advanced.paddingX],
    '--cp-ui-text-align': advanced.textAlign === 'inherit' ? 'unset' : advanced.textAlign,
    '--cp-ui-max-width': CONTENT_WIDTH_CSS[advanced.contentMaxWidth],
    '--cp-ui-radius': borderRadius,
    '--cp-ui-border-width': BORDER_WIDTH_CSS[advanced.borderWidth],
    '--cp-ui-shadow': SHADOW_CSS[advanced.shadow],
    '--cp-ui-surface-opacity': String(advanced.surfaceOpacity),
    '--cp-ui-backdrop-blur': advanced.backdropBlur ? '12px' : '0',
    '--cp-ui-gradient-direction': GRADIENT_DIRECTION_CSS[advanced.gradientDirection],
    '--cp-ui-link-color': linkColor,
    '--cp-ui-link-weight': advanced.linkStyle === 'bold' ? '600' : 'inherit',
    '--cp-ui-link-decoration':
      advanced.linkStyle === 'underline' || advanced.linkStyle === 'bold' ? 'underline' : 'none',
  }
}
