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
  const [cutoutUrl, setCutoutUrl] = useState<string>(() =>
    processedSmokeCache.get(imageUrl) || '',
  );

  useEffect(() => {
    if (!imageUrl) return;
    const cached = processedSmokeCache.get(imageUrl);
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

      // Crop slightly inward so the watercolor cloud body fills the text backdrop generously
      const sx = Math.round((img.naturalWidth || 960) * 0.12);
      const sy = Math.round((img.naturalHeight || 540) * 0.12);
      const sw = Math.round((img.naturalWidth || 960) * 0.76);
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

          // Radial elliptical feather so outer edges dissolve smoothly into the 3D garden
          const nx = px / w;
          const dx = (nx - 0.5) / 0.48;
          const dy = (ny - 0.5) / 0.46;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radialFade =
            dist >= 1 ? 0 : 1 - Math.pow(Math.max(0, (dist - 0.32) / 0.68), 1.65);

          // Keep watercolor smoke core warm and soft-opaque for effortless typography contrast
          const minC = Math.min(r, g, b);
          const chroma = Math.max(r, g, b) - minC;
          let lumAlpha = 1;
          if (minC > 243 && chroma < 11) {
            lumAlpha = Math.max(0.18, 1 - (minC - 243) / 14);
          }

          a = Math.round(a * radialFade * Math.max(lumAlpha, radialFade * 0.94));
          d[i] = Math.min(255, Math.round(r * 0.8 + 253 * 0.2));
          d[i + 1] = Math.min(255, Math.round(g * 0.8 + 248 * 0.2));
          d[i + 2] = Math.min(255, Math.round(b * 0.8 + 245 * 0.2));
          d[i + 3] = a;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      processedSmokeCache.set(imageUrl, dataUrl);
      if (!cancelled) setCutoutUrl(dataUrl);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return (
    <div className={`relative mx-auto flex items-center justify-center ${className}`}>
      {cutoutUrl ? (
        <img
          src={cutoutUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none select-none w-full h-full object-fill absolute inset-0 scale-125"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,250,247,0.92)_0%,rgba(255,250,247,0.65)_55%,rgba(255,250,247,0)_80%)]"
        />
      )}
      <div
        className={`relative z-10 w-full text-center ${
          compact ? 'px-1.5 py-2.5 sm:px-7 sm:py-4' : 'px-6 py-5 sm:px-10 sm:py-7'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
