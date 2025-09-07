'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import SignUpForm from '@/components/auth/SignUpForm'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'

type AuthMode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const handleSuccess = () => {
    router.push('/')
  }

  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToSignUp={() => setMode('signup')}
          />
        )
      case 'signup':
        return (
          <SignUpForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )
      case 'reset':
        return (
          <ResetPasswordForm
            onBack={() => setMode('login')}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {renderForm()}
        
        {mode === 'login' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setMode('reset')}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
