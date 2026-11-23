import type { CSSProperties } from 'react';
import type {
  InvitationFontId,
  TypographySettings,
  TypographySlotConfig,
} from '../types/wedding.ts';

export interface FontOptionMeta {
  id: InvitationFontId;
  label: string;
  category: 'Kaligrafi' | 'Serif Elegan' | 'Sans Modern';
  cssFamily: string;
}

export const FONT_OPTIONS: FontOptionMeta[] = [
  {
    id: 'dancing-script',
    label: 'Dancing Script (Kaligrafi Tegas)',
    category: 'Kaligrafi',
    cssFamily: '"Dancing Script", "Cormorant Garamond", cursive',
  },
  {
    id: 'great-vibes',
    label: 'Great Vibes (Kaligrafi Mewah)',
    category: 'Kaligrafi',
    cssFamily: '"Great Vibes", "Dancing Script", cursive',
  },
  {
    id: 'alex-brush',
    label: 'Alex Brush (Kaligrafi Rapi)',
    category: 'Kaligrafi',
    cssFamily: '"Alex Brush", "Dancing Script", cursive',
  },
  {
    id: 'cormorant-garamond',
    label: 'Cormorant Garamond (Serif Editorial)',
    category: 'Serif Elegan',
    cssFamily: '"Cormorant Garamond", Georgia, serif',
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display (Serif Klasik)',
    category: 'Serif Elegan',
    cssFamily: '"Playfair Display", Georgia, serif',
  },
  {
    id: 'lora',
    label: 'Lora (Serif Hangat & Jelas)',
    category: 'Serif Elegan',
    cssFamily: '"Lora", Georgia, serif',
  },
  {
    id: 'plus-jakarta-sans',
    label: 'Plus Jakarta Sans (Modern Bersih)',
    category: 'Sans Modern',
    cssFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  },
];

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  gateCouple: { font: 'cormorant-garamond', size: 19 },
  gateSubtitle: { font: 'cormorant-garamond', size: 13 },
  weddingOf: { font: 'dancing-script', size: 16 },
  coupleNames: { font: 'dancing-script', size: 24 },
  coupleParents: { font: 'plus-jakarta-sans', size: 10 },
  sectionTitles: { font: 'cormorant-garamond', size: 24 },
  verseQuote: { font: 'cormorant-garamond', size: 18 },
  bodyText: { font: 'plus-jakarta-sans', size: 12 },
  closingTitle: { font: 'dancing-script', size: 36 },
};

export interface TypographySlotMeta {
  key: keyof TypographySettings;
  label: string;
  sceneTag: string;
  sampleText: string;
  minSize: number;
  maxSize: number;
}

export const TYPOGRAPHY_SLOT_META: TypographySlotMeta[] = [
  {
    key: 'gateCouple',
    label: 'Nama Pengantin (Gerbang Depan)',
    sceneTag: 'Gerbang Pembuka',
    sampleText: 'Dimas Arya Pratama & Amara Kirana Putri',
    minSize: 14,
    maxSize: 34,
  },
  {
    key: 'gateSubtitle',
    label: 'Sapaan Tamu & Tombol Gerbang',
    sceneTag: 'Gerbang Pembuka',
    sampleText: 'Kepada Yth. Tamu Undangan · Ketuk untuk Membuka',
    minSize: 10,
    maxSize: 22,
  },
  {
    key: 'weddingOf',
    label: 'Tulisan "The Wedding of"',
    sceneTag: 'Adegan 1',
    sampleText: 'The Wedding of',
    minSize: 12,
    maxSize: 30,
  },
  {
    key: 'coupleNames',
    label: 'Nama Kedua Pengantin',
    sceneTag: 'Adegan 1 & 6',
    sampleText: 'Dimas Arya Pratama & Amara Kirana Putri',
    minSize: 16,
    maxSize: 42,
  },
  {
    key: 'coupleParents',
    label: 'Nama Orang Tua (Putra / Putri dari)',
    sceneTag: 'Adegan 1',
    sampleText: 'Putra Bapak Bambang Pratama & Ibu Sari Dewi',
    minSize: 9,
    maxSize: 18,
  },
  {
    key: 'sectionTitles',
    label: 'Judul Bagian (Ayat, Akad/Resepsi, Lokasi, Gift)',
    sceneTag: 'Adegan 2 – 5',
    sampleText: 'Akad Nikah & Resepsi Taman',
    minSize: 16,
    maxSize: 40,
  },
  {
    key: 'verseQuote',
    label: 'Isi Kutipan Ayat / Doa',
    sceneTag: 'Adegan 2',
    sampleText: 'Dan di antara tanda-tanda kekuasaan-Nya...',
    minSize: 13,
    maxSize: 30,
  },
  {
    key: 'bodyText',
    label: 'Teks Rincian (Jam, Alamat, Pesan Kado & Penutup)',
    sceneTag: 'Adegan 3 – 6',
    sampleText: '08:30 WIB · Glasshouse Conservatory Taman Sari',
    minSize: 10,
    maxSize: 20,
  },
  {
    key: 'closingTitle',
    label: 'Judul Penutup ("Terima Kasih")',
    sceneTag: 'Adegan 6',
    sampleText: 'Terima Kasih',
    minSize: 22,
    maxSize: 56,
  },
];

const VALID_FONT_IDS = new Set<string>(FONT_OPTIONS.map((f) => f.id));

function sanitizeSlot(
  rawSlot: unknown,
  fallback: TypographySlotConfig,
  minSize: number,
  maxSize: number,
): TypographySlotConfig {
  if (!rawSlot || typeof rawSlot !== 'object') {
    return { ...fallback };
  }
  const obj = rawSlot as { font?: unknown; size?: unknown };
  const font =
    typeof obj.font === 'string' && VALID_FONT_IDS.has(obj.font)
      ? (obj.font as InvitationFontId)
      : fallback.font;
  const parsedSize = Number(obj.size);
  const size = Number.isFinite(parsedSize)
    ? Math.min(maxSize, Math.max(minSize, Math.round(parsedSize)))
    : fallback.size;
  return { font, size };
}

export function mergeTypography(raw: unknown): TypographySettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = {} as TypographySettings;
  for (const meta of TYPOGRAPHY_SLOT_META) {
    result[meta.key] = sanitizeSlot(
      src[meta.key],
      DEFAULT_TYPOGRAPHY[meta.key],
      meta.minSize,
      meta.maxSize,
    );
  }
  return result;
}

export function getFontCssFamily(fontId: InvitationFontId | undefined): string {
  const found = FONT_OPTIONS.find((f) => f.id === fontId);
  return found ? found.cssFamily : FONT_OPTIONS[0].cssFamily;
}

/**
 * Produces CSS fontFamily + smooth responsive fontSize anchored to `slot.size` px on mobile,
 * scaling gently on desktop up to `desktopMultiplier`x.
 */
export function getSlotTextStyle(
  slot: TypographySlotConfig | undefined,
  fallback: TypographySlotConfig,
  scaleFactor = 1,
  desktopMultiplier = 1.32,
): CSSProperties {
  const active = slot || fallback;
  const basePx = Math.max(8, Math.round(active.size * scaleFactor));
  const maxPx = Math.max(basePx, Math.round(basePx * desktopMultiplier));
  const fluidBase = Math.round(basePx * 0.85 * 10) / 10;
  return {
    fontFamily: getFontCssFamily(active.font),
    fontSize:
      maxPx === basePx
        ? `${basePx}px`
        : `clamp(${basePx}px, calc(${fluidBase}px + 0.9vw), ${maxPx}px)`,
  };
}
