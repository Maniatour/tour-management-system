export type WeatherIconKind =
  | 'clear'
  | 'partly-cloudy'
  | 'clouds'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'thunder'
  | 'fog'

function cloudDetail(description: string): WeatherIconKind {
  if (
    /\b(few|scattered|broken|partly)\b/.test(description) ||
    description.includes('조금') ||
    description.includes('구름 조금')
  ) {
    return 'partly-cloudy'
  }
  return 'clouds'
}

/**
 * OpenWeather `weather.main` is the source of truth.
 * Description is only used to refine Clouds, or when main is missing.
 * Do not substring-match "rain" first — that turns "Clear, 0% rain" / mixed copy into rain.
 */
export function resolveWeatherIconKind(
  weatherMain: string,
  weatherDescription: string
): WeatherIconKind {
  const main = (weatherMain || '').trim().toLowerCase()
  const description = (weatherDescription || '').trim().toLowerCase()

  switch (main) {
    case 'thunderstorm':
      return 'thunder'
    case 'drizzle':
      return 'drizzle'
    case 'rain':
      return 'rain'
    case 'snow':
      return 'snow'
    case 'clear':
      return 'clear'
    case 'clouds':
      return cloudDetail(description)
    case 'mist':
    case 'fog':
    case 'haze':
    case 'smoke':
    case 'dust':
    case 'sand':
    case 'ash':
    case 'squall':
    case 'tornado':
      return 'fog'
    default:
      break
  }

  if (main === '맑음' || main === '쾌청') return 'clear'
  if (main === '비' || main === '소나기') return 'rain'
  if (main === '눈') return 'snow'
  if (main === '안개' || main === '박무') return 'fog'
  if (main === '뇌우' || main === '천둥') return 'thunder'
  if (main.includes('구름') || main === '흐림') return cloudDetail(description)

  if (/\b(thunder|thunderstorm)\b/.test(description) || description.includes('뇌우')) {
    return 'thunder'
  }
  if (/\bsnow\b/.test(description) || description.includes('눈보라')) {
    return 'snow'
  }
  if (/\bdrizzle\b/.test(description)) {
    return 'drizzle'
  }
  if (
    (/\b(rain|showers?)\b/.test(description) || description.includes('소나기')) &&
    !/\bno rain\b/.test(description)
  ) {
    return 'rain'
  }
  if (/\b(fog|mist|haze)\b/.test(description) || description.includes('안개')) {
    return 'fog'
  }
  if (/\b(clear|sunny)\b/.test(description) || description.includes('맑')) {
    return 'clear'
  }
  if (description.includes('cloud') || description.includes('구름') || description.includes('흐림')) {
    return cloudDetail(description)
  }

  return 'clouds'
}
