'use client'

interface FacebookFeedProps {
  imageUrl: string
  clientName: string
  logoUrl?: string
  caption?: string
}

export default function FacebookFeed({ imageUrl, clientName, logoUrl, caption }: FacebookFeedProps) {
  return (
    <div dir="rtl" className="w-full max-w-[500px] mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Phone frame */}
      <div className="relative rounded-[2.2rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))' }}>
        <div className="rounded-[2rem] overflow-hidden" style={{ background: '#fff', boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1" style={{ background: '#fff' }}>
            <div className="w-[120px] h-[28px] rounded-full" style={{ background: '#1a1a1a' }} />
          </div>

          {/* Facebook blue bar */}
          <div className="flex items-center justify-between px-4 py-2" style={{ background: '#fff', borderBottom: '1px solid #e4e6eb' }}>
            <span className="text-[22px] font-bold" style={{ color: '#1877f2' }}>facebook</span>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#e4e6eb' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1c1e21"><path d="M10 18a7.952 7.952 0 004.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0018 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z" /></svg>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#e4e6eb' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1c1e21"><path d="M20 2H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h3v3.767L13.277 18H20c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2z" /></svg>
              </div>
            </div>
          </div>

          {/* Post header */}
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white flex items-center justify-center" style={{ border: '1px solid #e4e6eb' }}>
              {logoUrl ? (
                <img src={logoUrl} alt={clientName} className="max-w-[70%] max-h-[70%] object-contain" />
              ) : (
                <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-gray-900">{clientName}</span>
              <div className="flex items-center gap-1 text-[12px] text-gray-500">
                <span>Sponsored</span>
                <span>·</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Caption */}
          {caption && (
            <div className="px-4 pb-3">
              <p className="text-[15px] text-gray-900 leading-relaxed">{caption}</p>
            </div>
          )}

          {/* Image */}
          <div className="w-full bg-gray-100">
            <img src={imageUrl} alt="Post" className="w-full h-auto object-cover" loading="lazy" />
          </div>

          {/* Reactions */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]" style={{ background: '#1877f2' }}>👍</span>
                <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]" style={{ background: '#ed4956' }}>❤️</span>
                <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]" style={{ background: '#f7b928' }}>😂</span>
              </div>
              <span className="text-[13px] text-gray-500 mr-1">2.4K</span>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-gray-500">
              <span>89 comments</span>
              <span>23 shares</span>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-gray-200" />

          {/* Actions */}
          <div className="flex items-center justify-around px-2 py-1.5">
            {(['👍 Like', '💬 Comment', '↗️ Share'] as const).map(label => (
              <button key={label} className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
                <span className="text-[13px] font-medium text-gray-600">{label}</span>
              </button>
            ))}
          </div>

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
