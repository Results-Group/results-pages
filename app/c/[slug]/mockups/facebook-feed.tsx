'use client';

interface FacebookFeedProps {
  imageUrl: string;
  clientName: string;
  logoUrl?: string;
  caption?: string;
}

export default function FacebookFeed({ imageUrl, clientName, logoUrl, caption }: FacebookFeedProps) {
  return (
    <div dir="rtl" className="w-full max-w-[500px] mx-auto rounded-lg overflow-hidden shadow-lg shadow-black/30" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="bg-white">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={clientName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-gray-900">{clientName}</span>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>עכשיו</span>
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
            <p className="text-[15px] text-gray-900">{caption}</p>
          </div>
        )}

        {/* Image */}
        <div className="w-full bg-gray-100">
          <img src={imageUrl} alt="Post" className="w-full h-auto object-cover" />
        </div>

        {/* Reactions bar */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1">
            <span className="text-sm">👍❤️</span>
            <span className="text-[13px] text-gray-500">127 אנשים</span>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-gray-500">
            <span>14 תגובות</span>
            <span>3 שיתופים</span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200" />

        {/* Action buttons */}
        <div className="flex items-center justify-around px-2 py-1">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className="text-[13px] font-medium text-gray-600">אהבתי</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[13px] font-medium text-gray-600">תגובה</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <path d="M22 3L9.218 10.083M22 3l-9.782 18-3-8.917M22 3L9.218 10.083m0 0L6 19.083" />
            </svg>
            <span className="text-[13px] font-medium text-gray-600">שיתוף</span>
          </button>
        </div>
      </div>
    </div>
  );
}
