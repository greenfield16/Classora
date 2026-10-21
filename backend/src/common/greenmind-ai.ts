export interface GreenMindRequest {
  task: string
  payload?: Record<string, unknown>
  prompt: string
  systemInstruction?: string
  imagesBase64?: { mimeType: string; data: string }[]
  responseJson?: boolean
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  label?: string
}

function pickWorkerText(data: any): string {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content.map((part: any) => part?.text || '').join('').trim()
  }

  return String(
    data?.text
    || data?.response
    || data?.output
    || data?.data?.text
    || data?.result?.text
    || (typeof data?.result === 'string' ? data.result : '')
    || data?.candidates?.[0]?.content?.parts?.[0]?.text
    || '',
  ).trim()
}

export async function callGreenMind(opts: GreenMindRequest): Promise<{ text: string; model: string; data: any }> {
  const {
    task,
    payload = {},
    prompt,
    systemInstruction,
    imagesBase64,
    responseJson = /\bjson\b/i.test(prompt),
    maxTokens = 2048,
    temperature = 0.7,
    timeoutMs = 60000,
    label = 'GreenMind AI',
  } = opts

  const url = String(process.env.GREENMIND_URL || '').trim().replace(/\/$/, '')
  const apiKey = String(process.env.GREENMIND_API_KEY || process.env.GREEN_EXAMS_API_KEY || '').trim()
  if (!url) throw new Error(`[${label}] GREENMIND_URL chưa được cấu hình`)
  if (!apiKey) throw new Error(`[${label}] GREENMIND_API_KEY chưa được cấu hình`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        task,
        payload,
        prompt,
        systemInstruction,
        imagesBase64,
        responseJson,
        maxTokens,
        temperature,
        source: 'greenfield-exams',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const raw = await res.text()
    let data: any
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = { text: raw }
    }

    if (!res.ok) {
      const message = data?.error?.message || data?.message || raw || res.statusText
      throw new Error(`HTTP ${res.status}: ${String(message).slice(0, 300)}`)
    }

    const text = pickWorkerText(data)
      || (data?.result && typeof data.result === 'object' ? JSON.stringify(data.result) : '')
      || (data?.analysis && typeof data.analysis === 'object' ? JSON.stringify(data.analysis) : '')
    if (!text) {
      throw new Error('GreenMind Worker trả về nội dung rỗng')
    }

    return {
      text,
      model: String(data?.model || data?.meta?.model || 'greenmind-worker'),
      data,
    }
  } catch (err: any) {
    console.error(`[${label}] GreenMind Worker failed: ${err.message}`)
    throw err
  }
}
