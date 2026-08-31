import WaiverSigningClient from '@/components/waiver/WaiverSigningClient'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default async function PublicWaiverPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <WaiverSigningClient token={token} />
}
