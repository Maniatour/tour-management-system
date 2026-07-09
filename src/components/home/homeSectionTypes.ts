import type { LucideIcon } from 'lucide-react'

export type CategoryTagItem = {
  labelKey: string
  tagQuery: string
  emoji: string
  gradient: string
  hoverGradient: string
}

export type StatItem = { number: string; label: string }
export type FeatureItem = { icon: LucideIcon; title: string; description: string }
