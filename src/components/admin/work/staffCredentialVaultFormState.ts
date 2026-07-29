import type { StaffCredentialVaultCategory } from '@/lib/staffCredentialVault'

export type StaffCredentialVaultFormState = {
  siteName: string
  siteUrl: string
  category: StaffCredentialVaultCategory
  loginId: string
  password: string
  notes: string
}

export const EMPTY_STAFF_CREDENTIAL_VAULT_FORM: StaffCredentialVaultFormState = {
  siteName: '',
  siteUrl: '',
  category: 'ota',
  loginId: '',
  password: '',
  notes: '',
}
