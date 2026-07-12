import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { getClientById, updateClient, uploadClientPositioningPdf } from '@/lib/clients'
import { distillPositioning } from '@/lib/positioning'
import { isAiConfigured } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

interface Ctx { params: Promise<{ id: string }> }

const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20MB

async function guard(req: NextRequest, id: string) {
  const session = await getSessionFromRequest(req)
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), client: null, session: null }
  const client = await getClientById(id)
  if (!client) return { error: NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 }), client: null, session: null }
  if (client.workspace_id) {
    const permErr = await requireWorkspacePermission(req, client.workspace_id, 'edit')
    if (permErr) return { error: permErr, client: null, session: null }
  } else if (!session.isOwner && session.role === 'viewer') {
    return { error: NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 }), client: null, session: null }
  }
  return { error: null, client, session }
}

/** Upload a positioning PDF, distill it with AI, and store the resulting free text. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { error, client, session } = await guard(req, id)
  if (error) return error

  const rl = await rateLimit(req, { windowMs: 60_000, max: 5, prefix: 'ai-positioning' })
  if (rl) return rl

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI לא מוגדר — חסר GEMINI_API_KEY' }, { status: 503 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: 'לא צורף קובץ' }, { status: 400 })
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'נא להעלות קובץ PDF' }, { status: 400 })
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 20MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    // Store the source PDF and distill in parallel
    const [pdfPath, distilled] = await Promise.all([
      uploadClientPositioningPdf(file, id),
      distillPositioning(base64),
    ])

    const updated = await updateClient(id, { positioning_pdf_path: pdfPath, positioning: distilled.text })
    await logAudit({ actor: session!, action: 'update', entity_type: 'client', entity_id: id, entity_label: `${client!.name} — מיצוב`, workspace_id: client!.workspace_id })
    return NextResponse.json({ positioning: updated.positioning, positioning_pdf_path: updated.positioning_pdf_path })
  } catch (err) {
    captureException(err, { route: 'POST /api/clients/[id]/positioning', id })
    return NextResponse.json({ error: 'שגיאה בעיבוד מסמך המיצוב' }, { status: 500 })
  }
}
