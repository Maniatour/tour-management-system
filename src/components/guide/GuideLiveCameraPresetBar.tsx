'use client'

import { Moon, Sparkles, SunMedium } from 'lucide-react'
import { CAMERA_PRESETS, type CameraPreset } from '@/lib/guideLiveCameraPresets'

type GuideLiveCameraPresetBarProps = {
  preset: CameraPreset
  disabled?: boolean
  supportHint: string
  labels: { auto: string; night: string; stars: string }
  onChange: (preset: CameraPreset) => void
}

const ICONS = {
  auto: SunMedium,
  night: Moon,
  stars: Sparkles,
} as const

export default function GuideLiveCameraPresetBar({
  preset,
  disabled,
  supportHint,
  labels,
  onChange,
}: GuideLiveCameraPresetBarProps) {
  return (
    <div className="pointer-events-auto mb-5 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 rounded-full bg-black/45 p-1">
        {CAMERA_PRESETS.map((key) => {
          const Icon = ICONS[key]
          const active = preset === key
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                active ? 'bg-[#FFB800] text-gray-900' : 'text-white/90 hover:bg-white/10'
              } disabled:opacity-50`}
              style={{ touchAction: 'manipulation' }}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {labels[key]}
            </button>
          )
        })}
      </div>
      <p className="max-w-[18rem] text-center text-[11px] leading-snug text-white/75">{supportHint}</p>
    </div>
  )
}
