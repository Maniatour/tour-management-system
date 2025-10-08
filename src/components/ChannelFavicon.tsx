'use client'

import React from 'react'

interface ChannelFaviconProps {
  channelId: string
  channels: Array<{ id: string; name: string; favicon_url?: string }> | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4', 
  lg: 'h-6 w-6'
}

export default function ChannelFavicon({ 
  channelId, 
  channels, 
  size = 'md',
  className = ''
}: ChannelFaviconProps) {
  const channel = channels?.find(c => c.id === channelId)
  const channelWithFavicon = channel as { favicon_url?: string; name?: string } | undefined

  if (channelWithFavicon?.favicon_url) {
    return (
      <img 
        src={channelWithFavicon.favicon_url} 
        alt={`${channelWithFavicon.name || 'Channel'} favicon`} 
        className={`${sizeClasses[size]} rounded flex-shrink-0 ${className}`}
        onError={(e) => {
          // 파비콘 로드 실패 시 기본 아이콘으로 대체
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            const fallback = document.createElement('div')
            fallback.className = `${sizeClasses[size]} rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 ${className}`
            fallback.innerHTML = '🌐'
            parent.appendChild(fallback)
          }
        }}
      />
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 ${className}`}>
      🌐
    </div>
  )
}
