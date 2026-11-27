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
} from '@vis.gl/react-google-maps';
import { MapPin, Wind } from 'lucide-react';
import type { EnvironmentalSnapshot } from '../../types/domain';

interface AirQualityMapProps {
  snapshot: EnvironmentalSnapshot;
  userCoords?: { latitude: number; longitude: number } | null;
  heightClassName?: string;
}

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

function MapCameraSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);
  return null;
}

function AirQualityMapInner({ snapshot, userCoords }: AirQualityMapProps) {
  const status = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const { city, region, country, latitude, longitude } = snapshot.location;

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <MapPin className="w-5 h-5 text-amber-600" aria-hidden="true" />
        <p className="font-medium text-slate-900 dark:text-white">
          Interactive map unavailable for {city}
        </p>
        <p>
          Coordinates {latitude.toFixed(4)}, {longitude.toFixed(4)} · AQI {snapshot.aqi.aqi} ({snapshot.aqi.category})
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={{ lat: latitude, lng: longitude }}
      defaultZoom={11}
      gestureHandling="cooperative"
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      className="w-full h-full"
    >
      <MapCameraSync lat={latitude} lng={longitude} />

      <AdvancedMarker
        ref={markerRef}
        position={{ lat: latitude, lng: longitude }}
        onClick={() => setInfoOpen((prev) => !prev)}
        title={`${city} Air Quality (${snapshot.aqi.aqi} ${snapshot.aqi.category})`}
      >
        <Pin
          background={snapshot.aqi.colorHex}
          borderColor="#0F172A"
          glyphColor="#FFFFFF"
          scale={1.15}
        />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)} maxWidth={260}>
          <div className="text-slate-900 space-y-1 p-0.5">
            <div className="font-semibold text-xs">
              {city}{region ? `, ${region}` : ''}{country ? ` · ${country}` : ''}
            </div>
            <div className="text-xs font-medium">
              AQI {snapshot.aqi.aqi} ({snapshot.aqi.category} · {snapshot.standard === 'INDIA_NAQI' ? 'India NAQI' : 'US EPA'})
            </div>
            <div className="text-[11px] text-slate-600">
              PM2.5: {snapshot.pollutants.pm25 ?? '--'} µg/m³ · Wind: {snapshot.weather.windSpeedKmh ?? '--'} km/h
            </div>
          </div>
        </InfoWindow>
      )}

      {userCoords && (
        <AdvancedMarker
          position={{ lat: userCoords.latitude, lng: userCoords.longitude }}
          title="Your current browser location"
        >
          <Pin background="#0D9488" borderColor="#134E4A" glyphColor="#FFFFFF" scale={0.95} />
        </AdvancedMarker>
      )}
    </GoogleMap>
  );
}

export function AirQualityMap({
  snapshot,
  userCoords,
  heightClassName = 'h-80 sm:h-96',
}: AirQualityMapProps) {
  const { city, country, latitude, longitude } = snapshot.location;

  if (!MAPS_API_KEY) {
    return (
      <div
        className={`${heightClassName} w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-2`}
      >
        <Wind className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {city}{country ? `, ${country}` : ''} · {latitude.toFixed(3)}, {longitude.toFixed(3)}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
          Interactive Google Map renders here when VITE_GOOGLE_MAPS_API_KEY is configured in the environment.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${heightClassName} w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950`}
    >
      <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="en">
        <AirQualityMapInner key={`${city}-${latitude}-${longitude}`} snapshot={snapshot} userCoords={userCoords} />
      </APIProvider>
    </div>
  );
}
