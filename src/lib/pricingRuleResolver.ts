import type { SimplePricingRule } from '@/lib/types/dynamic-pricing';

function normalizeVariantKey(variantKey?: string | null): string {
  const trimmed = (variantKey ?? '').toString().trim();
  return trimmed || 'default';
}

function ruleTimestamp(rule: SimplePricingRule): number {
  const raw = rule.updated_at || rule.created_at;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function priceTypeRank(priceType?: string | null): number {
  if (priceType === 'dynamic') return 2;
  if (priceType === 'base') return 1;
  return 0;
}

/**
 * 같은 날짜·채널·variant에 base/dynamic 중복 레코드가 있을 때
 * 최신(dynamic 우선) 규칙 하나만 남깁니다.
 */
export function dedupePricingRules(rules: SimplePricingRule[]): SimplePricingRule[] {
  const bestByKey = new Map<string, SimplePricingRule>();

  for (const rule of rules) {
    const key = `${rule.channel_id ?? ''}::${normalizeVariantKey(rule.variant_key)}`;
    const current = bestByKey.get(key);
    if (!current) {
      bestByKey.set(key, rule);
      continue;
    }

    const currentTs = ruleTimestamp(current);
    const nextTs = ruleTimestamp(rule);
    const currentRank = priceTypeRank(current.price_type);
    const nextRank = priceTypeRank(rule.price_type);

    if (
      nextTs > currentTs ||
      (nextTs === currentTs && nextRank > currentRank) ||
      (nextTs === currentTs && nextRank === currentRank && String(rule.id) > String(current.id))
    ) {
      bestByKey.set(key, rule);
    }
  }

  return Array.from(bestByKey.values());
}

export function pickLatestPricingRule(
  rules: SimplePricingRule[],
  options?: {
    channelId?: string;
    channelType?: 'OTA' | 'SELF' | '';
    variantKey?: string;
  }
): SimplePricingRule | undefined {
  if (!rules.length) return undefined;

  let filtered = rules;

  if (options?.channelId) {
    filtered = filtered.filter((rule) => rule.channel_id === options.channelId);
  } else if (options?.channelType === 'SELF') {
    filtered = filtered.filter((rule) => rule.channel_id?.startsWith('B'));
  } else if (options?.channelType === 'OTA') {
    filtered = filtered.filter((rule) => rule.channel_id && !rule.channel_id.startsWith('B'));
  }

  const normVariant = normalizeVariantKey(options?.variantKey);
  filtered = filtered.filter(
    (rule) => normalizeVariantKey(rule.variant_key) === normVariant
  );

  if (!filtered.length) return undefined;

  const deduped = dedupePricingRules(filtered);
  return deduped.sort((a, b) => ruleTimestamp(b) - ruleTimestamp(a))[0];
}
