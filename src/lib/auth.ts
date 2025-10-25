import { createClientSupabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  permissions?: string[]
  user_metadata?: {
    name?: string
    full_name?: string
    avatar_url?: string
    [key: string]: any
  }
}

export interface SignUpData {
  email: string
  password: string
  name?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AuthError {
  message: string
  status?: number
}

// 이메일로 회원가입
export async function signUpWithEmail({ email, password, name }: SignUpData) {
  const supabase = createClientSupabase()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0],
      },
    },
  })

  if (error) {
    return { error: { message: error.message, status: error.status } }
  }

  return { data, error: null }
}

// 이메일로 로그인
export async function signInWithEmail({ email, password }: SignInData) {
  const supabase = createClientSupabase()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: { message: error.message, status: error.status } }
  }

  return { data, error: null }
}

// 구글 로그인
export async function signInWithGoogle() {
  const supabase = createClientSupabase()
  
  console.log('Starting Google sign in...', {
    origin: window.location.origin,
    redirectTo: `${window.location.origin}/auth/callback`
  })
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
        include_granted_scopes: 'true',
      },
    },
  })

  console.log('Google OAuth result:', { data, error })

  if (error) {
    console.error('Google OAuth error:', error)
    return { error: { message: error.message, status: error.status } }
  }

  return { data, error: null }
}

// 자동 로그인 체크
export async function checkAutoLogin() {
  const supabase = createClientSupabase()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Auto login check error:', error)
      return { data: null, error: { message: error.message, status: error.status } }
    }

    if (session?.user) {
      console.log('Auto login successful:', { email: session.user.email })
      return { data: session, error: null }
    }

    return { data: null, error: null }
  } catch (error) {
    console.error('Unexpected error in auto login check:', error)
    return { data: null, error: { message: 'Unexpected error', status: 500 } }
  }
}

// 로그아웃
export async function signOut() {
  const supabase = createClientSupabase()
  
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: { message: error.message, status: error.status } }
  }

  return { error: null }
}

// 현재 사용자 정보 가져오기
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  const supabase = createClientSupabase()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    return { user: null, error: { message: error.message, status: error.status } }
  }

  return { user, error: null }
}

// 비밀번호 재설정 이메일 전송
export async function resetPassword(email: string) {
  const supabase = createClientSupabase()
  
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) {
    return { error: { message: error.message, status: error.status } }
  }

  return { data, error: null }
}

// 비밀번호 업데이트
export async function updatePassword(password: string) {
  const supabase = createClientSupabase()
  
  const { data, error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: { message: error.message, status: error.status } }
  }

  return { data, error: null }
}
