import WaiverDocumentEditorClient from '@/components/waiver/WaiverDocumentEditorClient'
import { isConfiguredWaiverCode } from '@/lib/waiver/types'
import { notFound } from 'next/navigation'

export default async function AdminWaiverDocumentEditPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  if (!isConfiguredWaiverCode(code)) notFound()
  return <WaiverDocumentEditorClient code={code} />
}
