import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import TourReportList from './TourReportList'
import TourReportWriteModal from './TourReportWriteModal'
import { FileText, Eye, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { isTourReportEditWindowClosed, tourReportText } from '@/lib/tourReportExtras'
import { normalizeTourReportEmail } from '@/lib/tourReportMissing'
import { useAuth } from '@/contexts/AuthContext'
import { useTourDetailSectionChrome } from '@/components/tour/TourDetailModalChromeContext'

export type TourReportSectionHandle = {
  createReport: () => void
  viewReports: () => void
}

interface TourReportSectionProps {
  tourId: string
  productId?: string | null
  tourName?: string
  tourDate?: string
  canCreateReport?: boolean
  canEditReport?: boolean
  canDeleteReport?: boolean
  showHeader?: boolean
  highlightReportId?: string | null
}

const TourReportSection = forwardRef<TourReportSectionHandle, TourReportSectionProps>(
  function TourReportSection(
    {
      tourId,
      productId,
      tourName: _tourName,
      tourDate,
      canCreateReport = true,
      canEditReport = true,
      canDeleteReport = true,
      showHeader: _showHeader = true,
      highlightReportId = null,
    },
    ref
  ) {
  const t = useTranslations('tours.tourReport')
  const locale = useLocale()
  const chrome = useTourDetailSectionChrome()
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  const [showForm, setShowForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [hasReports, setHasReports] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingReport, setEditingReport] = useState<any | null>(null)
  const [listNonce, setListNonce] = useState(0)

  useEffect(() => {
    checkForReports()
  }, [tourId])

  const checkForReports = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_reports')
        .select('id')
        .eq('tour_id', tourId)
        .limit(1)

      if (error) throw error
      const has = !!(data && data.length > 0)
      setHasReports(has)
      if (has) {
        setShowList(true)
      }
    } catch (error) {
      console.error('Error checking for reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewReports = useCallback(() => {
    setShowList(true)
    setShowForm(false)
  }, [])

  const handleCreateReport = useCallback(() => {
    setEditingReport(null)
    setShowForm(true)
  }, [])

  useImperativeHandle(ref, () => ({
    createReport: handleCreateReport,
    viewReports: handleViewReports,
  }))

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingReport(null)
    setShowList(true)
    setHasReports(true)
    setListNonce((n) => n + 1)
  }

  const handleFormCancel = useCallback(() => {
    setEditingReport(null)
    setShowForm(false)
  }, [])

  const handleEditReport = async (report: any) => {
    const myEmail = normalizeTourReportEmail(currentUserEmail)
    const reportEmail = normalizeTourReportEmail(report?.user_email)
    if (!myEmail || reportEmail !== myEmail) {
      toast.error(
        tourReportText(locale, '본인이 작성한 리포트만 수정할 수 있습니다.', 'You can only edit your own report.')
      )
      return
    }

    let resolvedDate =
      tourDate ||
      report?.tours?.tour_date ||
      null
    if (!resolvedDate && tourId) {
      const { data } = await supabase
        .from('tours')
        .select('tour_date')
        .eq('id', tourId)
        .maybeSingle()
      resolvedDate = data?.tour_date ?? null
    }

    if (isTourReportEditWindowClosed(resolvedDate)) {
      toast.error(
        tourReportText(
          locale,
          '리포트 수정은 투어 다음날까지만 가능합니다.',
          'Reports can only be edited until the day after the tour.'
        )
      )
      return
    }

    setEditingReport(report)
    setShowForm(true)
  }

  const handleDeleteReport = (_reportId: string) => {
    toast.success(t('reportDeleted'))
  }

  const writeModal = (
    <TourReportWriteModal
      open={showForm}
      onClose={handleFormCancel}
      tourId={tourId}
      productId={productId ?? null}
      locale={locale}
      {...(editingReport?.id ? { reportId: editingReport.id as string } : {})}
      {...(editingReport ? { initialData: editingReport } : {})}
      onSuccess={handleFormSuccess}
    />
  )

  let body: React.ReactNode
  if (showList) {
    body = (
      <div className="space-y-4">
        <TourReportList
          key={`${tourId}-${listNonce}`}
          tourId={tourId}
          showTourInfo={false}
          {...(canEditReport ? { onEdit: handleEditReport } : {})}
          {...(canDeleteReport ? { onDelete: handleDeleteReport } : {})}
          locale={locale}
          highlightReportId={highlightReportId}
        />
      </div>
    )
  } else if (loading) {
    body = (
      <div className={`text-center ${chrome.emptyStatePadding}`}>
        <div className={`animate-spin rounded-full border-b-2 border-primary mx-auto mb-2 ${chrome.compact ? 'h-6 w-6' : 'h-8 w-8'}`} />
        <p className={chrome.emptyStateTitle}>Loading...</p>
      </div>
    )
  } else if (hasReports) {
    body = (
      <div className={`text-center space-y-2 ${chrome.compact ? 'py-4' : 'py-6'}`}>
        <FileText className={`${chrome.compact ? 'w-8 h-8' : 'w-10 h-10'} text-green-500 mx-auto`} />
        <p className={chrome.compact ? 'text-xs text-gray-700' : 'text-gray-700 text-base'}>{t('hasReports')}</p>
        <p className={chrome.emptyStateSubtext}>
          {t('clickListButton')}
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={handleViewReports} size="sm" className={chrome.compact ? 'h-7 px-2 text-xs' : 'px-3'}>
            <Eye className={`${chrome.compact ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
            {t('reportList')}
          </Button>
        </div>
      </div>
    )
  } else {
    body = (
      <div className={`text-center ${chrome.emptyStatePadding}`}>
        <FileText className={`${chrome.emptyStateIconClass} text-gray-400 mx-auto ${chrome.compact ? 'mb-2' : 'mb-4'}`} />
        <p className={chrome.emptyStateTitle}>{t('noReports')}</p>
        <p className={chrome.emptyStateSubtext}>
          {t('reportAfterTour')}
        </p>
        {canCreateReport ? (
          <div className={`flex justify-center ${chrome.compact ? 'mt-2' : 'mt-4'}`}>
            <Button
              type="button"
              onClick={handleCreateReport}
              size="sm"
              className={chrome.compact ? 'h-7 px-2 text-xs' : 'px-3'}
            >
              <Plus className={`${chrome.compact ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
              {t('writeReport')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {body}
      {writeModal}
    </>
  )
  }
)

export default TourReportSection
