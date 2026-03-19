"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, Loader } from "lucide-react";

/* ─── Google Maps API Key ─────────────────────────────────────
   Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file.
   ──────────────────────────────────────────────────────────── */
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/* ─── Types ──────────────────────────────────────────────────── */
interface LocationCoords {
  lat: number;
  lng: number;
}

interface LocationMapPickerProps {
  value: string;                       // Current selected city/locality
  onSelect: (city: string, coords?: LocationCoords) => void;    // Called with city name and optional coordinates
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

/* ─── Load Google Maps script once ───────────────────────────── */
let gmapsLoaded = false;
let gmapsLoading = false;
const gmapsCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (gmapsLoaded && (window as any).google?.maps) {
      resolve();
      return;
    }
    gmapsCallbacks.push(resolve);
    if (gmapsLoading) return;
    gmapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gmapsLoaded = true;
      gmapsCallbacks.forEach((cb) => cb());
      gmapsCallbacks.length = 0;
    };
    script.onerror = () => {
      gmapsLoading = false;
      gmapsCallbacks.forEach((cb) => cb());
      gmapsCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

/* ─── Extract city from Google Place ─────────────────────────── */
function extractCity(place: any): string {
  const comps = place.address_components || [];
  for (const c of comps) {
    if (c.types.includes("locality")) return c.long_name;
  }
  for (const c of comps) {
    if (c.types.includes("administrative_area_level_2")) return c.long_name;
  }
  for (const c of comps) {
    if (c.types.includes("administrative_area_level_1")) return c.long_name;
  }
  return place.name || "";
}

/* ─── Component ──────────────────────────────────────────────── */
export default function LocationMapPicker({
  value,
  onSelect,
  onClear,
  placeholder = "Search location on map…",
  className = "",
}: LocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const previewMapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const previewMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<LocationCoords | null>(null);

  /* Stable ref for onSelect to prevent stale closures in listeners */
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  /* Load Google Maps */
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if ((window as any).google?.maps) {
        setReady(true);
      } else {
        setError(true);
      }
    });
  }, []);

  /* Init search map + autocomplete (when value is NOT set — search mode) */
  useEffect(() => {
    if (!ready || value || !mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    // Don't re-init if already created on same div
    if (mapInstanceRef.current) return;

    const defaultCenter = { lat: 22.5726, lng: 88.3639 }; // Kolkata
    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      map,
      visible: false,
      animation: google.maps.Animation.DROP,
    });
    markerRef.current = marker;

    // Setup Places Autocomplete on search input
    if (searchRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
        types: ["(cities)"],
        componentRestrictions: { country: "in" },
      });
      autocomplete.bindTo("bounds", map);

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        map.setCenter(place.geometry.location);
        map.setZoom(13);
        marker.setPosition(place.geometry.location);
        marker.setVisible(true);

        const city = extractCity(place);
        if (city) {
          setSelectedCoords({ lat, lng });
          onSelectRef.current(city, { lat, lng });
          setSearchText(city);
        }
      });
    }

    // Click on map to pick a location
    map.addListener("click", (e: any) => {
      const latLng = e.latLng;
      marker.setPosition(latLng);
      marker.setVisible(true);

      const lat = latLng.lat();
      const lng = latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results: any, status: any) => {
        if (status === "OK" && results?.[0]) {
          const city = extractCity(results[0]);
          if (city) {
            setSelectedCoords({ lat, lng });
            onSelectRef.current(city, { lat, lng });
            setSearchText(city);
          }
        }
      });
    });
  }, [ready, value]); // No onSelect dependency — use ref instead

  /* Cleanup search map when switching to selected view */
  useEffect(() => {
    if (value) {
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [value]);

  /* Init preview map (when value IS set — selected mode) */
  useEffect(() => {
    if (!ready || !value || !previewMapRef.current || !selectedCoords) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const center = { lat: selectedCoords.lat, lng: selectedCoords.lng };
    const map = new google.maps.Map(previewMapRef.current, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      gestureHandling: "none",
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
    previewMapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      map,
      position: center,
      visible: true,
    });
    previewMarkerRef.current = marker;

    return () => {
      previewMapInstanceRef.current = null;
      previewMarkerRef.current = null;
    };
  }, [ready, value, selectedCoords]);

  /* Handle clear */
  const handleClear = () => {
    setSelectedCoords(null);
    setSearchText("");
    onClear();
  };

  /* If API failed, fall back to simple text search */
  if (error) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Type city name…"
            value={value}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {value && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Map unavailable — type city name manually.
        </p>
      </div>
    );
  }

  /* Selected location chip + preview map */
  if (value) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="border border-brand-200 bg-brand-50/50 rounded-lg px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" />
            <p className="font-semibold text-sm">{value}</p>
          </div>
          <button onClick={handleClear} className="p-1 rounded hover:bg-brand-100">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        {/* Preview map — centered at selected location */}
        {selectedCoords && (
          <div className="rounded-lg overflow-hidden border border-gray-200 h-36" ref={previewMapRef} />
        )}
      </div>
    );
  }

  /* Map + search (no value selected) */
  return (
    <div className={`space-y-2 ${className}`}>
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader className="h-4 w-4 animate-spin" /> Loading map…
        </div>
      ) : (
        <>
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder={placeholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {/* Map */}
          <div className="rounded-lg overflow-hidden border border-gray-200 h-52" ref={mapRef} />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Search or click on map to select a location
          </p>
        </>
      )}
    </div>
  );
}
