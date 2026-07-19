/**
 * Resolve OTA credentials from credentials_ref (vault pointer).
 * Supported refs:
 *   - env:VAR_NAME  → process.env.VAR_NAME
 * Never embed raw secrets in channel_connections.config.
 */

export type ResolvedOtaCredentials = {
  apiKey: string
  source: string
}

export function resolveOtaCredentialsFromRef(
  credentialsRef: string | null | undefined
): ResolvedOtaCredentials | null {
  const ref = (credentialsRef || '').trim()
  if (!ref) return null

  if (ref.startsWith('env:')) {
    const envName = ref.slice(4).trim()
    if (!envName || !/^[A-Z][A-Z0-9_]*$/i.test(envName)) {
      return null
    }
    const apiKey = (process.env[envName] || '').trim()
    if (!apiKey) return null
    return { apiKey, source: `env:${envName}` }
  }

  return null
}
