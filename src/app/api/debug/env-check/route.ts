import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const requiredEnvVars = [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_PRIVATE_KEY_ID', 
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_CLIENT_ID',
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL'
    ]
    
    const envStatus = requiredEnvVars.map(varName => ({
      name: varName,
      exists: !!process.env[varName],
      hasValue: !!(process.env[varName] && process.env[varName].trim().length > 0),
      length: process.env[varName]?.length || 0,
      // 보안을 위해 API 키는 일부만 표시
      preview: varName.includes('KEY') || varName.includes('SECRET') 
        ? (process.env[varName] ? `${process.env[varName].substring(0, 10)}...` : 'not set')
        : process.env[varName] || 'not set'
    }))
    
    const missingVars = envStatus.filter(env => !env.exists || !env.hasValue)
    
    // 모든 환경 변수 목록 (디버깅용)
    const allEnvKeys = Object.keys(process.env)
      .filter(key => key.includes('RESEND') || key.includes('GOOGLE'))
      .map(key => ({
        key,
        exists: true,
        hasValue: !!(process.env[key] && process.env[key].trim().length > 0)
      }))
    
    return NextResponse.json({
      success: true,
      data: {
        envStatus,
        missingVars: missingVars.map(env => env.name),
        allConfigured: missingVars.length === 0,
        allEnvKeys,
        nodeEnv: process.env.NODE_ENV,
        // RESEND 관련 환경 변수 상세 정보
        resendConfig: {
          hasApiKey: !!process.env.RESEND_API_KEY,
          hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
          apiKeyLength: process.env.RESEND_API_KEY?.length || 0,
          fromEmail: process.env.RESEND_FROM_EMAIL || 'not set'
        }
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Environment check failed: ${error}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
