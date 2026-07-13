import MapGL, { Layer, type MapRef, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-compass-pro/dist/style.css';
import { Compass } from 'maplibre-compass-pro';
import type { GeoJSONFeature, StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

const LIGHT_STYLE = {
  version: 8 as const,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    'carto-tiles': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f2efe9' },
    },
    {
      id: 'carto-tiles-layer',
      type: 'raster',
      source: 'carto-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const MAPTILER_SATELLITE_STYLE = {
  version: 8 as const,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    'maptiler-tiles': {
      type: 'raster',
      tiles: [
        'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=' +
          import.meta.env.PUBLIC_MAPTILER_API_KEY,
      ],
      tileSize: 256,
      attribution: '© MapTiler © OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'maptiler-tiles-layer',
      type: 'raster',
      source: 'maptiler-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

type MapViewProps = {
  geojson: GeoJSON.FeatureCollection;
  textGeojson: GeoJSON.FeatureCollection;
};

function getFeatureBounds(
  feature: GeoJSON.Feature,
): [number, number, number, number] | null {
  const coords: number[][] = [];
  const collect = (geom: GeoJSON.Geometry) => {
    if (!geom) return;
    switch (geom.type) {
      case 'Point':
        coords.push(geom.coordinates as number[]);
        break;
      case 'MultiPoint':
        coords.push(...(geom.coordinates as number[][]));
        break;
      case 'LineString':
        coords.push(...(geom.coordinates as number[][]));
        break;
      case 'MultiLineString':
        for (const line of geom.coordinates as number[][][]) {
          coords.push(...line);
        }
        break;
      case 'Polygon':
        for (const ring of geom.coordinates as number[][][]) {
          coords.push(...ring);
        }
        break;
      case 'MultiPolygon':
        for (const poly of geom.coordinates as number[][][][]) {
          for (const ring of poly) {
            coords.push(...ring);
          }
        }
        break;
      case 'GeometryCollection':
        geom.geometries.forEach(collect);
        break;
    }
  };
  collect(feature.geometry);
  if (coords.length === 0) return null;
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function matches(feature: GeoJSON.Feature, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  for (const v of Object.values(feature.properties || {})) {
    if (String(v).toLowerCase().includes(lower)) return true;
  }
  return false;
}

function computeBounds(
  fc: GeoJSON.FeatureCollection | undefined,
): [number, number, number, number] | null {
  if (!fc) return null;
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  let found = false;
  for (const f of fc.features) {
    const b = getFeatureBounds(f);
    if (b) {
      found = true;
      if (b[0] < minLon) minLon = b[0];
      if (b[1] < minLat) minLat = b[1];
      if (b[2] > maxLon) maxLon = b[2];
      if (b[3] > maxLat) maxLat = b[3];
    }
  }
  return found ? [minLon, minLat, maxLon, maxLat] : null;
}

function findNearestFeature(
  features: GeoJSON.Feature[],
  lon: number,
  lat: number,
): GeoJSON.Feature | null {
  let best: GeoJSON.Feature | null = null;
  let bestDist = Infinity;
  for (const f of features) {
    const b = getFeatureBounds(f);
    if (!b) continue;
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const d = (cx - lon) ** 2 + (cy - lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

function computeLineDirection(
  geom: GeoJSON.MultiLineString,
): 'N' | 'S' | 'E' | 'W' | null {
  const lines = geom.coordinates;
  if (!lines.length) return null;

  let maxLen = -Infinity;
  let bestBearing = 0;

  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const dx = line[i][0] - line[i - 1][0];
      const dy = line[i][1] - line[i - 1][1];
      const len = dx * dx + dy * dy;
      if (len > maxLen) {
        maxLen = len;
        const dLon = (dx * Math.PI) / 180;
        const lat1 = (line[i - 1][1] * Math.PI) / 180;
        const lat2 = (line[i][1] * Math.PI) / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x =
          Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        bestBearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      }
    }
  }

  if (maxLen <= 0) return null;

  if (bestBearing >= 315 || bestBearing < 45) return 'N';
  if (bestBearing >= 45 && bestBearing < 135) return 'E';
  if (bestBearing >= 135 && bestBearing < 225) return 'S';
  return 'W';
}

const MapView = ({ geojson, textGeojson }: MapViewProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFid, setSelectedFid] = useState<number | null>(null);
  const [highlightGeoFid, setHighlightGeoFid] = useState<number | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const compassRef = useRef<Compass | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined'
      ? !window.matchMedia('(max-width: 1023px)').matches
      : true,
  );
  const [mapStyle, setMapStyle] = useState<'light' | 'maptiler-satellite'>(
    'light',
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMapLoad = () => {
    const instance = mapRef.current?.getMap();
    if (!instance || compassRef.current) return;
    compassRef.current = new Compass({
      size: 'md',
      displayDirection: true,
    });
    instance.addControl(compassRef.current, 'top-right');
  };

  const selectFeature = (feature: GeoJSON.Feature) => {
    const instance = mapRef.current?.getMap();
    const bounds = getFeatureBounds(feature);
    if (bounds) {
      instance?.fitBounds(bounds, { padding: 100, maxZoom: 18 });
    }

    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates as number[];
      const nearest = findNearestFeature(geojson.features, lon, lat);
      setHighlightGeoFid(
        typeof nearest?.properties?.fid === 'number'
          ? nearest.properties.fid
          : null,
      );
      setSelectedFid(
        typeof feature.properties?.fid === 'number'
          ? feature.properties.fid
          : null,
      );
      return;
    }

    setHighlightGeoFid(
      typeof feature.properties?.fid === 'number'
        ? feature.properties.fid
        : null,
    );
    if (bounds) {
      const cx = (bounds[0] + bounds[2]) / 2;
      const cy = (bounds[1] + bounds[3]) / 2;
      const nearestText = findNearestFeature(textGeojson.features, cx, cy);
      setSelectedFid(
        typeof nearestText?.properties?.fid === 'number'
          ? nearestText.properties.fid
          : null,
      );
    }
  };

  const clearSelection = () => {
    setSelectedFid(null);
    setHighlightGeoFid(null);
    setSearchInput('');
    setSearch('');
  };

  const fullBounds = useMemo(() => {
    return computeBounds(geojson) || computeBounds(textGeojson);
  }, [geojson, textGeojson]);

  const prevGeoFid = useRef<number | null>(null);

  useEffect(() => {
    const instance = mapRef.current?.getMap();
    if (!instance) return;
    if (prevGeoFid.current != null) {
      instance.setFeatureState(
        { source: 'geojson-data', id: prevGeoFid.current },
        { selected: false },
      );
    }
    if (highlightGeoFid != null) {
      instance.setFeatureState(
        { source: 'geojson-data', id: highlightGeoFid },
        { selected: true },
      );
    }
    prevGeoFid.current = highlightGeoFid;
  }, [highlightGeoFid]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredTextGeojson = useMemo(() => {
    if (!textGeojson || !search) return textGeojson;
    return {
      ...textGeojson,
      features: textGeojson.features.filter((f) => matches(f, search)),
    };
  }, [textGeojson, search]);

  const directionGeojson = useMemo(() => {
    if (!geojson) return null;
    return {
      type: 'FeatureCollection' as const,
      features: geojson.features
        .map((f) => {
          const dir = computeLineDirection(
            f.geometry as GeoJSON.MultiLineString,
          );
          if (!dir) return null;
          return {
            ...f,
            properties: {
              ...f.properties,
              direction: dir,
            },
          };
        })
        .filter(Boolean) as GeoJSON.Feature[],
    };
  }, [geojson]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setViewportH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const markerFeatures = useMemo(
    () => filteredTextGeojson?.features ?? [],
    [filteredTextGeojson],
  );
  const ITEM_HEIGHT = 56;
  const OVERSCAN = 6;
  const total = markerFeatures.length;
  const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const end = Math.min(
    total,
    Math.ceil((scrollTop + viewportH) / ITEM_HEIGHT) + OVERSCAN,
  );
  const visible = markerFeatures.slice(start, end);

  useEffect(() => {
    if (selectedFid == null) return;
    const idx = markerFeatures.findIndex(
      (f) => f.properties?.fid === selectedFid,
    );
    if (idx < 0) return;
    const el = listRef.current;
    if (!el) return;
    const top = idx * ITEM_HEIGHT;
    const bottom = top + ITEM_HEIGHT;
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTo({
        top: Math.max(0, top - el.clientHeight / 2 + ITEM_HEIGHT / 2),
        behavior: 'smooth',
      });
    }
  }, [selectedFid, markerFeatures]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden">
      <input
        type="text"
        placeholder="Search..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="absolute top-2.5 left-2.5 z-20 max-w-[calc(100%-1.25rem)] rounded border border-[#ccc] bg-white px-3 py-2 shadow sm:w-[250px]"
      />
      <select
        value={mapStyle}
        onChange={(e) =>
          setMapStyle(e.target.value as 'light' | 'maptiler-satellite')
        }
        className="absolute top-2.5 right-2.5 z-20 rounded bg-white/90 px-2 py-1 shadow text-xs font-medium sm:w-[250px] lg:left-2.5 lg:right-auto lg:top-14"
        aria-label="Map style"
      >
        <option value="light">Carto Map</option>
        <option value="maptiler-satellite">MapTiler Satellite</option>
      </select>
      <div className="absolute inset-0">
        <MapGL
          ref={mapRef}
          initialViewState={{
            longitude: 124.941804,
            latitude: 10.076847,
            zoom: 12,
          }}
          maxTileCacheSize={100_000_000}
          style={{ width: '100%', height: '100%' }}
          mapStyle={
            (mapStyle === 'light'
              ? LIGHT_STYLE
              : MAPTILER_SATELLITE_STYLE) as StyleSpecification
          }
          dragRotate={true}
          onLoad={handleMapLoad}
          onMouseMove={(e) => {
            const instance = mapRef.current?.getMap();
            if (!instance) return;
            const features = instance.queryRenderedFeatures(e.point, {
              layers: ['geojson-fill', 'geojson-line', 'text-label'],
            });
            instance.getContainer().style.cursor =
              features.length > 0 ? 'pointer' : 'grab';
          }}
          onClick={(e) => {
            const instance = mapRef.current?.getMap();
            if (!instance) return;
            const features = instance.queryRenderedFeatures(e.point, {
              layers: ['geojson-fill', 'geojson-line', 'text-label'],
            });
            if (features.length > 0) {
              selectFeature(features[0] as GeoJSONFeature);
            } else {
              clearSelection();
            }
          }}
        >
          <Source
            id="geojson-data"
            type="geojson"
            data={geojson}
            promoteId="fid"
          >
            <Layer
              id="geojson-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  '#ff8000',
                  '#0080ff',
                ],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  0.45,
                  0.2,
                ],
              }}
            />
            <Layer
              id="geojson-line"
              type="line"
              paint={{
                'line-color': [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  '#ff8000',
                  '#0066cc',
                ],
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  4,
                  2,
                ],
              }}
            />
          </Source>
          {filteredTextGeojson && (
            <Source id="text-data" type="geojson" data={filteredTextGeojson}>
              <Layer
                id="text-label"
                type="symbol"
                layout={{
                  'text-field': ['get', 'text'],
                  'text-font': [
                    'Open Sans Regular',
                    'Arial Unicode MS Regular',
                  ],
                  'text-size': 12,
                  'text-anchor': 'top',
                  'text-offset': [0, 0.8],
                }}
                paint={{
                  'text-color': '#000000',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1.5,
                }}
              />
            </Source>
          )}
          {directionGeojson && (
            <Source id="direction-data" type="geojson" data={directionGeojson}>
              <Layer
                id="direction-label"
                type="symbol"
                minzoom={16}
                layout={{
                  'text-field': ['get', 'direction'],
                  'text-font': [
                    'Open Sans Regular',
                    'Arial Unicode MS Regular',
                  ],
                  'text-size': 10,
                  'text-anchor': 'center',
                  'text-allow-overlap': false,
                }}
                paint={{
                  'text-color': '#666666',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1,
                }}
              />
            </Source>
          )}
        </MapGL>
      </div>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute z-20 rounded bg-white/90 px-2 py-1 shadow max-lg:bottom-4 max-lg:right-4 max-lg:text-sm lg:top-1/2 lg:right-4 lg:-translate-y-1/2 lg:text-base"
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}
      <aside
        className={`absolute z-10 flex flex-col bg-white/95 shadow-xl transition-transform duration-300 max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:h-[45%] max-lg:w-auto lg:right-0 lg:top-0 lg:h-full lg:w-80 ${
          sidebarOpen
            ? 'translate-y-0 max-lg:translate-y-0'
            : 'max-lg:translate-y-full lg:-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Markers ({total})</span>
          <div className="flex items-center gap-2">
            {selectedFid != null && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>
        </div>
        <div
          ref={listRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="flex-1 overflow-y-auto"
        >
          <div style={{ position: 'relative', height: total * ITEM_HEIGHT }}>
            {visible.map((f, i) => {
              const index = start + i;
              const isSelected = f.properties?.fid === selectedFid;
              return (
                <button
                  key={f.properties?.fid ?? index}
                  type="button"
                  onClick={() => selectFeature(f)}
                  style={{
                    position: 'absolute',
                    top: index * ITEM_HEIGHT,
                    height: ITEM_HEIGHT,
                  }}
                  className={`left-0 right-0 block border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-gray-100 ${
                    isSelected
                      ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                      : ''
                  }`}
                >
                  <div className="truncate font-medium text-gray-900">
                    {String(
                      f.properties?.text ?? f.properties?.name ?? 'Marker',
                    )}
                  </div>
                  <div className="truncate text-gray-500">
                    {Object.entries(f.properties ?? {})
                      .filter(
                        ([k]) => k !== 'ext' && k !== 'text' && k !== 'name',
                      )
                      .map(([k, v]) => `${k}: ${v}`)
                      .slice(0, 2)
                      .join('  ·  ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MapView;
