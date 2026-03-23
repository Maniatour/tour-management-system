'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

const STORAGE_PREFIX = 'tms-route:v1'

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/**
 * 현재 경로(pathname)별로 sessionStorage(또는 localStorage)에 상태를 저장합니다.
 * 같은 페이지에서 새로고침(F5) 후에도 선택값이 유지됩니다.
 *
 * @param keySuffix 페이지 내에서 구분하는 키 (예: `'tour-filters'`, `'edit-tab'`)
 * @param initialValue 저장된 값이 없을 때 사용할 기본값 (객체는 모듈 상수로 두는 것을 권장)
 * @param options.storage `'session'`(기본, 탭 닫으면 삭제) | `'local'`(브라우저에 더 오래 유지)
 *
 * @returns [state, setState, hydrated] — hydrated는 스토리지에서 1차 로드가 끝났는지 여부
 */
export function useRoutePersistedState<T>(
  keySuffix: string,
  initialValue: T,
  options?: { storage?: 'session' | 'local' }
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const pathname = usePathname() ?? '/'
  const storageKind = options?.storage ?? 'session'
  const fullKey = `${STORAGE_PREFIX}:${pathname}:${keySuffix}`
  const initialRef = useRef(initialValue)
  initialRef.current = initialValue

  const [state, setState] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(false)
    const storage = storageKind === 'local' ? localStorage : sessionStorage
    try {
      const raw = storage.getItem(fullKey)
      const init = initialRef.current
      if (raw != null) {
        const parsed = JSON.parse(raw) as unknown
        if (isPlainObject(parsed) && isPlainObject(init)) {
          setState({ ...init, ...parsed } as T)
        } else {
          setState(parsed as T)
        }
      } else {
        setState(init)
      }
    } catch {
      setState(initialRef.current)
    }
    setHydrated(true)
  }, [fullKey, storageKind])

  useEffect(() => {
    if (!hydrated) return
    const storage = storageKind === 'local' ? localStorage : sessionStorage
    try {
      storage.setItem(fullKey, JSON.stringify(state))
    } catch {
      /* quota */
    }
  }, [fullKey, hydrated, state, storageKind])

  return [state, setState, hydrated]
}

export function buildRouteStorageKey(pathname: string, keySuffix: string): string {
  return `${STORAGE_PREFIX}:${pathname || '/'}:${keySuffix}`
}
