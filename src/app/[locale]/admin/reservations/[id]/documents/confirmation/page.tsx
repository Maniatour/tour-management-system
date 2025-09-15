'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { renderTemplateString } from '@/lib/template'
import { getPickupHotelDisplay } from '@/utils/reservationUtils'

export default function ReservationConfirmationPage() {
  const params = useParams() as { id?: string; locale?: string }
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<{ subject?: string; content: string } | null>(null)
  const [pricing, setPricing] = useState<any>(null)
  const [tour, setTour] = useState<any>(null)
  const [pickupHotel, setPickupHotel] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return
      const { data, error } = await supabase
        .from('reservations')
        .select('*, customers(*), products(*), channels(*)')
        .eq('id', params.id)
        .single()
      if (!error) {
        setData(data)
        // Fetch pricing
        const { data: pricingRow } = await supabase
          .from('reservation_pricing')
          .select('*')
          .eq('reservation_id', data.id)
          .maybeSingle()
        if (pricingRow) setPricing(pricingRow)
        // Fetch tour
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
        // Fetch pickup hotel
        if (data.pickup_hotel) {
          const { data: hotelRow } = await supabase
            .from('pickup_hotels')
            .select('*')
            .eq('id', data.pickup_hotel)
            .maybeSingle()
          if (hotelRow) setPickupHotel(hotelRow)
        }
      }
      const { data: tpl } = await supabase
        .from('document_templates')
        .select('subject, content')
        .eq('template_key', 'reservation_confirmation')
        .eq('language', (params as any)?.locale || 'ko')
        .limit(1)
        .maybeSingle()
      if (tpl) setTemplate(tpl as any)
      setLoading(false)
    }
    load()
  }, [params?.id])

  const rendered = useMemo(() => {
    if (!data || !template) return null
    const pickupDisplay = pickupHotel ? `${pickupHotel.hotel} - ${pickupHotel.pick_up_location}` : (data.pickup_hotel || '')
    const totalPrice = pricing?.total_price ?? null
    const pricingCtx = pricing ? {
      ...pricing,
      total_locale: typeof totalPrice === 'number' ? Number(totalPrice).toLocaleString() : ''
    } : {}
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
      customer: { name: data.customers?.name, email: data.customers?.email },
      product: { name: data.products?.name },
      pickup: { display: pickupDisplay, hotel: pickupHotel?.hotel, pick_up_location: pickupHotel?.pick_up_location, address: pickupHotel?.address, link: pickupHotel?.link, pin: pickupHotel?.pin },
      channel: { name: data.channels?.name, type: data.channels?.type },
      pricing: pricingCtx,
      tour: tour || {}
    }
    return renderTemplateString(template.content, ctx)
  }, [data, template, pickupHotel, pricing, tour])

  if (loading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">Not found.</div>

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reservation Confirmation</h1>
      <div className="text-sm text-gray-500">Reservation ID: {data.id}</div>
      <div className="border rounded p-4 space-y-2" dangerouslySetInnerHTML={{ __html: rendered || '' }} />
      <button
        onClick={() => window.print()}
        className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
      >
        Print / Save PDF
      </button>
    </div>
  )
}


