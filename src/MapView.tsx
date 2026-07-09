import MapGL, { Layer, Source, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAP_STYLE = {
  version: 8,
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

type MapViewProps = {
  geojson?: GeoJSON.GeoJSON;
  textGeojson?: GeoJSON.GeoJSON;
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

const MapView = ({ geojson, textGeojson }: MapViewProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [popup, setPopup] = useState<{
    x: number;
    y: number;
    features: GeoJSON.Feature[];
  } | null>(null);
  const { map } = useMap();
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  const fullBounds = useMemo(() => {
    return computeBounds(geojson) || computeBounds(textGeojson);
  }, [geojson, textGeojson]);

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    if (!instance) return;
    mapInstanceRef.current = instance;

    if (fullBounds) {
      instance.fitBounds(fullBounds, { padding: 50 });
    }
  }, [map, fullBounds]);

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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <input
        type="text"
        placeholder="Search..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1,
          padding: '8px 12px',
          width: 250,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
      />
      <MapGL
        initialViewState={{
          longitude: 124.941804,
          latitude: 10.076847,
          zoom: 12,
        }}
        style={{ width: '100vw', height: '100vh' }}
        mapStyle={MAP_STYLE}
        onMouseMove={(e) => {
          const instance = map?.getMap();
          if (!instance) return;
          const features = instance.queryRenderedFeatures(e.point, {
            layers: ['geojson-fill', 'geojson-line', 'text-marker'],
          });
          const container = instance.getContainer();
          if (features.length > 0) {
            container.style.cursor = 'pointer';
          } else {
            container.style.cursor = 'grab';
          }
        }}
        onClick={(e) => {
          const instance = map?.getMap();
          if (!instance) return;
          let features = instance.queryRenderedFeatures(e.point, {
            layers: ['geojson-fill', 'geojson-line', 'text-marker'],
          });
          console.log('click filtered', features.length);
          if (features.length === 0) {
            features = instance.queryRenderedFeatures(e.point);
            console.log(
              'click all',
              features.length,
              features.map((f) => (f as GeoJSON.Feature).layer?.id),
            );
          }
          if (features.length > 0) {
            const feature = features[0] as GeoJSON.Feature;
            const bounds = getFeatureBounds(feature);
            if (bounds) {
              instance.fitBounds(bounds, { padding: 100, maxZoom: 18 });
            }
            setPopup({
              x: e.point.x,
              y: e.point.y,
              features: features as GeoJSON.Feature[],
            });
          } else {
            setPopup(null);
          }
        }}
      >
        <Source id="geojson-data" type="geojson" data={geojson}>
          <Layer
            id="geojson-fill"
            type="fill"
            paint={{
              'fill-color': '#0080ff',
              'fill-opacity': 0.2,
            }}
          />
          <Layer
            id="geojson-line"
            type="line"
            paint={{
              'line-color': '#0066cc',
              'line-width': 2,
            }}
          />
        </Source>
        {filteredTextGeojson && (
          <Source id="text-data" type="geojson" data={filteredTextGeojson}>
            <Layer
              id="text-marker"
              type="circle"
              paint={{
                'circle-radius': 20,
                'circle-color': '#ff4444',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
              }}
            />
            <Layer
              id="text-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'text'],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
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
      </MapGL>
      {popup && (
        <div
          style={{
            position: 'absolute',
            left: popup.x + 10,
            top: popup.y - 10,
            zIndex: 2,
            backgroundColor: 'white',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '8px',
            maxWidth: 250,
            maxHeight: 200,
            overflow: 'auto',
            fontSize: 12,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {popup.features.map((f) => (
            <div
              key={f.properties.fid ?? Math.random()}
              style={{ marginBottom: 4 }}
            >
              {Object.entries(f.properties || {})
                .filter(([k]) => k !== 'ext')
                .map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapView;
