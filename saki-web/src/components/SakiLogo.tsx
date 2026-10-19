import { useId } from 'react';

interface Props {
  size?: number;
  animated?: boolean;
}

/** Five-bar voice glyph used as Saki's mark. */
export function SakiLogo({ size = 32, animated = false }: Props) {
  // Unique per instance: a shared id breaks when the first logo on the page is hidden.
  const gradientId = `saki-logo-${useId().replace(/:/g, '')}`;
  const bars = [
    { x: 14, h: 12 },
    { x: 23, h: 28 },
    { x: 32, h: 20 },
    { x: 41, h: 36 },
    { x: 50, h: 10 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      {bars.map((bar, i) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={32 - bar.h / 2}
          width={i === 4 ? 4 : 5}
          height={bar.h}
          rx={2.5}
          fill="#0b0f17"
          className={animated ? 'animate-bar' : undefined}
          style={animated ? { transformOrigin: `${bar.x}px 32px`, animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </svg>
  );
}
