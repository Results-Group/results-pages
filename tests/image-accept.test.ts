import { describe, it, expect } from 'vitest'
import { rejectUpload, MAX_UPLOAD_BYTES } from '@/lib/image-accept'

describe('rejectUpload', () => {
  it('accepts the formats the pipeline can process', () => {
    expect(rejectUpload('a.webp', 'image/webp', 1000)).toBeNull()
    expect(rejectUpload('צילום מסך.PNG', 'image/png', 1000)).toBeNull()
    expect(rejectUpload('photo.heic', 'image/heic', 1000)).toBeNull()
  })

  it('accepts a correct extension even when the browser sends a junk MIME', () => {
    expect(rejectUpload('a.jpg', 'application/octet-stream', 1000)).toBeNull()
    expect(rejectUpload('a.jpg', '', 1000)).toBeNull()
  })

  it('rejects video regardless of the file name', () => {
    expect(rejectUpload('clip.mp4', 'video/mp4', 1000)).toBe('not-an-image')
    // a video renamed to .jpg still declares video/* — the MIME wins
    expect(rejectUpload('sneaky.jpg', 'video/mp4', 1000)).toBe('not-an-image')
  })

  it('rejects unknown types and oversized files', () => {
    expect(rejectUpload('doc.pdf', 'application/pdf', 1000)).toBe('not-an-image')
    expect(rejectUpload('a.webp', 'image/webp', MAX_UPLOAD_BYTES + 1)).toBe('too-large')
  })
})
