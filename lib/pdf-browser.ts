// Headless Chrome for server-side rendering: the landing-page PDF export and
// the campaign-deck PDF export.
//
// Local dev falls back to the user's system Chrome (avoiding the 50 MB
// chromium-min download for every hot reload); Vercel loads a pack of
// Chromium tarball on first invocation. Cold starts pay ~5s for that
// download; subsequent invocations are ~1-2s.

import 'server-only'
import puppeteer, { type Browser } from 'puppeteer-core'

// Sparticuz publishes matched Chromium tarballs per release; this URL must
// stay in lockstep with the @sparticuz/chromium-min version pinned in
// package.json (currently 131.0.1) — mismatches cause silent segfaults.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // Dynamic import so the local `npm run dev` process doesn't try to unpack
    // the 50 MB chromium tarball just to boot.
    const chromium = (await import('@sparticuz/chromium-min')).default
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
