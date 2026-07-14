'use client'

interface InstagramFeedProps {
  imageUrl: string
  clientName: string
  logoUrl?: string
  caption?: string
}

export default function InstagramFeed({ imageUrl, clientName, logoUrl, caption }: InstagramFeedProps) {
  return (
    <div dir="rtl" className="w-full max-w-[468px] mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Phone frame */}
      <div className="relative rounded-[2.2rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))' }}>
        <div className="rounded-[2rem] overflow-hidden" style={{ background: '#fff', boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1" style={{ background: '#fff' }}>
            <div className="w-[120px] h-[28px] rounded-full" style={{ background: '#1a1a1a' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #efefef' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt={clientName} className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <div className="w-full h-full rounded-full" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
                  )}
                </div>
              </div>
              <div>
                <span className="text-[13px] font-semibold text-gray-900 block leading-tight">{clientName}</span>
                <span className="text-[10px] text-gray-400">Sponsored</span>
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-900">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </div>

          {/* Image */}
          <div className="w-full aspect-square bg-gray-100">
            <img src={imageUrl} alt="Post" className="w-full h-full object-cover" loading="lazy" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M22 3L9.218 10.083M22 3l-9.782 18-3-8.917M22 3L9.218 10.083m0 0L6 19.083" /></svg>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </div>

          {/* Likes */}
          <div className="px-3 pb-1">
            <p className="text-[13px] text-gray-900 font-semibold">1,247 likes</p>
          </div>

          {/* Caption */}
          {caption && (
            <div className="px-3 pb-3">
              <p className="text-[13px] text-gray-900 leading-relaxed">
                <span className="font-semibold">{clientName}</span>{' '}
                <span className="text-gray-700">{caption}</span>
              </p>
            </div>
          )}

          {/* Home bar */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-[134px] h-[5px] rounded-full" style={{ background: '#1a1a1a' }} />
          </div>
        </div>
      </div>
      {/* Reflection */}
      <div className="mx-8 h-8 rounded-b-[2rem] opacity-20" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)', filter: 'blur(8px)' }} />
    </div>
  )
}
