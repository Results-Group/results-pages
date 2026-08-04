'use client'

import { useCallback, useState } from 'react'
import { compressImageClient, isImageFile, MAX_FILE_MB } from '@/lib/image-compress'

/**
 * Uploads one image to a strategy document's asset folder.
 *
 * Compresses in the browser first, exactly as the campaign editor does — a
 * 12 MB phone photo would otherwise spend the whole request budget travelling.
 *
 * `ensureDoc` matters: a brand-new document has no id until its first save, and
 * an upload needs a folder to live in. It resolves to the id, creating the
 * document if necessary.
 */
export function useImageUpload(ensureDoc: () => Promise<string | null>) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File): Promise<{ file_path: string } | null> => {
    setError(null)
    if (!isImageFile(file)) {
      setError('ניתן להעלות תמונות בלבד')
      return null
    }
    setUploading(true)
    try {
      const docId = await ensureDoc()
      if (!docId) throw new Error('לא ניתן היה ליצור את המסמך')

      const compressed = await compressImageClient(file)
        .catch(() => ({ blob: file as Blob, filename: file.name }))
      if (compressed.blob.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`הקובץ גדול מדי (מקסימום ${MAX_FILE_MB} MB)`)
      }

      const body = new FormData()
      body.append('file', compressed.blob, compressed.filename)
      const res = await fetch(`/api/strategy-docs/${docId}/assets`, { method: 'POST', body })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'שגיאה בהעלאה')
      }
      return await res.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהעלאה')
      return null
    } finally {
      setUploading(false)
    }
  }, [ensureDoc])

  return { upload, uploading, error }
}
