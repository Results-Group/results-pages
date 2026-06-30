'use client';

interface InstagramStoryProps {
  imageUrl: string;
  clientName: string;
  logoUrl?: string;
}

export default function InstagramStory({ imageUrl, clientName, logoUrl }: InstagramStoryProps) {
  return (
    <div dir="rtl" className="w-[240px] mx-auto">
      <div className="relative w-full aspect-[9/16] rounded-[1.8rem] overflow-hidden bg-black shadow-xl shadow-black/40" style={{ border: '3px solid rgba(64,225,211,0.2)' }}>
        {/* Image */}
        <img src={imageUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />

        {/* Top gradient overlay */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Progress bar */}
        <div className="absolute top-3 inset-x-3 z-10">
          <div className="w-full h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full w-1/3 bg-white rounded-full" />
          </div>
        </div>

        {/* Top bar: avatar + username + timestamp */}
        <div className="absolute top-5 inset-x-3 z-10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-400 flex-shrink-0 ring-2 ring-white/40">
            {logoUrl ? (
              <img src={logoUrl} alt={clientName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-500" />
            )}
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-sm">{clientName}</span>
          <span className="text-white/70 text-xs drop-shadow-sm">3h</span>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-4 inset-x-3 z-10 flex items-center gap-2">
          <div className="flex-1 h-9 rounded-full border border-white/50 flex items-center px-3">
            <span className="text-white/70 text-xs">שלח הודעה</span>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="flex-shrink-0 opacity-80">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
