/**
 * Upload acceptance rules for campaign assets. Client-safe and pure — the
 * asset route enforces them server-side, and tests can hold the exact rule
 * (the route itself can't run under vitest's node environment).
 */

export const ACCEPTED_IMAGE_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif', 'image/avif',
  'image/tiff', 'image/bmp',
])

export const ACCEPTED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'tiff', 'bmp'])

/** 50 MB — the client compresses first; this is a safety net. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export type UploadRejection = 'too-large' | 'not-an-image' | null

/**
 * Either the MIME or the extension must identify an image: browsers sometimes
 * send an empty/octet-stream type for files dragged from odd sources, and a
 * correct extension shouldn't be punished for it — but a video is rejected no
 * matter what its name claims.
 */
export function rejectUpload(name: string, mime: string, size: number): UploadRejection {
  if (size > MAX_UPLOAD_BYTES) return 'too-large'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const m = mime.toLowerCase()
  if (m.startsWith('video/')) return 'not-an-image'
  if (ACCEPTED_IMAGE_MIME.has(m) || ACCEPTED_IMAGE_EXT.has(ext)) return null
  return 'not-an-image'
}
