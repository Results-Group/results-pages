'use client'

const MAX_DIM = 1920
const QUALITY = 0.88

/**
 * Compress an image file in the browser using canvas, before uploading.
 * - Resizes to MAX_DIM × MAX_DIM max (preserves aspect ratio, no upscale)
 * - Outputs as JPEG (works for HEIC too — browser decodes natively on iOS/macOS)
 * - Returns a Blob that is typically 80–95% smaller than a raw iPhone photo
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

      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('canvas.toBlob failed'))
          const base = file.name.replace(/\.[^.]+$/, '')
          resolve({ blob, filename: `${base}.jpg` })
        },
        'image/jpeg',
        QUALITY,
      )
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
