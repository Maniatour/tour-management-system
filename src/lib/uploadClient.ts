'use client';

import { supabase } from '@/lib/supabase';

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

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: session.refresh_token,
  });

  if (error || !data.session) {
    throw new Error(
      error?.message ||
        '세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.'
    );
  }
}

/**
 * /api/upload 호출 시 세션이 쿠키가 아닌 localStorage(기본 supabase-js)에만 있어도
 * Authorization Bearer 로 인증되도록 합니다.
 */
export async function fetchUploadApi(formData: FormData): Promise<Response> {
  await ensureFreshAuthSessionForUpload();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
}
