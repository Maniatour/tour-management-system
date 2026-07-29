import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function resolveEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIAL_VAULT_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error('CREDENTIAL_VAULT_ENCRYPTION_KEY is not configured')
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  const base64Buf = Buffer.from(raw, 'base64')
  if (base64Buf.length === 32) {
    return base64Buf
  }
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function isCredentialVaultEncryptionConfigured(): boolean {
  return Boolean(process.env.CREDENTIAL_VAULT_ENCRYPTION_KEY?.trim())
}

export function encryptCredentialSecret(plaintext: string): string {
  const key = resolveEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptCredentialSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid credential ciphertext')
  }
  const key = resolveEncryptionKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
