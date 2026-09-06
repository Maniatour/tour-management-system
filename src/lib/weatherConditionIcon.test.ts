import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWeatherIconKind } from '@/lib/weatherConditionIcon'
import { pickTourDayForecast, weatherFromDayForecasts } from '@/lib/weatherForecastPick'

test('clear sky is sun, not rain', () => {
  assert.equal(resolveWeatherIconKind('Clear', 'Clear sky'), 'clear')
  assert.equal(resolveWeatherIconKind('Clear', 'clear sky'), 'clear')
})

test('clouds are not rain even if description mentions rain chance', () => {
  assert.equal(resolveWeatherIconKind('Clouds', 'overcast clouds'), 'clouds')
  assert.equal(resolveWeatherIconKind('Clouds', 'few clouds'), 'partly-cloudy')
  assert.equal(resolveWeatherIconKind('Clouds', 'scattered clouds'), 'partly-cloudy')
  assert.equal(resolveWeatherIconKind('Clouds', 'Clear, 0% rain'), 'clouds')
})

test('rain main maps to rain', () => {
  assert.equal(resolveWeatherIconKind('Rain', 'light rain'), 'rain')
  assert.equal(resolveWeatherIconKind('Rain', 'moderate rain'), 'rain')
})

test('grand canyon picks morning slot, not afternoon rain', () => {
  const slots = [
    { dt_txt: '2026-09-06 09:00:00' },
    { dt_txt: '2026-09-06 12:00:00' },
    { dt_txt: '2026-09-06 15:00:00' },
    { dt_txt: '2026-09-06 18:00:00' },
    { dt_txt: '2026-09-06 21:00:00' },
  ]
  const picked = pickTourDayForecast(slots, 'Grand Canyon South Rim', '2026-09-06')
  assert.equal(picked?.dt_txt, '2026-09-06 12:00:00')
})

test('afternoon rain slot is not used as grand canyon condition', () => {
  const list = [
    {
      dt_txt: '2026-09-06 12:00:00',
      main: { temp: 12, humidity: 30 },
      weather: [{ main: 'Clear', description: 'clear sky' }],
      wind: { speed: 2 },
      visibility: 10000,
    },
    {
      dt_txt: '2026-09-06 21:00:00',
      main: { temp: 18, humidity: 70 },
      weather: [{ main: 'Rain', description: 'moderate rain' }],
      wind: { speed: 4 },
      visibility: 8000,
    },
  ]
  const weather = weatherFromDayForecasts(list, 'Grand Canyon South Rim', '2026-09-06')
  assert.equal(weather?.weather_main, 'Clear')
  assert.equal(weather?.weather_description, 'clear sky')
})
