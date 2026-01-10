import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const resendFromEmail = process.env.RESEND_FROM_EMAIL
    
    // 모든 환경 변수 목록 (RESEND 관련만)
    const allEnvKeys = Object.keys(process.env)
      .filter(key => key.includes('RESEND') || key.includes('resend'))
      .map(key => ({
        key,
        exists: true,
        hasValue: !!(process.env[key] && process.env[key]!.trim().length > 0),
        length: process.env[key]?.length || 0,
        preview: key.includes('KEY') || key.includes('SECRET')
          ? (process.env[key] ? `${process.env[key]!.substring(0, 10)}...` : 'not set')
          : process.env[key] || 'not set'
      }))
    
    return NextResponse.json({
      success: true,
      data: {
        resendApiKey: {
          exists: !!resendApiKey,
          hasValue: !!(resendApiKey && resendApiKey.trim().length > 0),
          length: resendApiKey?.length || 0,
          preview: resendApiKey ? `${resendApiKey.substring(0, 10)}...` : 'not set',
          startsWith: resendApiKey?.substring(0, 5) || 'not set'
        },
        resendFromEmail: {
          exists: !!resendFromEmail,
          hasValue: !!(resendFromEmail && resendFromEmail.trim().length > 0),
          value: resendFromEmail || 'not set'
        },
        allResendEnvKeys: allEnvKeys,
        nodeEnv: process.env.NODE_ENV,
        // 파일 시스템 확인 (서버 사이드에서만 가능)
        fileSystem: {
          cwd: process.cwd(),
          // .env.local 파일 존재 여부는 직접 확인 불가 (보안상)
        }
      },
      message: resendApiKey 
        ? 'RESEND_API_KEY가 설정되어 있습니다.' 
        : 'RESEND_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하고 서버를 재시작하세요.'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Environment check failed: ${error}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
