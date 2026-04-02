'use client';

import { supabase } from '@/lib/supabase';

/**
 * /api/upload 호출 시 세션이 쿠키가 아닌 localStorage(기본 supabase-js)에만 있어도
 * Authorization Bearer 로 인증되도록 합니다.
 */
export async function fetchUploadApi(formData: FormData): Promise<Response> {
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
