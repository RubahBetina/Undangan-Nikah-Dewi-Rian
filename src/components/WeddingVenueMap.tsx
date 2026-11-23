import { useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
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
  reportGmpQuotaIfExceeded,
} from '../lib/googleMaps.ts';
import type { WeddingSettings } from '../types/wedding.ts';

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
  onResolvedLocation,
}: VenueMapCanvasProps) {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();
  const placesLib = useMapsLibrary('places');
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const [searchedLoc, setSearchedLoc] = useState<ResolvedVenueLocation | null>(null);
  const [searching, setSearching] = useState(false);

  const hasExplicitCoords = typeof lat === 'number' && typeof lng === 'number';
  const activeLoc: ResolvedVenueLocation | null = hasExplicitCoords
    ? { lat: lat as number, lng: lng as number, placeId }
    : searchedLoc;

  // Dispatch Tier 2 quota notification if Maps JS API fails auth
  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [loadingStatus]);

  // Dynamically resolve coordinates from Places API (New) when admin hasn't pinned a place yet
  useEffect(() => {
    if (hasExplicitCoords || !placesLib) return;
    let cancelled = false;

    const resolveFromPlaces = async () => {
      setSearching(true);
      const queries = [
        [venueName, address].filter(Boolean).join(', ').trim(),
        address.trim(),
        cityLocation.trim(),
      ].filter((q, idx, arr) => Boolean(q) && arr.indexOf(q) === idx);

      try {
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

    void resolveFromPlaces();
    return () => {
      cancelled = true;
    };
  }, [hasExplicitCoords, placesLib, venueName, address, cityLocation, onResolvedLocation]);

  // Smoothly pan map when coordinates change (e.g., admin selects a different venue)
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

  if (!activeLoc) {
    return (
      <div
        className={`${heightClass} w-full rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] flex flex-col items-center justify-center p-6 text-center space-y-2`}
      >
        <MapPin className="w-6 h-6 text-[#C47D8E] animate-pulse" />
        <p className="text-xs text-[#6E5D63]">
          {searching
            ? 'Menentukan titik lokasi acara di Google Maps...'
            : 'Memuat peta interaktif Google Maps...'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${heightClass} w-full rounded-2xl overflow-hidden border border-[#E6DFDB] bg-[#F4EFEA] relative`}
    >
      <GoogleMap
        defaultCenter={{ lat: activeLoc.lat, lng: activeLoc.lng }}
        defaultZoom={15}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl
        internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker
          ref={markerRef}
          position={{ lat: activeLoc.lat, lng: activeLoc.lng }}
          title={venueName}
          onClick={() => setInfoOpen(true)}
        >
          <Pin
            background="#C47D8E"
            borderColor="#8F4A5B"
            glyphColor="#FFFFFF"
            scale={1.15}
          />
        </AdvancedMarker>

        {infoOpen && marker && (
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
