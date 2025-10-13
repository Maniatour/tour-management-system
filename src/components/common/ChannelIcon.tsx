import React from 'react'
import { getChannelIcon } from '@/utils/tourStatusUtils'

interface ChannelIconProps {
  channelInfo: any
}

export default function ChannelIcon({ channelInfo }: ChannelIconProps) {
  const iconData = getChannelIcon(channelInfo)
  
  if (typeof iconData === 'object' && iconData.type === 'image') {
    return (
      <img 
        src={iconData.src} 
        alt={iconData.alt} 
        className={iconData.className}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }
  
  return <span>{iconData}</span>
}
