'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { resetPassword } from '@/lib/auth'
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

const resetPasswordSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요'),
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

interface ResetPasswordFormProps {
  onBack?: () => void
}

export default function ResetPasswordForm({ onBack }: ResetPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await resetPassword(data.email)
      
      if (result.error) {
        setError(result.error.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('비밀번호 재설정 요청 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">이메일 전송 완료!</h2>
          <p className="text-gray-600 mb-6">
            비밀번호 재설정 링크를 이메일로 보내드렸습니다.<br />
            이메일을 확인하고 링크를 클릭해주세요.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">비밀번호 재설정</h2>
          <p className="text-gray-600 mt-2">이메일로 재설정 링크를 보내드립니다</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                {...register('email')}
                type="email"
                id="email"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이메일을 입력하세요"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '전송 중...' : '재설정 링크 전송'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-500 font-medium flex items-center justify-center mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
