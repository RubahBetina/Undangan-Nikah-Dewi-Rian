interface SimpleReq {
  url?: string;
  method?: string;
}

interface SimpleRes {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

function isAllowedGoogleMapsHost(parsed: URL): boolean {
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return pathname.startsWith('/maps');
  if (host === 'maps.google.com' || host === 'g.page') return true;
  if (host === 'www.google.com' || host === 'google.com') {
    return pathname.startsWith('/maps');
  }
  if (host === 'consent.google.com') return true;
  return false;
}

function extractCoordsFromText(raw: string): { lat: number; lng: number } | null {
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // ignore malformed URI sequences
  }

  const isValid = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0);

  for (const text of candidates) {
    const pinMatches = [...text.matchAll(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/g)];
    if (pinMatches.length > 0) {
      const last = pinMatches[pinMatches.length - 1];
      const lat = Number.parseFloat(last[1]);
      const lng = Number.parseFloat(last[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }

    const qMatch = text.match(
      /[?&](?:q|query|ll|center|destination)=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i,
    );
    if (qMatch) {
      const lat = Number.parseFloat(qMatch[1]);
      const lng = Number.parseFloat(qMatch[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }

    const atMatch = text.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
    if (atMatch) {
      const lat = Number.parseFloat(atMatch[1]);
      const lng = Number.parseFloat(atMatch[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }

    // Google Maps HTML meta staticmap / embedded coordinate array fallback
    const staticMapMatch = text.match(
      /maps\.google\.com\/maps\/api\/staticmap\?[^"']*center=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i,
    );
    if (staticMapMatch) {
      const lat = Number.parseFloat(staticMapMatch[1]);
      const lng = Number.parseFloat(staticMapMatch[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }
  }

  return null;
}

export async function resolveGoogleMapsTarget(rawUrl: string): Promise<{
  resolvedUrl: string;
  coords: { lat: number; lng: number } | null;
}> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl.trim());
  } catch {
    throw new Error('Link Google Maps tidak valid.');
  }

  if (!isAllowedGoogleMapsHost(currentUrl)) {
    throw new Error('Hanya tautan resmi Google Maps (maps.app.goo.gl / google.com/maps) yang didukung.');
  }

  const direct = extractCoordsFromText(currentUrl.toString());
  if (direct) {
    return { resolvedUrl: currentUrl.toString(), coords: direct };
  }

  let finalUrl = currentUrl.toString();
  for (let hop = 0; hop < 5; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(finalUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AtelierFleurMapResolver/1.0)',
          'Accept-Language': 'id,en;q=0.9',
        },
      });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        const nextUrl = new URL(location, finalUrl);
        if (!isAllowedGoogleMapsHost(nextUrl)) {
          break;
        }
        finalUrl = nextUrl.toString();
        const coordsFromRedirect = extractCoordsFromText(finalUrl);
        if (coordsFromRedirect) {
          return { resolvedUrl: finalUrl, coords: coordsFromRedirect };
        }
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = (await response.text()).slice(0, 120_000);
        const coordsFromHtml = extractCoordsFromText(html);
        if (coordsFromHtml) {
          return { resolvedUrl: finalUrl, coords: coordsFromHtml };
        }
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    resolvedUrl: finalUrl,
    coords: extractCoordsFromText(finalUrl),
  };
}

export default async function handler(req: SimpleReq, res: SimpleRes): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method && req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const parsedReqUrl = new URL(req.url || '/', 'http://localhost');
  const targetUrl = (parsedReqUrl.searchParams.get('url') || '').trim();
  if (!targetUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Parameter url wajib diisi.' }));
    return;
  }

  try {
    const result = await resolveGoogleMapsTarget(targetUrl);
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Gagal membaca link Google Maps.',
      }),
    );
  }
}
