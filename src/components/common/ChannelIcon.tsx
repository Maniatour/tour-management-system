interface ChannelIconProps {
  channelInfo: { favicon_url?: string; name?: string }
}

export default function ChannelIcon({ channelInfo }: ChannelIconProps) {
  if (channelInfo?.favicon_url) {
    return (
      <img
        src={channelInfo.favicon_url}
        alt={`${channelInfo.name || 'Channel'} favicon`}
        className="h-4 w-4 rounded flex-shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }

  return <span>🌐</span>
}
