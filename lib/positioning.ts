/**
 * Client positioning distillation.
 *
 * Uses the exact analysis prompt from Results Magic (Base44, `processStrategyDocument`)
 * so the extracted brand identity stays compatible with what the team already gets there.
 * The structured JSON is then formatted into free Hebrew text for storage/editing and for
 * grounding campaign copy generation.
 *
 * Model override: set GEMINI_POSITIONING_MODEL (e.g. a Gemini "pro" id) to match Base44's
 * higher-tier model; otherwise falls back to the default GEMINI_MODEL.
 */
import { geminiGenerateJson } from './ai'

/** Structured brand identity — the 8 elements extracted per the Base44 prompt. */
export interface PositioningJson {
  coreMessage?: string
  brandValues?: string[]
  brandVoice?: string
  brandPersonality?: string[]
  targetAudiences?: { name?: string; description?: string; painPoints?: string }[]
  customerNeeds?: string[]
  competitiveAdvantages?: string[]
  dosAndDonts?: { dos?: string[]; donts?: string[] }
}

// Verbatim analysis instructions from Base44 `processStrategyDocument` (lines 18-38),
// kept faithful for output compatibility. NOTE: the inference clause intentionally lets
// the model fill reasonable estimates when info is missing (per Base44).
const DISTILL_PROMPT = `CRITICAL: Analyze ONLY the actual content inside the document. Completely ignore the file name, file size, or any system/upload metadata. NEVER write about file size limits, 10MB, upload errors, or "the file is too large" — those are not part of the brand strategy. If you cannot read content, leave fields empty rather than inventing text about file constraints.

Analyze the attached brand positioning document/strategy presentation. Extract the following core brand identity elements into a structured JSON format:

Core Message: The main value proposition or slogan.
Brand Values: List of core values (e.g., Innovation, Integrity).
Brand Voice: Description of the tone of voice (e.g., Professional, Witty).
Brand Personality: Adjectives describing the brand personality.
Target Audiences: List of audience segments with their names, descriptions, and key pain points.
Customer Needs: List of key customer needs and desires that the brand fulfills.
Competitive Advantages: List of key differentiators.
Dos and Donts: Marketing guidelines on what to do and what to avoid.
If specific information is missing in the document, infer reasonable estimates based on the context or leave empty if impossible. Translate the content to Hebrew if the document is in Hebrew, otherwise keep it in the original language (usually prefer Hebrew for this system).

Return ONLY valid JSON with exactly this shape (Hebrew values):
{
  "coreMessage": "string",
  "brandValues": ["string"],
  "brandVoice": "string",
  "brandPersonality": ["string"],
  "targetAudiences": [{ "name": "string", "description": "string", "painPoints": "string" }],
  "customerNeeds": ["string"],
  "competitiveAdvantages": ["string"],
  "dosAndDonts": { "dos": ["string"], "donts": ["string"] }
}`

function section(title: string, body: string | undefined): string | null {
  const t = (body || '').trim()
  return t ? `## ${title}\n${t}` : null
}

function list(items?: string[]): string {
  return (items || []).filter(Boolean).map(s => `• ${s.trim()}`).join('\n')
}

/** Format the structured JSON into readable, editable Hebrew free text. */
export function formatPositioning(j: PositioningJson): string {
  const audiences = (j.targetAudiences || [])
    .filter(a => a && (a.name || a.description || a.painPoints))
    .map(a => {
      const parts = [a.name?.trim()].filter(Boolean)
      const head = parts.length ? `• ${parts.join('')}` : '•'
      const desc = a.description?.trim() ? `\n  ${a.description.trim()}` : ''
      const pain = a.painPoints?.trim() ? `\n  כאבים: ${a.painPoints.trim()}` : ''
      return `${head}${desc}${pain}`
    })
    .join('\n')

  const dos = list(j.dosAndDonts?.dos)
  const donts = list(j.dosAndDonts?.donts)
  const dosDonts = [
    dos ? `כן:\n${dos}` : '',
    donts ? `לא:\n${donts}` : '',
  ].filter(Boolean).join('\n\n')

  return [
    section('מסר מרכזי', j.coreMessage),
    section('ערכי מותג', list(j.brandValues)),
    section('טון דיבור', j.brandVoice),
    section('אישיות מותג', list(j.brandPersonality)),
    section('קהלי יעד', audiences),
    section('צרכי הלקוח', list(j.customerNeeds)),
    section('יתרונות תחרותיים', list(j.competitiveAdvantages)),
    section('מותר ואסור', dosDonts),
  ].filter(Boolean).join('\n\n')
}

/** Distill a positioning PDF (base64) into free Hebrew text via Gemini. */
export async function distillPositioning(pdfBase64: string): Promise<{ text: string; json: PositioningJson }> {
  const json = await geminiGenerateJson<PositioningJson>(DISTILL_PROMPT, {
    file: { data: pdfBase64, mimeType: 'application/pdf' },
    model: process.env.GEMINI_POSITIONING_MODEL || undefined,
  })
  return { text: formatPositioning(json), json }
}
