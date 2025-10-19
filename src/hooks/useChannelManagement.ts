import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

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

export function useChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [selectedChannelType, setSelectedChannelType] = useState<'OTA' | 'SELF' | ''>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isMultiChannelMode, setIsMultiChannelMode] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // 채널을 타입별로 그룹화
  const channelGroups = useMemo(() => {
    const otaChannels = channels.filter(channel => 
      channel.type.toLowerCase() === 'ota' || channel.category === 'OTA'
    );
    const selfChannels = channels.filter(channel => 
      channel.type.toLowerCase() === 'self' || 
      channel.type.toLowerCase() === 'partner' || 
      channel.category === 'Own' ||
      channel.category === 'Self' ||
      channel.category === 'Partner'
    );

    return [
      {
        type: 'OTA' as const,
        label: 'OTA 채널',
        channels: otaChannels
      },
      {
        type: 'SELF' as const,
        label: '자체 채널 (Self & Partner)',
        channels: selfChannels
      }
    ];
  }, [channels]);

  const loadChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true);
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('채널 로드 실패:', error);
        // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setChannels([]);
        return;
      }
      
      console.log('로드된 채널 데이터:', data);
      setChannels(data || []);
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
      if (selectedChannelData.type.toLowerCase() === 'ota' || selectedChannelData.category === 'OTA') {
        channelType = 'OTA';
      } else if (
        selectedChannelData.type.toLowerCase() === 'self' || 
        selectedChannelData.type.toLowerCase() === 'partner' || 
        selectedChannelData.category === 'Own' ||
        selectedChannelData.category === 'Self' ||
        selectedChannelData.category === 'Partner'
      ) {
        channelType = 'SELF';
      }
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
