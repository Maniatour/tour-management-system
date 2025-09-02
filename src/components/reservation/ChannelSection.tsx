'use client'

interface Channel {
  id: string
  name: string
  type: 'ota' | 'self' | 'partner'
}

interface ChannelSectionProps {
  formData: {
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    channelId: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  channels: Channel[]
  t: (key: string) => string
}

export default function ChannelSection({
  formData,
  setFormData,
  channels,
  t
}: ChannelSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.channel')}</label>
      
      {/* 채널명 검색 */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="채널명 검색..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          onChange={(e) => setFormData((prev: any) => ({ ...prev, channelSearch: e.target.value }))} // eslint-disable-line @typescript-eslint/no-explicit-any
        />
      </div>
      
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* 채널 타입별 탭 */}
        <div className="flex bg-gray-50">
          {['self', 'ota', 'partner'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData((prev: any) => ({ ...prev, selectedChannelType: type as 'ota' | 'self' | 'partner' }))} // eslint-disable-line @typescript-eslint/no-explicit-any
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                formData.selectedChannelType === type
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {type === 'self' ? '자체채널' : type === 'ota' ? 'OTA' : '제휴사'}
            </button>
          ))}
        </div>
        
        {/* 채널 선택 리스트 */}
        <div className="h-[770px] overflow-y-auto">
          {channels
            .filter(channel => {
              const matchesType = channel.type === formData.selectedChannelType
              const matchesSearch = !formData.channelSearch || 
                channel.name?.toLowerCase().includes(formData.channelSearch.toLowerCase())
              return matchesType && matchesSearch
            })
            .map(channel => (
              <div
                key={channel.id}
                onClick={() => setFormData((prev: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                  ...prev, 
                  channelId: prev.channelId === channel.id ? '' : channel.id 
                }))}
                className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  formData.channelId === channel.id ? 'bg-blue-500 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="text-sm text-gray-900">{channel.name}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
