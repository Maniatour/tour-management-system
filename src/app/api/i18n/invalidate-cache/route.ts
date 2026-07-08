import { invalidateLocaleMessagesCache } from '@/i18n/loadLocaleMessages'

export async function POST() {
  invalidateLocaleMessagesCache()
  return Response.json({ ok: true })
}
