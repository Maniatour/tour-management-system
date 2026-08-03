'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatProductDurationForStorage,
  normalizeDurationParts,
  parseFlexibleDurationInput,
  parseStoredProductDuration,
  type ProductDurationParts,
} from '@/lib/productDurationInput'

type ProductDurationInputLabels = {
  hours: string
  minutes: string
  flexiblePlaceholder: string
  hint: string
}

type ProductDurationInputProps = {
  value: string
  onChange: (value: string) => void
  labels: ProductDurationInputLabels
  idPrefix?: string
}

export default function ProductDurationInput({
  value,
  onChange,
  labels,
  idPrefix = 'product-duration',
}: ProductDurationInputProps) {
  const [parts, setParts] = useState<ProductDurationParts>(() => parseStoredProductDuration(value))
  const [flexText, setFlexText] = useState('')

  useEffect(() => {
    setParts(parseStoredProductDuration(value))
    setFlexText('')
  }, [value])

  const commitParts = (next: ProductDurationParts) => {
    const normalized = normalizeDurationParts(next)
    setParts(normalized)
    onChange(formatProductDurationForStorage(normalized))
    setFlexText('')
  }

  const handleHoursChange = (raw: string) => {
    const hours = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0)
    commitParts({ ...parts, hours })
  }

  const handleMinutesChange = (raw: string) => {
    const minutes = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0)
    commitParts({ ...parts, minutes })
  }

  const handleFlexibleBlur = () => {
    if (!flexText.trim()) return
    const parsed = parseFlexibleDurationInput(flexText)
    if (parsed) {
      commitParts(parsed)
    }
  }

  const handleFlexibleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleFlexibleBlur()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`${idPrefix}-hours`} className="text-xs text-muted-foreground">
            {labels.hours}
          </Label>
          <Input
            id={`${idPrefix}-hours`}
            type="number"
            min={0}
            inputMode="numeric"
            value={parts.hours === 0 ? '' : parts.hours}
            onChange={(e) => handleHoursChange(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`${idPrefix}-minutes`} className="text-xs text-muted-foreground">
            {labels.minutes}
          </Label>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            min={0}
            inputMode="numeric"
            value={parts.minutes === 0 ? '' : parts.minutes}
            onChange={(e) => handleMinutesChange(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <Input
        value={flexText}
        onChange={(e) => setFlexText(e.target.value)}
        onBlur={handleFlexibleBlur}
        onKeyDown={handleFlexibleKeyDown}
        placeholder={labels.flexiblePlaceholder}
        aria-label={labels.flexiblePlaceholder}
      />
      <p className="text-xs text-muted-foreground">{labels.hint}</p>
    </div>
  )
}
