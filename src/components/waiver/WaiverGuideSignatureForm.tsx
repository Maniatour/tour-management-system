'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import WaiverSignaturePad from '@/components/waiver/WaiverSignaturePad'

export default function WaiverGuideSignatureForm({
  reservationId,
  isKo,
}: {
  reservationId: string
  isKo: boolean
}) {
  const [guideName, setGuideName] = useState('')
  const [guidePhone, setGuidePhone] = useState('')
  const [empty, setEmpty] = useState(true)
  const [dataUrl, setDataUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [padKey, setPadKey] = useState(0)

  async function submit() {
    if (!guideName.trim() || empty || !dataUrl) {
      toast.error(isKo ? '가이드 이름과 서명이 필요합니다' : 'Guide name and signature are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/waivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'guide-sign',
        reservationId,
        guideName: guideName.trim(),
        guidePhone: guidePhone.trim(),
        signaturePngBase64: dataUrl,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || (isKo ? '저장하지 못했습니다' : 'Could not save'))
      return
    }
    toast.success(isKo ? '가이드 서명을 저장했습니다' : 'Guide signature saved')
    setPadKey((k) => k + 1)
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-white p-6">
      <h2 className="text-lg font-semibold tracking-tight">
        {isKo ? 'Taadidiin 가이드 서명' : 'Taadidiin guide signature'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isKo
          ? '가이드 서명은 자동으로 만들지 않습니다. 캐년 X 운영자 양식에 넣을 실제 서명만 여기에 받습니다.'
          : 'Guide signatures are never fabricated. Capture the actual guide signature for the Canyon X operator form.'}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="guide-name" className="text-sm font-medium">
            {isKo ? '가이드 이름' : 'Tour guide name'}
          </label>
          <Input id="guide-name" className="h-11 rounded-lg" value={guideName} onChange={(e) => setGuideName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="guide-phone" className="text-sm font-medium">
            {isKo ? '가이드 전화' : 'Tour guide phone'}
          </label>
          <Input id="guide-phone" type="tel" className="h-11 rounded-lg" value={guidePhone} onChange={(e) => setGuidePhone(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <WaiverSignaturePad
          key={padKey}
          label={isKo ? '가이드 서명' : 'Guide signature'}
          hint={isKo ? '손가락, 스타일러스 또는 마우스로 서명하세요.' : 'Draw with finger, stylus, or mouse.'}
          clearLabel={isKo ? '지우기' : 'Clear'}
          undoLabel={isKo ? '실행 취소' : 'Undo'}
          onChange={(isEmpty, url) => {
            setEmpty(isEmpty)
            setDataUrl(url)
          }}
        />
      </div>
      <Button className="mt-4 h-11 rounded-xl" disabled={saving} onClick={() => void submit()}>
        {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '가이드 서명 저장' : 'Save guide signature'}
      </Button>
    </section>
  )
}
