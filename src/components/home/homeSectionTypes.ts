import type { LucideIcon } from 'lucide-react'

export type CategoryTagItem = {
  id?: string
  labelKey?: string
  tagQuery: string
  label?: string
  imageUrl?: string
}

export type StatItem = { number: string; label: string }
export type FeatureItem = { icon: LucideIcon; title: string; description: string }
