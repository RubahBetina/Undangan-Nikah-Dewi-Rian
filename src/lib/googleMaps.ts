export const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function reportGmpQuotaIfExceeded(err: unknown): boolean {
  if (!err) return false;
  const obj = err as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error?: { status?: unknown; code?: unknown; message?: unknown };
  };
  const statusStr = String(obj?.status ?? obj?.error?.status ?? '');
  const codeVal = obj?.code ?? obj?.error?.code;
  const msg =
    err instanceof Error
      ? err.message
      : String(obj?.message ?? obj?.error?.message ?? err);

  const isQuotaError =
    statusStr === 'OVER_QUERY_LIMIT' ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    codeVal === 429 ||
    /OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|OverQuotaMapError|QuotaExceededError|quota exceeded|rateLimitExceeded/i.test(
      msg,
    );

  if (isQuotaError) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}

export function buildGoogleMapsDirectionsUrl(options: {
  venueName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  fallbackUrl?: string;
}): string {
  const { venueName, address, lat, lng, placeId, fallbackUrl } = options;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base;
  }
  const query = [venueName, address].filter(Boolean).join(', ').trim();
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return fallbackUrl || 'https://www.google.com/maps';
}
