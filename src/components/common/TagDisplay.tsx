'use client'

import React from 'react'
import { useTranslations } from 'next-intl'

interface TagDisplayProps {
  tags: string[]
  maxDisplay?: number
  showCount?: boolean
  className?: string
  itemClassName?: string
}

/**
 * 다국어 태그를 표시我先 컴포넌트
 * 
 * 사용법:
 * <TagDisplay tags={['popular', 'new', 'recommended']} />
 * 
 * 데이터베이스에는 영어 키를 저장하고, UI에서는 현재 언어로 번역해서 표시합니다.
 * 우선순위: DB 번역 > i18n 번역 > 원본 태그
 */
export default function TagDisplay({ 
  tags, 
  maxDisplay = Infinity, 
  showCount = false,
  className = '',
  itemClassName = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
}: TagDisplayProps) {
  const t = useTranslations('common.tagLabels')

  if (!tags || tags.length === 0) {
    return null
  }

  const displayedTags = tags.slice(0, maxDisplay)
  const remainingCount = tags.length - displayedTags.length

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayedTags.map((tag, index) => {
        // 번역 시도: 우선순위 1) DB 번역 2) i18n 번역 3) 원본
        const translatedTag = (() => {
          try {
            // 먼저 i18n 번역 시도
            const i18nTranslation = t(tag as any)
            return i18nTranslation && i18nTranslation !== tag ? i18nTranslation : tag
          } catch {
            return tag
          }
        })()

        // pronunciation 처리 (여러 발음이 | 또는 쉼표로 구분된 경우 첫 번째 사용)
        const displayLabel = /[|,]/.test(translatedTag)
          ? translatedTag.split(/[|,]/)[0].trim()
          : translatedTag

        return (
          <span
            key={index}
            className={itemClassName}
            title={tag} // 원본 태그를 툴팁으로 표시
          >
            {displayLabel}
          </span>
        )
      })}
      {remainingCount > 0 && (
        <span className={itemClassName}>
          +{remainingCount}
        </span>
      )}
    </div>
  )
}
