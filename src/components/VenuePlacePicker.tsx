import { useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { CheckCircle2, MapPin, RotateCcw, Search } from 'lucide-react';
import {
  GMP_ATTRIBUTION_ID,
  buildGoogleMapsDirectionsUrl,
  getGoogleMapsApiKey,
  reportGmpQuotaIfExceeded,
} from '../lib/googleMaps.ts';
import type { WeddingSettings } from '../types/wedding.ts';
import { VenueMapCanvas } from './WeddingVenueMap.tsx';

export interface SelectedPlaceResult {
  venueName: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  mapsUrl: string;
}

interface AutocompleteMountProps {
  onSelectPlace: (place: SelectedPlaceResult) => void;
}

function ImperativePlaceAutocomplete({ onSelectPlace }: AutocompleteMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectPlace);
  const placesLib = useMapsLibrary('places');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    const host = containerRef.current;
    if (!placesLib || !host) return;

    host.replaceChildren();
    const autocomplete = new placesLib.PlaceAutocompleteElement({});
    autocomplete.setAttribute('internal-usage-attribution-ids', GMP_ATTRIBUTION_ID);
    autocomplete.setAttribute(
      'placeholder',
      'Cari nama gedung, hotel, taman, atau desa terdekat di Google Maps...',
    );
    autocomplete.style.width = '100%';
    autocomplete.style.display = 'block';

    const handleSelect = async (event: Event) => {
      const selectEvent = event as unknown as {
        placePrediction?: google.maps.places.PlacePrediction;
      };
      const prediction = selectEvent.placePrediction;
      if (!prediction) return;
      setErrorText(null);
      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI'],
        });
        if (!place.location) {
          setErrorText('Koordinat untuk tempat ini tidak tersedia.');
          return;
        }
        const lat = place.location.lat();
        const lng = place.location.lng();
        const venueName = place.displayName || place.formattedAddress || 'Lokasi Acara';
        const address = place.formattedAddress || venueName;
        const placeId = place.id || '';
        const mapsUrl =
          place.googleMapsURI ||
          buildGoogleMapsDirectionsUrl({
            venueName,
            address,
            lat,
            lng,
            placeId,
          });
        onSelectRef.current({
          venueName,
          address,
          lat,
          lng,
          placeId,
          mapsUrl,
        });
      } catch (err) {
        reportGmpQuotaIfExceeded(err);
        setErrorText('Gagal mengambil detail lokasi dari Google Places.');
      }
    };

    autocomplete.addEventListener('gmp-select', handleSelect);
    host.appendChild(autocomplete);

    return () => {
      autocomplete.removeEventListener('gmp-select', handleSelect);
      host.replaceChildren();
    };
  }, [placesLib]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-[#DFD6D1] bg-white px-1 py-0.5 text-sm shadow-2xs"
      />
      {!placesLib && (
        <p className="text-[11px] text-[#6E5D63]">
          Memuat pencarian lokasi Google Places...
        </p>
      )}
      {errorText && <p className="text-[11px] text-[#8F3A4E]">{errorText}</p>}
    </div>
  );
}

interface VenuePlacePickerProps {
  settings: WeddingSettings;
  onSelectPlace: (place: SelectedPlaceResult) => void;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  onClearPin?: () => void;
}

export function VenuePlacePicker({
  settings,
  onSelectPlace,
  onPickCoords,
  onClearPin,
}: VenuePlacePickerProps) {
  const apiKey = getGoogleMapsApiKey();
  const hasPinnedCoords =
    typeof settings.venueLat === 'number' && typeof settings.venueLng === 'number';

  return (
    <div className="rounded-xl border border-[#EFE8E4] bg-[#FBF8F6] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#C47D8E]" />
          <div>
            <p className="text-xs font-semibold text-[#3A2D32]">
              Cari, Tempel Link, atau Geser Pin Lokasi Acara
            </p>
            <p className="text-[11px] text-[#6E5D63]">
              Untuk acara di rumah pribadi, Anda bisa tempel link Google Maps / koordinat di bawah atau klik langsung di peta.
            </p>
          </div>
        </div>

        {hasPinnedCoords && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3B5B47]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                Pin Terpasang ({settings.venueLat?.toFixed(5)}, {settings.venueLng?.toFixed(5)})
              </span>
            </span>
            {onClearPin && (
              <button
                type="button"
                onClick={onClearPin}
                title="Hapus koordinat pin tersimpan"
                className="inline-flex items-center gap-1 rounded-lg border border-[#DFD6D1] bg-white px-2 py-0.5 text-[10px] font-medium text-[#6E5D63] hover:text-[#8F3A4E] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Pin</span>
              </button>
            )}
          </div>
        )}
      </div>

      {apiKey ? (
        <APIProvider apiKey={apiKey} language="id" region="ID" libraries={['places', 'marker']}>
          <ImperativePlaceAutocomplete onSelectPlace={onSelectPlace} />
          <VenueMapCanvas
            venueName={settings.akadVenue}
            address={settings.akadAddress}
            cityLocation={settings.cityLocation}
            lat={settings.venueLat}
            lng={settings.venueLng}
            placeId={settings.venuePlaceId}
            mapsUrl={settings.mapsUrl}
            heightClass="h-[250px] sm:h-[280px]"
            editable={Boolean(onPickCoords)}
            onPickCoords={onPickCoords}
          />
        </APIProvider>
      ) : (
        <div className="rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2.5 text-xs text-[#6E5D63] flex items-start gap-2.5 leading-relaxed">
          <MapPin className="w-4 h-4 text-[#C47D8E] shrink-0 mt-0.5" />
          <span>
            <strong>Peta Interaktif belum aktif</strong> karena <code className="px-1 py-0.5 rounded bg-[#F5EEEC] text-[#3A2D32]">VITE_GOOGLE_MAPS_API_KEY</code> belum diisi di Environment Variables (Vercel / <code className="px-1 py-0.5 rounded bg-[#F5EEEC] text-[#3A2D32]">.env</code>). Anda tetap bisa mengisi <strong>Link Google Maps</strong> atau <strong>Koordinat (Lat, Lng)</strong> di bawah agar tombol &ldquo;Buka Google Maps&rdquo; mengarah tepat ke lokasi.
          </span>
        </div>
      )}
    </div>
  );
}
