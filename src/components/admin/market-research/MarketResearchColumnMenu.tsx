'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  EyeOff,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketListing } from '@/lib/market-research/types'

type MenuItem = {
  id: string
  label: string
  icon: typeof Star
  disabled?: boolean
  danger?: boolean
  href?: string
  onSelect?: () => void
}

export function MarketResearchColumnMenu({
  isKo,
  listing,
  favorite,
  canMoveLeft,
  canMoveRight,
  onToggleFavorite,
  onMove,
  onHide,
  onEnterPrice,
  onFetch,
  onEdit,
  onDelete,
}: {
  isKo: boolean
  listing: MarketListing
  favorite: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onToggleFavorite?: ((listingId: string) => void) | undefined
  onMove?: ((listingId: string, direction: -1 | 1) => void) | undefined
  onHide?: ((listingId: string) => void) | undefined
  onEnterPrice: (listingId: string) => void
  onFetch: (listingId: string) => void
  onEdit: (listing: MarketListing) => void
  onDelete: (id: string) => void
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-market-column-menu]')) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const items: MenuItem[] = [
    {
      id: 'favorite',
      label: isKo ? (favorite ? '즐겨찾기 해제' : '즐겨찾기') : favorite ? 'Unfavorite' : 'Favorite',
      icon: Star,
      onSelect: () => onToggleFavorite?.(listing.id),
    },
    {
      id: 'left',
      label: isKo ? '왼쪽으로' : 'Move left',
      icon: ChevronLeft,
      disabled: !canMoveLeft,
      onSelect: () => onMove?.(listing.id, -1),
    },
    {
      id: 'right',
      label: isKo ? '오른쪽으로' : 'Move right',
      icon: ChevronRight,
      disabled: !canMoveRight,
      onSelect: () => onMove?.(listing.id, 1),
    },
    {
      id: 'hide',
      label: isKo ? '숨기기' : 'Hide',
      icon: EyeOff,
      onSelect: () => onHide?.(listing.id),
    },
    {
      id: 'price',
      label: isKo ? '가격 입력' : 'Enter price',
      icon: CircleDollarSign,
      onSelect: () => onEnterPrice(listing.id),
    },
    {
      id: 'fetch',
      label: isKo ? '지금 수집' : 'Fetch now',
      icon: RefreshCw,
      onSelect: () => onFetch(listing.id),
    },
    {
      id: 'edit',
      label: isKo ? '리스팅 수정' : 'Edit listing',
      icon: Pencil,
      onSelect: () => onEdit(listing),
    },
    {
      id: 'open',
      label: isKo ? '리스팅 열기' : 'Open listing',
      icon: ExternalLink,
      href: listing.listing_url,
    },
    {
      id: 'delete',
      label: isKo ? '리스팅 삭제' : 'Delete listing',
      icon: Trash2,
      danger: true,
      onSelect: () => onDelete(listing.id),
    },
  ]

  const openMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 196
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))
    setPosition({ top: rect.bottom + 6, left })
    setOpen(true)
  }

  return (
    <div ref={rootRef} className="flex justify-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 rounded-xl px-3 text-slate-600"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {favorite ? <Star className="mr-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" /> : <MoreHorizontal className="mr-1 h-4 w-4" />}
        {isKo ? '더보기' : 'More'}
      </Button>
      {open && position
        ? createPortal(
            <div
              id={menuId}
              role="menu"
              data-market-column-menu
              className="fixed z-[80] w-[196px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
              style={{ top: position.top, left: position.left }}
            >
              {items.map((item) => {
                const Icon = item.icon
                const className = `flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  item.danger
                    ? 'mt-1 border-t border-slate-100 text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                } disabled:pointer-events-none disabled:opacity-40`
                if (item.href) {
                  return (
                    <a
                      key={item.id}
                      role="menuitem"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={className}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </a>
                  )
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={className}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.()
                      setOpen(false)
                    }}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${item.id === 'favorite' && favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                    {item.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
