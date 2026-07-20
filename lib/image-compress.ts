'use client'

const MAX_DIM = 1920
const QUALITY = 0.88

/** Formats that can carry an alpha channel — these must not be flattened to JPEG. */
function sourceHasAlpha(file: File): boolean {
  const type = file.type.toLowerCase()
  if (/png|webp|gif|avif/.test(type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['png', 'webp', 'gif', 'avif'].includes(ext)
}

/**
 * Compress an image file in the browser using canvas, before uploading.
 * - Resizes to MAX_DIM × MAX_DIM max (preserves aspect ratio, no upscale)
 * - Transparent sources (PNG/WebP/GIF/AVIF) are encoded as WebP so alpha
 *   survives. Encoding them as JPEG turned every transparent pixel black,
 *   which put a black box behind transparent logos.
 * - Everything else (JPEG/HEIC — browser decodes HEIC natively on iOS/macOS)
 *   stays JPEG, which compresses photos better.
 */
export async function compressImageClient(file: File): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { naturalWidth: w, naturalHeight: h } = img

      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas not supported'))
      ctx.drawImage(img, 0, 0, w, h)

      const keepAlpha = sourceHasAlpha(file)
      const base = file.name.replace(/\.[^.]+$/, '')

      const encode = (type: string, ext: string, onFail?: () => void) =>
        canvas.toBlob(
          blob => {
            // Browsers that can't encode the requested type hand back null (or
            // silently fall back to PNG) — retry once with a safe format.
            if (!blob) {
              if (onFail) return onFail()
              return reject(new Error('canvas.toBlob failed'))
            }
            resolve({ blob, filename: `${base}.${ext}` })
          },
          type,
          QUALITY,
        )

      if (keepAlpha) {
        encode('image/webp', 'webp', () => encode('image/png', 'png'))
      } else {
        encode('image/jpeg', 'jpg')
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`cannot decode ${file.name}`))
    }

    img.src = url
  })
}

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/bmp',
])

export function isImageFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type.toLowerCase())) return true
  // Fallback: check extension (HEIC from some devices reports empty type)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tiff', 'bmp'].includes(ext)
}

export const MAX_FILE_MB = 150
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
