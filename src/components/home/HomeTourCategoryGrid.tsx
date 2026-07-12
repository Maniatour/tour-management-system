'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CategoryTagItem } from '@/components/home/homeSectionTypes'
import { getHomeCategoryIcon } from '@/lib/homeCategoryIcons'
import {
  getHomeCategoryIllustration,
  getHomeCategoryTileStyle,
} from '@/lib/homeCategoryGridData'

type Props = {
  locale: string
  t: (key: string) => string
  items: CategoryTagItem[]
  /** Mania Tour 홈 — 쉐도우 카드 + 일러스트 아이콘 */
  variant?: 'default' | 'boxed'
}

export default function HomeTourCategoryGrid({ locale, t, items, variant = 'default' }: Props) {
  const isBoxed = variant === 'boxed'

  return (
    <div className={isBoxed ? 'kv-adventure-grid' : 'gyg-category-grid'}>
      {items.map((item) => {
        const Icon = getHomeCategoryIcon(item.labelKey)
        const tileStyle = getHomeCategoryTileStyle(item.labelKey)
        const illustrationUrl = getHomeCategoryIllustration(item.labelKey)
        const label = t(item.labelKey)

        if (isBoxed) {
          return (
            <Link
              key={item.labelKey}
              href={`/${locale}/products?tag=${encodeURIComponent(item.tagQuery)}`}
              className="kv-adventure-card group"
            >
              {illustrationUrl ? (
                <span className="kv-adventure-illust" aria-hidden>
                  <Image
                    src={illustrationUrl}
                    alt=""
                    width={72}
                    height={72}
                    className="kv-adventure-illust-img"
                    sizes="72px"
                  />
                </span>
              ) : (
                <Icon
                  className="kv-adventure-icon"
                  style={{ color: tileStyle.iconColor }}
                  aria-hidden
                />
              )}
              <span className="kv-adventure-label">{label}</span>
            </Link>
          )
        }

        return (
          <Link
            key={item.labelKey}
            href={`/${locale}/products?tag=${encodeURIComponent(item.tagQuery)}`}
            className="gyg-category-tile group"
          >
            <span
              className="gyg-category-icon-wrap"
              style={{ backgroundColor: tileStyle.background }}
              aria-hidden
            >
              <Icon className="gyg-category-icon" style={{ color: tileStyle.iconColor }} />
            </span>
            <span className="gyg-category-label group-hover:text-[var(--gyg-navy)]">
              {label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
