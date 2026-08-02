'use client'

import React from 'react'
import { MapPin } from 'lucide-react'
import type { SupportedLanguage } from '@/lib/translation'
import {
  extractFirstUrl,
  findNextUrl,
  GOOGLE_MAPS_URL_RE,
  isGoogleMapsUrl,
  isLocationShareMessage,
  isNaverMapsUrl,
  NAVER_MAPS_URL_RE,
} from '@/lib/chatMessageLinks'

interface ChatMessageBodyProps {
  message: string
  selectedLanguage: SupportedLanguage
  /** 파란색 말풍선(내 메시지·가이드) 안에서는 밝은 링크 색 사용 */
  isDarkBubble?: boolean
}

function openExternalUrl(url: string, event: React.MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  window.open(url, '_blank', 'noopener,noreferrer')
}

function getMapLinkLabel(url: string): string {
  if (isGoogleMapsUrl(url)) {
    return 'View on Google Maps'
  }
  if (isNaverMapsUrl(url)) {
    return 'View on Naver Maps'
  }
  return url
}

function MapLink({
  url,
  linkClass,
  variant = 'default',
}: {
  url: string
  linkClass: string
  variant?: 'default' | 'green'
}) {
  const label = getMapLinkLabel(url)
  const colorClass =
    variant === 'green'
      ? 'text-green-600 hover:text-green-800'
      : linkClass

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${colorClass} underline inline-flex items-center gap-1`}
      onClick={(event) => openExternalUrl(url, event)}
    >
      <MapPin size={14} className="shrink-0" aria-hidden />
      {label}
    </a>
  )
}

function linkifyLine(
  line: string,
  linkClass: string,
  lineKey: number
): React.ReactNode {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  let partIndex = 0

  while (cursor < line.length) {
    const match = findNextUrl(line, cursor)
    if (!match) {
      nodes.push(
        <span key={`${lineKey}-text-${partIndex}`}>{line.slice(cursor)}</span>
      )
      break
    }

    if (match.start > cursor) {
      nodes.push(
        <span key={`${lineKey}-text-${partIndex++}`}>{line.slice(cursor, match.start)}</span>
      )
    }

    const variant = isNaverMapsUrl(match.url) ? 'green' : 'default'
    nodes.push(
      <MapLink
        key={`${lineKey}-link-${partIndex++}`}
        url={match.url}
        linkClass={linkClass}
        variant={variant}
      />
    )

    cursor = match.end
  }

  if (nodes.length === 0) {
    return <span key={lineKey}>{line}</span>
  }

  return <div key={lineKey}>{nodes}</div>
}

function LocationShareCard({
  message,
  linkClass,
}: {
  message: string
  linkClass: string
}) {
  const googleUrl = extractFirstUrl(message, GOOGLE_MAPS_URL_RE)
  const naverUrl = extractFirstUrl(message, NAVER_MAPS_URL_RE)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-medium">
        <MapPin size={16} className="shrink-0" aria-hidden />
        <span>My Location</span>
      </div>
      <div className="text-xs opacity-90">View on Map</div>
      <div className="flex flex-col items-start gap-1.5">
        {googleUrl ? (
          <MapLink url={googleUrl} linkClass={linkClass} />
        ) : null}
        {naverUrl ? (
          <MapLink url={naverUrl} linkClass={linkClass} variant="green" />
        ) : null}
      </div>
    </div>
  )
}

export default function ChatMessageBody({
  message,
  selectedLanguage: _selectedLanguage,
  isDarkBubble = false,
}: ChatMessageBodyProps) {
  const linkClass = isDarkBubble
    ? 'text-blue-100 hover:text-white'
    : 'text-primary hover:text-primary/80'

  if (isLocationShareMessage(message)) {
    return <LocationShareCard message={message} linkClass={linkClass} />
  }

  return (
    <div className="whitespace-pre-wrap break-words">
      {message.split('\n').map((line, index) => linkifyLine(line, linkClass, index))}
    </div>
  )
}
