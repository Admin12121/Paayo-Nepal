export type LngLatTuple = [number, number];

export type RegionMapMode = "districts" | "custom";

type RegionMapFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type RegionMapPayload = {
  mode: RegionMapMode;
  selected_districts: string[];
  marker: { lng: number; lat: number } | null;
  custom_area: RegionMapFeature | null;
};

export const NEPAL_DEFAULT_CENTER: LngLatTuple = [84.124, 28.3949];

export const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
] as const;

export const DISTRICTS_BY_PROVINCE: Record<(typeof NEPAL_PROVINCES)[number], string[]> = {
  Koshi: [
    "Bhojpur",
    "Dhankuta",
    "Ilam",
    "Jhapa",
    "Khotang",
    "Morang",
    "Okhaldhunga",
    "Panchthar",
    "Sankhuwasabha",
    "Solukhumbu",
    "Sunsari",
    "Taplejung",
    "Terhathum",
    "Udayapur",
  ],
  Madhesh: [
    "Bara",
    "Dhanusha",
    "Mahottari",
    "Parsa",
    "Rautahat",
    "Saptari",
    "Sarlahi",
    "Siraha",
  ],
  Bagmati: [
    "Bhaktapur",
    "Chitwan",
    "Dhading",
    "Dolakha",
    "Kathmandu",
    "Kavrepalanchok",
    "Lalitpur",
    "Makwanpur",
    "Nuwakot",
    "Ramechhap",
    "Rasuwa",
    "Sindhuli",
    "Sindhupalchok",
  ],
  Gandaki: [
    "Baglung",
    "Gorkha",
    "Kaski",
    "Lamjung",
    "Manang",
    "Mustang",
    "Myagdi",
    "Nawalpur",
    "Parbat",
    "Syangja",
    "Tanahun",
  ],
  Lumbini: [
    "Arghakhanchi",
    "Banke",
    "Bardiya",
    "Dang",
    "Gulmi",
    "Kapilvastu",
    "Parasi",
    "Palpa",
    "Pyuthan",
    "Rolpa",
    "Rupandehi",
    "Rukum East",
  ],
  Karnali: [
    "Dailekh",
    "Dolpa",
    "Humla",
    "Jajarkot",
    "Jumla",
    "Kalikot",
    "Mugu",
    "Salyan",
    "Surkhet",
    "Rukum West",
  ],
  Sudurpashchim: [
    "Achham",
    "Baitadi",
    "Bajhang",
    "Bajura",
    "Dadeldhura",
    "Darchula",
    "Doti",
    "Kailali",
    "Kanchanpur",
  ],
};

export const PROVINCE_CENTER: Record<(typeof NEPAL_PROVINCES)[number], LngLatTuple> = {
  Koshi: [87.15, 27.35],
  Madhesh: [85.45, 26.95],
  Bagmati: [85.2, 27.75],
  Gandaki: [83.95, 28.3],
  Lumbini: [82.8, 27.7],
  Karnali: [82.0, 29.35],
  Sudurpashchim: [80.85, 29.2],
};

export type RegionLocationState = {
  mapMode: RegionMapMode;
  selectedDistricts: string[];
  marker: LngLatTuple | null;
  polygon: LngLatTuple[];
};

const isLngLatTuple = (value: unknown): value is LngLatTuple => {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const toClosedPolygon = (points: LngLatTuple[]): LngLatTuple[] => {
  if (points.length < 3) return [];
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return points;
  }
  return [...points, first];
};

const polygonFromUnknown = (value: unknown): LngLatTuple[] => {
  if (!value || typeof value !== "object") return [];
  const geometry = (value as { geometry?: unknown }).geometry;
  if (!geometry || typeof geometry !== "object") return [];
  const g = geometry as { type?: unknown; coordinates?: unknown };
  if (g.type !== "Polygon" || !Array.isArray(g.coordinates)) return [];
  const firstRing = g.coordinates[0];
  if (!Array.isArray(firstRing)) return [];

  const points = firstRing
    .filter(isLngLatTuple)
    .map((point) => [point[0], point[1]] as LngLatTuple);

  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      return points.slice(0, -1);
    }
  }

  return points;
};

export const deriveCoordinatesFromRegionLocation = (
  marker: LngLatTuple | null,
  polygon: LngLatTuple[],
): { latitude: number | null; longitude: number | null } => {
  if (marker) {
    return { longitude: marker[0], latitude: marker[1] };
  }

  if (polygon.length >= 3) {
    const sum = polygon.reduce(
      (acc, [lng, lat]) => {
        acc.lng += lng;
        acc.lat += lat;
        return acc;
      },
      { lng: 0, lat: 0 },
    );
    return {
      longitude: sum.lng / polygon.length,
      latitude: sum.lat / polygon.length,
    };
  }

  return { latitude: null, longitude: null };
};

export const buildRegionMapPayload = (
  location: RegionLocationState,
): RegionMapPayload | null => {
  const closedPolygon = toClosedPolygon(location.polygon);
  const hasDistricts = location.selectedDistricts.length > 0;
  const hasMarker = Boolean(location.marker);
  const hasArea = closedPolygon.length >= 4;

  if (!hasDistricts && !hasMarker && !hasArea) {
    return null;
  }

  return {
    mode: location.mapMode,
    selected_districts: location.selectedDistricts,
    marker: location.marker
      ? { lng: location.marker[0], lat: location.marker[1] }
      : null,
    custom_area:
      closedPolygon.length >= 4
        ? {
            type: "Feature",
            properties: {
              source: "dashboard-region-editor",
            },
            geometry: {
              type: "Polygon",
              coordinates: [closedPolygon],
            },
          }
        : null,
  };
};

export const normalizeRegionLocation = (
  mapData: unknown,
  fallbackDistrict: string | null | undefined,
  fallbackLongitude: number | null | undefined,
  fallbackLatitude: number | null | undefined,
): RegionLocationState => {
  const fallbackMarker =
    typeof fallbackLongitude === "number" && typeof fallbackLatitude === "number"
      ? ([fallbackLongitude, fallbackLatitude] as LngLatTuple)
      : null;

  if (!mapData || typeof mapData !== "object") {
    return {
      mapMode: "districts",
      selectedDistricts: fallbackDistrict ? [fallbackDistrict] : [],
      marker: fallbackMarker,
      polygon: [],
    };
  }

  const raw = mapData as {
    mode?: unknown;
    selected_districts?: unknown;
    marker?: unknown;
    custom_area?: unknown;
  };

  const markerRaw =
    raw.marker &&
    typeof raw.marker === "object" &&
    typeof (raw.marker as { lng?: unknown }).lng === "number" &&
    typeof (raw.marker as { lat?: unknown }).lat === "number"
      ? ([
          (raw.marker as { lng: number }).lng,
          (raw.marker as { lat: number }).lat,
        ] as LngLatTuple)
      : null;

  const mode = raw.mode === "custom" ? "custom" : "districts";
  const selectedDistricts = asStringArray(raw.selected_districts);

  return {
    mapMode: mode,
    selectedDistricts:
      selectedDistricts.length > 0
        ? selectedDistricts
        : fallbackDistrict
          ? [fallbackDistrict]
          : [],
    marker: markerRaw ?? fallbackMarker,
    polygon: polygonFromUnknown(raw.custom_area),
  };
};
