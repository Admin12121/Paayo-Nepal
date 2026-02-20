"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import {
  NEPAL_DEFAULT_CENTER,
  PROVINCE_CENTER,
  normalizeRegionLocation,
  type LngLatTuple,
} from "@/lib/region-location";

type RegionMapPreviewProps = {
  mapData: unknown;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
};

type DistrictBoundaryFeature = {
  type: "Feature";
  properties: {
    DISTRICT: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

type DistrictBoundaryCollection = {
  type: "FeatureCollection";
  features: DistrictBoundaryFeature[];
};

type MapFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, string>;
    geometry:
      | {
          type: "LineString";
          coordinates: LngLatTuple[];
        }
      | {
          type: "Polygon";
          coordinates: LngLatTuple[][];
        };
  }>;
};

const DISTRICT_NAME_ALIASES: Record<string, string> = {
  TERHATHUM: "TEHRATHUM",
  DHANUSHA: "DHANUSA",
  KAVREPALANCHOK: "KAVREPALANCHOWK",
  TANAHUN: "TANAHU",
  "RUKUM EAST": "EASTERN RUKUM",
  "RUKUM WEST": "WESTERN RUKUM",
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "(c) OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const normalizeDistrictName = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, " ");

const canonicalDistrictName = (value: string) => {
  const normalized = normalizeDistrictName(value);
  return DISTRICT_NAME_ALIASES[normalized] ?? normalized;
};

const zoomFromSpan = (span: number) => {
  if (span <= 0.08) return 11.6;
  if (span <= 0.2) return 10.8;
  if (span <= 0.35) return 10.2;
  if (span <= 0.6) return 9.5;
  if (span <= 1.2) return 8.7;
  if (span <= 2.2) return 7.9;
  return 7.1;
};

const polygonCenter = (polygon: LngLatTuple[]): LngLatTuple | null => {
  if (polygon.length === 0) return null;
  const total = polygon.reduce(
    (acc, point) => {
      acc.lng += point[0];
      acc.lat += point[1];
      return acc;
    },
    { lng: 0, lat: 0 },
  );
  return [total.lng / polygon.length, total.lat / polygon.length];
};

const polygonSpan = (polygon: LngLatTuple[]): number => {
  if (polygon.length < 2) return 0;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of polygon) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  return Math.max(maxLng - minLng, maxLat - minLat);
};

const toFeatureCollection = (polygon: LngLatTuple[]): MapFeatureCollection => {
  const features: MapFeatureCollection["features"] = [];
  if (polygon.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "line" },
      geometry: { type: "LineString", coordinates: polygon },
    });
  }

  if (polygon.length >= 3) {
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    const closedPolygon =
      first[0] === last[0] && first[1] === last[1]
        ? polygon
        : [...polygon, first];

    features.push({
      type: "Feature",
      properties: { kind: "polygon" },
      geometry: { type: "Polygon", coordinates: [closedPolygon] },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

function DistrictLayer({ boundaries }: { boundaries: DistrictBoundaryFeature[] }) {
  const { map, isLoaded } = useMap();
  const instanceId = useId().replace(/:/g, "");
  const idsRef = useRef({
    sourceId: `region-preview-district-source-${instanceId}`,
    fillId: `region-preview-district-fill-${instanceId}`,
    lineId: `region-preview-district-line-${instanceId}`,
  });

  const collection = useMemo<DistrictBoundaryCollection>(
    () => ({
      type: "FeatureCollection",
      features: boundaries,
    }),
    [boundaries],
  );

  useEffect(() => {
    if (!map || !isLoaded) return;
    const mapInstance = map;
    const { sourceId, fillId, lineId } = idsRef.current;

    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: collection,
      });
    }

    if (!mapInstance.getLayer(fillId)) {
      mapInstance.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#1d4ed8",
          "fill-opacity": 0.15,
        },
      });
    }

    if (!mapInstance.getLayer(lineId)) {
      mapInstance.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#1e3a8a",
          "line-width": 1.8,
        },
      });
    }

    return () => {
      try {
        if (mapInstance.getLayer(fillId)) mapInstance.removeLayer(fillId);
        if (mapInstance.getLayer(lineId)) mapInstance.removeLayer(lineId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      } catch {
        // map already disposed
      }
    };
  }, [map, isLoaded, collection]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(idsRef.current.sourceId) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(collection);
  }, [map, isLoaded, collection]);

  return null;
}

function AreaLayer({ polygon }: { polygon: LngLatTuple[] }) {
  const { map, isLoaded } = useMap();
  const instanceId = useId().replace(/:/g, "");
  const idsRef = useRef({
    sourceId: `region-preview-area-source-${instanceId}`,
    fillId: `region-preview-area-fill-${instanceId}`,
    lineId: `region-preview-area-line-${instanceId}`,
  });

  useEffect(() => {
    if (!map || !isLoaded) return;
    const mapInstance = map;
    const { sourceId, fillId, lineId } = idsRef.current;

    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: toFeatureCollection([]),
      });
    }

    if (!mapInstance.getLayer(fillId)) {
      mapInstance.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#1d4ed8",
          "fill-opacity": 0.2,
        },
      });
    }

    if (!mapInstance.getLayer(lineId)) {
      mapInstance.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#1e3a8a",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    }

    return () => {
      try {
        if (mapInstance.getLayer(fillId)) mapInstance.removeLayer(fillId);
        if (mapInstance.getLayer(lineId)) mapInstance.removeLayer(lineId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      } catch {
        // map already disposed
      }
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(idsRef.current.sourceId) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(toFeatureCollection(polygon));
  }, [map, isLoaded, polygon]);

  return null;
}

export function RegionMapPreview({
  mapData,
  province,
  district,
  latitude,
  longitude,
  className,
}: RegionMapPreviewProps) {
  const location = useMemo(
    () => normalizeRegionLocation(mapData, district, longitude, latitude),
    [mapData, district, longitude, latitude],
  );

  const [districtBoundaries, setDistrictBoundaries] =
    useState<DistrictBoundaryCollection | null>(null);

  useEffect(() => {
    if (location.selectedDistricts.length === 0) {
      setDistrictBoundaries(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchBoundaries = async () => {
      try {
        const response = await fetch("/data/nepal-districts.geojson", {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as DistrictBoundaryCollection;
        if (!active || payload.type !== "FeatureCollection") return;
        setDistrictBoundaries(payload);
      } catch {
        if (!active) return;
        setDistrictBoundaries(null);
      }
    };

    void fetchBoundaries();

    return () => {
      active = false;
      controller.abort();
    };
  }, [location.selectedDistricts]);

  const selectedDistrictBoundaries = useMemo(() => {
    if (!districtBoundaries || location.selectedDistricts.length === 0) return [];
    const selectedNames = new Set(
      location.selectedDistricts.map((item) => canonicalDistrictName(item)),
    );
    return districtBoundaries.features.filter((feature) =>
      selectedNames.has(canonicalDistrictName(feature.properties.DISTRICT)),
    );
  }, [districtBoundaries, location.selectedDistricts]);

  const fallbackProvinceCenter = useMemo(() => {
    if (!province) return NEPAL_DEFAULT_CENTER;
    return PROVINCE_CENTER[province as keyof typeof PROVINCE_CENTER] ?? NEPAL_DEFAULT_CENTER;
  }, [province]);

  const derivedPolygonCenter = polygonCenter(location.polygon);
  const center = location.marker ?? derivedPolygonCenter ?? fallbackProvinceCenter;
  const zoom = location.marker
    ? 9.2
    : location.polygon.length >= 3
      ? zoomFromSpan(polygonSpan(location.polygon))
      : selectedDistrictBoundaries.length > 0
        ? 8.1
        : 7.2;

  return (
    <div className={className}>
      <Map
        theme="light"
        styles={{ light: OSM_STYLE, dark: OSM_STYLE }}
        center={center}
        zoom={zoom}
        pitch={0}
        bearing={0}
      >
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showLocate={false}
          showFullscreen={false}
        />
        {selectedDistrictBoundaries.length > 0 ? (
          <DistrictLayer boundaries={selectedDistrictBoundaries} />
        ) : null}
        {location.polygon.length > 0 ? (
          <AreaLayer polygon={location.polygon} />
        ) : null}
        {location.marker ? (
          <MapMarker longitude={location.marker[0]} latitude={location.marker[1]}>
            <MarkerContent>
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow">
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
            </MarkerContent>
          </MapMarker>
        ) : null}
      </Map>
    </div>
  );
}

