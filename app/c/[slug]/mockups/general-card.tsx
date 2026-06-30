'use client';

interface GeneralCardProps {
  imageUrl: string;
  caption?: string;
}

export default function GeneralCard({ imageUrl, caption }: GeneralCardProps) {
  return (
    <div dir="rtl" className="w-full font-sans">
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(64,225,211,0.1)' }}>
        <img src={imageUrl} alt={caption || 'Creative'} className="w-full h-auto object-cover" />
      </div>
      {caption && (
        <p className="mt-3 text-sm" style={{ color: '#a0aab0' }}>{caption}</p>
      )}
    </div>
  );
}
