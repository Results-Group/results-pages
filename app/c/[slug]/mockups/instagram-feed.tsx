'use client';

interface InstagramFeedProps {
  imageUrl: string;
  clientName: string;
  logoUrl?: string;
  caption?: string;
}

export default function InstagramFeed({ imageUrl, clientName, logoUrl, caption }: InstagramFeedProps) {
  return (
    <div dir="rtl" className="w-full max-w-[468px] mx-auto rounded-lg overflow-hidden shadow-lg shadow-black/30" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-pink-500/30">
              {logoUrl ? (
                <img src={logoUrl} alt={clientName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
              )}
            </div>
            <span className="text-sm font-semibold text-gray-900">{clientName}</span>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-900">
            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </div>

        {/* Image */}
        <div className="w-full aspect-square bg-gray-100">
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900">
              <path d="M22 3L9.218 10.083M22 3l-9.782 18-3-8.917M22 3L9.218 10.083m0 0L6 19.083" />
            </svg>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        {/* Likes */}
        <div className="px-3 pb-1">
          <p className="text-sm text-gray-900 font-semibold">אהבו על ידי אחרים</p>
        </div>

        {/* Caption */}
        {caption && (
          <div className="px-3 pb-3">
            <p className="text-sm text-gray-900">
              <span className="font-semibold">{clientName}</span>{' '}
              <span className="text-gray-800">{caption}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
