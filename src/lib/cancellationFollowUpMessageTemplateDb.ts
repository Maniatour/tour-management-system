import type {
  CancellationFollowUpMessageChannel,
  CancellationFollowUpMessageKind,
  CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'
import { fetchPrimaryStaffOutreachMessageTemplateFromDb } from '@/lib/staffOutreachMessageTemplateDb'

export async function fetchCancellationFollowUpMessageTemplateFromDb(
  locale: CancellationFollowUpMessageLocale,
  channel: CancellationFollowUpMessageChannel,
  messageKind: CancellationFollowUpMessageKind
): Promise<{ subject_template: string | null; body_template: string } | null> {
  return fetchPrimaryStaffOutreachMessageTemplateFromDb(
    'cancellation_follow_up',
    locale,
    channel,
    messageKind
  )
}
