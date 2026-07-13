'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  PRODUCT_LISTING_RIBBON_OPTIONS,
  getProductListingRibbonLabelKey,
  getProductListingRibbonSelection,
  getProductListingRibbonVariantClass,
  resolveProductListingRibbon,
  type ProductListingRibbonSelection,
} from '@/lib/productListingRibbon'
import {
  getProductCardPreviewCommonLabel,
  type AdminProductCardPreviewLocale,
} from '@/lib/adminProductCardPreviewLabels'

type ProductListingRibbonPickerProps = {
  maxParticipants: number | null
  tags: string[]
  disabled?: boolean
  previewLocale?: AdminProductCardPreviewLocale
  onSelect: (selection: ProductListingRibbonSelection) => void
}

const MENU_WIDTH = 200
const MENU_GAP = 6
const VIEWPORT_MARGIN = 8

export default function ProductListingRibbonPicker({
  maxParticipants,
  tags,
  disabled = false,
  previewLocale = 'ko',
  onSelect,
}: ProductListingRibbonPickerProps) {
  const t = useTranslations('products')
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const ribbonProduct = { max_participants: maxParticipants, tags }
  const resolvedRibbon = resolveProductListingRibbon(ribbonProduct)
  const currentSelection = getProductListingRibbonSelection(ribbonProduct)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))
    const top = rect.bottom + MENU_GAP

    setMenuPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    const handleReposition = () => updatePosition()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open, updatePosition])

  const handleSelect = (selection: ProductListingRibbonSelection) => {
    setOpen(false)
    onSelect(selection)
  }

  const badgeLabel = resolvedRibbon
    ? getProductCardPreviewCommonLabel(previewLocale, getProductListingRibbonLabelKey(resolvedRibbon.id))
    : t('selectRibbon')

  const badgeClassName = resolvedRibbon
    ? `${getProductListingRibbonVariantClass(resolvedRibbon.variant)} admin-product-gyg-card__ribbon is-on`
    : 'gyg-listing-ribbon admin-product-gyg-card__ribbon is-off'

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        className="admin-product-gyg-card__ribbon-menu"
        role="listbox"
        aria-label={t('changeRibbon')}
        style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {PRODUCT_LISTING_RIBBON_OPTIONS.map((option) => {
          const isSelected = currentSelection === option.id
          const previewLabel =
            option.id === 'auto' || option.id === 'none'
              ? t(option.labelKey)
              : getProductCardPreviewCommonLabel(previewLocale, option.labelKey)

          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`admin-product-gyg-card__ribbon-option${isSelected ? ' is-selected' : ''}`}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                handleSelect(option.id)
              }}
            >
              {option.variant ? (
                <span
                  className={`${getProductListingRibbonVariantClass(option.variant)} admin-product-gyg-card__ribbon-preview`}
                  aria-hidden
                >
                  {previewLabel}
                </span>
              ) : (
                <span className="admin-product-gyg-card__ribbon-preview admin-product-gyg-card__ribbon-preview--plain">
                  {previewLabel}
                </span>
              )}
              {isSelected ? <span className="admin-product-gyg-card__ribbon-check">✓</span> : null}
            </button>
          )
        })}
      </div>
    ) : null

  return (
    <div className="admin-product-gyg-card__ribbon-picker">
      <button
        ref={buttonRef}
        type="button"
        className={badgeClassName}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!disabled) setOpen((value) => !value)
        }}
        disabled={disabled}
        title={t('changeRibbon')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {badgeLabel}
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
