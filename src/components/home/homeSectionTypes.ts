import type { LucideIcon } from 'lucide-react'

export type CategoryTagItem = {
  labelKey: string
  tagQuery: string
}

export type StatItem = { number: string; label: string }
export type FeatureItem = { icon: LucideIcon; title: string; description: string }
