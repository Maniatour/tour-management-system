import { redirect } from 'next/navigation'

export default async function LocaleWaiverRedirect({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/waiver/${encodeURIComponent(token)}`)
}
