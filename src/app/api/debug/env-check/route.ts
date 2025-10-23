import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const requiredEnvVars = [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_PRIVATE_KEY_ID', 
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_CLIENT_ID'
    ]
    
    const envStatus = requiredEnvVars.map(varName => ({
      name: varName,
      exists: !!process.env[varName],
      hasValue: !!(process.env[varName] && process.env[varName].trim().length > 0),
      length: process.env[varName]?.length || 0
    }))
    
    const missingVars = envStatus.filter(env => !env.exists || !env.hasValue)
    
    return NextResponse.json({
      success: true,
      data: {
        envStatus,
        missingVars: missingVars.map(env => env.name),
        allConfigured: missingVars.length === 0
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
