'use client'

import { Flashlight, FlashlightOff } from 'lucide-react'

type EvRange = { min: number; max: number; step: number }

type GuideLiveCameraToolsProps = {
  torchSupported: boolean
  torchOn: boolean
  onTorchChange: (on: boolean) => void
  evRange: EvRange | null
  evValue: number
  onEvChange: (value: number) => void
  disabled?: boolean
  torchLabel: string
  evLabel: string
}

export default function GuideLiveCameraTools({
  torchSupported,
  torchOn,
  onTorchChange,
  evRange,
  evValue,
  onEvChange,
  disabled,
  torchLabel,
  evLabel,
}: GuideLiveCameraToolsProps) {
  if (!torchSupported && !evRange) return null

  return (
    <div className="pointer-events-auto mb-3 flex w-full items-center gap-3">
      {torchSupported ? (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={torchOn}
          aria-label={torchLabel}
          onClick={() => onTorchChange(!torchOn)}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            torchOn ? 'bg-[#FFB800] text-gray-900' : 'bg-black/45 text-white'
          } disabled:opacity-50`}
        >
          {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
        </button>
      ) : null}
      {evRange ? (
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-white/80">
          <span className="shrink-0">{evLabel}</span>
          <input
            type="range"
            min={evRange.min}
            max={evRange.max}
            step={evRange.step}
            value={evValue}
            disabled={disabled}
            onChange={(event) => onEvChange(Number(event.target.value))}
            className="h-2 w-full accent-[#FFB800]"
          />
          <span className="w-8 shrink-0 text-right tabular-nums">
            {evValue > 0 ? `+${evValue.toFixed(1)}` : evValue.toFixed(1)}
          </span>
        </label>
      ) : null}
    </div>
  )
}
