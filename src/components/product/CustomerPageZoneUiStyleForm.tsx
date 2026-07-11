'use client'

import type { ReactNode } from 'react'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  ZONE_UI_PRESETS,
  ZONE_UI_FONT_FAMILIES,
  ZONE_UI_FONT_SIZES,
  applyUiPreset,
  CARD_UI_ZONES,
  getFontFamilyStack,
  getFontSizeTokens,
  toEditableZoneUiStylePatch,
  type ZoneUiFontFamily,
  type ZoneUiFontSize,
  type ZoneUiPadding,
  type ZoneUiStylePatch,
  type ZoneUiBorderRadius,
  type ZoneUiButtonSize,
  type ZoneUiButtonStyle,
  type ZoneUiContentWidth,
  type ZoneUiFontWeight,
  type ZoneUiGradientDirection,
  type ZoneUiHeadingFontWeight,
  type ZoneUiLetterSpacing,
  type ZoneUiLineHeight,
  type ZoneUiLinkStyle,
  type ZoneUiShadow,
  type ZoneUiTextAlign,
  type ZoneUiBorderWidth,
} from '@/lib/customerPageZoneUiStyle'

type CustomerPageZoneUiStyleFormProps = {
  zone: CustomerPageZone
  value: ZoneUiStylePatch
  onChange: (next: ZoneUiStylePatch) => void
}

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  hint?: string
}) {
  const safe = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#2563eb'
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2563eb"
          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg font-mono"
        />
      </div>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </label>
  )
}

function FormSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-lg border border-gray-200 bg-white overflow-hidden group"
    >
      <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 list-none flex items-center justify-between">
        {title}
        <span className="text-gray-400 text-[10px] group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="p-3 space-y-3 border-t border-gray-100">{children}</div>
    </details>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function CustomerPageZoneUiStyleForm({
  zone,
  value,
  onChange,
}: CustomerPageZoneUiStyleFormProps) {
  const set = (patch: Partial<ZoneUiStylePatch>) => onChange({ ...value, ...patch })

  const showGradient = zone === 'home-hero' || zone === 'home-cta' || zone === 'home-promo' || value.useGradient
  const showOverlay = zone === 'home-hero'
  const hidePaddingY = CARD_UI_ZONES.includes(zone)

  const bodyFont = getFontFamilyStack(value.fontFamily ?? 'inherit')
  const headingFontId =
    value.headingFontFamily === 'inherit' || !value.headingFontFamily
      ? (value.fontFamily ?? 'inherit')
      : value.headingFontFamily
  const headingFont = getFontFamilyStack(headingFontId)
  const bodySize = getFontSizeTokens(value.fontSize ?? 'default')
  const headingSizeKey =
    !value.headingFontSize || value.headingFontSize === 'default'
      ? (value.fontSize ?? 'default')
      : value.headingFontSize
  const headingSize = getFontSizeTokens(headingSizeKey)

  const paddingOptions: { id: ZoneUiPadding; label: string }[] = [
    { id: 'none', label: '없음' },
    { id: 'compact', label: '좁게' },
    { id: 'default', label: '보통' },
    { id: 'spacious', label: '넓게' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 rounded-lg bg-primary/5 border border-border/60 px-3 py-2">
        프리셋·타이포·레이아웃·색상·버튼·효과를 zone별로 자유롭게 조합할 수 있습니다. 저장 즉시
        고객 페이지에 반영됩니다.
      </p>

      <FormSection title="프리셋 & 미리보기" defaultOpen>
        <SelectField
          label="UI 프리셋"
          value={value.presetId ?? 'default'}
          options={ZONE_UI_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
          onChange={(presetId) =>
            onChange(toEditableZoneUiStylePatch(zone, applyUiPreset(presetId, zone)))
          }
        />

        <div
          className="rounded-lg border border-gray-200 px-4 py-3"
          style={{
            fontFamily: bodyFont === 'inherit' ? undefined : bodyFont,
            fontSize: bodySize.body,
            fontWeight: value.fontWeight === 'bold' ? 700 : value.fontWeight === 'semibold' ? 600 : undefined,
            lineHeight: value.lineHeight === 'relaxed' ? 1.625 : undefined,
            letterSpacing: value.letterSpacing === 'wide' ? '0.025em' : undefined,
            color: value.textColor ?? '#111827',
            textAlign: value.textAlign === 'inherit' ? undefined : value.textAlign,
            backgroundColor: value.useGradient
              ? undefined
              : (value.backgroundColor ?? '#ffffff'),
            background: value.useGradient
              ? `linear-gradient(to right, ${value.gradientFrom ?? '#1e3a8a'}, ${value.gradientTo ?? '#581c87'})`
              : undefined,
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
          }}
        >
          <p
            className="mb-1"
            style={{
              fontFamily: headingFont === 'inherit' ? undefined : headingFont,
              fontSize: headingSize.h1,
              fontWeight: 700,
              color: value.textColor ?? '#111827',
            }}
          >
            제목 미리보기
          </p>
          <p className="mb-2" style={{ color: value.mutedTextColor ?? '#4b5563' }}>
            본문·부제·링크 스타일이 이렇게 보입니다.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-block font-medium"
              style={{
                backgroundColor: value.accentColor ?? '#2563eb',
                color: value.accentTextColor ?? '#fff',
                borderRadius: value.buttonRadius === 'full' ? '9999px' : '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
              }}
            >
              버튼
            </span>
            <span style={{ color: value.linkColor || value.accentColor || '#2563eb' }}>링크</span>
          </div>
        </div>
      </FormSection>

      <FormSection title="타이포그래피">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            label="본문 폰트"
            value={value.fontFamily ?? 'inherit'}
            options={ZONE_UI_FONT_FAMILIES.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(fontFamily) => set({ fontFamily: fontFamily as ZoneUiFontFamily })}
          />
          <SelectField
            label="제목 폰트"
            value={value.headingFontFamily ?? 'inherit'}
            options={ZONE_UI_FONT_FAMILIES.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(headingFontFamily) =>
              set({ headingFontFamily: headingFontFamily as ZoneUiFontFamily })
            }
          />
          <SelectField
            label="본문 글자 크기"
            value={value.fontSize ?? 'default'}
            options={ZONE_UI_FONT_SIZES.map((s) => ({ id: s.id, label: `${s.label} (${s.description})` }))}
            onChange={(fontSize) => set({ fontSize: fontSize as ZoneUiFontSize })}
          />
          <SelectField
            label="제목 글자 크기"
            value={value.headingFontSize ?? 'default'}
            options={[
              { id: 'default' as ZoneUiFontSize, label: '본문과 동일' },
              ...ZONE_UI_FONT_SIZES.map((s) => ({ id: s.id, label: s.label })),
            ]}
            onChange={(headingFontSize) => set({ headingFontSize: headingFontSize as ZoneUiFontSize })}
          />
          <SelectField
            label="본문 굵기"
            value={value.fontWeight ?? 'normal'}
            options={[
              { id: 'normal' as ZoneUiFontWeight, label: '보통' },
              { id: 'medium' as ZoneUiFontWeight, label: '미디엄' },
              { id: 'semibold' as ZoneUiFontWeight, label: '세미볼드' },
              { id: 'bold' as ZoneUiFontWeight, label: '볼드' },
            ]}
            onChange={(fontWeight) => set({ fontWeight })}
          />
          <SelectField
            label="제목 굵기"
            value={value.headingFontWeight ?? 'bold'}
            options={[
              { id: 'semibold' as ZoneUiHeadingFontWeight, label: '세미볼드' },
              { id: 'bold' as ZoneUiHeadingFontWeight, label: '볼드' },
              { id: 'extrabold' as ZoneUiHeadingFontWeight, label: '엑스트라볼드' },
            ]}
            onChange={(headingFontWeight) => set({ headingFontWeight })}
          />
          <SelectField
            label="줄 간격"
            value={value.lineHeight ?? 'normal'}
            options={[
              { id: 'tight' as ZoneUiLineHeight, label: '좁게' },
              { id: 'normal' as ZoneUiLineHeight, label: '보통' },
              { id: 'relaxed' as ZoneUiLineHeight, label: '넓게' },
              { id: 'loose' as ZoneUiLineHeight, label: '아주 넓게' },
            ]}
            onChange={(lineHeight) => set({ lineHeight })}
          />
          <SelectField
            label="자간"
            value={value.letterSpacing ?? 'normal'}
            options={[
              { id: 'tight' as ZoneUiLetterSpacing, label: '좁게' },
              { id: 'normal' as ZoneUiLetterSpacing, label: '보통' },
              { id: 'wide' as ZoneUiLetterSpacing, label: '넓게' },
            ]}
            onChange={(letterSpacing) => set({ letterSpacing })}
          />
        </div>
      </FormSection>

      <FormSection title="레이아웃 & 여백">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!hidePaddingY && (
            <SelectField
              label="세로 여백"
              value={value.paddingY ?? 'default'}
              options={paddingOptions.filter((p) => p.id !== 'none' || hidePaddingY)}
              onChange={(paddingY) => set({ paddingY })}
            />
          )}
          <SelectField
            label="가로 여백"
            value={value.paddingX ?? 'default'}
            options={paddingOptions}
            onChange={(paddingX) => set({ paddingX })}
          />
          <SelectField
            label="텍스트 정렬"
            value={value.textAlign ?? 'inherit'}
            options={[
              { id: 'inherit' as ZoneUiTextAlign, label: '기본(상속)' },
              { id: 'left' as ZoneUiTextAlign, label: '왼쪽' },
              { id: 'center' as ZoneUiTextAlign, label: '가운데' },
              { id: 'right' as ZoneUiTextAlign, label: '오른쪽' },
            ]}
            onChange={(textAlign) => set({ textAlign })}
          />
          <SelectField
            label="콘텐츠 최대 너비"
            value={value.contentMaxWidth ?? 'full'}
            options={[
              { id: 'full' as ZoneUiContentWidth, label: '전체 너비' },
              { id: 'wide' as ZoneUiContentWidth, label: '넓게 (1280px)' },
              { id: 'default' as ZoneUiContentWidth, label: '보통 (1152px)' },
              { id: 'narrow' as ZoneUiContentWidth, label: '좁게 (768px)' },
            ]}
            onChange={(contentMaxWidth) => set({ contentMaxWidth })}
          />
        </div>
      </FormSection>

      <FormSection title="색상 & 배경">
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <input
            type="checkbox"
            checked={value.useGradient ?? false}
            onChange={(e) => set({ useGradient: e.target.checked })}
            className="rounded border-gray-300"
          />
          그라데이션 배경 사용
        </label>

        {showGradient && (
          <SelectField
            label="그라데이션 방향"
            value={value.gradientDirection ?? 'to-r'}
            options={[
              { id: 'to-r' as ZoneUiGradientDirection, label: '좌 → 우' },
              { id: 'to-b' as ZoneUiGradientDirection, label: '위 → 아래' },
              { id: 'to-br' as ZoneUiGradientDirection, label: '좌상 → 우하' },
              { id: 'to-bl' as ZoneUiGradientDirection, label: '우상 → 좌하' },
            ]}
            onChange={(gradientDirection) => set({ gradientDirection })}
          />
        )}

        {showOverlay && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              어두운 오버레이 ({Math.round((value.overlayOpacity ?? 0) * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={value.overlayOpacity ?? 0}
              onChange={(e) => set({ overlayOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!value.useGradient && (
            <ColorField
              label="배경색"
              value={value.backgroundColor}
              onChange={(backgroundColor) => set({ backgroundColor })}
            />
          )}
          {value.useGradient && (
            <>
              <ColorField
                label="그라데이션 시작"
                value={value.gradientFrom}
                onChange={(gradientFrom) => set({ gradientFrom })}
              />
              <ColorField
                label="그라데이션 끝"
                value={value.gradientTo}
                onChange={(gradientTo) => set({ gradientTo })}
              />
            </>
          )}
          <ColorField label="제목·본문 색" value={value.textColor} onChange={(textColor) => set({ textColor })} />
          <ColorField
            label="부제·보조 텍스트"
            value={value.mutedTextColor}
            onChange={(mutedTextColor) => set({ mutedTextColor })}
          />
          <ColorField
            label="강조색 (버튼·숫자)"
            value={value.accentColor}
            onChange={(accentColor) => set({ accentColor })}
          />
          <ColorField
            label="강조색 hover"
            value={value.accentHoverColor}
            onChange={(accentHoverColor) => set({ accentHoverColor })}
          />
          <ColorField
            label="버튼 글자색"
            value={value.accentTextColor}
            onChange={(accentTextColor) => set({ accentTextColor })}
          />
          <ColorField label="카드·패널 배경" value={value.surfaceColor} onChange={(surfaceColor) => set({ surfaceColor })} />
          <ColorField label="아이콘 색" value={value.iconColor} onChange={(iconColor) => set({ iconColor })} />
          <ColorField label="테두리 색" value={value.borderColor} onChange={(borderColor) => set({ borderColor })} />
        </div>
      </FormSection>

      <FormSection title="카드 & 테두리 & 효과">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            label="모서리 둥글기"
            value={value.borderRadius ?? 'lg'}
            options={[
              { id: 'none' as ZoneUiBorderRadius, label: '없음 (0)' },
              { id: 'sm' as ZoneUiBorderRadius, label: '작게' },
              { id: 'md' as ZoneUiBorderRadius, label: '보통' },
              { id: 'lg' as ZoneUiBorderRadius, label: '크게' },
              { id: 'xl' as ZoneUiBorderRadius, label: '더 크게' },
              { id: '2xl' as ZoneUiBorderRadius, label: '2XL' },
              { id: 'full' as ZoneUiBorderRadius, label: '알약형' },
            ]}
            onChange={(borderRadius) => set({ borderRadius })}
          />
          <SelectField
            label="테두리 두께"
            value={value.borderWidth ?? 'thin'}
            options={[
              { id: 'none' as ZoneUiBorderWidth, label: '없음' },
              { id: 'thin' as ZoneUiBorderWidth, label: '얇게 (1px)' },
              { id: 'medium' as ZoneUiBorderWidth, label: '보통 (2px)' },
              { id: 'thick' as ZoneUiBorderWidth, label: '두껍게 (3px)' },
            ]}
            onChange={(borderWidth) => set({ borderWidth })}
          />
          <SelectField
            label="그림자"
            value={value.shadow ?? 'sm'}
            options={[
              { id: 'none' as ZoneUiShadow, label: '없음' },
              { id: 'sm' as ZoneUiShadow, label: '약하게' },
              { id: 'md' as ZoneUiShadow, label: '보통' },
              { id: 'lg' as ZoneUiShadow, label: '강하게' },
              { id: 'xl' as ZoneUiShadow, label: '아주 강하게' },
            ]}
            onChange={(shadow) => set({ shadow })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            카드·패널 불투명도 ({Math.round((value.surfaceOpacity ?? 1) * 100)}%)
          </label>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={value.surfaceOpacity ?? 1}
            onChange={(e) => set({ surfaceOpacity: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value.backdropBlur ?? false}
            onChange={(e) => set({ backdropBlur: e.target.checked })}
            className="rounded border-gray-300"
          />
          글래스 효과 (배경 블러)
        </label>
      </FormSection>

      <FormSection title="버튼 & 링크">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            label="버튼 스타일"
            value={value.buttonStyle ?? 'solid'}
            options={[
              { id: 'solid' as ZoneUiButtonStyle, label: '솔리드 (채움)' },
              { id: 'outline' as ZoneUiButtonStyle, label: '아웃라인' },
              { id: 'soft' as ZoneUiButtonStyle, label: '소프트 (연한 배경)' },
              { id: 'ghost' as ZoneUiButtonStyle, label: '고스트 (투명)' },
            ]}
            onChange={(buttonStyle) => set({ buttonStyle })}
          />
          <SelectField
            label="버튼 크기"
            value={value.buttonSize ?? 'md'}
            options={[
              { id: 'sm' as ZoneUiButtonSize, label: '작게' },
              { id: 'md' as ZoneUiButtonSize, label: '보통' },
              { id: 'lg' as ZoneUiButtonSize, label: '크게' },
            ]}
            onChange={(buttonSize) => set({ buttonSize })}
          />
          <SelectField
            label="버튼 모서리"
            value={value.buttonRadius ?? 'inherit'}
            options={[
              { id: 'inherit' as ZoneUiBorderRadius | 'inherit', label: '영역과 동일' },
              { id: 'none' as ZoneUiBorderRadius, label: '각짐' },
              { id: 'md' as ZoneUiBorderRadius, label: '보통' },
              { id: 'lg' as ZoneUiBorderRadius, label: '크게' },
              { id: 'xl' as ZoneUiBorderRadius, label: '더 크게' },
              { id: 'full' as ZoneUiBorderRadius, label: '알약형' },
            ]}
            onChange={(buttonRadius) =>
              set({ buttonRadius: buttonRadius as ZoneUiBorderRadius | 'inherit' })
            }
          />
          <SelectField
            label="링크 스타일"
            value={value.linkStyle ?? 'default'}
            options={[
              { id: 'default' as ZoneUiLinkStyle, label: '기본' },
              { id: 'underline' as ZoneUiLinkStyle, label: '밑줄' },
              { id: 'bold' as ZoneUiLinkStyle, label: '굵게 + 밑줄' },
            ]}
            onChange={(linkStyle) => set({ linkStyle })}
          />
        </div>
        <ColorField
          label="링크 색 (비우면 강조색)"
          value={value.linkColor}
          onChange={(linkColor) => set({ linkColor })}
          hint="비워두면 강조색과 동일"
        />
      </FormSection>
    </div>
  )
}
