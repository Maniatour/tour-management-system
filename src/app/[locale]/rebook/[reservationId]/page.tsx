import { redirect, notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

type PageProps = {
  params: Promise<{ locale: string; reservationId: string }>
}

/** 짧은 재예약 링크 → 상품 상세 + prefill */
export default async function RebookShortLinkPage({ params }: PageProps) {
  const { locale, reservationId } = await params
  const id = reservationId?.trim()
  if (!id) notFound()

  const admin = supabaseAdmin
  if (!admin) notFound()

  const { data: reservation } = await admin
    .from('reservations')
    .select('product_id')
    .eq('id', id)
    .maybeSingle()

  if (!reservation?.product_id) notFound()

  const lang = locale === 'ko' ? 'ko' : 'en'
  redirect(`/${lang}/products/${reservation.product_id}?rebook=${encodeURIComponent(id)}`)
}
