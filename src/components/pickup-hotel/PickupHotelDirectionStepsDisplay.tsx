'use client'

import { parseDirectionSteps } from '@/lib/pickupHotelDirectionSteps'

interface PickupHotelDirectionStepsDisplayProps {
  text: string | null | undefined
  accent?: 'blue' | 'green'
  emptyLabel?: string
}

export default function PickupHotelDirectionStepsDisplay({
  text,
  accent = 'blue',
  emptyLabel = '안내가 없습니다.',
}: PickupHotelDirectionStepsDisplayProps) {
  const steps = parseDirectionSteps(text)
  const numberBg = accent === 'green' ? 'bg-emerald-500' : 'bg-blue-500'

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${numberBg}`}
          >
            {index + 1}
          </span>
          <span className="text-sm leading-6 text-foreground">{step}</span>
        </li>
      ))}
    </ol>
  )
}
