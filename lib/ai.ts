/**
 * Google Gemini AI client for translation and data parsing.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash'

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured')
  return key
}

function getModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/** A binary file (e.g. PDF) to send alongside the prompt as inline data. */
export interface GeminiFile {
  /** Base64-encoded file bytes (no data: prefix). */
  data: string
  /** MIME type, e.g. 'application/pdf'. */
  mimeType: string
}

export async function geminiGenerate(prompt: string, opts?: { json?: boolean; file?: GeminiFile; model?: string }): Promise<string> {
  const apiKey = getApiKey()
  const model = opts?.model || getModel()

  const parts: Record<string, unknown>[] = []
  if (opts?.file) {
    parts.push({ inline_data: { mime_type: opts.file.mimeType, data: opts.file.data } })
  }
  parts.push({ text: prompt })

  const body: Record<string, unknown> = {
    contents: [{ parts }],
  }
  if (opts?.json) {
    body.generationConfig = { responseMimeType: 'application/json' }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 500)}`)
  }

  const data = (await res.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No text in Gemini response')
  return text
}

export async function geminiGenerateJson<T = unknown>(prompt: string, opts?: { file?: GeminiFile; model?: string }): Promise<T> {
  const raw = await geminiGenerate(prompt, { json: true, file: opts?.file, model: opts?.model })
  try {
    return JSON.parse(raw) as T
  } catch {
    // Sometimes the model wraps JSON in markdown code fences
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned) as T
  }
}

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}
