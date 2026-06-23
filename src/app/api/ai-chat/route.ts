import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { rawQuery, initDb } from '@/lib/db'
import { decodeSession, checkUserAccess } from '@/lib/whop'

// ============ AI Provider Configuration ============
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

const SYSTEM_PROMPT = `You are AstroBidhi AI, a Vedic astrology analyst (KP system, Parashari, Jaimini). The user is asking a follow-up question about their birth chart analysis. You have their chart data and previous analysis.

OUTPUT FORMAT:
- Use Markdown: **bold** for key terms, - bullet lists for specifics, short paragraphs
- Be direct — don't start with "Great question!" or "Based on your chart..."
- Reference specific planets, houses, and signs from the chart data
- Keep responses concise (3-5 short paragraphs max) but thorough
- Use Vedic terminology with brief explanations
- End with a one-line italic disclaimer: *AI-generated Vedic guidance. Consult a qualified astrologer for major decisions.*
- Do NOT claim the Moon sign, Nakshatra, or Dasa are unknown — they're in the Chart Summary
- Do NOT wrap your response in code fences`

// ============ Rate Limits ============
const FREE_FOLLOWUP_PER_ANALYSIS = 3

// ============ Device Access Helper ============
async function checkDeviceAccess(deviceId: string, analysisType: string): Promise<{
  isPremium: boolean
  hasAccess: boolean
  hasAllPremium: boolean
  hasUnlimited: boolean
}> {
  try {
    await initDb()
    const catalogEntry = await rawQuery<{ id: string; isActive: number }>(
      `SELECT id, isActive FROM PremiumCatalog WHERE analysisType = ?`,
      [analysisType]
    )
    const isPremium = catalogEntry.length > 0 && catalogEntry[0].isActive === 1
    if (!isPremium) {
      return { isPremium: false, hasAccess: true, hasAllPremium: false, hasUnlimited: false }
    }
    const deviceAccessGrants = await rawQuery<{
      analysisType: string
      expiresAt: string | null
    }>(
      `SELECT analysisType, expiresAt FROM DeviceAccess WHERE deviceId = ?`,
      [deviceId]
    )
    const now = new Date().toISOString()
    const activeGrants = deviceAccessGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)
    const hasSpecificAccess = activeGrants.some(g => g.analysisType === analysisType)
    const hasAllPremium = activeGrants.some(g => g.analysisType === 'all_premium')
    const hasUnlimited = activeGrants.some(g => g.analysisType === 'unlimited')
    if (hasSpecificAccess || hasAllPremium || hasUnlimited) {
      return { isPremium: true, hasAccess: true, hasAllPremium, hasUnlimited }
    }
    const legacyGrants = await rawQuery<{ accessLevel: string; expiresAt: string | null }>(
      `SELECT accessLevel, expiresAt FROM UserAccess WHERE deviceId = ?`,
      [deviceId]
    )
    const activeLegacyGrants = legacyGrants.filter(g => !g.expiresAt || new Date(g.expiresAt).toISOString() >= now)
    const legacyUnlimited = activeLegacyGrants.some(g => g.accessLevel === 'unlimited')
    const legacyPremium = legacyUnlimited || activeLegacyGrants.some(g => g.accessLevel === 'premium')
    return { isPremium: true, hasAccess: legacyPremium, hasAllPremium: legacyPremium, hasUnlimited: legacyUnlimited }
  } catch {
    return { isPremium: false, hasAccess: true, hasAllPremium: false, hasUnlimited: false }
  }
}

// ============ AI Provider Functions ============
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini key')
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096, topP: 0.9 },
    }),
  })
  if (!response.ok) throw new Error(`Gemini: HTTP ${response.status}`)
  const data = await response.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callGroq(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('No Groq key')
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 4096,
    }),
  })
  if (!response.ok) throw new Error(`Groq: HTTP ${response.status}`)
  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

async function callOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('No OpenRouter key')
  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://astrobidhi.space-z.ai',
          'X-Title': 'AstroBidhi',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.7, max_tokens: 4096,
        }),
      })
      if (!response.ok) continue
      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (text) return text
    } catch { continue }
  }
  throw new Error('OpenRouter: All models failed')
}

async function callZaiSDK(prompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    temperature: 0.7, max_tokens: 4096,
  })
  return completion.choices[0]?.message?.content || ''
}

async function generateResponse(prompt: string): Promise<{ text: string; provider: string }> {
  const providers: { name: string; fn: () => Promise<string> }[] = [
    { name: 'gemini', fn: () => callGemini(prompt) },
    { name: 'groq', fn: () => callGroq(prompt) },
    { name: 'openrouter', fn: () => callOpenRouter(prompt) },
    { name: 'z-ai-sdk', fn: () => callZaiSDK(prompt) },
  ]
  for (const provider of providers) {
    try {
      const text = await provider.fn()
      if (text) return { text, provider: provider.name }
    } catch (err) {
      console.warn(`[AI-Chat] ${provider.name} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw new Error('All AI providers failed')
}

// ============ Main Handler ============
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { question, analysisType, analysisResult, chartData, deviceId, conversationHistory } = body

    if (!question || !analysisType || !chartData || !deviceId) {
      return NextResponse.json({ detail: 'question, analysisType, chartData, and deviceId are required' }, { status: 400 })
    }

    // Check access level
    const access = await checkDeviceAccess(deviceId, analysisType)
    const isPremiumUser = access.hasAccess && (access.hasAllPremium || access.hasUnlimited)
    
    // Also check Whop access
    let whopHasAccess = false
    const whopCookie = request.cookies.get('whop_session')?.value
    if (whopCookie) {
      const session = decodeSession(whopCookie)
      if (session?.userId) {
        try {
          const whopAccess = await checkUserAccess(session.userId)
          whopHasAccess = whopAccess.hasAccess
        } catch { /* ignore */ }
      }
    }
    
    const hasPremiumAccess = isPremiumUser || whopHasAccess

    // Check follow-up count for free users
    if (!hasPremiumAccess) {
      await initDb()
      const followUps = await rawQuery<{ id: string }>(
        `SELECT id FROM ChatFollowUp WHERE deviceId = ? AND analysisType = ?`,
        [deviceId, analysisType]
      )
      if (followUps.length >= FREE_FOLLOWUP_PER_ANALYSIS) {
        return NextResponse.json({
          detail: `Free follow-up limit reached (${FREE_FOLLOWUP_PER_ANALYSIS} per analysis). Upgrade for unlimited follow-ups.`,
          limitReached: true,
          usedCount: followUps.length,
          limit: FREE_FOLLOWUP_PER_ANALYSIS,
        }, { status: 403 })
      }
    }

    // Build prompt with context
    const historyStr = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? conversationHistory.map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      : ''

    const contextStr = analysisResult
      ? `\n\nPrevious Analysis:\n${analysisResult.substring(0, 3000)}`
      : ''

    // Extract structured chart info so the AI has clear Moon sign / Nakshatra /
    // Dasa context instead of having to parse raw JSON. Without this, the AI
    // often responds with "your Moon sign and Nakshatra are unknown" because
    // it can't find them in the raw JSON quickly.
    const { extractChartInfo, formatChartInfoForPrompt } = await import('@/lib/chart-info')
    const chartInfo = extractChartInfo(chartData as Record<string, unknown>)
    const chartSummary = formatChartInfoForPrompt(chartInfo)

    const fullPrompt = `${SYSTEM_PROMPT}

${chartSummary}

Full Chart JSON (truncated):
${JSON.stringify(chartData).substring(0, 3000)}
${contextStr}
${historyStr ? `\nConversation History:\n${historyStr}\n` : ''}
User's Follow-up Question: ${question}

Answer specifically using the chart data above. The Moon sign, Nakshatra, Ascendant, and current Dasa period are already extracted for you in the Chart Summary — use them directly. Do NOT claim they are unknown. Be concise but thorough.`

    // Generate response
    const { text, provider } = await generateResponse(fullPrompt)

    // Save follow-up record for rate limiting
    try {
      await initDb()
      const { randomUUID } = await import('crypto')
      await rawQuery(
        `INSERT INTO ChatFollowUp (id, deviceId, analysisType, question, response, provider, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [randomUUID(), deviceId, analysisType, question.substring(0, 500), text.substring(0, 500), provider]
      )
    } catch (dbErr) {
      console.warn('[AI-Chat] Failed to save follow-up record (table may not exist):', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    return NextResponse.json({
      response: text,
      provider,
      isPremium: hasPremiumAccess,
    })
  } catch (error) {
    console.error('[AI-Chat] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ detail: 'Failed to generate response. Please try again.' }, { status: 500 })
  }
}
