'use client'

interface GeneralCardProps {
  imageUrl: string
  caption?: string
}

export default function GeneralCard({ imageUrl, caption }: GeneralCardProps) {
  return (
    <div dir="rtl" className="w-full">
      <div className="relative rounded-2xl overflow-hidden group" style={{ boxShadow: '0 15px 50px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)' }}>
        <img src={imageUrl} alt={caption || 'Creative'} className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        {/* Hover shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)' }} />
      </div>
      {caption && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: '#a0aab0' }}>{caption}</p>
      )}
    </div>
  )
}
