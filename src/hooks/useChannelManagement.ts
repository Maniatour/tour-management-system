import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface Channel {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  commission_base_price_only?: boolean;
  [key: string]: unknown;
}

interface ChannelGroup {
  type: 'OTA' | 'SELF';
  label: string;
  channels: Channel[];
}

export function useChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [selectedChannelType, setSelectedChannelType] = useState<'OTA' | 'SELF' | ''>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isMultiChannelMode, setIsMultiChannelMode] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // 채널을 타입별로 그룹화 (type 컬럼만 참조)
  const channelGroups = useMemo(() => {
    // OTA 채널: type이 'ota'인 채널만
    const otaChannels = channels.filter(channel => 
      (channel.type || '').toLowerCase() === 'ota'
    );
    
    // 자체 채널: ID가 'M00001'인 홈페이지 채널만 (Self 채널 제외)
    const selfChannels = channels.filter(channel => {
      // ID가 'M00001'인 채널만 자체 채널로 분류
      return channel.id === 'M00001';
    });
    
    // 디버깅: 자체 채널 필터링 결과 출력
    console.log('useChannelManagement - 자체 채널 필터링:', {
      totalChannels: channels.length,
      selfChannelsCount: selfChannels.length,
      selfChannels: selfChannels.map(c => ({ id: c.id, name: c.name, type: c.type, category: c.category }))
    });

    return [
      {
        type: 'OTA' as const,
        label: 'OTA 채널',
        channels: otaChannels
      },
      {
        type: 'SELF' as const,
        label: '자체 채널 (홈페이지)',
        channels: selfChannels
      }
    ];
  }, [channels]);

  const loadChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true);
      
      // 활성 채널과 M00001 채널을 모두 가져오기
      const [activeChannelsResult, m00001Result] = await Promise.all([
        supabase
          .from('channels')
          .select('*')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('channels')
          .select('*')
          .eq('id', 'M00001')
          .single()
      ]);

      if (activeChannelsResult.error) {
        console.error('활성 채널 로드 실패:', activeChannelsResult.error);
      }

      const activeChannels = activeChannelsResult.data || [];
      
      // M00001 채널이 활성 채널 목록에 없으면 추가
      let allChannels = [...activeChannels];
      if (m00001Result.data && !activeChannels.find((ch: any) => ch.id === 'M00001')) {
        allChannels.push(m00001Result.data);
        console.log('M00001 채널 추가됨 (status와 관계없이):', m00001Result.data);
      }
      
      // 중복 제거 (ID 기준)
      const uniqueChannels = allChannels.filter((channel, index, self) =>
        index === self.findIndex((ch) => ch.id === channel.id)
      );
      
      console.log('로드된 채널 데이터:', uniqueChannels);
      // M00001 채널 확인
      const m00001Channel = uniqueChannels.find((ch: any) => ch.id === 'M00001');
      console.log('M00001 채널 확인:', m00001Channel ? { id: m00001Channel.id, name: m00001Channel.name, status: m00001Channel.status } : 'M00001 채널 없음');
      
      // 각 채널의 commission_percent 필드 확인
      if (uniqueChannels.length > 0) {
        uniqueChannels.forEach((channel: any) => {
          console.log(`채널 ${channel.name} (${channel.id}): commission_percent=${channel.commission_percent}, commission=${channel.commission}`);
        });
      }
      setChannels(uniqueChannels);
    } catch (error) {
      console.error('채널 로드 실패:', error);
      setChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  }, []);

  const handleChannelTypeSelect = useCallback((channelType: 'OTA' | 'SELF') => {
    setSelectedChannelType(channelType);
    setSelectedChannel('');
    setIsMultiChannelMode(false);
    setSelectedChannels([]);
  }, []);

  const handleChannelSelect = useCallback(async (channelId: string) => {
    console.log('채널 선택됨:', channelId);
    
    // 선택된 채널의 타입 자동 감지
    const selectedChannelData = channels.find(channel => channel.id === channelId);
    let channelType: 'OTA' | 'SELF' | '' = '';
    
    if (selectedChannelData) {
      // 채널 타입 결정 로직
      const channelTypeLower = (selectedChannelData.type || '').toLowerCase();
      
      if (channelTypeLower === 'ota') {
        channelType = 'OTA';
      } else if (selectedChannelData.id === 'M00001') {
        // ID가 'M00001'인 채널만 자체 채널로 분류
        channelType = 'SELF';
      }
      // Partner (type === 'partner')는 자동 감지되지 않음
    }
    
    console.log('감지된 채널 타입:', channelType);
    
    setSelectedChannel(channelId);
    setSelectedChannelType(channelType); // 감지된 채널 타입 설정
    setIsMultiChannelMode(false);
    setSelectedChannels([]);
  }, [channels]);

  const handleMultiChannelToggle = useCallback(() => {
    setIsMultiChannelMode(!isMultiChannelMode);
    if (!isMultiChannelMode) {
      setSelectedChannel('');
    } else {
      setSelectedChannels([]);
    }
  }, [isMultiChannelMode]);

  const handleChannelToggle = useCallback((channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  }, []);

  // 선택된 채널 타입의 모든 채널을 선택/해제
  const handleSelectAllChannelsInType = useCallback(() => {
    if (!selectedChannelType) return;
    
    const currentGroup = channelGroups.find(group => group.type === selectedChannelType);
    if (!currentGroup) return;

    const allChannelIds = currentGroup.channels.map(channel => channel.id);
    
    if (selectedChannels.length === allChannelIds.length && 
        allChannelIds.every(id => selectedChannels.includes(id))) {
      // 모든 채널이 선택된 상태면 모두 해제
      setSelectedChannels([]);
    } else {
      // 모든 채널 선택
      setSelectedChannels(allChannelIds);
    }
  }, [selectedChannelType, channelGroups, selectedChannels]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  return {
    channels,
    channelGroups,
    isLoadingChannels,
    selectedChannelType,
    selectedChannel,
    isMultiChannelMode,
    selectedChannels,
    loadChannels,
    handleChannelTypeSelect,
    handleChannelSelect,
    handleMultiChannelToggle,
    handleChannelToggle,
    handleSelectAllChannelsInType
  };
}
