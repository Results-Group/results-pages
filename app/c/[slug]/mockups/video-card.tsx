'use client';

import { useState } from 'react';

interface VideoCardProps {
  url: string;
  embedUrl?: string;
  platform: 'youtube' | 'vimeo' | 'other';
  caption?: string;
}

export default function VideoCard({ url, embedUrl, platform, caption }: VideoCardProps) {
  const [showEmbed, setShowEmbed] = useState(false);

  const thumbnailUrl = getThumbnail(url, platform);

  function getThumbnail(videoUrl: string, plat: string): string | null {
    if (plat === 'youtube') {
      const match = videoUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
    return null;
  }

  return (
    <div dir="rtl" className="w-full font-sans">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden" style={{ background: 'linear-gradient(135deg, #141e20, #0d1112)' }}>
        {showEmbed && embedUrl ? (
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {thumbnailUrl && (
              <img src={thumbnailUrl} alt="Video thumbnail" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            )}

            {embedUrl ? (
              <button
                onClick={() => setShowEmbed(true)}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: 'rgba(64,225,211,0.15)', border: '2px solid rgba(64,225,211,0.4)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#40e1d3" className="ml-1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 group"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: 'rgba(64,225,211,0.15)', border: '2px solid rgba(64,225,211,0.4)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#40e1d3" className="ml-1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: '#40e1d3' }}>צפייה בסרטון</span>
              </a>
            )}

            {platform !== 'other' && (
              <div
                className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1.5"
                style={{
                  background: platform === 'youtube' ? 'rgba(255,42,77,0.85)' : 'rgba(26,183,234,0.85)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {platform === 'youtube' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                    <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.123C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.012z" />
                  </svg>
                )}
                {platform === 'youtube' ? 'YouTube' : 'Vimeo'}
              </div>
            )}
          </>
        )}
      </div>

      {caption && (
        <p className="mt-3 text-sm" style={{ color: '#a0aab0' }}>{caption}</p>
      )}
    </div>
  );
}
