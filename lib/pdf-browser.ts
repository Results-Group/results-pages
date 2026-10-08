// Headless Chrome for server-side rendering: the landing-page PDF export and
// the campaign-deck PDF export.
//
// Local dev falls back to the user's system Chrome (avoiding the 50 MB
// chromium-min download for every hot reload); Vercel loads a pack of
// Chromium tarball on first invocation. Cold starts pay ~5s for that
// download; subsequent invocations are ~1-2s.

import 'server-only'
import puppeteer, { type Browser } from 'puppeteer-core'
import { logger } from './logger'

// Sparticuz publishes matched Chromium tarballs per release; this URL must
// stay in lockstep with the @sparticuz/chromium-min version pinned in
// package.json (currently 131.0.1) — mismatches cause silent segfaults.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

// The Chromium pack ships no emoji font: in the first deck PDFs the Facebook
// mockups' reactions (😂❤️👍) and Share/Comment/Like icons were blank. Pinned
// to a release so the glyphs can't change under a cached PDF.
const EMOJI_FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.047/fonts/NotoColorEmoji.ttf'

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // chromium-min unpacks the shared libraries Chromium needs (libnss3 and
    // friends, its al2023 bundle) only when it recognises AWS Lambda on Node
    // 20/22 — by AWS_EXECUTION_ENV or AWS_LAMBDA_JS_RUNTIME, which Vercel's
    // runtime does not set. Without them every launch failed with "libnss3.so:
    // cannot open shared object file" (2026-10-08). It reads the variable when
    // the module loads, so this must come before the import below.
    process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs22.x'
    // Dynamic import so the local `npm run dev` process doesn't try to unpack
    // the 50 MB chromium tarball just to boot.
    const chromium = (await import('@sparticuz/chromium-min')).default
    // Into ~/.fonts, where the pack's fontconfig looks; cached for the life of
    // the instance. Emoji are a nicety — a failed download still renders.
    await chromium.font(EMOJI_FONT_URL).catch(err => {
      logger.warn('emoji font unavailable for headless Chrome', { error: err instanceof Error ? err.message : String(err) })
    })
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    })
  }
  // Local: point at whichever Chrome the developer has installed. Override
  // via CHROME_EXECUTABLE_PATH if the default macOS path doesn't match.
  const executablePath =
    process.env.CHROME_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return puppeteer.launch({ executablePath, headless: true })
}
