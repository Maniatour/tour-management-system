'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import SopDocumentWithToc from '@/components/sop/SopDocumentWithToc'
import { markdownToHtml } from '@/components/LightRichEditor'
import {
  parseSopDocumentJson,
  sopText,
  type SopDocument,
  type SopEditLocale,
} from '@/types/sopStructure'

type VersionRow = {
  id: string
  title: string
  body_structure: unknown
  version_number: number
  published_at: string
}

export default function GuideSopReadClient() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const locale = pathname.split('/').filter(Boolean)[0] || 'ko'
  const isEn = locale === 'en'
  const { authUser, userRole, loading, isInitialized } = useAuth()

  const [version, setVersion] = useState<VersionRow | null>(null)
  const [structureDoc, setStructureDoc] = useState<SopDocument | null>(null)
  const [alreadySigned, setAlreadySigned] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewLang, setViewLang] = useState<SopEditLocale>(isEn ? 'en' : 'ko')

  const staffOk =
    userRole === 'admin' || userRole === 'manager' || userRole === 'team_member'

  useEffect(() => {
    setViewLang(isEn ? 'en' : 'ko')
  }, [isEn])

  const load = useCallback(async () => {
    if (!isInitialized || loading || !authUser?.id) return
    if (!staffOk) {
      setLoadError(isEn ? 'Staff only.' : '직원만 접근할 수 있습니다.')
      return
    }

    const { data, error } = await supabase
      .from('company_sop_versions')
      .select('id, title, body_structure, version_number, published_at')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      setLoadError(isEn ? 'Could not load SOP.' : 'SOP를 불러오지 못했습니다.')
      return
    }

    const row = data as VersionRow
    setVersion(row)
    setStructureDoc(parseSopDocumentJson(row.body_structure))

    const { data: sig } = await supabase
      .from('sop_signatures')
      .select('id')
      .eq('version_id', row.id)
      .eq('user_id', authUser.id)
      .maybeSingle()

    setAlreadySigned(!!sig)
  }, [authUser?.id, isEn, isInitialized, loading, staffOk])

  useEffect(() => {
    void load()
  }, [load])

  if (!isInitialized || loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">{isEn ? 'Loading…' : '불러오는 중…'}</p>
      </div>
    )
  }

  if (!staffOk) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError}</p>
      </div>
    )
  }

  if (loadError || !version) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError || (isEn ? 'No SOP published.' : '게시된 SOP가 없습니다.')}</p>
      </div>
    )
  }

  const headingText =
    structureDoc != null
      ? (sopText(structureDoc.title_ko, structureDoc.title_en, viewLang).trim() || version.title)
      : version.title

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEn ? 'Company SOP' : '회사 SOP'}</h1>
          <div
            className="mt-1 text-lg font-semibold text-gray-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(headingText) }}
          />
          <p className="mt-1 text-sm text-gray-600">
            {isEn ? `Version ${version.version_number}` : `제${version.version_number}판`} ·{' '}
            {new Date(version.published_at).toLocaleString(isEn ? 'en-US' : 'ko-KR')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {alreadySigned === false ? (
            <Button type="button" size="sm" onClick={() => router.push(`/${locale}/sop/sign?version=${version.id}`)}>
              {isEn ? 'Sign this version' : '이 버전 서명하기'}
            </Button>
          ) : alreadySigned ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              {isEn ? 'Signed' : '서명 완료'}
            </span>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => router.back()}>
            {isEn ? 'Back' : '뒤로'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{isEn ? 'View language' : '보기 언어'}</span>
        <Button type="button" size="sm" variant={viewLang === 'ko' ? 'default' : 'outline'} onClick={() => setViewLang('ko')}>
          한국어
        </Button>
        <Button type="button" size="sm" variant={viewLang === 'en' ? 'default' : 'outline'} onClick={() => setViewLang('en')}>
          English
        </Button>
      </div>

      {structureDoc ? (
        <SopDocumentWithToc doc={structureDoc} viewLang={viewLang} uiLocaleEn={isEn} />
      ) : (
        <p className="text-sm text-gray-600">{isEn ? 'No structured content.' : '구조화된 본문이 없습니다.'}</p>
      )}

      {alreadySigned === false ? (
        <p className="text-sm text-amber-800">
          {isEn ? 'You have not signed this version yet. ' : '아직 이 버전에 서명하지 않았습니다. '}
          <Link className="font-medium underline" href={`/${locale}/sop/sign?version=${version.id}`}>
            {isEn ? 'Go to sign page' : '서명 페이지로 이동'}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
