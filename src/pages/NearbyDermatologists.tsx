import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default leaflet marker assets for clinic markers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Custom pin for the USER location
import userPin from "@/assets/google-pin.png";

function setupLeafletIcons() {
  // Keep default icon for clinic markers
  try {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  } catch {
    // ignore if bundler can't resolve above in non-standard env
  }
}

type PlaceItem = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  source: "google" | "osm";
  phone?: string;
  mapsUrl?: string;
  rating?: number;
  userRatingCount?: number;
};

// Read keys from .env (frontend-safe). Ensure Places API is enabled and key is referrer-restricted.
const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

// City‑wide search strategy (meters). We escalate until we get results.
const CITY_RADIUS_STEPS = [40000, 60000, 80000, 100000]; // 40km → 60km → 80km → 100km

const NearbyDermatologists = () => {
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRadius, setActiveRadius] = useState<number>(CITY_RADIUS_STEPS[0]);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const placeLayerRef = useRef<L.LayerGroup | null>(null);

  // Custom icon for the user’s current location (Google-style pin)
  const userIcon = L.icon({
    iconUrl: userPin,
    iconRetinaUrl: userPin,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
    shadowUrl: markerShadow,
    shadowSize: [41, 41],
    shadowAnchor: [13, 41],
  });

  useEffect(() => {
    setupLeafletIcons();

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser.");
      setError("Geolocation not supported by this browser.");
      setLoading(false);
      return;
    }

    const geoSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const c = { lat: latitude, lon: longitude };
      setCoords(c);
      initMap(c.lat, c.lon, accuracy || 50);
      void loadNearbyEscalating(c.lat, c.lon);
    };

    const geoError = () => {
      toast.error("Location access denied or unavailable.");
      setError("Location access denied or unavailable.");
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(geoSuccess, geoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 12_000,
    });

    // Keep the user's location marker visible/fresh
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
        updateUserMarker(latitude, longitude, accuracy || 50);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap(lat: number, lon: number, accuracy: number) {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        center: [lat, lon],
        zoom: 13,
        zoomControl: true,
      });

      // OSM tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstance.current);

      // Recenter control
      const Recenter = L.Control.extend({
        onAdd: () => {
          const btn = L.DomUtil.create("button", "leaflet-bar");
          btn.style.width = "34px";
          btn.style.height = "34px";
          btn.style.cursor = "pointer";
          btn.title = "Recenter on my location";
          btn.innerHTML = "⌖";
          btn.onclick = () => {
            if (coords && mapInstance.current) {
              mapInstance.current.setView([coords.lat, coords.lon], 14);
              if (userMarkerRef.current) userMarkerRef.current.openPopup();
            }
          };
          return btn;
        },
        onRemove: () => {},
      });
      new Recenter({ position: "topleft" }).addTo(mapInstance.current);

      // Layer for clinic pins
      placeLayerRef.current = L.layerGroup().addTo(mapInstance.current);
    }

    // Add/Update user marker and accuracy circle
    updateUserMarker(lat, lon, accuracy);
  }

  function updateUserMarker(lat: number, lon: number, accuracy: number) {
    if (!mapInstance.current) return;

    const pos = L.latLng(lat, lon);

    // Create or move the user marker
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(pos, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(mapInstance.current)
        .bindPopup(`<b>You are here</b><br/>Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`, { closeButton: true });
    } else {
      userMarkerRef.current.setLatLng(pos);
    }

    // Accuracy circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(pos, {
        radius: Math.max(accuracy, 25),
        color: "#0ea5e9",
        fillColor: "#0ea5e9",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(mapInstance.current);
    } else {
      accuracyCircleRef.current.setLatLng(pos).setRadius(Math.max(accuracy, 25));
    }
  }

  // ----------------------------- Places fetching -----------------------------

  // Nearby search (distance-ranked). Radius param is dynamic.
  const fetchPlacesV1Nearby = async (lat: number, lon: number, radius: number): Promise<PlaceItem[]> => {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const url = "https://places.googleapis.com/v1/places:searchNearby";
      const body = {
        // 'dermatologist' is not a standalone primary type in v1; use doctor/medical and then filter names
        includedTypes: ["doctor", "medical_clinic"],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius,
          },
        },
        languageCode: "en",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.location",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.googleMapsUri",
            "places.rating",
            "places.userRatingCount",
          ].join(","),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) return [];
      const data = await res.json();

      const places = (data.places ?? [])
        .map((pl: any): PlaceItem | null => {
          const loc = pl.location;
          const nm = pl.displayName?.text || "Clinic";
          if (!loc?.latitude || !loc?.longitude) return null;
          const phone: string | undefined =
            pl.nationalPhoneNumber || pl.internationalPhoneNumber || undefined;
          return {
            id: pl.id || `${loc.latitude}_${loc.longitude}_${nm}`,
            name: nm,
            lat: loc.latitude,
            lon: loc.longitude,
            address: pl.formattedAddress || "Address not available",
            source: "google",
            phone,
            mapsUrl: pl.googleMapsUri || undefined,
            rating: typeof pl.rating === "number" ? pl.rating : undefined,
            userRatingCount: typeof pl.userRatingCount === "number" ? pl.userRatingCount : undefined,
          };
        })
        .filter(Boolean) as PlaceItem[];

      // Prefer obvious dermatology hits
      const dermPreferred = places.filter((p) => /derm|skin/i.test(p.name));
      return dermPreferred.length ? dermPreferred : places;
    } catch {
      return [];
    }
  };

  // Text search — query "Nearest Dermatologists". Radius param via locationBias.
  const fetchPlacesV1Text = async (lat: number, lon: number, radius: number): Promise<PlaceItem[]> => {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const url = "https://places.googleapis.com/v1/places:searchText";
      const body = {
        textQuery: "Nearest Dermatologists",
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius,
          },
        },
        languageCode: "en",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.location",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.googleMapsUri",
            "places.rating",
            "places.userRatingCount",
          ].join(","),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) return [];
      const data = await res.json();

      const places = (data.places ?? [])
        .map((pl: any): PlaceItem | null => {
          const loc = pl.location;
          const nm = pl.displayName?.text || "Clinic";
          if (!loc?.latitude || !loc?.longitude) return null;
          const phone: string | undefined =
            pl.nationalPhoneNumber || pl.internationalPhoneNumber || undefined;
          return {
            id: pl.id || `${loc.latitude}_${loc.longitude}_${nm}`,
            name: nm,
            lat: loc.latitude,
            lon: loc.longitude,
            address: pl.formattedAddress || "Address not available",
            source: "google",
            phone,
            mapsUrl: pl.googleMapsUri || undefined,
            rating: typeof pl.rating === "number" ? pl.rating : undefined,
            userRatingCount: typeof pl.userRatingCount === "number" ? pl.userRatingCount : undefined,
          };
        })
        .filter(Boolean) as PlaceItem[];

      const dermPreferred = places.filter((p) => /derm|skin/i.test(p.name));
      return dermPreferred.length ? dermPreferred : places;
    } catch {
      return [];
    }
  };

  // Escalate radius city‑wide until we find results
  async function loadNearbyEscalating(lat: number, lon: number) {
    setLoading(true);
    setError(null);
    try {
      let found: PlaceItem[] = [];
      let chosen = CITY_RADIUS_STEPS[0];

      for (const r of CITY_RADIUS_STEPS) {
        const [nearby, text] = await Promise.all([
          fetchPlacesV1Nearby(lat, lon, r),
          fetchPlacesV1Text(lat, lon, r),
        ]);
        const all = [...nearby, ...text];
        const unique = Array.from(
          new Map(
            all.map((p) => [p.id || `${p.name}_${p.lat.toFixed(5)}_${p.lon.toFixed(5)}`, p])
          ).values()
        );
        if (unique.length > 0) {
          found = unique;
          chosen = r;
          break;
        }
      }

      setActiveRadius(chosen);
      setPlaces(found);
      plotPlaces(found);
    } catch {
      setError("Failed to fetch nearby clinics");
    } finally {
      setLoading(false);
    }
  }

  function plotPlaces(items: PlaceItem[]) {
    if (!mapInstance.current) return;

    // Clear previous pins (keep user marker)
    if (placeLayerRef.current) {
      placeLayerRef.current.clearLayers();
    } else {
      placeLayerRef.current = L.layerGroup().addTo(mapInstance.current);
    }

    // Bounds should always include the user's location so their pin is visible
    const bounds = L.latLngBounds([]);

    if (coords) bounds.extend([coords.lat, coords.lon]);

    items.forEach((p) => {
      const m = L.marker([p.lat, p.lon]);
      const rating = typeof p.rating === "number" ? `⭐ ${p.rating} (${p.userRatingCount || 0})` : "";
      const phone = p.phone ? `<br/>📞 ${p.phone}` : "";
      const mapsLink = p.mapsUrl
        ? `<br/><a href="${p.mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>`
        : "";
      m.bindPopup(`<b>${p.name}</b><br/>${p.address}${phone}<br/>${rating}${mapsLink}`);
      m.addTo(placeLayerRef.current!);

      bounds.extend([p.lat, p.lon]);
    });

    if (!bounds.isValid()) {
      // No places yet; keep user in view
      if (coords) mapInstance.current.setView([coords.lat, coords.lon], 14);
    } else {
      mapInstance.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }

  const km = (activeRadius / 1000).toFixed(0);

  const openLargerMapHref = coords
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        "Nearest Dermatologists"
      )}/@${coords.lat},${coords.lon},12z`
    : `https://www.google.com/maps/search/${encodeURIComponent("Nearest Dermatologists")}`;

  // ----------------------------- Render -----------------------------

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-6xl">
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Nearby Dermatologists
          </h1>
          <p className="text-muted-foreground">
            Find dermatologists and skin care clinics near your current location.
          </p>
        </div>

        {/* Single Leaflet map with user's location ALWAYS visible and clinic markers */}
        <div className="relative rounded-xl overflow-hidden border bg-card">
          {/* View larger map link anchored to Google with the updated query */}
          {coords && (
            <a
              href={openLargerMapHref}
              target="_blank"
              rel="noopener"
              className="absolute left-2 top-2 z-[1000] text-xs bg-white/90 hover:bg-white border rounded px-2 py-1 shadow"
            >
              view larger map
            </a>
          )}

          <div ref={mapRef} className="h-[520px] w-full" />

          {/* Overlays */}
          {coords && (
            <div className="absolute right-2 top-2 z-[1000] flex flex-col gap-1 items-end">
              <div className="bg-white/90 border rounded px-2 py-1 text-xs shadow">
                You: {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
              </div>
              <div className="bg-white/90 border rounded px-2 py-1 text-xs shadow">
                Radius: ~{km} km
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching city‑wide for dermatologists…
            </div>
          ) : error ? (
            <div className="text-destructive text-sm">{error}</div>
          ) : places.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No clinics found even after city‑wide search. Try zooming out or moving the map.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Showing {places.length} locations within about {km} km. Your current location marker remains visible.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default NearbyDermatologists;