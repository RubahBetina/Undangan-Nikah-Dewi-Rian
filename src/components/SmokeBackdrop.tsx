import { useEffect, useState, type ReactNode } from 'react';

interface SmokeBackdropProps {
  imageUrl: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

const processedSmokeCache = new Map<string, string>();

/**
 * Converts a watercolor smoke/cloud image on light paper into a soft transparent
 * organic mist puff (zero rectangular box), keeping a warm cream center for crisp text legibility.
 */
export function SmokeBackdrop({
  imageUrl,
  children,
  className = '',
  compact = false,
}: SmokeBackdropProps) {
  const cacheKey = `v4:${imageUrl}`;
  const [cutoutUrl, setCutoutUrl] = useState<string>(() =>
    processedSmokeCache.get(cacheKey) || '',
  );

  useEffect(() => {
    if (!imageUrl) return;
    const cached = processedSmokeCache.get(cacheKey);
    if (cached) {
      setCutoutUrl(cached);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const w = Math.min(640, img.naturalWidth || 640);
      const h = Math.max(
        2,
        Math.round((w * (img.naturalHeight || 720)) / Math.max(1, img.naturalWidth || 1280)),
      );
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Crop slightly inward so the watercolor cloud body sits generously behind text
      const sx = Math.round((img.naturalWidth || 960) * 0.13);
      const sy = Math.round((img.naturalHeight || 540) * 0.12);
      const sw = Math.round((img.naturalWidth || 960) * 0.74);
      const sh = Math.round((img.naturalHeight || 540) * 0.76);

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      for (let py = 0; py < h; py++) {
        const ny = py / h;
        for (let px = 0; px < w; px++) {
          const i = (py * w + px) * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          let a = d[i + 3];
          if (a === 0) continue;

          const nx = px / w;
          const angle = Math.atan2(ny - 0.5, nx - 0.5);
          const organicWobble =
            0.032 * Math.sin(angle * 3 + 0.7) +
            0.02 * Math.cos(angle * 5 - 1.2) +
            0.012 * Math.sin(angle * 7 + 2.0);

          // Soft rounded-cloud squircle covers corner text ("109 Hari", "36 Detik", etc.) while still fading organically
          const dx = Math.abs(nx - 0.5) / 0.45;
          const dy = Math.abs(ny - 0.5) / 0.45;
          const dist = Math.max(
            0,
            Math.pow(Math.pow(dx, 3.4) + Math.pow(dy, 3.4), 1 / 3.4) + organicWobble,
          );

          const t = Math.min(1, Math.max(0, (dist - 0.64) / 0.33));
          const radialFade = 1 - t * t * (3 - 2 * t);

          // Strict perimeter guard: guarantees smooth fade to exact 0 alpha across the outer 12% on all 4 sides (zero straight lines)
          const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny);
          const e = Math.min(1, Math.max(0, (edgeDist - 0.03) / 0.1));
          const edgeGuard = e * e * (3 - 2 * e);

          const brightness = (r + g + b) / 3;
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          const pigment = Math.min(
            1,
            Math.max(0, (242 - brightness) / 16) + Math.max(0, (chroma - 4) / 12),
          );

          // Balanced translucency (~78–83% in text zone): text stays crisp over dark branches while background softly breathes through
          const mistStrength = Math.max(pigment * 0.85, 0.78);
          a = Math.round(a * Math.min(0.84, mistStrength * radialFade * edgeGuard));

          d[i] = Math.min(255, Math.round(r * 0.8 + 253 * 0.2));
          d[i + 1] = Math.min(255, Math.round(g * 0.8 + 248 * 0.2));
          d[i + 2] = Math.min(255, Math.round(b * 0.8 + 245 * 0.2));
          d[i + 3] = a;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      processedSmokeCache.set(cacheKey, dataUrl);
      if (!cancelled) setCutoutUrl(dataUrl);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [cacheKey, imageUrl]);

  return (
    <div className={`relative mx-auto flex items-center justify-center ${className}`}>
      {cutoutUrl ? (
        <img
          src={cutoutUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className={`pointer-events-none select-none w-full h-full object-fill absolute inset-0 ${
            compact
              ? 'scale-[1.24] sm:scale-[1.28]'
              : 'scale-[1.34] sm:scale-[1.38]'
          }`}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,250,247,0.84)_0%,rgba(255,250,247,0.58)_52%,rgba(255,250,247,0)_76%)]"
        />
      )}
      <div
        className={`relative z-10 w-full text-center [text-shadow:0_1px_14px_rgba(255,250,247,0.95),0_0_4px_rgba(255,250,247,0.9)] ${
          compact
            ? 'px-3 py-2 sm:px-8 sm:py-3 md:px-12 md:py-3.5'
            : 'px-6 py-5 sm:px-10 sm:py-7 md:px-14 md:py-8'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
