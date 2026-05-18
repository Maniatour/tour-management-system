import enMessages from '@/i18n/locales/en.json'
import koMessages from '@/i18n/locales/ko.json'

/** DB 번역 병합 시 누락될 수 있어 locale JSON에서 직접 읽음 */
export function paidForComboboxHelpWhenStandardUnset(locale: string): string {
  const fromFile =
    locale === 'en'
      ? enMessages.companyExpense?.form?.paidForComboboxHelpWhenStandardUnset
      : koMessages.companyExpense?.form?.paidForComboboxHelpWhenStandardUnset
  if (typeof fromFile === 'string' && fromFile.trim()) return fromFile
  return locale === 'en'
    ? 'When standard payment for is not set, only payment-for text saved on expenses without a standard category is suggested.'
    : '표준 결제 내용이 미저장(선택 안 함)일 때, 표준 미저장 지출에 저장된 결제 내용만 제안합니다.'
}
