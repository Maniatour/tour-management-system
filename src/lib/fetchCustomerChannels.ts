import { supabase } from '@/lib/supabase'
import type { CustomerReservationChannel } from '@/components/customer/customerReservationTypes'

export async function fetchCustomerChannels(): Promise<CustomerReservationChannel[]> {
  const { data: channelsData, error } = await supabase
    .from('channels')
    .select('id, name, favicon_url')
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('Channels 로딩 오류:', error)
    return []
  }

  return (channelsData || []).map((c: { id: string; name: string; favicon_url: string | null }) => {
    const { favicon_url, ...rest } = c
    return { ...rest, ...(favicon_url != null ? { favicon_url } : {}) }
  })
}
