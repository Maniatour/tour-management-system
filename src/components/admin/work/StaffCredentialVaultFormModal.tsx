'use client'

import { useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import type { StaffCredentialVaultFormState } from '@/components/admin/work/staffCredentialVaultFormState'
import { STAFF_CREDENTIAL_VAULT_CATEGORIES } from '@/lib/staffCredentialVault'

type StaffCredentialVaultFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  locale: string
  values: StaffCredentialVaultFormState
  onChange: (next: StaffCredentialVaultFormState) => void
  onClose: () => void
  onSave: () => void | Promise<void>
  saving?: boolean
}

export function StaffCredentialVaultFormModal({
  open,
  mode,
  locale,
  values,
  onChange,
  onClose,
  onSave,
  saving = false,
}: StaffCredentialVaultFormModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  if (!open) return null
  const isKo = locale === 'ko'

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'create'
              ? isKo
                ? '로그인 정보 등록'
                : 'Add login'
              : isKo
                ? '로그인 정보 수정'
                : 'Edit login'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '카테고리' : 'Category'}
            </label>
            <select
              value={values.category}
              onChange={(e) =>
                onChange({
                  ...values,
                  category: e.target.value as StaffCredentialVaultFormState['category'],
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {STAFF_CREDENTIAL_VAULT_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {isKo ? item.labelKo : item.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '사이트명' : 'Site name'}
            </label>
            <input
              value={values.siteName}
              onChange={(e) => onChange({ ...values, siteName: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={isKo ? '예: Viator Supplier' : 'e.g. Viator Supplier'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '사이트 URL' : 'Site URL'}
            </label>
            <input
              value={values.siteUrl}
              onChange={(e) => onChange({ ...values, siteUrl: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '로그인 ID' : 'Login ID'}
            </label>
            <input
              value={values.loginId}
              onChange={(e) => onChange({ ...values, loginId: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '비밀번호' : 'Password'}
              {mode === 'edit' && (
                <span className="ml-1 text-xs font-normal text-gray-500">
                  {isKo ? '(변경 시에만 입력)' : '(leave blank to keep)'}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                value={values.password}
                onChange={(e) => onChange({ ...values, password: e.target.value })}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label={showPassword ? (isKo ? '숨기기' : 'Hide') : isKo ? '보기' : 'Show'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '메모' : 'Notes'}
            </label>
            <textarea
              value={values.notes}
              onChange={(e) => onChange({ ...values, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={isKo ? '2FA 담당자, 계정 용도 등' : '2FA owner, account purpose, etc.'}
            />
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            {isKo
              ? '비밀번호는 서버에서 암호화되어 저장됩니다. 열람·복사 시 누가 언제 접근했는지 기록됩니다.'
              : 'Passwords are encrypted at rest. Every reveal and copy is logged with who and when.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? (isKo ? '저장 중…' : 'Saving…') : isKo ? '저장' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
