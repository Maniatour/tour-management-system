'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { renderTemplateString } from '@/lib/template'

export default function ReservationReceiptPage() {
  const params = useParams() as { id?: string; locale?: string }
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<{ subject?: string; content: string } | null>(null)
  const [pricing, setPricing] = useState<any>(null)
  const [tour, setTour] = useState<any>(null)
  const [pickupHotel, setPickupHotel] = useState<any>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return
      const { data, error } = await supabase
        .from('reservations')
        .select('*, customers(*), products(*)')
        .eq('id', params.id)
        .single()
      if (!error) {
        setData(data)
        // pricing from reservation_pricing
        const { data: pricingRow } = await supabase
          .from('reservation_pricing')
          .select('*')
          .eq('reservation_id', data.id)
          .maybeSingle()
        if (pricingRow) {
          setPricing(pricingRow)
          if (typeof pricingRow.total_price === 'number') setTotal(Number(pricingRow.total_price))
        }
        // tour fetch by id or product/date
        if (data.tour_id) {
          const { data: tourRow } = await supabase
            .from('tours')
            .select('*')
            .eq('id', data.tour_id)
            .maybeSingle()
          if (tourRow) setTour(tourRow)
        } else if (data.product_id && data.tour_date) {
          const { data: tourRow } = await supabase
            .from('tours')
            .select('*')
            .eq('product_id', data.product_id)
            .eq('tour_date', data.tour_date)
            .maybeSingle()
          if (tourRow) setTour(tourRow)
        }
        // pickup hotel fetch
        if (data.pickup_hotel) {
          const { data: hotelRow } = await supabase
            .from('pickup_hotels')
            .select('*')
            .eq('id', data.pickup_hotel)
            .maybeSingle()
          if (hotelRow) setPickupHotel(hotelRow)
        }
      }
      try {
        const { data: tpl } = await supabase
          .from('document_templates')
          .select('subject, content')
          .eq('template_key', 'reservation_receipt')
          .eq('language', (params as any)?.locale || 'ko')
          .limit(1)
          .maybeSingle()
        if (tpl) setTemplate(tpl as any)
      } catch (error) {
        console.warn('document_templates 테이블이 존재하지 않습니다. 기본 템플릿을 사용합니다.')
        // 기본 템플릿 사용
        setTemplate({
          subject: '[예약 영수증] {{reservation.id}}',
          content: '<h1>예약 영수증</h1><p>총액: {{pricing.total_locale}}원</p>'
        })
      }
      setLoading(false)
    }
    load()
  }, [params?.id])

  const rendered = useMemo(() => {
    if (!data || !template) return null
    const ctx = {
      reservation: {
        id: data.id,
        tour_date: data.tour_date,
        tour_time: data.tour_time,
        pickup_time: data.pickup_time,
        adults: data.adults,
        child: data.child,
        infant: data.infant
      },
      customer: { name: data.customers?.name },
      product: { name: data.products?.name },
      pickup: { display: pickupHotel ? `${pickupHotel.hotel} - ${pickupHotel.pick_up_location}` : data.pickup_hotel, hotel: pickupHotel?.hotel, pick_up_location: pickupHotel?.pick_up_location, address: pickupHotel?.address, link: pickupHotel?.link, pin: pickupHotel?.pin },
      channel: {},
      pricing: pricing ? { ...pricing, total, total_locale: total.toLocaleString() } : { total, total_locale: total.toLocaleString() },
      tour: tour || {}
    }
    return renderTemplateString(template.content, ctx)
  }, [data, template, total, pricing, tour, pickupHotel])

  if (loading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">Not found.</div>

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reservation Receipt</h1>
      <div className="text-sm text-gray-500">Reservation ID: {data.id}</div>
      <div className="border rounded p-4 space-y-2" dangerouslySetInnerHTML={{ __html: rendered || '' }} />
      {!location.pathname.includes('/embed') && (
        <button
          onClick={() => window.print()}
          className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          Print / Save PDF
        </button>
      )}
    </div>
  )
}


