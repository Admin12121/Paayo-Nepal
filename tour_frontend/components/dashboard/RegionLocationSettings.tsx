"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DISTRICTS_BY_PROVINCE,
  type LngLatTuple,
  NEPAL_DEFAULT_CENTER,
  NEPAL_PROVINCES,
  PROVINCE_CENTER,
  type RegionMapMode,
  deriveCoordinatesFromRegionLocation,
} from "@/lib/region-location";
import { Layers3, LocateFixed, Pencil, Trash2, Undo2 } from "lucide-react";

type RegionLocationSettingsProps = {
  province: string;
  onProvinceChange: (value: string) => void;
  selectedDistricts: string[];
  onSelectedDistrictsChange: (value: string[]) => void;
  mapMode: RegionMapMode;
  onMapModeChange: (value: RegionMapMode) => void;
  marker: LngLatTuple | null;
  onMarkerChange: (value: LngLatTuple | null) => void;
  polygon: LngLatTuple[];
  onPolygonChange: (value: LngLatTuple[]) => void;
};

type ViewportState = {
  center: LngLatTuple;
  zoom: number;
  bearing: number;
  pitch: number;
};

const DEFAULT_VIEWPORT: ViewportState = {
  center: NEPAL_DEFAULT_CENTER,
  zoom: 6.6,
  bearing: 0,
  pitch: 0,
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

const toFeatureCollection = (polygon: LngLatTuple[]): MapFeatureCollection => {
  const features: MapFeatureCollection["features"] = [];
  if (polygon.length >= 2) {
    features.push({
      type: "Feature",
      properties: {
        kind: "line",
      },
      geometry: {
        type: "LineString",
        coordinates: polygon,
      },
    });
  }

  if (polygon.length >= 3) {
    features.push({
      type: "Feature",
      properties: {
        kind: "polygon",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...polygon, polygon[0]]],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

function RegionMapAreaLayer({ polygon }: { polygon: LngLatTuple[] }) {
  const { map, isLoaded } = useMap();
  const instanceId = useId().replace(/:/g, "");
  const idsRef = useRef({
    sourceId: `region-area-source-${instanceId}`,
    fillId: `region-area-fill-${instanceId}`,
    lineId: `region-area-line-${instanceId}`,
  });

  useEffect(() => {
    if (!map || !isLoaded) return;

    const { sourceId, fillId, lineId } = idsRef.current;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: toFeatureCollection([]),
      });
    }

    if (!map.getLayer(fillId)) {
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.18,
        },
      });
    }

    if (!map.getLayer(lineId)) {
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#1d4ed8",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    }

    return () => {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
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

function RegionMapClickCapture({
  onMapClick,
}: {
  onMapClick: (point: LngLatTuple) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handler = (event: maplibregl.MapMouseEvent) => {
      onMapClick([event.lngLat.lng, event.lngLat.lat]);
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, isLoaded, onMapClick]);

  return null;
}

export default function RegionLocationSettings({
  province,
  onProvinceChange,
  selectedDistricts,
  onSelectedDistrictsChange,
  mapMode,
  onMapModeChange,
  marker,
  onMarkerChange,
  polygon,
  onPolygonChange,
}: RegionLocationSettingsProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    ...DEFAULT_VIEWPORT,
    center: marker || NEPAL_DEFAULT_CENTER,
    zoom: marker ? 8.8 : DEFAULT_VIEWPORT.zoom,
  }));

  const provinceKey = useMemo(
    () => NEPAL_PROVINCES.find((item) => item === province),
    [province],
  );

  const districtOptions = useMemo(
    () => (provinceKey ? DISTRICTS_BY_PROVINCE[provinceKey] : []),
    [provinceKey],
  );

  const derivedCoordinates = useMemo(
    () => deriveCoordinatesFromRegionLocation(marker, polygon),
    [marker, polygon],
  );

  const handleProvinceSelect = (nextProvince: string) => {
    onProvinceChange(nextProvince);
    const key = NEPAL_PROVINCES.find((item) => item === nextProvince);
    if (!key) {
      onSelectedDistrictsChange([]);
      return;
    }
    const allowed = new Set(DISTRICTS_BY_PROVINCE[key]);
    onSelectedDistrictsChange(
      selectedDistricts.filter((district) => allowed.has(district)),
    );

    if (!marker && polygon.length === 0) {
      const provinceCenter = PROVINCE_CENTER[key] ?? NEPAL_DEFAULT_CENTER;
      setViewport((current) => ({
        ...current,
        center: provinceCenter,
        zoom: 7.3,
      }));
    }
  };

  const toggleDistrict = (district: string) => {
    if (selectedDistricts.includes(district)) {
      onSelectedDistrictsChange(
        selectedDistricts.filter((item) => item !== district),
      );
      return;
    }
    onSelectedDistrictsChange([...selectedDistricts, district]);
  };

  const handleMapClick = useCallback(
    (point: LngLatTuple) => {
      if (mapMode === "custom" && isDrawing) {
        onPolygonChange([...polygon, point]);
        if (!marker) {
          onMarkerChange(point);
        }
        return;
      }
      onMarkerChange(point);
    },
    [mapMode, isDrawing, onMarkerChange, onPolygonChange, polygon, marker],
  );

  const handleUndoPoint = () => {
    if (polygon.length === 0) return;
    onPolygonChange(polygon.slice(0, -1));
  };

  const handleClearArea = () => {
    onPolygonChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Province
        </label>
        <select
          value={province}
          onChange={(event) => handleProvinceSelect(event.target.value)}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 shadow-sm outline-none focus:border-blue-300"
        >
          <option value="">Select province...</option>
          {NEPAL_PROVINCES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Districts
          </label>
          <span className="text-[11px] text-gray-400">
            {selectedDistricts.length} selected
          </span>
        </div>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
          {districtOptions.length === 0 ? (
            <p className="px-1 py-2 text-[12px] text-gray-400">
              Select a province first.
            </p>
          ) : (
            districtOptions.map((district) => {
              const checked = selectedDistricts.includes(district);
              return (
                <button
                  key={district}
                  type="button"
                  onClick={() => toggleDistrict(district)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                    checked
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100",
                  )}
                >
                  <span>{district}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border",
                      checked
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-300 bg-white",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Location Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant={mapMode === "districts" ? "default" : "outline"}
            onClick={() => {
              onMapModeChange("districts");
              setIsDrawing(false);
            }}
            className="h-9 text-[12px]"
          >
            <Layers3 className="size-3.5" />
            Districts
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mapMode === "custom" ? "default" : "outline"}
            onClick={() => onMapModeChange("custom")}
            className="h-9 text-[12px]"
          >
            <Pencil className="size-3.5" />
            Custom Area
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
          <p className="text-[12px] font-medium text-gray-700">Region Map</p>
          <div className="flex items-center gap-1">
            {mapMode === "custom" && (
              <>
                <Button
                  type="button"
                  size="icon-xs"
                  variant={isDrawing ? "default" : "outline"}
                  onClick={() => setIsDrawing((current) => !current)}
                  title={isDrawing ? "Stop drawing" : "Start drawing"}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={handleUndoPoint}
                  disabled={polygon.length === 0}
                  title="Undo point"
                >
                  <Undo2 className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={handleClearArea}
                  disabled={polygon.length === 0}
                  title="Clear area"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              onClick={() => {
                onMarkerChange(null);
                onPolygonChange([]);
              }}
              title="Reset location"
            >
              <LocateFixed className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="relative h-56 w-full">
          <Map viewport={viewport} onViewportChange={setViewport}>
            <MapControls
              position="bottom-right"
              showZoom
              showCompass
              showLocate
              showFullscreen
            />
            <RegionMapClickCapture onMapClick={handleMapClick} />
            <RegionMapAreaLayer polygon={polygon} />
            {marker && (
              <MapMarker
                longitude={marker[0]}
                latitude={marker[1]}
                draggable
                onDragEnd={(lngLat) => onMarkerChange([lngLat.lng, lngLat.lat])}
              >
                <MarkerContent>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                </MarkerContent>
              </MapMarker>
            )}
          </Map>
        </div>

        <div className="space-y-1 border-t border-gray-100 px-3 py-2">
          <p className="text-[11px] text-gray-500">
            {mapMode === "custom" && isDrawing
              ? "Drawing mode is active. Click on the map to add boundary points."
              : "Click the map to set region location. Drag the pin to adjust."}
          </p>
          <p className="text-[11px] text-gray-400">
            Coordinates:{" "}
            {derivedCoordinates.latitude !== null &&
            derivedCoordinates.longitude !== null
              ? `${derivedCoordinates.latitude.toFixed(5)}, ${derivedCoordinates.longitude.toFixed(5)}`
              : "not set"}
          </p>
        </div>
      </div>
    </div>
  );
}
