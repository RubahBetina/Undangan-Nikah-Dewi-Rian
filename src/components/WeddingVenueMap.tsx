import { useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  type MapMouseEvent,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation, X } from 'lucide-react';
import {
  GMP_ATTRIBUTION_ID,
  buildGoogleMapsDirectionsUrl,
  getGoogleMapsApiKey,
  isShortGoogleMapsUrl,
  parseCoordsFromGoogleMapsInput,
  reportGmpQuotaIfExceeded,
  resolveGoogleMapsUrlCoords,
} from '../lib/googleMaps.ts';
import type { WeddingSettings } from '../types/wedding.ts';

const DEFAULT_SEED_MAPS_URL = 'https://maps.google.com/?q=Dago+Pakar+Bandung';

interface ResolvedVenueLocation {
  lat: number;
  lng: number;
  placeId?: string;
  resolvedLabel?: string;
}

interface VenueMapCanvasProps {
  venueName: string;
  address: string;
  cityLocation: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  mapsUrl?: string;
  heightClass?: string;
  editable?: boolean;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  onResolvedLocation?: (loc: ResolvedVenueLocation) => void;
}

export function VenueMapCanvas({
  venueName,
  address,
  cityLocation,
  lat,
  lng,
  placeId,
  mapsUrl,
  heightClass = 'h-[340px] sm:h-[400px]',
  editable = false,
  onPickCoords,
  onResolvedLocation,
}: VenueMapCanvasProps) {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();
  const placesLib = useMapsLibrary('places');
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const [searchedLoc, setSearchedLoc] = useState<ResolvedVenueLocation | null>(null);
  const [searching, setSearching] = useState(false);

  const hasExplicitCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const parsedUrlCoords = !hasExplicitCoords
    ? parseCoordsFromGoogleMapsInput(mapsUrl || '')
    : null;

  const activeLoc: ResolvedVenueLocation | null = hasExplicitCoords
    ? { lat: lat as number, lng: lng as number, placeId }
    : parsedUrlCoords
      ? { lat: parsedUrlCoords.lat, lng: parsedUrlCoords.lng }
      : searchedLoc;

  // Dispatch Tier 2 quota notification if Maps JS API fails auth
  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [loadingStatus]);

  // Reset cached searchedLoc whenever explicit coords or custom mapsUrl changes
  useEffect(() => {
    setSearchedLoc(null);
  }, [lat, lng, mapsUrl]);

  // Resolve coordinates accurately:
  // 1) Try resolving short Google Maps links (maps.app.goo.gl / goo.gl/maps) first.
  // 2) Only fall back to Places Text Search when NO custom mapsUrl was entered (prevents
  //    private names like "Rumah Mempelai Wanita" from snapping to random public places).
  useEffect(() => {
    if (hasExplicitCoords || parsedUrlCoords) return;

    const trimmedMapsUrl = (mapsUrl || '').trim();
    const hasCustomMapsUrl =
      Boolean(trimmedMapsUrl) &&
      /^https?:\/\//i.test(trimmedMapsUrl) &&
      trimmedMapsUrl !== DEFAULT_SEED_MAPS_URL;

    let cancelled = false;

    const resolveLocation = async () => {
      setSearching(true);
      try {
        if (hasCustomMapsUrl && isShortGoogleMapsUrl(trimmedMapsUrl)) {
          const resolved = await resolveGoogleMapsUrlCoords(trimmedMapsUrl);
          if (cancelled) return;
          if (resolved) {
            const loc: ResolvedVenueLocation = {
              lat: resolved.lat,
              lng: resolved.lng,
              resolvedLabel: venueName,
            };
            setSearchedLoc(loc);
            onResolvedLocation?.(loc);
            return;
          }
        }

        // Do NOT guess coordinates from text when admin pasted a custom Google Maps link!
        if (hasCustomMapsUrl) {
          return;
        }

        if (!placesLib) return;
        const queries = [
          [venueName, address].filter(Boolean).join(', ').trim(),
          address.trim(),
          cityLocation.trim(),
        ].filter((q, idx, arr) => Boolean(q) && arr.indexOf(q) === idx);

        for (const textQuery of queries) {
          if (cancelled) return;
          const { places } = await placesLib.Place.searchByText({
            textQuery,
            fields: ['id', 'displayName', 'formattedAddress', 'location'],
            language: 'id',
            region: 'id',
            maxResultCount: 1,
          });
          const first = places?.[0];
          if (first?.location) {
            const loc: ResolvedVenueLocation = {
              lat: first.location.lat(),
              lng: first.location.lng(),
              placeId: first.id,
              resolvedLabel: first.displayName || first.formattedAddress || venueName,
            };
            if (!cancelled) {
              setSearchedLoc(loc);
              onResolvedLocation?.(loc);
            }
            return;
          }
        }
      } catch (err) {
        reportGmpQuotaIfExceeded(err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    void resolveLocation();
    return () => {
      cancelled = true;
    };
  }, [
    hasExplicitCoords,
    parsedUrlCoords?.lat,
    parsedUrlCoords?.lng,
    placesLib,
    mapsUrl,
    venueName,
    address,
    cityLocation,
    onResolvedLocation,
  ]);

  // Smoothly pan map when coordinates change (e.g., admin selects or pastes a different venue)
  useEffect(() => {
    if (!map || !activeLoc) return;
    map.panTo({ lat: activeLoc.lat, lng: activeLoc.lng });
  }, [map, activeLoc?.lat, activeLoc?.lng]);

  const directionsHref = buildGoogleMapsDirectionsUrl({
    venueName,
    address,
    lat: activeLoc?.lat,
    lng: activeLoc?.lng,
    placeId: activeLoc?.placeId || placeId,
    fallbackUrl: mapsUrl,
  });

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div
        className={`${heightClass} w-full rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] flex flex-col items-center justify-center p-6 text-center space-y-3`}
      >
        <MapPin className="w-7 h-7 text-[#C47D8E]" />
        <div className="space-y-1">
          <p className="font-display text-xl font-bold text-[#3A2D32]">{venueName}</p>
          <p className="text-xs text-[#6E5D63] max-w-xs mx-auto">{address}</p>
        </div>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D]"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Buka di Google Maps</span>
        </a>
      </div>
    );
  }

  if (!activeLoc && !editable) {
    return (
      <div
        className={`${heightClass} w-full rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] flex flex-col items-center justify-center p-6 text-center space-y-3`}
      >
        <MapPin className={`w-6 h-6 text-[#C47D8E] ${searching ? 'animate-pulse' : ''}`} />
        {searching ? (
          <p className="text-xs text-[#6E5D63]">
            Menentukan titik lokasi acara dari Google Maps...
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="font-display text-xl font-bold text-[#3A2D32]">{venueName}</p>
              <p className="text-xs text-[#6E5D63] max-w-xs mx-auto">{address}</p>
            </div>
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D]"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Buka Lokasi di Google Maps</span>
            </a>
          </>
        )}
      </div>
    );
  }

  const initialCenter = activeLoc
    ? { lat: activeLoc.lat, lng: activeLoc.lng }
    : { lat: -6.9175, lng: 107.6191 };

  const handleMapClick = (ev: MapMouseEvent) => {
    if (!editable || !onPickCoords) return;
    const latLng = ev.detail.latLng;
    if (latLng) {
      onPickCoords({ lat: latLng.lat, lng: latLng.lng });
    }
  };

  return (
    <div
      className={`${heightClass} w-full rounded-2xl overflow-hidden border border-[#E6DFDB] bg-[#F4EFEA] relative`}
    >
      <GoogleMap
        defaultCenter={initialCenter}
        defaultZoom={activeLoc ? 16 : 11}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl
        onClick={editable ? handleMapClick : undefined}
        internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
        style={{ width: '100%', height: '100%' }}
      >
        {activeLoc && (
          <AdvancedMarker
            ref={markerRef}
            position={{ lat: activeLoc.lat, lng: activeLoc.lng }}
            title={venueName}
            draggable={editable}
            onClick={() => setInfoOpen(true)}
            onDragEnd={(e: google.maps.MapMouseEvent) => {
              if (!editable || !onPickCoords || !e.latLng) return;
              onPickCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }}
          >
            <Pin
              background="#C47D8E"
              borderColor="#8F4A5B"
              glyphColor="#FFFFFF"
              scale={1.15}
            />
          </AdvancedMarker>
        )}

        {!editable && infoOpen && marker && (
          <InfoWindow
            anchor={marker}
            maxWidth={240}
            onCloseClick={() => setInfoOpen(false)}
          >
            <div className="p-1 text-[#3A2D32] space-y-1">
              <p className="font-display text-base font-bold leading-tight text-[#3A2D32]">
                {venueName}
              </p>
              <p className="text-[11px] text-[#6E5D63] leading-snug">{address}</p>
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C47D8E] hover:underline pt-1"
              >
                <span>Buka Rute Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {editable && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 flex justify-center">
          <span className="rounded-lg bg-white/95 border border-[#E6DFDB] px-2.5 py-1 text-[10px] font-medium text-[#3A2D32] shadow-xs">
            {activeLoc
              ? 'Klik area peta atau geser pin pink untuk meluruskan titik rumah/gedung.'
              : 'Klik langsung di peta untuk menandai titik lokasi acara.'}
          </span>
        </div>
      )}
    </div>
  );
}

interface InteractiveVenueMapProps {
  settings: WeddingSettings;
  heightClass?: string;
}

export function InteractiveVenueMap({
  settings,
  heightClass = 'h-[340px] sm:h-[400px]',
}: InteractiveVenueMapProps) {
  const apiKey = getGoogleMapsApiKey();
  const directionsHref = buildGoogleMapsDirectionsUrl({
    venueName: settings.akadVenue,
    address: settings.akadAddress,
    lat: settings.venueLat,
    lng: settings.venueLng,
    placeId: settings.venuePlaceId,
    fallbackUrl: settings.mapsUrl,
  });

  if (!apiKey) {
    return (
      <div
        className={`${heightClass} w-full rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] flex flex-col items-center justify-center p-6 text-center space-y-3`}
      >
        <MapPin className="w-7 h-7 text-[#C47D8E]" />
        <div className="space-y-1">
          <p className="font-display text-xl font-bold text-[#3A2D32]">
            {settings.akadVenue}
          </p>
          <p className="text-xs text-[#6E5D63] max-w-xs mx-auto">
            {settings.akadAddress}
          </p>
        </div>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D]"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Buka Google Maps</span>
        </a>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="id" region="ID" libraries={['places', 'marker']}>
      <VenueMapCanvas
        venueName={settings.akadVenue}
        address={settings.akadAddress}
        cityLocation={settings.cityLocation}
        lat={settings.venueLat}
        lng={settings.venueLng}
        placeId={settings.venuePlaceId}
        mapsUrl={settings.mapsUrl}
        heightClass={heightClass}
      />
    </APIProvider>
  );
}

interface WeddingVenueMapModalProps {
  open: boolean;
  onClose: () => void;
  settings: WeddingSettings;
}

export function WeddingVenueMapModal({
  open,
  onClose,
  settings,
}: WeddingVenueMapModalProps) {
  if (!open) return null;

  const directionsHref = buildGoogleMapsDirectionsUrl({
    venueName: settings.akadVenue,
    address: settings.akadAddress,
    lat: settings.venueLat,
    lng: settings.venueLng,
    placeId: settings.venuePlaceId,
    fallbackUrl: settings.mapsUrl,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-[#3A2D32]/50"
      role="dialog"
      aria-modal="true"
      aria-label="Peta Lokasi Acara Google Maps"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B8E78]">
              Lokasi Acara
            </p>
            <h3 className="font-display text-2xl font-bold text-[#3A2D32] leading-tight mt-0.5">
              {settings.akadVenue}
            </h3>
            <p className="text-xs text-[#6E5D63] mt-1">{settings.akadAddress}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup peta lokasi"
            className="p-1.5 rounded-lg text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <InteractiveVenueMap settings={settings} heightClass="h-[320px] sm:h-[380px]" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-[#6E5D63]">
            Geser atau perbesar peta untuk melihat rute menuju lokasi acara.
          </p>
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D] whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Buka Rute Google Maps</span>
          </a>
        </div>
      </div>
    </div>
  );
}
