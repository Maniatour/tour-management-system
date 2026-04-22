import { supabaseAdmin } from '@/lib/supabase'
import type { ResidentCheckSubmissionRow } from '@/lib/residentCheckTokenService'

export async function syncCustomerFromResidentCheckSubmission(args: {
  customerId: string | null
  submission: ResidentCheckSubmissionRow
}): Promise<void> {
  if (!supabaseAdmin || !args.customerId) return

  let resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' = 'non_resident'
  if (args.submission.residency === 'us_resident') {
    resident_status = 'us_resident'
  } else if (args.submission.pass_photo_url) {
    resident_status = 'non_resident_with_pass'
  } else {
    resident_status = 'non_resident'
  }

  await supabaseAdmin
    .from('customers')
    .update({
      resident_status,
      pass_photo_url: args.submission.pass_photo_url,
      id_photo_url: args.submission.id_proof_url,
    })
    .eq('id', args.customerId)
}

export async function markResidentCheckTokenCompleted(tokenId: string): Promise<void> {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from('resident_check_tokens')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', tokenId)
}
