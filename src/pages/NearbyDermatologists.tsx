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

// Your custom Google-style pin for the USER location (add a PNG to this path)
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

// Read keys from .env (frontend-safe). Ensure Places + Maps Embed APIs are enabled and key is referrer-restricted.
const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
const GOOGLE_EMBED_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined) || GOOGLE_PLACES_KEY;

// Radius in meters
const SEARCH_RADIUS = 15000; // 15 km

const NearbyDermatologists = () => {
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);

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
      setLoading(false);
      return;
    }

    const geoSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lon: longitude });
      initMap(latitude, longitude);
    };

    const geoError = () => {
      toast.error("Location access denied or unavailable.");
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(geoSuccess, geoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 12_000,
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMarkers = (places: PlaceItem[]) => {
    if (!mapInstance.current) return;

    // Clear previous markers
    const existing = (mapInstance.current as any).__dermMarkers;
    if (existing) {
      existing.forEach((m: L.Marker) => mapInstance.current!.removeLayer(m));
    }

    const markers: L.Marker[] = [];
    places.forEach((p) => {
      const m = L.marker([p.lat, p.lon]).addTo(mapInstance.current!);
      const srcTag = p.source === "google" ? "Google" : "OSM";
      const phone = p.phone ? `<br/>📞 ${p.phone}` : "";
      m.bindPopup(
        `<strong>${p.name}</strong><br/>${p.address}${phone}<br/><em>Source: ${srcTag}</em>`
      );
      markers.push(m);
    });

    (mapInstance.current as any).__dermMarkers = markers;
  };

  // Haversine (meters) for possible dedupe
  const distM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const c = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.sqrt(c));
  };

  const dedupePlaces = (items: PlaceItem[]) => {
    const out: PlaceItem[] = [];
    for (const p of items) {
      const nameKey = p.name.trim().toLowerCase();
      const dup = out.find(
        (q) => q.name.trim().toLowerCase() === nameKey && distM(p, q) < 80
      );
      if (!dup) out.push(p);
    }
    return out;
  };

  // Google Places v1 Nearby Search (with phone + maps URL via FieldMask)
  const fetchPlacesV1Nearby = async (lat: number, lon: number): Promise<PlaceItem[]> => {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const url = "https://places.googleapis.com/v1/places:searchNearby";
      const body = {
        includedTypes: ["doctor"],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: SEARCH_RADIUS,
          },
        },
        languageCode: "en",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask":
            [
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

  // Google Places v1 Text Search
  const fetchPlacesV1Text = async (lat: number, lon: number): Promise<PlaceItem[]> => {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const url = "https://places.googleapis.com/v1/places:searchText";
      const body = {
        textQuery: "dermatologist",
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: SEARCH_RADIUS,
          },
        },
        languageCode: "en",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask":
            [
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
          const nm = pl.displayName?.text || "Dermatology";
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

      return places;
    } catch {
      return [];
    }
  };

  // Legacy Nearby Search (no phone unless you call details per result; we skip for perf)
  const fetchPlacesLegacy = async (lat: number, lon: number): Promise<PlaceItem[]> => {
    if (!GOOGLE_PLACES_KEY) return [];
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${lat},${lon}` +
        `&radius=${SEARCH_RADIUS}` +
        `&type=doctor` +
        `&keyword=dermatologist` +
        `&key=${GOOGLE_PLACES_KEY}`;

      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();

      const places = (data.results ?? [])
        .map((r: any): PlaceItem | null => {
          const loc = r.geometry?.location;
          const nm = r.name || "Dermatology clinic";
          if (!loc?.lat || !loc?.lng) return null;
          return {
            id: r.place_id || `${loc.lat}_${loc.lng}_${nm}`,
            name: nm,
            lat: loc.lat,
            lon: loc.lng,
            address: r.vicinity || r.formatted_address || "Address not available",
            source: "google",
            mapsUrl: r.place_id
              ? `https://www.google.com/maps/search/?api=1&query_place_id=${r.place_id}`
              : `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`,
            rating: typeof r.rating === "number" ? r.rating : undefined,
            userRatingCount: typeof r.user_ratings_total === "number" ? r.user_ratings_total : undefined,
          };
        })
        .filter(Boolean) as PlaceItem[];

      return places;
    } catch {
      return [];
    }
  };

  // Overpass fallback (OSM)
  const fetchOverpass = async (lat: number, lon: number): Promise<PlaceItem[]> => {
    const query = `
[out:json][timeout:25];
(
  node(around:${SEARCH_RADIUS},${lat},${lon})["healthcare"="dermatologist"];
  node(around:${SEARCH_RADIUS},${lat},${lon})["healthcare"="clinic"]["medical_specialty"="dermatology"];
  node(around:${SEARCH_RADIUS},${lat},${lon})["amenity"="doctors"]["specialty"="dermatology"];
  node(around:${SEARCH_RADIUS},${lat},${lon})[name~"dermat|skin|derm",i];
  way(around:${SEARCH_RADIUS},${lat},${lon})[name~"dermat|skin|derm",i];
  relation(around:${SEARCH_RADIUS},${lat},${lon})[name~"dermat|skin|derm",i];
);
out center;`.trim();

    try {
      const res = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      );
      if (!res.ok) return [];

      const data = await res.json();
      const elements = data?.elements ?? [];

      const places = elements
        .map((el: any) => {
          const plat = el.lat ?? el.center?.lat ?? el.bounds?.minlat;
          const plon = el.lon ?? el.center?.lon ?? el.bounds?.minlon;
          if (!plat || !plon) return null;

          const addr =
            el.tags?.["addr:full"] ||
            [el.tags?.["addr:housenumber"], el.tags?.["addr:street"], el.tags?.["addr:city"]]
              .filter(Boolean)
              .join(" ") ||
            "Address not available";

          return {
            id: String(el.id),
            name: el.tags?.name || "Unnamed Clinic",
            lat: plat,
            lon: plon,
            address: addr,
            source: "osm",
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${plat},${plon}`,
          } as PlaceItem;
        })
        .filter(Boolean) as PlaceItem[];

      return places;
    } catch {
      return [];
    }
  };

  const initMap = async (lat: number, lon: number) => {
    try {
      if (!mapRef.current) {
        setLoading(false);
        return;
      }

      if (!mapInstance.current) {
        // Create map
        mapInstance.current = L.map(mapRef.current, {
          attributionControl: true,
          zoomControl: true,
        }).setView([lat, lon], 13);

        // Remove Leaflet prefix; keep OSM attribution (required)
        mapInstance.current.attributionControl?.setPrefix?.("");

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapInstance.current);
      } else {
        mapInstance.current.setView([lat, lon], 13);
      }

      // Add user marker with Google-style pin
      const userMarker = L.marker([lat, lon], { icon: userIcon });
      userMarker.bindPopup("You are here").openPopup();
      userMarker.addTo(mapInstance.current);

      let places: PlaceItem[] = [];

      if (GOOGLE_PLACES_KEY) {
        const p1 = await fetchPlacesV1Nearby(lat, lon);
        places.push(...p1);
      }
      if (places.length < 10 && GOOGLE_PLACES_KEY) {
        const p2 = await fetchPlacesV1Text(lat, lon);
        places.push(...p2);
      }
      if (places.length < 10 && GOOGLE_PLACES_KEY) {
        const p3 = await fetchPlacesLegacy(lat, lon);
        places.push(...p3);
      }
      if (places.length < 8) {
        const p4 = await fetchOverpass(lat, lon);
        places.push(...p4);
      }

      let deduped = dedupePlaces(places);
      const dermFirst = deduped
        .filter((p) => /derm|skin/i.test(p.name))
        .concat(deduped.filter((p) => !/derm|skin/i.test(p.name)));
      deduped = dermFirst;

      // Even if empty, we can still show Embed map as a UX fallback
      if (!deduped.length) {
        if (GOOGLE_EMBED_KEY) {
          setUseEmbedFallback(true);
        } else {
          setUseEmbedFallback(false);
        }
        setLoading(false);
        return;
      }

      setUseEmbedFallback(false);
      addMarkers(deduped);
      setLoading(false);
    } catch (err) {
      console.error("Error initializing map:", err);
      if (GOOGLE_EMBED_KEY && coords) setUseEmbedFallback(true);
      setLoading(false);
    }
  };

  const embedSrc =
    useEmbedFallback && coords && GOOGLE_EMBED_KEY
      ? `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(
          GOOGLE_EMBED_KEY
        )}&q=${encodeURIComponent("dermatologist")}&center=${coords.lat},${coords.lon}&zoom=14`
      : null;

  return (
    <AppLayout>
      <div className="py-10 max-w-6xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="text-primary" /> Nearby Dermatologists
        </h1>
        <p className="text-muted-foreground">
          Find dermatologists and skin care clinics near your current location.
        </p>

        {/* Map (Leaflet or Embed fallback) */}
        {useEmbedFallback && embedSrc ? (
          <div className="w-full rounded-lg border shadow-sm overflow-hidden">
            <iframe
              title="Dermatologists near me"
              src={embedSrc}
              width="100%"
              height="420"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ border: 0, display: "block" }}
              allowFullScreen
            />
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-[420px] rounded-lg border shadow-sm overflow-hidden" />
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        )}

        {/* Clean page: no "Nearby Clinics" container/list below the map */}
        {!loading && useEmbedFallback && (
          <div className="text-center text-muted-foreground">
            Showing Google results near your location. Use the map to explore.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default NearbyDermatologists;