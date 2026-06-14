import { NextResponse } from 'next/server'

// Debug endpoint — checks which API keys are loaded (values are masked for security)
export async function GET() {
  const maskKey = (key: string | undefined) => {
    if (!key) return 'NOT SET'
    if (key.length <= 8) return '***SET***'
    return key.substring(0, 4) + '...' + key.substring(key.length - 4)
  }

  const envStatus = {
    OPENROUTER_API_KEY: maskKey(process.env.OPENROUTER_API_KEY),
    GEMINI_API_KEY: maskKey(process.env.GEMINI_API_KEY),
    GROQ_API_KEY: maskKey(process.env.GROQ_API_KEY),
    XAI_API_KEY: maskKey(process.env.XAI_API_KEY),
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    PORT: process.env.PORT || 'NOT SET',
    PYTHON_BIN: process.env.PYTHON_BIN || 'NOT SET',
  }

  return NextResponse.json({
    status: 'ok',
    environmentVariables: envStatus,
    hint: "If all keys show 'NOT SET', the Railway variables are not reaching the Next.js process. Make sure variable names match exactly (case-sensitive).",
  })
}
