import React, { memo } from 'react';
import { Globe, Users, Edit2 } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
}

interface ChannelGroup {
  type: 'OTA' | 'SELF';
  label: string;
  channels: Channel[];
}

interface ChannelPricingStats {
  [year: string]: number; // 연도별 설정된 날짜 수
}

interface ChannelSelectorProps {
  channelGroups: ChannelGroup[];
  isLoadingChannels: boolean;
  selectedChannelType: 'OTA' | 'SELF' | '';
  selectedChannel: string;
  isMultiChannelMode: boolean;
  selectedChannels: string[];
  onChannelTypeSelect: (channelType: 'OTA' | 'SELF') => void;
  onChannelSelect: (channelId: string) => void;
  onMultiChannelToggle: () => void;
  onChannelToggle: (channelId: string) => void;
  onSelectAllChannelsInType: () => void;
  onChannelEdit?: (channelId: string) => void; // 채널 편집 핸들러
  channelPricingStats?: Record<string, ChannelPricingStats>; // 채널 ID별 연도별 날짜 수
}

export const ChannelSelector = memo(function ChannelSelector({
  channelGroups,
  isLoadingChannels,
  selectedChannelType,
  selectedChannel,
  isMultiChannelMode,
  selectedChannels,
  onChannelTypeSelect,
  onChannelSelect,
  onMultiChannelToggle,
  onChannelToggle,
  onSelectAllChannelsInType,
  onChannelEdit,
  channelPricingStats = {}
}: ChannelSelectorProps) {
  
  // 연도별 날짜 수를 표시 형식으로 변환
  const formatPricingStats = (stats: ChannelPricingStats | undefined) => {
    if (!stats || Object.keys(stats).length === 0) return null;
    
    const sortedYears = Object.keys(stats).sort();
    return sortedYears.map(year => {
      const daysCount = stats[year];
      const isLeapYear = (parseInt(year) % 4 === 0 && parseInt(year) % 100 !== 0) || (parseInt(year) % 400 === 0);
      const totalDays = isLeapYear ? 366 : 365;
      return `${year} (${daysCount}/${totalDays})`;
    }).join(', ');
  };
  if (isLoadingChannels) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">채널 로딩 중...</span>
      </div>
    );
  }

  const selfGroup = channelGroups.find(group => group.type === 'SELF');
  const otaGroup = channelGroups.find(group => group.type === 'OTA');

  return (
    <div className="space-y-4">
      {/* 자체 채널 전체 선택 */}
      {selfGroup && selfGroup.channels.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => onChannelTypeSelect('SELF')}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selectedChannelType === 'SELF'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5" />
              <div className="flex-1">
                <div className="font-medium">자체 채널 (전체선택)</div>
                <div className="text-sm text-gray-500">
                  {selfGroup.channels.length}개 채널
                </div>
                {/* 자체 채널 통계 - 모든 자체 채널의 날짜 수 합계 */}
                {(() => {
                  const allStats: ChannelPricingStats = {};
                  selfGroup.channels.forEach(channel => {
                    const channelStats = channelPricingStats[channel.id];
                    if (channelStats) {
                      Object.keys(channelStats).forEach(year => {
                        if (!allStats[year]) {
                          allStats[year] = 0;
                        }
                        allStats[year] += channelStats[year];
                      });
                    }
                  });
                  const statsText = formatPricingStats(allStats);
                  return statsText ? (
                    <div className="text-xs text-gray-500 mt-1">{statsText}</div>
                  ) : null;
                })()}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* OTA 채널 목록 */}
      {otaGroup && otaGroup.channels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 mb-2">
            <Globe className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">OTA 채널</span>
          </div>
          
          <div className="space-y-1">
            {otaGroup.channels.map((channel) => {
              const isSelected = selectedChannel === channel.id;
              const stats = channelPricingStats[channel.id];
              const statsText = formatPricingStats(stats);

              return (
                <div
                  key={channel.id}
                  className={`w-full p-2 rounded-md border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onChannelSelect(channel.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                            {channel.name}
                          </span>
                        </div>
                        {statsText && (
                          <div className="text-xs text-gray-500 mt-1">{statsText}</div>
                        )}
                      </div>
                    </button>
                    {onChannelEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChannelEdit(channel.id);
                        }}
                        className="ml-2 p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                        title="채널 편집"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 선택 상태 표시 */}
      {(selectedChannelType || selectedChannel) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-700">
            현재 선택된 채널:
          </div>
          <div className="text-sm text-blue-600 mt-1">
            {selectedChannelType === 'SELF' 
              ? `자체 채널 (${selfGroup?.channels.length || 0}개)`
              : selectedChannel 
                ? otaGroup?.channels.find(c => c.id === selectedChannel)?.name || '알 수 없음'
                : '선택되지 않음'
            }
          </div>
        </div>
      )}
    </div>
  );
});
