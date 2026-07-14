'use client'

interface InstagramStoryProps {
  imageUrl: string
  clientName: string
  logoUrl?: string
}

export default function InstagramStory({ imageUrl, clientName, logoUrl }: InstagramStoryProps) {
  return (
    <div dir="rtl" className="w-[260px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[2.4rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))' }}>
        <div className="relative rounded-[2.2rem] overflow-hidden" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <div className="relative w-full aspect-[9/16] bg-black">
            {/* Image — contain so non-9:16 creatives aren't cropped (letterboxed on black) */}
            <img src={imageUrl} alt="Story" className="absolute inset-0 w-full h-full object-contain" loading="lazy" />

            {/* Top gradient */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

            {/* Notch */}
            <div className="absolute top-0 inset-x-0 flex justify-center pt-2 z-20">
              <div className="w-[100px] h-[25px] rounded-full" style={{ background: '#000' }} />
            </div>

            {/* Progress bars */}
            <div className="absolute top-8 inset-x-3 z-10 flex gap-1">
              <div className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
                <div className="h-full w-full bg-white rounded-full" />
              </div>
              <div className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
                <div className="h-full w-1/3 bg-white rounded-full" />
              </div>
              <div className="flex-1 h-[2px] rounded-full bg-white/30" />
            </div>

            {/* Username bar */}
            <div className="absolute top-11 inset-x-3 z-10 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt={clientName} className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <div className="w-full h-full rounded-full" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
                  )}
                </div>
              </div>
              <span className="text-white text-[13px] font-semibold drop-shadow-lg">{clientName}</span>
              <span className="text-white/60 text-[11px] drop-shadow-lg">2h</span>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-5 inset-x-3 z-10 flex items-center gap-2.5">
              <div className="flex-1 h-10 rounded-full border border-white/40 flex items-center px-4">
                <span className="text-white/60 text-[13px]">Send message</span>
              </div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="flex-shrink-0 opacity-70">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="flex-shrink-0 opacity-70">
                <path d="M22 3L9.218 10.083M22 3l-9.782 18-3-8.917M22 3L9.218 10.083m0 0L6 19.083" />
              </svg>
            </div>

            {/* Home bar indicator */}
            <div className="absolute bottom-1 inset-x-0 flex justify-center z-20">
              <div className="w-[120px] h-[4px] rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
      {/* Reflection */}
      <div className="mx-6 h-6 rounded-b-[2rem] opacity-15" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)', filter: 'blur(6px)' }} />
    </div>
  )
}
