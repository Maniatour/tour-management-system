'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Cloud, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type WeatherRow = {
  id: string
  location_name: string
  date: string
  temperature: number | null
  temp_min: number | null
  temp_max: number | null
  humidity: number | null
  weather_main: string | null
  weather_description: string | null
  wind_speed: number | null
  visibility: number | null
  updated_at: string | null
}

export default function AdminWeatherRecordsPage() {
  const params = useParams()
  const locale = (params?.locale as string) || 'ko'
  const t = useTranslations('adminWeatherRecords')
  const [rows, setRows] = useState<WeatherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortDesc, setSortDesc] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('weather_data')
        .select(
          'id, location_name, date, temperature, temp_min, temp_max, humidity, weather_main, weather_description, wind_speed, visibility, updated_at'
        )
        .order('date', { ascending: !sortDesc })
        .order('location_name', { ascending: true })
        .limit(800)

      if (qErr) {
        setError(qErr.message || t('loadError'))
        setRows([])
        return
      }
      setRows((data as WeatherRow[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [sortDesc, t])

  useEffect(() => {
    load()
  }, [load])

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="max-w-full mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-sky-100 rounded-full p-2">
            <Cloud className="h-6 w-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
          >
            {sortDesc ? t('sortDesc') : t('sortAsc')}
          </button>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('btnRefresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-gray-600 text-sm">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600 text-sm">{t('errorEmpty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colDate')}</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colLocation')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colTemp')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colMin')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colMax')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colHumidity')}</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colWeather')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colWind')}</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colVis')}</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{t('colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">{r.date}</td>
                  <td className="px-3 py-2 text-gray-800">{r.location_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.temperature != null ? Number(r.temperature).toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.temp_min != null ? Number(r.temp_min).toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.temp_max != null ? Number(r.temp_max).toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.humidity ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={r.weather_description || ''}>
                    {r.weather_main || '—'}
                    {r.weather_description ? ` (${r.weather_description})` : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.wind_speed != null ? Number(r.wind_speed).toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.visibility ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{fmtTime(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
