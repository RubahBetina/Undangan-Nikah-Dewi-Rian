export interface ParsedCoordinates {
  lat: number;
  lng: number;
}

function isValidLatLng(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Extracts latitude/longitude coordinates from either:
 * - A direct coordinate pair like "-7.321456, 108.354321"
 * - A full Google Maps URL containing !3d...!4d..., ?q=lat,lng, ll=lat,lng, or /@lat,lng
 */
export function parseCoordsFromGoogleMapsInput(rawInput: string): ParsedCoordinates | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  // 1. Direct coordinate pair: "-7.32145, 108.35432" or "(-7.32145, 108.35432)"
  const directMatch = trimmed.match(
    /^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/,
  );
  if (directMatch) {
    const lat = Number.parseFloat(directMatch[1]);
    const lng = Number.parseFloat(directMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const candidates = [trimmed, safeDecode(trimmed)];

  for (const text of candidates) {
    // 2. Exact Google Maps place pin coordinates (!3dLAT!4dLNG) — most accurate in /place/ URLs
    const dataPinMatches = [...text.matchAll(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/g)];
    if (dataPinMatches.length > 0) {
      const last = dataPinMatches[dataPinMatches.length - 1];
      const lat = Number.parseFloat(last[1]);
      const lng = Number.parseFloat(last[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 3. Query string parameters: ?q=lat,lng, &query=lat,lng, &ll=lat,lng, &center=lat,lng, &destination=lat,lng
    const queryCoordMatch = text.match(
      /[?&](?:q|query|ll|center|destination|daddr|saddr|viewpoint)=(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
    );
    if (queryCoordMatch) {
      const lat = Number.parseFloat(queryCoordMatch[1]);
      const lng = Number.parseFloat(queryCoordMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 4. /search/lat,lng or /place/lat,lng path pattern
    const pathCoordMatch = text.match(
      /\/(?:search|place)\/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
    );
    if (pathCoordMatch) {
      const lat = Number.parseFloat(pathCoordMatch[1]);
      const lng = Number.parseFloat(pathCoordMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }

    // 5. Viewport @lat,lng pattern (e.g., https://www.google.com/maps/@-7.321,108.354,17z)
    const atMatch = text.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
    if (atMatch) {
      const lat = Number.parseFloat(atMatch[1]);
      const lng = Number.parseFloat(atMatch[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

export function isShortGoogleMapsUrl(rawUrl: string): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && parsed.pathname.toLowerCase().startsWith('/maps'))
    );
  } catch {
    return false;
  }
}

export async function resolveGoogleMapsUrlCoords(
  rawUrl: string,
): Promise<{ lat: number; lng: number; resolvedUrl?: string } | null> {
  const direct = parseCoordsFromGoogleMapsInput(rawUrl);
  if (direct) {
    return { ...direct, resolvedUrl: rawUrl.trim() };
  }

  const trimmed = (rawUrl || '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;

  try {
    const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      resolvedUrl?: string;
      coords?: { lat: number; lng: number } | null;
    };
    if (data.coords && isValidLatLng(data.coords.lat, data.coords.lng)) {
      return {
        lat: data.coords.lat,
        lng: data.coords.lng,
        resolvedUrl: data.resolvedUrl || trimmed,
      };
    }
    if (data.resolvedUrl) {
      const parsed = parseCoordsFromGoogleMapsInput(data.resolvedUrl);
      if (parsed) {
        return { ...parsed, resolvedUrl: data.resolvedUrl };
      }
    }
  } catch {
    // Graceful fallback if serverless resolver is unavailable
  }

  return null;
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

  // 1. Explicit pinned coordinates (most accurate)
  if (typeof lat === 'number' && typeof lng === 'number' && isValidLatLng(lat, lng)) {
    const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base;
  }

  // 2. Explicit Google Maps URL pasted by admin (takes priority over text search)
  const trimmedFallback = (fallbackUrl || '').trim();
  if (trimmedFallback && /^https?:\/\//i.test(trimmedFallback)) {
    const parsedFromUrl = parseCoordsFromGoogleMapsInput(trimmedFallback);
    if (parsedFromUrl) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${parsedFromUrl.lat},${parsedFromUrl.lng}`)}`;
    }
    return trimmedFallback;
  }

  // 3. Fallback text search only if neither coordinates nor mapsUrl was provided
  const query = [venueName, address].filter(Boolean).join(', ').trim();
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return 'https://www.google.com/maps';
}
