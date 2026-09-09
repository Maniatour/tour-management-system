'use client'

import { useTranslations } from 'next-intl'

export default function ChoiceProcessingFeeNote({
  apply,
}: {
  apply?: boolean | null | undefined
}) {
  const t = useTranslations('productDetail')
  if (!apply) return null

  return (
    <p className="mt-1 text-[11px] font-medium leading-snug text-amber-800">
      {t('choiceCardProcessingFee')}
    </p>
  )
}
