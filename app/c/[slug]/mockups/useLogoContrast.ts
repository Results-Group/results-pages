'use client'

import { useEffect, useState } from 'react'

/**
 * Decides whether a logo needs a dark backdrop.
 *
 * Ad mockups put the client logo in a white avatar circle, which makes a
 * white-on-transparent logo invisible. Rather than asking anyone to configure
 * a colour per client, sample the logo: average the luminance of its visible
 * (non-transparent) pixels and flip the backdrop when the artwork is light.
 *
 * Logos are served through our own /api/asset proxy, so the canvas stays
 * same-origin and readable; if anything fails we keep the white default.
 */
export function useLogoNeedsDarkBackdrop(logoUrl?: string): boolean {
  const [needsDark, setNeedsDark] = useState(false)

  useEffect(() => {
    if (!logoUrl) { setNeedsDark(false); return }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (cancelled) return
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        let total = 0
        let weight = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255
          if (alpha < 0.1) continue // ignore transparent padding
          // Rec. 709 relative luminance
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
          total += lum * alpha
          weight += alpha
        }
        if (weight === 0) return // fully transparent — nothing to judge
        if (!cancelled) setNeedsDark(total / weight > 0.65)
      } catch {
        // Tainted canvas or unsupported context — keep the white default.
      }
    }

    img.src = logoUrl
    return () => { cancelled = true }
  }, [logoUrl])

  return needsDark
}
