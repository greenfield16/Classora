/** Server-only OpenAI Responses adapter. Never import into browser code. */
export interface OpenAIRequest {
  prompt: string
  systemInstruction?: string
  imagesBase64?: { mimeType: string; data: string }[]
  responseJson?: boolean
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

export async function callOpenAI(opts: OpenAIRequest): Promise<{ text: string; model: string }> {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')
  const content: any[] = [{ type: 'input_text', text: opts.prompt }]
  for (const image of opts.imagesBase64 || []) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.mimeType)) {
      throw new Error('Unsupported image type.')
    }
    content.push({ type: 'input_image', image_url: `data:${image.mimeType};base64,${image.data}` })
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      store: false,
      instructions: opts.systemInstruction,
      input: [{ role: 'user', content }],
      max_output_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.35,
      ...((opts.responseJson ?? /\bjson\b/i.test(opts.prompt)) ? { text: { format: { type: 'json_object' } } } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
  })
  // Do not forward provider error bodies: they can contain user input or configuration.
  if (!res.ok) throw new Error(`OpenAI request failed (HTTP ${res.status}).`)
  const data = await res.json() as any
  if (data.status !== 'completed') throw new Error('OpenAI response did not complete. Please retry or reduce the request.')
  const text = (data.output || [])
    .filter((item: any) => item.type === 'message')
    .flatMap((item: any) => item.content || [])
    .filter((part: any) => part.type === 'output_text')
    .map((part: any) => part.text || '').join('').trim()
  if (!text) throw new Error('OpenAI returned no text.')
  return { text, model: String(data.model || 'gpt-4.1-mini') }
}
