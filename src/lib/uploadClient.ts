'use client';

import {
  canAttemptProactiveRefresh,
  coordinatedRefreshSession,
  getStoredAccessTokenIfValid,
  isAuthRefreshRateLimited,
  markProactiveRefreshAttempted,
  supabase,
  updateSupabaseToken,
} from '@/lib/supabase';

const UPLOAD_SESSION_REFRESH_SKEW_SEC = 300;

/**
 * 카메라·갤러리 등으로 탭이 백그라운드일 때 토큰 자동 갱신이 밀리면,
 * 만료된 JWT로 Storage/API 업로드 시 401 이후 세션이 끊겨 로그아웃처럼 보일 수 있습니다.
 * 업로드 직전에 만료 임박이면 refresh 합니다.
 */
export async function ensureFreshAuthSessionForUpload(): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.refresh_token) {
    throw new Error(
      '로그인이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = session.expires_at ?? 0;
  const needsRefresh =
    !session.expires_at || exp <= now + UPLOAD_SESSION_REFRESH_SKEW_SEC;

  if (!needsRefresh) return;

  if (isAuthRefreshRateLimited()) {
    const stored = getStoredAccessTokenIfValid(UPLOAD_SESSION_REFRESH_SKEW_SEC)
    if (stored) {
      updateSupabaseToken(stored)
      return
    }
    throw new Error(
      '로그인 세션 갱신이 일시적으로 제한되었습니다. 1~2분 후 다시 시도해 주세요.'
    );
  }

  if (!canAttemptProactiveRefresh()) {
    const stored = getStoredAccessTokenIfValid(UPLOAD_SESSION_REFRESH_SKEW_SEC)
    if (stored) {
      updateSupabaseToken(stored)
      return
    }
  }

  markProactiveRefreshAttempted()
  const { session: refreshed, error } = await coordinatedRefreshSession(supabase, {
    refresh_token: session.refresh_token,
  })

  if (error || !refreshed) {
    throw new Error(
      error?.message ||
        '세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.'
    );
  }
}

async function buildAuthUploadHeaders(): Promise<Headers> {
  await ensureFreshAuthSessionForUpload();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return headers;
}

/**
 * /api/upload 호출 시 세션이 쿠키가 아닌 localStorage(기본 supabase-js)에만 있어도
 * Authorization Bearer 로 인증되도록 합니다.
 */
export async function fetchUploadApi(formData: FormData): Promise<Response> {
  const headers = await buildAuthUploadHeaders();
  return fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
}

/**
 * /api/upload/image — 예약 증빙·상품 이미지 등 (Office Manager 등 localStorage JWT 세션)
 */
export async function fetchImageUploadApi(formData: FormData): Promise<Response> {
  const headers = await buildAuthUploadHeaders();
  return fetch('/api/upload/image', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
}

/** JSON API 호출 시 Bearer JWT + 쿠키 credentials */
export async function fetchWithAuthSession(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const authHeaders = await buildAuthUploadHeaders();
  const headers = new Headers(init?.headers);
  authHeaders.forEach((value, key) => headers.set(key, value));
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
