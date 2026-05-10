'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RECEIPT_OCR_AMOUNT_LINE_PLAIN,
  RECEIPT_OCR_AMOUNT_LINE_TEMPLATE_IDS,
  RECEIPT_OCR_CATEGORY_TEMPLATE_DEFAULTS,
  RECEIPT_OCR_CATEGORY_TEMPLATE_IDS,
  type ReceiptOcrAmountLineTemplateId,
  type ReceiptOcrCategoryTemplateId,
  type ReceiptOcrSkipLineTemplateId,
  RECEIPT_OCR_SKIP_LINE_PLAIN,
  RECEIPT_OCR_SKIP_LINE_TEMPLATE_IDS,
  RECEIPT_OCR_BODY_MATCH_TEMPLATE_HORSESHOE,
  plainPhraseToLineContainsPattern,
} from '@/lib/receiptOcrRuleTemplates'
import type {
  ReceiptOcrAmountLineHintStored,
  ReceiptOcrBodyMatchRuleStored,
  ReceiptOcrCategoryRuleStored,
  ReceiptOcrPaidToSkipPatternStored,
} from '@/lib/receiptOcrParseRules'

export type ReceiptOcrTemplateKind = 'category' | 'skip' | 'amount' | 'bodyMatch'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  newId: () => string
  onAddCategory: (row: ReceiptOcrCategoryRuleStored) => void
  onAddSkip: (row: ReceiptOcrPaidToSkipPatternStored) => void
  onAddAmount: (row: ReceiptOcrAmountLineHintStored) => void
  onAddBodyMatch: (row: ReceiptOcrBodyMatchRuleStored) => void
}

export default function ReceiptOcrRuleTemplateDialog({
  open,
  onOpenChange,
  newId,
  onAddCategory,
  onAddSkip,
  onAddAmount,
  onAddBodyMatch,
}: Props) {
  const t = useTranslations('adminReceiptOcrParseRules')
  // 동적 템플릿 키 (adminReceiptOcrParseRules.*)
  const tx = (key: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- template id별 메시지 키
    (t as any)(key)
  const [kind, setKind] = useState<ReceiptOcrTemplateKind>('category')
  const [customPaidFor, setCustomPaidFor] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [customLinePhrase, setCustomLinePhrase] = useState('')
  const [bodyContains, setBodyContains] = useState('')
  const [bodyPaidTo, setBodyPaidTo] = useState('')
  const [bodyPaidFor, setBodyPaidFor] = useState('')
  const [bodyUseCc, setBodyUseCc] = useState(false)

  useEffect(() => {
    setCustomLinePhrase('')
    setBodyContains('')
    setBodyPaidTo('')
    setBodyPaidFor('')
    setBodyUseCc(false)
  }, [kind])

  const addCategoryFromPreset = (id: ReceiptOcrCategoryTemplateId) => {
    const def = RECEIPT_OCR_CATEGORY_TEMPLATE_DEFAULTS[id]
    onAddCategory({
      id: newId(),
      paid_for: tx(`templateCategoryPaidFor_${id}`),
      keywords: [...def.keywords],
      enabled: true,
    })
  }

  const addCategoryCustom = () => {
    const paid_for = customPaidFor.trim()
    const keywords = customKeywords
      .split(/[,|\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (!paid_for || keywords.length === 0) return
    onAddCategory({
      id: newId(),
      paid_for,
      keywords,
      enabled: true,
    })
    setCustomPaidFor('')
    setCustomKeywords('')
  }

  const addSkipFromPreset = (id: ReceiptOcrSkipLineTemplateId) => {
    const plain = RECEIPT_OCR_SKIP_LINE_PLAIN[id]
    const pattern = plainPhraseToLineContainsPattern(plain)
    if (!pattern) return
    onAddSkip({
      id: newId(),
      pattern,
      flags: 'i',
      enabled: true,
      plain_phrase: plain,
    })
  }

  const addSkipCustom = () => {
    const plain = customLinePhrase.trim()
    const pattern = plainPhraseToLineContainsPattern(plain)
    if (!pattern) return
    onAddSkip({
      id: newId(),
      pattern,
      flags: 'i',
      enabled: true,
      plain_phrase: plain,
    })
    setCustomLinePhrase('')
  }

  const addAmountFromPreset = (id: ReceiptOcrAmountLineTemplateId) => {
    const plain = RECEIPT_OCR_AMOUNT_LINE_PLAIN[id]
    const pattern = plainPhraseToLineContainsPattern(plain)
    if (!pattern) return
    onAddAmount({
      id: newId(),
      line_pattern: pattern,
      flags: 'i',
      enabled: true,
      plain_phrase: plain,
    })
  }

  const addAmountCustom = () => {
    const plain = customLinePhrase.trim()
    const pattern = plainPhraseToLineContainsPattern(plain)
    if (!pattern) return
    onAddAmount({
      id: newId(),
      line_pattern: pattern,
      flags: 'i',
      enabled: true,
      plain_phrase: plain,
    })
    setCustomLinePhrase('')
  }

  const addBodyHorseshoe = () => {
    const h = RECEIPT_OCR_BODY_MATCH_TEMPLATE_HORSESHOE
    onAddBodyMatch({
      id: newId(),
      contains_phrase: h.contains_phrase,
      paid_to: h.paid_to,
      paid_for: h.paid_for,
      payment_method_id: '',
      payment_use_cc_label: h.payment_use_cc_label,
      enabled: true,
    })
  }

  const addBodyCustom = () => {
    const c = bodyContains.trim()
    const pt = bodyPaidTo.trim()
    const pf = bodyPaidFor.trim()
    if (!c || (!pt && !pf && !bodyUseCc)) return
    onAddBodyMatch({
      id: newId(),
      contains_phrase: c,
      paid_to: pt,
      paid_for: pf,
      payment_method_id: '',
      payment_use_cc_label: bodyUseCc,
      enabled: true,
    })
    setBodyContains('')
    setBodyPaidTo('')
    setBodyPaidFor('')
    setBodyUseCc(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('templateDialogTitle')}</DialogTitle>
          <DialogDescription className="text-left text-xs leading-relaxed">
            {t('templateDialogIntro')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label className="text-xs text-slate-600">{t('templateKindLabel')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReceiptOcrTemplateKind)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">{t('templateKindCategory')}</SelectItem>
                <SelectItem value="skip">{t('templateKindSkip')}</SelectItem>
                <SelectItem value="amount">{t('templateKindAmount')}</SelectItem>
                <SelectItem value="bodyMatch">{t('templateKindBodyMatch')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'category' ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] text-slate-600 leading-snug">{t('templateCategoryExplain')}</p>
              <div className="flex flex-wrap gap-2">
                {RECEIPT_OCR_CATEGORY_TEMPLATE_IDS.map((cid) => (
                  <Button
                    key={cid}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => addCategoryFromPreset(cid)}
                  >
                    {tx(`templateCategoryChip_${cid}`)}
                  </Button>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-xs font-medium text-slate-800">{t('templateCategoryCustomTitle')}</p>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">{t('fieldPaidFor')}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={customPaidFor}
                    onChange={(e) => setCustomPaidFor(e.target.value)}
                    placeholder={t('templateCategoryPaidForPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">{t('fieldKeywords')}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={customKeywords}
                    onChange={(e) => setCustomKeywords(e.target.value)}
                    placeholder={t('fieldKeywordsPlaceholder')}
                  />
                </div>
                <Button type="button" size="sm" className="w-full sm:w-auto" onClick={addCategoryCustom}>
                  {t('templateAddCustomCategory')}
                </Button>
              </div>
            </div>
          ) : null}

          {kind === 'skip' ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] text-slate-600 leading-snug">{t('templateSkipExplain')}</p>
              <div className="flex flex-wrap gap-2">
                {RECEIPT_OCR_SKIP_LINE_TEMPLATE_IDS.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => addSkipFromPreset(id)}
                    title={RECEIPT_OCR_SKIP_LINE_PLAIN[id]}
                  >
                    {tx(`templateSkipChip_${id}`)}
                  </Button>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <Label className="text-xs">{t('plainPhraseLabel')}</Label>
                <Input
                  className="h-8 text-sm"
                  value={customLinePhrase}
                  onChange={(e) => setCustomLinePhrase(e.target.value)}
                  placeholder={t('templateSkipCustomPlaceholder')}
                />
                <p className="text-[10px] text-slate-500">{t('plainPhraseHint')}</p>
                <Button type="button" size="sm" onClick={addSkipCustom}>
                  {t('templateAddLineRule')}
                </Button>
              </div>
            </div>
          ) : null}

          {kind === 'amount' ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] text-slate-600 leading-snug">{t('templateAmountExplain')}</p>
              <div className="flex flex-wrap gap-2">
                {RECEIPT_OCR_AMOUNT_LINE_TEMPLATE_IDS.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => addAmountFromPreset(id)}
                    title={RECEIPT_OCR_AMOUNT_LINE_PLAIN[id]}
                  >
                    {tx(`templateAmountChip_${id}`)}
                  </Button>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <Label className="text-xs">{t('plainPhraseLabelAmount')}</Label>
                <Input
                  className="h-8 text-sm"
                  value={customLinePhrase}
                  onChange={(e) => setCustomLinePhrase(e.target.value)}
                  placeholder={t('templateAmountCustomPlaceholder')}
                />
                <p className="text-[10px] text-slate-500">{t('plainPhraseHintAmount')}</p>
                <Button type="button" size="sm" onClick={addAmountCustom}>
                  {t('templateAddLineRule')}
                </Button>
              </div>
            </div>
          ) : null}

          {kind === 'bodyMatch' ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[11px] text-slate-600 leading-snug">{t('templateBodyExplain')}</p>
              <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={addBodyHorseshoe}>
                {t('templateBodyHorseshoeBtn')}
              </Button>
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-xs font-medium text-slate-800">{t('templateBodyCustomTitle')}</p>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">{t('fieldBodyContains')}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={bodyContains}
                    onChange={(e) => setBodyContains(e.target.value)}
                    placeholder={t('fieldBodyContainsPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">{t('fieldBodyPaidTo')}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={bodyPaidTo}
                    onChange={(e) => setBodyPaidTo(e.target.value)}
                    placeholder={t('fieldBodyPaidToPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">{t('fieldBodyPaidFor')}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={bodyPaidFor}
                    onChange={(e) => setBodyPaidFor(e.target.value)}
                    placeholder={t('fieldBodyPaidForPlaceholder')}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={bodyUseCc} onCheckedChange={(c) => setBodyUseCc(c === true)} />
                  {t('fieldBodyPaymentCc')}
                </label>
                <Button type="button" size="sm" onClick={addBodyCustom}>
                  {t('templateAddBodyMatch')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('templateDialogClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
