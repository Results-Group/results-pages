/**
 * Keeps a client's brand colour legible on the deck's dark ground.
 *
 * The presentation injects `client.brand_color` over --brand-cyan, which drives
 * 58 rules — the campaign title in the header, nav-button hover, borders,
 * accents. A client whose brand colour is black (#000000, which is what Sergio
 * has) turned all of them invisible against the #090c0e background: the title
 * vanished and hovering "next" painted the label black.
 *
 * Rather than reject the colour, lift it until it clears a contrast floor. A
 * black brand becomes a near-white accent — monochrome, which is what a
 * black-brand client wants anyway — while a merely deep colour keeps its hue.
 *
 * Pure and dependency-free so it can be unit tested and used on both the
 * campaign deck and the performance report.
 */

/** The deck's background. */
export const DECK_BACKGROUND = '#090c0e'

/**
 * WCAG AA for normal text. The accent isn't only used on the big header title —
 * it also colours nav-button hover labels at 0.82rem, so the stricter floor is
 * the right one.
 */
const MIN_CONTRAST = 4.5
/** Below this saturation a colour is effectively greyscale. */
const ACHROMATIC = 0.08
/** Where a greyscale brand lands: a crisp near-white, not a muddy mid grey. */
const MONOCHROME_ACCENT = '#ededed'

/** Convert a #RRGGBB (or #RGB) hex to an rgba() string. Falls back to the raw value. */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** Convert a #RRGGBB (or #RGB) hex to an 'R, G, B' triplet for rgba(var(--brand-rgb), a). */
export function hexToRgbTriplet(hex: string): string | null {
  const rgb = parseHex(hex)
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : null
}

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let h = (hex || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h, s, l }
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255 }
}

/**
 * Returns the brand colour if it is already legible on `background`, otherwise
 * the same hue lifted until it is. Returns null for a missing or malformed
 * value, so callers can simply fall back to the theme default.
 */
export function readableAccent(brandColor?: string | null, background: string = DECK_BACKGROUND): string | null {
  if (!brandColor) return null
  const rgb = parseHex(brandColor)
  if (!rgb) return null

  const hex = toHex(rgb)
  if (contrastRatio(hex, background) >= MIN_CONTRAST) return hex

  const hsl = rgbToHsl(rgb)
  // A black or near-black brand has no hue to preserve. Lifting it by lightness
  // alone lands on a mid grey that reads as a rendering fault; a near-white
  // accent reads as a deliberate monochrome identity, which is what a client
  // who picked black is after.
  if (hsl.s < ACHROMATIC) {
    return contrastRatio(MONOCHROME_ACCENT, background) >= MIN_CONTRAST ? MONOCHROME_ACCENT : '#ffffff'
  }
  // Otherwise walk lightness up in small steps and stop at the first value that
  // clears the floor, so the result stays as close to the original as possible.
  for (let l = hsl.l; l <= 1; l += 0.02) {
    const candidate = toHex(hslToRgb({ ...hsl, l }))
    if (contrastRatio(candidate, background) >= MIN_CONTRAST) return candidate
  }
  return '#ffffff'
}
