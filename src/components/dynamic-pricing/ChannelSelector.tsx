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

  // 디버깅: channelPricingStats와 채널 목록 매칭 확인
  React.useEffect(() => {
    if (Object.keys(channelPricingStats).length > 0) {
      const allChannelIds = new Set<string>();
      const channelIdToName = new Map<string, string>();
      const channelNameToId = new Map<string, string>();
      
      channelGroups.forEach(group => {
        group.channels.forEach(channel => {
          allChannelIds.add(channel.id);
          channelIdToName.set(channel.id, channel.name);
          // 채널 이름도 정규화해서 저장
          const normalizedName = channel.name.toLowerCase().trim();
          channelNameToId.set(normalizedName, channel.id);
        });
      });
      
      const statsChannelIds = new Set(Object.keys(channelPricingStats));
      
      // 채널 ID로 매칭 확인
      const missingInStatsById = Array.from(allChannelIds).filter(id => !statsChannelIds.has(id));
      
      // 채널 이름으로 매칭 확인
      const missingInStatsByName = Array.from(allChannelIds).filter(id => {
        if (statsChannelIds.has(id)) return false; // ID로 이미 매칭됨
        const channelName = channelIdToName.get(id);
        if (!channelName) return true;
        const normalizedName = channelName.toLowerCase().trim();
        return !statsChannelIds.has(normalizedName);
      });
      
      const missingInChannels = Array.from(statsChannelIds).filter(id => {
        // ID로 매칭 확인
        if (allChannelIds.has(id)) return false;
        // 이름으로 매칭 확인
        const matchingChannelId = Array.from(channelNameToId.entries()).find(([name, chId]) => {
          return name === id.toLowerCase().trim();
        });
        return !matchingChannelId;
      });
      
      // 각 채널의 매칭 상태 확인
      const channelMatchingStatus = Array.from(allChannelIds).map(id => {
        const name = channelIdToName.get(id) || '알 수 없음';
        const matchedById = statsChannelIds.has(id);
        const normalizedName = name.toLowerCase().trim();
        const normalizedNameNoParens = normalizedName.replace(/[()]/g, '').replace(/\s+/g, ' ');
        const matchedByName = statsChannelIds.has(normalizedName) || statsChannelIds.has(normalizedNameNoParens);
        const matched = matchedById || matchedByName;
        
        return {
          id,
          name,
          matchedById,
          matchedByName,
          matched,
          normalizedName,
          normalizedNameNoParens
        };
      });

      // 매칭되지 않은 채널들 상세 정보
      const unmatchedChannels = channelMatchingStatus.filter(ch => !ch.matched);
      
      console.log('ChannelSelector - 통계 매칭 확인:', {
        totalChannels: allChannelIds.size,
        totalStats: statsChannelIds.size,
        matchedChannels: channelMatchingStatus.filter(ch => ch.matched).map(ch => ({ id: ch.id, name: ch.name })),
        unmatchedChannels: unmatchedChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          normalizedName: ch.normalizedName,
          normalizedNameNoParens: ch.normalizedNameNoParens,
          matchedById: ch.matchedById,
          matchedByName: ch.matchedByName
        })),
        allStatsKeys: Object.keys(channelPricingStats),
        statsByNameKeys: Object.keys(channelPricingStats).filter(key => !allChannelIds.has(key) && !Array.from(allChannelIds).some(id => id.toLowerCase() === key.toLowerCase()))
      });
    }
  }, [channelPricingStats, channelGroups]);
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

  // 자체 채널 중 홈페이지 채널만 필터링
  // id가 'SELF'인 통합 채널만 제외하고, 나머지 모든 자체 채널 표시
  // 만약 자체 채널이 1개만 있고 그것이 'SELF'인 경우, 모든 자체 채널 표시 (임시)
  const finalDisplayChannels = (() => {
    if (!selfGroup || selfGroup.channels.length === 0) return [];
    
    // id가 'SELF'가 아닌 채널만 필터링
    const filtered = selfGroup.channels.filter(channel => {
      const channelAny = channel as any;
      const isSelfIntegrated = channel.id === 'SELF';
      
      console.log('ChannelSelector - 자체 채널 필터링:', {
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        channelCategory: channel.category,
        sub_channels: channelAny.sub_channels,
        isSelfIntegrated,
        shouldDisplay: !isSelfIntegrated
      });
      
      return !isSelfIntegrated;
    });
    
    // 필터링 결과가 없고 자체 채널이 1개만 있는 경우, 모든 자체 채널 표시
    if (filtered.length === 0 && selfGroup.channels.length === 1) {
      console.log('ChannelSelector - 자체 채널이 1개만 있어서 모두 표시:', selfGroup.channels[0]);
      return selfGroup.channels;
    }
    
    return filtered;
  })();

  // 디버깅: 자체 채널 그룹 정보 출력
  console.log('ChannelSelector - 자체 채널 그룹:', {
    selfGroupExists: !!selfGroup,
    selfGroupChannelsCount: selfGroup?.channels.length || 0,
    finalDisplayChannelsCount: finalDisplayChannels.length,
    selfGroupChannels: selfGroup?.channels.map(c => {
      const cAny = c as any;
      return {
        id: c.id, 
        name: c.name, 
        type: c.type, 
        category: c.category,
        sub_channels: cAny.sub_channels,
        website: cAny.website,
        customer_website: cAny.customer_website,
        admin_website: cAny.admin_website,
        isHomepage: c.id === 'SELF' ? 'SELF는 통합 채널 (카카오톡, 블로그 등)' : 
                    (c.name?.toLowerCase().includes('homepage') || 
                     c.name?.toLowerCase().includes('홈페이지') ||
                     c.name?.toLowerCase().includes('website') ||
                     c.name?.toLowerCase().includes('웹사이트') ||
                     cAny.website || cAny.customer_website || cAny.admin_website ? '홈페이지일 가능성' : '일반 자체 채널')
      };
    }),
    finalDisplayChannels: finalDisplayChannels.map(c => ({ 
      id: c.id, 
      name: c.name, 
      type: c.type, 
      category: c.category 
    })),
    note: 'SELF 채널은 홈페이지가 아닌 통합 채널입니다. 홈페이지 채널이 별도로 있어야 합니다.'
  });

  return (
    <div className="space-y-4">
      {/* 자체 채널 - 홈페이지만 표시 */}
      {finalDisplayChannels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">자체 채널 (홈페이지)</span>
          </div>
          
          <div className="space-y-1">
            {finalDisplayChannels.map((channel) => {
              const channelAny = channel as any;
              const isSelected = selectedChannel === channel.id;
              // 채널 ID로 먼저 찾고, 없으면 소문자 버전으로, 그 다음 채널 이름으로 찾기
              let stats = channelPricingStats[channel.id];
              if (!stats) {
                // 소문자 버전으로 시도
                stats = channelPricingStats[channel.id.toLowerCase()];
              }
              if (!stats) {
                // 채널 이름 정규화 (소문자, 공백 제거, 특수문자 제거)
                const normalizedName = channel.name
                  .toLowerCase()
                  .trim()
                  .replace(/[()]/g, '') // 괄호 제거
                  .replace(/\s+/g, ' '); // 여러 공백을 하나로
                stats = channelPricingStats[normalizedName];
                
                // 여전히 없으면 원본 이름으로도 시도
                if (!stats) {
                  stats = channelPricingStats[channel.name.toLowerCase().trim()];
                }
              }
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
                        {(channelAny.customer_website || channelAny.admin_website) && (
                          <div className="text-xs text-gray-400 mt-1">
                            {channelAny.customer_website || channelAny.admin_website}
                          </div>
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
              // 채널 ID로 먼저 찾고, 없으면 소문자 버전으로, 그 다음 채널 이름으로 찾기
              let stats = channelPricingStats[channel.id];
              if (!stats) {
                // 소문자 버전으로 시도
                stats = channelPricingStats[channel.id.toLowerCase()];
              }
              if (!stats) {
                // 채널 이름 정규화 (소문자, 공백 제거, 특수문자 제거)
                const normalizedName = channel.name
                  .toLowerCase()
                  .trim()
                  .replace(/[()]/g, '') // 괄호 제거
                  .replace(/\s+/g, ' '); // 여러 공백을 하나로
                stats = channelPricingStats[normalizedName];
                
                // 여전히 없으면 원본 이름으로도 시도
                if (!stats) {
                  stats = channelPricingStats[channel.name.toLowerCase().trim()];
                }
              }
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
