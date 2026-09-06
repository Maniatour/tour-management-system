import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'
import type { WeatherIconKind } from '@/lib/weatherConditionIcon'

export function WeatherConditionIcon({
  kind,
  sizeClass = 'w-6 h-6',
}: {
  kind: WeatherIconKind
  sizeClass?: string
}) {
  switch (kind) {
    case 'thunder':
      return <CloudLightning className={`${sizeClass} text-purple-600`} />
    case 'snow':
      return <CloudSnow className={`${sizeClass} text-blue-400`} />
    case 'rain':
      return <CloudRain className={`${sizeClass} text-primary`} />
    case 'drizzle':
      return <CloudDrizzle className={`${sizeClass} text-blue-400`} />
    case 'fog':
      return <CloudFog className={`${sizeClass} text-gray-500`} />
    case 'clear':
      return <Sun className={`${sizeClass} text-yellow-500`} />
    case 'partly-cloudy':
      return <CloudSun className={`${sizeClass} text-orange-400`} />
    case 'clouds':
    default:
      return <Cloud className={`${sizeClass} text-gray-500`} />
  }
}
