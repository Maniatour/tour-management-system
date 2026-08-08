import type { InputHTMLAttributes } from 'react'

/**
 * Chrome/브라우저가 검색·필터 입력을 카드번호·결제 필드로 오인하지 않도록 막는 공통 속성.
 * native <input> 또는 shadcn Input에 spread 해서 사용.
 */
export const BROWSER_AUTOFILL_OFF_PROPS = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const satisfies InputHTMLAttributes<HTMLInputElement> & {
  'data-1p-ignore'?: boolean | string
  'data-lpignore'?: string
  'data-form-type'?: string
  autoCorrect?: string
  autoCapitalize?: string
}
