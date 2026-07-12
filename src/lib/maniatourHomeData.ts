import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Calendar,
  Camera,
  ClipboardList,
  Compass,
  Heart,
  Plane,
  Star,
  Sun,
  Sunrise,
  Users,
} from 'lucide-react'

/** Grand Canyon South Rim sunrise — wide hero (Yavapai Point golden hour) */
export const MANIATOUR_HERO_IMAGE =
  'https://images.unsplash.com/photo-1530638561217-8fde588861e3?auto=format&fit=crop&w=1920&q=85'

/** Grand Canyon sunrise — traveler on the right rim looking out over the canyon */
export const MANIATOUR_CTA_IMAGE =
  '/images/maniatour-cta-grand-canyon-sunrise.png'

export type ManiaTourTravelStyleItem = {
  labelKey: string
  descKey: string
  tagQuery: string
  icon: LucideIcon
  accent: string
}

export const MANIATOUR_TRAVEL_STYLE_ITEMS: ManiaTourTravelStyleItem[] = [
  { labelKey: 'travelStyleDayTour', descKey: 'travelStyleDayTourDesc', tagQuery: '당일', icon: Sun, accent: '#f97316' },
  { labelKey: 'travelStyleSunrise', descKey: 'travelStyleSunriseDesc', tagQuery: '일출', icon: Sunrise, accent: '#eab308' },
  { labelKey: 'travelStyleMultiDay', descKey: 'travelStyleMultiDayDesc', tagQuery: '숙박', icon: Calendar, accent: '#3b82f6' },
  { labelKey: 'travelStyleSmallGroup', descKey: 'travelStyleSmallGroupDesc', tagQuery: '프리미엄', icon: Users, accent: '#8b5cf6' },
  { labelKey: 'travelStyleHelicopter', descKey: 'travelStyleHelicopterDesc', tagQuery: '헬기', icon: Plane, accent: '#ec4899' },
  { labelKey: 'travelStyleCustom', descKey: 'travelStyleCustomDesc', tagQuery: '맞춤', icon: Compass, accent: '#ef4444' },
]

export type ManiaTourGuideItem = {
  titleKey: string
  categoryKey: string
  imageUrl: string
}

export const MANIATOUR_GUIDE_ITEMS: ManiaTourGuideItem[] = [
  {
    titleKey: 'homeGuide1Title',
    categoryKey: 'homeGuide1Category',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80',
  },
  {
    titleKey: 'homeGuide2Title',
    categoryKey: 'homeGuide2Category',
    imageUrl: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=600&q=80',
  },
  {
    titleKey: 'homeGuide3Title',
    categoryKey: 'homeGuide3Category',
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80',
  },
  {
    titleKey: 'homeGuide4Title',
    categoryKey: 'homeGuide4Category',
    imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=80',
  },
  {
    titleKey: 'homeGuide5Title',
    categoryKey: 'homeGuide5Category',
    imageUrl: 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=600&q=80',
  },
]

export const MANIATOUR_INSTAGRAM_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504198458649-3128b932f49e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=80',
]

export type ManiaTourFeatureItem = {
  icon: LucideIcon
  titleKey: string
  descKey: string
}

export const MANIATOUR_FEATURE_ITEMS: ManiaTourFeatureItem[] = [
  { icon: Users, titleKey: 'maniatourFeatureSmallGroup', descKey: 'maniatourFeatureSmallGroupDesc' },
  { icon: BadgeCheck, titleKey: 'maniatourFeatureGuides', descKey: 'maniatourFeatureGuidesDesc' },
  { icon: ClipboardList, titleKey: 'maniatourFeatureWellPlanned', descKey: 'maniatourFeatureWellPlannedDesc' },
  { icon: Camera, titleKey: 'maniatourFeaturePhotos', descKey: 'maniatourFeaturePhotosDesc' },
  { icon: Star, titleKey: 'maniatourFeatureReviews', descKey: 'maniatourFeatureReviewsDesc' },
  { icon: Heart, titleKey: 'maniatourFeatureLocal', descKey: 'maniatourFeatureLocalDesc' },
]

export type ManiaTourHeroStatItem = {
  icon: LucideIcon
  textKey: string
}

export const MANIATOUR_HERO_STATS: ManiaTourHeroStatItem[] = [
  { icon: Star, textKey: 'homeHeroStatReviewsFull' },
  { icon: Users, textKey: 'homeHeroStatTravelersFull' },
  { icon: Users, textKey: 'homeHeroStatSmallGroupFull' },
  { icon: Calendar, textKey: 'homeHeroStatSinceFull' },
]
