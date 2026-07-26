import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { syncEmailLogsFromResendForReservationIds } = await import(
    '../src/lib/emailLogDeliverySync'
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: logs } = await supabase
    .from('email_logs')
    .select('reservation_id')
    .is('delivered_at', null)
    .is('bounced_at', null)
    .not('resend_email_id', 'is', null)
    .eq('status', 'sent')

  const ids = [...new Set((logs ?? []).map((l) => l.reservation_id).filter(Boolean))]
  console.log('Reservations with pending delivery:', ids.length)

  const batchSize = 8
  let totalSynced = 0
  let totalChecked = 0
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const result = await syncEmailLogsFromResendForReservationIds(batch, { maxLogs: 8 })
    totalSynced += result.synced
    totalChecked += result.checked
    console.log(`Batch ${Math.floor(i / batchSize) + 1}: checked=${result.checked} synced=${result.synced}`)
    if (i + batchSize < ids.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log('Done:', { totalSynced, totalChecked })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
