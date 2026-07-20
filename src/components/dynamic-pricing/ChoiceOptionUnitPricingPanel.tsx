'use client';

import { memo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

export type OptionUnitPrice = {
  adult_price: number;
  child_price: number;
  infant_price: number;
};

type ChoiceOption = {
  id: string;
  name: string;
  name_ko?: string;
};

type ChoiceGroup = {
  id: string;
  name: string;
  name_ko?: string;
  options: ChoiceOption[];
};

type Props = {
  choiceGroups: ChoiceGroup[];
  optionsPricing: Record<string, OptionUnitPrice>;
  onChange: (optionId: string, next: OptionUnitPrice) => void;
  isSinglePrice: boolean;
};

export const ChoiceOptionUnitPricingPanel = memo(function ChoiceOptionUnitPricingPanel({
  choiceGroups,
  optionsPricing,
  onChange,
  isSinglePrice,
}: Props) {
  const t = useTranslations('products.dynamicPricingPage');
  const locale = useLocale();
  const isKoUi = locale === 'ko' || locale.startsWith('ko');

  const isResidencyGroup = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    if (n.includes('미국 거주자 구분') && n.includes('기타 입장료')) return true;
    if (n === '미국 거주자 구분' || n === '미국 비거주자 구분') return true;
    if (n.includes('resident') && (n.includes('admission') || n.includes('입장'))) return true;
    return false;
  };

  const displayName = (nameKo?: string, nameEn?: string) => {
    const raw = isKoUi ? nameKo || nameEn || '' : nameEn || nameKo || '';
    if (isResidencyGroup(nameKo || '') || isResidencyGroup(nameEn || '') || isResidencyGroup(raw)) {
      return t('choiceGroupResidencyShort');
    }
    return raw;
  };

  if (!choiceGroups.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t('noChoiceOptionsForUnitPrice')}
      </p>
    );
  }

  const inputCls =
    'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-ring focus:border-ring';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('choiceUnitPriceHint')}</p>
      <p className="text-[11px] text-amber-800/90 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        초이스 그룹에 「차량/단위별」이 설정된 경우, 입력한 금액은 인원으로 곱하지 않고 선택 1회(또는 대수)당 고정가로
        청구됩니다.
      </p>
      {choiceGroups.map((group) => (
        <div
          key={group.id}
          className="rounded-xl border border-border/60 overflow-hidden"
        >
          <div className="bg-muted/40 px-3 py-2 border-b border-border/60">
            <h5 className="text-sm font-semibold text-foreground">
              {displayName(group.name_ko, group.name)}
            </h5>
          </div>
          <div className="divide-y divide-border/50">
            {group.options.map((option) => {
              const price = optionsPricing[option.id] || {
                adult_price: 0,
                child_price: 0,
                infant_price: 0,
              };
              return (
                <div
                  key={option.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 sm:w-40 shrink-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {displayName(option.name_ko, option.name)}
                    </div>
                  </div>
                  {isSinglePrice ? (
                    <div className="w-full sm:w-36">
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        {t('choiceAdjAmount')} ($)
                      </label>
                      <input
                        type="number"
                        value={price.adult_price === 0 ? '' : price.adult_price}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = v === '' || v === '-' ? 0 : parseFloat(v);
                          if (v !== '' && v !== '-' && isNaN(n)) return;
                          onChange(option.id, {
                            adult_price: n,
                            child_price: n,
                            infant_price: n,
                          });
                        }}
                        className={inputCls}
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:min-w-[18rem]">
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1">
                          {t('adult')}
                        </label>
                        <input
                          type="number"
                          value={price.adult_price === 0 ? '' : price.adult_price}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' || v === '-' ? 0 : parseFloat(v);
                            if (v !== '' && v !== '-' && isNaN(n)) return;
                            onChange(option.id, { ...price, adult_price: n });
                          }}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1">
                          {t('child')}
                        </label>
                        <input
                          type="number"
                          value={price.child_price === 0 ? '' : price.child_price}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' || v === '-' ? 0 : parseFloat(v);
                            if (v !== '' && v !== '-' && isNaN(n)) return;
                            onChange(option.id, { ...price, child_price: n });
                          }}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1">
                          {t('infant')}
                        </label>
                        <input
                          type="number"
                          value={price.infant_price === 0 ? '' : price.infant_price}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' || v === '-' ? 0 : parseFloat(v);
                            if (v !== '' && v !== '-' && isNaN(n)) return;
                            onChange(option.id, { ...price, infant_price: n });
                          }}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
