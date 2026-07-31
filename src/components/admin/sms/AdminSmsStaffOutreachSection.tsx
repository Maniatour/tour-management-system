'use client'

import { useCallback } from 'react'
import StaffOutreachMessageTemplatePanel from '@/components/reservation/StaffOutreachMessageTemplatePanel'
import { useStaffOutreachMessageTemplates } from '@/hooks/useStaffOutreachMessageTemplates'
import { getBuiltinCancellationFollowUpTemplate } from '@/lib/cancellationFollowUpMessage'
import { getBuiltinPendingAltTourTemplate } from '@/lib/pendingCustomerAltTourMessage'
import { defaultStaffOutreachTemplateName } from '@/lib/staffOutreachMessageTemplates'
import type { AdminSmsCategoryDef } from '@/lib/adminSmsTemplateCatalog'

type Props = {
  category: AdminSmsCategoryDef
  uiLocale: string
  messageLocale: 'ko' | 'en'
  isActive: boolean
}

export default function AdminSmsStaffOutreachSection({
  category,
  uiLocale,
  messageLocale,
  isActive,
}: Props) {
  const isKo = uiLocale.startsWith('ko')
  const scope = category.staffOutreachScope!
  const variant = category.staffOutreachVariant || 'default'

  const getBuiltin = useCallback(() => {
    if (scope === 'pending_alt_tour') {
      const b = getBuiltinPendingAltTourTemplate(messageLocale, 'sms')
      return {
        name: defaultStaffOutreachTemplateName(messageLocale),
        subject: b.subject,
        body: b.body,
      }
    }
    const messageKind = variant === 'rebooking' ? 'rebooking' : 'follow_up'
    const b = getBuiltinCancellationFollowUpTemplate(messageLocale, 'sms', messageKind)
    return {
      name: defaultStaffOutreachTemplateName(messageLocale),
      subject: b.subject,
      body: b.body,
    }
  }, [scope, variant, messageLocale])

  const templateManager = useStaffOutreachMessageTemplates({
    scope,
    locale: messageLocale,
    channel: 'sms',
    variant,
    isOpen: isActive,
    showSubject: false,
    getBuiltin,
    prepareBodyForEditor: (stored) => stored,
    prepareBodyForSave: (editor) => editor,
    loadFailedMessage: isKo ? '템플릿을 불러오지 못했습니다.' : 'Failed to load templates.',
    saveFailedMessage: isKo ? '저장에 실패했습니다.' : 'Save failed.',
    deleteFailedMessage: isKo ? '삭제에 실패했습니다.' : 'Delete failed.',
    savedMessage: isKo ? '템플릿이 저장되었습니다.' : 'Template saved.',
    deletedMessage: isKo ? '템플릿이 삭제되었습니다.' : 'Template deleted.',
    addedMessage: isKo ? '새 템플릿이 추가되었습니다.' : 'New template added.',
  })

  return (
    <StaffOutreachMessageTemplatePanel
      channel="sms"
      uiLocale={uiLocale}
      editMode
      showSubject={false}
      placeholderHint={category.placeholderHint ?? ''}
      templateManager={templateManager}
      adminSmsSamplePreview={{
        categoryId: category.id,
        messageLocale,
      }}
    />
  )
}
