'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Edit2, Globe, Users } from 'lucide-react';

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
  [year: string]: number;
}

interface ProductVariant {
  variant_key: string;
  variant_name_ko?: string | null;
  variant_name_en?: string | null;
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
  onChannelEdit?: (channelId: string) => void;
  channelPricingStats?: Record<string, ChannelPricingStats>;
  productVariants?: ProductVariant[];
  selectedVariant?: string;
  onVariantSelect?: (variantKey: string) => void;
}

function resolvePricingStats(
  channel: Channel,
  channelPricingStats: Record<string, ChannelPricingStats>
): ChannelPricingStats | undefined {
  let stats = channelPricingStats[channel.id];
  if (stats) return stats;

  stats = channelPricingStats[channel.id.toLowerCase()];
  if (stats) return stats;

  const normalizedName = channel.name
    .toLowerCase()
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');
  stats = channelPricingStats[normalizedName];
  if (stats) return stats;

  return channelPricingStats[channel.name.toLowerCase().trim()];
}

export const ChannelSelector = memo(function ChannelSelector({
  channelGroups,
  isLoadingChannels,
  selectedChannel,
  onChannelSelect,
  onChannelEdit,
  channelPricingStats = {},
  productVariants = [],
  selectedVariant = 'default',
  onVariantSelect,
}: ChannelSelectorProps) {
  const t = useTranslations('products.dynamicPricingPage');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatPricingStats = (stats: ChannelPricingStats | undefined) => {
    if (!stats || Object.keys(stats).length === 0) return null;

    const sortedYears = Object.keys(stats).sort();
    return sortedYears
      .map((year) => {
        const daysCount = stats[year];
        const yearNum = parseInt(year, 10);
        const isLeapYear =
          (yearNum % 4 === 0 && yearNum % 100 !== 0) || yearNum % 400 === 0;
        const totalDays = isLeapYear ? 366 : 365;
        return `${year} (${daysCount}/${totalDays})`;
      })
      .join(', ');
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selfGroup = channelGroups.find((group) => group.type === 'SELF');
  const otaGroup = channelGroups.find((group) => group.type === 'OTA');

  const finalDisplayChannels = useMemo(() => {
    if (!selfGroup || selfGroup.channels.length === 0) return [];

    const filtered = selfGroup.channels.filter((channel) => channel.id !== 'SELF');
    if (filtered.length === 0 && selfGroup.channels.length === 1) {
      return selfGroup.channels;
    }
    return filtered;
  }, [selfGroup]);

  const allChannels = useMemo(
    () => [...finalDisplayChannels, ...(otaGroup?.channels ?? [])],
    [finalDisplayChannels, otaGroup]
  );

  const selectedChannelData = allChannels.find((ch) => ch.id === selectedChannel);
  const selectedChannelName =
    selectedChannelData?.name || (selectedChannel ? selectedChannel : t('notSelected'));

  const showVariantSelector =
    productVariants.length > 1 ||
    productVariants.some((variant) => variant.variant_key !== 'default');

  const selectedVariantData = productVariants.find(
    (variant) => variant.variant_key === selectedVariant
  );
  const selectedVariantLabel =
    selectedVariantData?.variant_name_ko ||
    selectedVariantData?.variant_name_en ||
    selectedVariantData?.variant_key ||
    selectedVariant;

  if (isLoadingChannels) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <span className="ml-2 text-gray-600">{t('channelLoading')}</span>
      </div>
    );
  }

  const renderChannelOption = (channel: Channel) => {
    const isSelected = selectedChannel === channel.id;
    const statsText = formatPricingStats(
      resolvePricingStats(channel, channelPricingStats)
    );

    return (
      <div
        key={channel.id}
        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-colors ${
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-transparent hover:bg-muted/60'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onChannelSelect(channel.id);
            setIsOpen(false);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <div className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
            {channel.name}
          </div>
          {statsText ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{statsText}</div>
          ) : null}
        </button>
        {onChannelEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChannelEdit(channel.id);
            }}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            title="채널 편집"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="mt-0.5 shrink-0 text-primary">
            {selectedChannelData && otaGroup?.channels.some((ch) => ch.id === selectedChannel) ? (
              <Globe className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              {t('channelSelect')}
            </div>
            <div className="truncate text-sm font-semibold text-foreground">
              {selectedChannelName}
            </div>
            {showVariantSelector ? (
              <div className="truncate text-xs text-muted-foreground">
                {t('variantSelect')}: {selectedVariantLabel}
              </div>
            ) : null}
          </div>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen ? (
          <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-lg">
            {finalDisplayChannels.length > 0 ? (
              <div className="mb-2 space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>자체 채널</span>
                </div>
                {finalDisplayChannels.map(renderChannelOption)}
              </div>
            ) : null}

            {otaGroup && otaGroup.channels.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>OTA 채널</span>
                </div>
                {otaGroup.channels.map(renderChannelOption)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showVariantSelector && onVariantSelect ? (
        <div className="rounded-xl border border-border/60 bg-white px-3 py-2.5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t('variantSelect')}
          </label>
          <select
            value={selectedVariant}
            onChange={(e) => onVariantSelect(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {productVariants.map((variant) => (
              <option key={variant.variant_key} value={variant.variant_key}>
                {variant.variant_name_ko ||
                  variant.variant_name_en ||
                  variant.variant_key}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
});
