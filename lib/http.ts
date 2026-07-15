import { NextRequest, NextResponse } from 'next/server'

/**
 * Safely parse a JSON request body. An unguarded `await req.json()` throws a
 * SyntaxError on an empty or malformed body, which escapes as a raw 500 — the
 * frontend then shows a confusing generic error. This turns that into a clean
 * 400 with a Hebrew message, with no behavior change on valid input.
 *
 * Usage:
 *   const { data: body, error } = await parseJson(req)
 *   if (error) return error
 *   const { email, password } = body
 *
 * The helper returns the NextResponse rather than throwing, so it drops in even
 * where the handler has no outer try/catch.
 */
export async function parseJson<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const data = (await req.json()) as T
    if (data === null || typeof data !== 'object') {
      return { data: null, error: NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }
    }
    return { data, error: null }
  } catch {
    return { data: null, error: NextResponse.json({ error: 'גוף הבקשה אינו תקין' }, { status: 400 }) }
  }
}

/** Same as {@link parseJson} for multipart/form-data bodies. */
export async function parseForm(
  req: NextRequest,
): Promise<{ data: FormData; error: null } | { data: null; error: NextResponse }> {
  try {
    return { data: await req.formData(), error: null }
  } catch {
    return { data: null, error: NextResponse.json({ error: 'גוף הבקשה אינו תקין' }, { status: 400 }) }
  }
}
